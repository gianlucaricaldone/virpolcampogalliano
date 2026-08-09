/**
 * Migrazione dei dati dal progetto vecchio al nuovo.
 *
 * Dry-run per default: legge, trasforma, scrive il report, non tocca il
 * database. Scrive solo con --esegui. Idempotente per chiavi naturali: ciò
 * che esiste già nel target si salta, mai si sovrascrive.
 *
 * Un run --esegui interrotto a metà NON si riprende rieseguendo sopra: si
 * azzera il target (npm run db:reset in locale; al cutover, un progetto
 * appena creato) e si riesegue da zero. L'idempotenza copre i run completati,
 * non i parziali: i pagamenti si generano solo per i tesseramenti creati
 * nello stesso run, e le presenze si giudicano già migrate dalla sola
 * presenza della seduta.
 *
 * Uso:
 *   npm run migra -- --quota 2024-25=350 --quota 2025-26=380
 *   npm run migra -- --esegui --quota 2024-25=350 --quota 2025-26=380
 *
 * Vedi docs/superpowers/specs/2026-08-09-migrazione-dati-design.md.
 */
import { writeFileSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import { parseArgs } from 'node:util'
import { passwordIniziale } from '@/lib/domain/password'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generaReport, type ContoTabella, type DatiReport } from '@/scripts/migrazione/report'
import {
  analizzaQuote,
  chiaveCognomeNome,
  chiavePersona,
  fondiTesseramenti,
  NOTA_RICOSTRUITO,
  raggruppaPresenze,
  ricostruisciPagamenti,
  trasformaStaff,
  trasformaStagione,
  trasformaTesserati,
} from '@/scripts/migrazione/trasforma'
import type {
  Anomalia,
  VecchiaPresenza,
  VecchiaSquadra,
  VecchiaStagione,
  VecchiDatiStagionali,
  VecchioTesseramentoSquadra,
  VecchioTesserato,
  VecchioUtente,
} from '@/scripts/migrazione/tipi'
import { leggiTutto } from '@/scripts/migrazione/vecchio'

try { loadEnvFile('.env.local') } catch { /* variabili già nell'ambiente */ }

const PERCORSO_REPORT = 'scripts/report-migrazione.md'

async function main() {
  const { values } = parseArgs({
    options: {
      esegui: { type: 'boolean', default: false },
      quota: { type: 'string', multiple: true, default: [] },
    },
  })
  const dryRun = !values.esegui
  const quotePerCodice = analizzaQuote(values.quota ?? [])

  const db = supabaseAdmin()
  const conteggi: Record<string, ContoTabella> = {}
  const anomalie: Anomalia[] = []
  const accountCreati: { email: string; password: string }[] = []

  // ---- Lettura completa dal vecchio --------------------------------------
  const vStagioni = await leggiTutto<VecchiaStagione>(
    'stagioni_sportive', 'id, nome, data_inizio, data_fine, archiviata')
  const vUtenti = await leggiTutto<VecchioUtente>(
    'users', 'id, email, role, roles, nome, cognome, telefono')
  const vTesserati = await leggiTutto<VecchioTesserato>(
    'tesserati', 'id, nome, cognome, data_nascita, codice_fiscale, email, telefono, indirizzo, citta, cap')
  const vSquadre = await leggiTutto<VecchiaSquadra>(
    'squadre', 'id, nome, categoria, annata, stagione_id')
  const vRigheSquadra = await leggiTutto<VecchioTesseramentoSquadra>(
    'tesserati_squadre_stagioni', 'id, tesserato_id, squadra_id, stagione_id, numero_maglia, data_tesseramento, note')
  const vDati = await leggiTutto<VecchiDatiStagionali>(
    'tesserati_dati_stagionali', 'id, tesserato_id, stagione_id, stato_pagamento, note_pagamento, visita_sportiva, scadenza_certificato, updated_at')
  const vPresenze = await leggiTutto<VecchiaPresenza>(
    'presenze', 'id, tesserato_id, squadra_id, stagione_id, data, tipo, presente, note')

  // ---- Stagioni -----------------------------------------------------------
  const codicePerStagioneVecchia = new Map<string, string>()
  const stagioniDaScrivere: { codice: string; etichetta: string; data_inizio: string; data_fine: string; stato: 'aperta' | 'chiusa' }[] = []
  for (const v of vStagioni) {
    const esito = trasformaStagione(v)
    if (!esito.ok) { anomalie.push(esito.anomalia); continue }
    codicePerStagioneVecchia.set(v.id, esito.stagione.codice)
    stagioniDaScrivere.push(esito.stagione)
  }

  // Le quote vanno date per ogni stagione trovata nei dati: fermarsi PRIMA
  // di qualunque scrittura, non a metà.
  const codiciSenzaQuota = stagioniDaScrivere
    .map((s) => s.codice)
    .filter((codice) => !quotePerCodice.has(codice))
  if (codiciSenzaQuota.length > 0) {
    throw new Error(
      `quota mancante per: ${codiciSenzaQuota.join(', ')}. Passala con --quota CODICE=IMPORTO.`,
    )
  }
  const quotaPerStagioneVecchia = new Map(
    [...codicePerStagioneVecchia].map(([idVecchio, codice]) => [idVecchio, quotePerCodice.get(codice)!]),
  )

  // ---- Trasformazioni pure ------------------------------------------------
  const { persone, anomalie: aTesserati } = trasformaTesserati(vTesserati)
  anomalie.push(...aTesserati)

  // La stessa funzione chiave usata in trasformaTesserati: una sola
  // definizione. I tesserati con terna duplicata non stanno in
  // personaPerChiave, quindi restano fuori dalla mappa — come vogliono i
  // test dei task 3 e 4.
  const personaPerChiave = new Map(persone.map((p) => [p.chiave, p]))
  const tesseratiPerId = new Map<string, string>()
  for (const t of vTesserati) {
    const chiave = chiavePersona(t)
    if (personaPerChiave.has(chiave)) tesseratiPerId.set(t.id, chiave)
  }

  // Omonimi: cognome+nome non è una chiave naturale robusta come
  // chiavePersona (codice fiscale o terna con nascita). Due persone diverse
  // che condividono cognome+nome collidono qui, e con un semplice
  // Map.set l'ultima sovrascriverebbe la prima in silenzio — un allenatore
  // finirebbe agganciato alla persona sbagliata. Si tracciano le chiavi
  // viste più di una volta e si rimuovono dalla mappa: un allenatore che
  // punta a un nome ambiguo cade nell'anomalia esistente
  // 'allenatore_senza_persona' (sicura), e admin/dirigente restano senza
  // persona collegata (anche sicuro).
  const personePerCognomeNome = new Map<string, string>()
  const cognomeNomeAmbigui = new Set<string>()
  for (const p of persone) {
    const chiaveCN = chiaveCognomeNome(p.cognome, p.nome)
    if (personePerCognomeNome.has(chiaveCN)) {
      cognomeNomeAmbigui.add(chiaveCN)
    } else {
      personePerCognomeNome.set(chiaveCN, p.chiave)
    }
  }
  for (const chiaveCN of cognomeNomeAmbigui) {
    personePerCognomeNome.delete(chiaveCN)
  }

  const { account, scartati: staffScartati, anomalie: aStaff } = trasformaStaff(
    vUtenti, personePerCognomeNome)
  anomalie.push(...aStaff)

  const squadreValide = vSquadre.filter((s) => {
    if (s.stagione_id && codicePerStagioneVecchia.has(s.stagione_id)) return true
    anomalie.push({
      tipo: 'squadra_senza_stagione',
      id: s.id,
      chiave: s.nome,
      dettaglio: 'squadra senza stagione (o con stagione anomala): non migra',
    })
    return false
  })
  const stagionePerSquadraVecchia = new Map(squadreValide.map((s) => [s.id, s.stagione_id!]))

  const { tesseramenti, anomalie: aTess } = fondiTesseramenti(vRigheSquadra, vDati, tesseratiPerId)
  anomalie.push(...aTess)
  const { pagamenti, anomalie: aPag } = ricostruisciPagamenti(vDati, tesseratiPerId, quotaPerStagioneVecchia)
  anomalie.push(...aPag)
  const { sedute, scartateNonAllenamento, anomalie: aPres } = raggruppaPresenze(
    vPresenze, tesseratiPerId, stagionePerSquadraVecchia)
  anomalie.push(...aPres)

  // ---- Stato attuale del target, per l'idempotenza ------------------------
  const { data: stagioniEsistenti } = await db.from('stagioni').select('id, codice')
  const { data: personeEsistenti } = await db.from('persone')
    .select('id, codice_fiscale, cognome, nome, data_nascita')
  const { data: squadreEsistenti } = await db.from('squadre').select('id, stagione_id, nome')
  const { data: tessEsistenti } = await db.from('tesseramenti').select('id, persona_id, stagione_id')
  const { data: quoteEsistenti } = await db.from('quote_importi').select('stagione_id')
  const { data: seduteEsistenti } = await db.from('sedute_allenamento')
    .select('id, squadra_id, data, ora_inizio')

  // ---- Scritture (o conteggio, in dry-run) --------------------------------
  // Ogni blocco segue lo stesso schema: indice delle chiavi già nel target,
  // divisione nuove/già presenti, conteggio, insert solo con --esegui. In
  // dry-run le mappe di id si riempiono con id fittizi 'dry:<chiave>' così i
  // blocchi a valle contano comunque il giusto.

  // Stagioni.
  const stagioneIdPerCodice = new Map((stagioniEsistenti ?? []).map((s) => [s.codice, s.id]))
  const stagioniNuove = stagioniDaScrivere.filter((s) => !stagioneIdPerCodice.has(s.codice))
  conteggi['stagioni'] = {
    lette: vStagioni.length,
    migrate: stagioniNuove.length,
    giaPresenti: stagioniDaScrivere.length - stagioniNuove.length,
    scartate: vStagioni.length - stagioniDaScrivere.length,
    motivoScarti: 'nome non riconducibile a un codice',
  }
  for (const s of stagioniNuove) {
    if (dryRun) { stagioneIdPerCodice.set(s.codice, `dry:${s.codice}`); continue }
    const { data, error } = await db.from('stagioni').insert(s).select('id').single()
    if (error) throw new Error(`insert stagione ${s.codice}: ${error.message}`)
    stagioneIdPerCodice.set(s.codice, data.id)
  }
  const stagioneIdPerVecchia = new Map(
    [...codicePerStagioneVecchia].map(([vecchioId, codice]) => [vecchioId, stagioneIdPerCodice.get(codice)!]),
  )

  // Quote per stagione.
  const stagioniConQuota = new Set((quoteEsistenti ?? []).map((q) => q.stagione_id))
  let quoteNuove = 0
  let quotePresenti = 0
  for (const s of stagioniDaScrivere) {
    const stagioneId = stagioneIdPerCodice.get(s.codice)!
    if (stagioniConQuota.has(stagioneId)) { quotePresenti += 1; continue }
    quoteNuove += 1
    if (dryRun) continue
    const { error } = await db.from('quote_importi').insert({
      stagione_id: stagioneId,
      importo: quotePerCodice.get(s.codice)!,
      note: NOTA_RICOSTRUITO,
    })
    if (error) throw new Error(`insert quota ${s.codice}: ${error.message}`)
  }
  conteggi['quote_importi'] = {
    lette: stagioniDaScrivere.length, migrate: quoteNuove, giaPresenti: quotePresenti, scartate: 0,
  }

  // Persone. L'indice dell'esistente usa la stessa chiavePersona.
  const personaIdPerChiave = new Map(
    (personeEsistenti ?? []).map((p) => [chiavePersona(p), p.id]),
  )
  const personeNuove = persone.filter((p) => !personaIdPerChiave.has(p.chiave))
  conteggi['persone (tesserati)'] = {
    lette: vTesserati.length,
    migrate: personeNuove.length,
    giaPresenti: persone.length - personeNuove.length,
    scartate: vTesserati.length - persone.length,
    motivoScarti: 'terna duplicata: vedi anomalie',
  }
  for (const p of personeNuove) {
    if (dryRun) { personaIdPerChiave.set(p.chiave, `dry:${p.chiave}`); continue }
    const { chiave, ...riga } = p
    const { data, error } = await db.from('persone').insert(riga).select('id').single()
    if (error) throw new Error(`insert persona ${chiave}: ${error.message}`)
    personaIdPerChiave.set(chiave, data.id)
  }

  // Account staff: auth.users + profili, con compensazione come in
  // app/(app)/admin/utenti/actions.ts. Un fallimento è un'anomalia, non un
  // crash: gli altri account devono comunque nascere.
  const { data: authEsistenti, error: eAuth } = await db.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })
  if (eAuth) throw new Error(`lettura auth.users del target: ${eAuth.message}`)
  if (authEsistenti.users.length === 1000) {
    throw new Error(
      'auth.users del target ha 1000 o più utenti: listUsers è troncato a una pagina e ' +
      'proseguire darebbe un indice monco. Va paginato come leggiTutto prima di continuare.',
    )
  }
  const emailEsistenti = new Set(
    authEsistenti.users.map((u) => u.email?.toLowerCase()).filter(Boolean),
  )
  let accountNuovi = 0
  let accountPresenti = 0
  let accountFalliti = 0
  for (const a of account) {
    if (emailEsistenti.has(a.email)) { accountPresenti += 1; continue }
    accountNuovi += 1
    if (dryRun) continue
    const password = passwordIniziale(a.nomePerPassword)
    const { data: creato, error } = await db.auth.admin.createUser({
      email: a.email,
      password,
      email_confirm: true,
    })
    if (error) {
      accountFalliti += 1
      anomalie.push({
        tipo: 'account_non_creato', id: a.email, chiave: a.email,
        dettaglio: `auth.createUser: ${error.message}`,
      })
      continue
    }
    const { error: eProfilo } = await db.from('profili').insert({
      id: creato.user.id,
      ruolo: a.ruolo,
      persona_id: a.personaChiave ? (personaIdPerChiave.get(a.personaChiave) ?? null) : null,
    })
    if (eProfilo) {
      // Compensazione, come in app/(app)/admin/utenti/actions.ts: se anche
      // deleteUser fallisce non si perde traccia, altrimenti resta un utente
      // fantasma in auth.users che tiene occupata l'email e nessuno saprebbe
      // perché il prossimo tentativo dice "email già registrata".
      await db.auth.admin.deleteUser(creato.user.id).catch((erroreCompensazione) => {
        console.error(
          `migra: compensazione fallita, utente fantasma in auth.users id=${creato.user.id}`,
          erroreCompensazione,
        )
      })
      accountFalliti += 1
      anomalie.push({
        tipo: 'account_non_creato', id: a.email, chiave: a.email,
        dettaglio: `insert profilo: ${eProfilo.message}`,
      })
      continue
    }
    accountCreati.push({ email: a.email, password })
  }
  conteggi['account staff'] = {
    lette: vUtenti.length,
    migrate: accountNuovi - accountFalliti,
    giaPresenti: accountPresenti,
    scartate: staffScartati + accountFalliti,
    motivoScarti: 'tesserato/genitore, o creazione fallita (vedi anomalie)',
  }

  // Squadre.
  const squadraIdPerChiave = new Map(
    (squadreEsistenti ?? []).map((s) => [`${s.stagione_id}|${s.nome}`, s.id]),
  )
  const squadraIdPerVecchia = new Map<string, string>()
  let squadreNuove = 0
  let squadrePresenti = 0
  for (const s of squadreValide) {
    const stagioneId = stagioneIdPerVecchia.get(s.stagione_id!)!
    const chiave = `${stagioneId}|${s.nome}`
    const esistente = squadraIdPerChiave.get(chiave)
    if (esistente) {
      squadraIdPerVecchia.set(s.id, esistente)
      squadrePresenti += 1
      continue
    }
    squadreNuove += 1
    if (dryRun) { squadraIdPerVecchia.set(s.id, `dry:${chiave}`); continue }
    const { data, error } = await db.from('squadre').insert({
      stagione_id: stagioneId, nome: s.nome, categoria: s.categoria, annata: s.annata,
    }).select('id').single()
    if (error) throw new Error(`insert squadra ${s.nome}: ${error.message}`)
    squadraIdPerVecchia.set(s.id, data.id)
    squadraIdPerChiave.set(chiave, data.id)
  }
  conteggi['squadre'] = {
    lette: vSquadre.length,
    migrate: squadreNuove,
    giaPresenti: squadrePresenti,
    scartate: vSquadre.length - squadreValide.length,
    motivoScarti: 'senza stagione: vedi anomalie',
  }

  // Tesseramenti. Chiave: persona + stagione (id del target). L'indice
  // dell'esistente mappa alla riga, non solo alla presenza: un run
  // successivo deve poter risolvere l'id anche per un tesseramento creato
  // in un run precedente, altrimenti le presenze di una seduta nuova che lo
  // referenziano non trovano l'id e scompaiono in silenzio (vedi sotto).
  const tessEsistentiPerChiave = new Map(
    (tessEsistenti ?? []).map((t) => [`${t.persona_id}|${t.stagione_id}`, t.id]),
  )
  const tesseramentoIdPerChiave = new Map<string, string>()
  const tesseramentiCreati = new Set<string>()
  let tessNuovi = 0
  let tessPresenti = 0
  let tessScartati = 0
  for (const t of tesseramenti) {
    const personaId = personaIdPerChiave.get(t.personaChiave)
    const stagioneId = stagioneIdPerVecchia.get(t.stagioneVecchiaId)
    if (!personaId || !stagioneId) { tessScartati += 1; continue } // persona o stagione già anomala
    const chiave = `${t.personaChiave}|${t.stagioneVecchiaId}`
    const idEsistente = tessEsistentiPerChiave.get(`${personaId}|${stagioneId}`)
    if (idEsistente) {
      // Già presente: NON va in tesseramentiCreati (i pagamenti ricostruiti
      // restano solo per i tesseramenti nuovi di questo run), ma l'id serve
      // comunque a chi consulta tesseramentoIdPerChiave più sotto (presenze
      // di una seduta nuova su un tesseramento vecchio).
      tesseramentoIdPerChiave.set(chiave, idEsistente)
      tessPresenti += 1
      continue
    }
    tessNuovi += 1
    tesseramentiCreati.add(chiave)
    if (dryRun) { tesseramentoIdPerChiave.set(chiave, `dry:${chiave}`); continue }
    const { data, error } = await db.from('tesseramenti').insert({
      persona_id: personaId,
      stagione_id: stagioneId,
      squadra_id: t.squadraVecchiaId ? (squadraIdPerVecchia.get(t.squadraVecchiaId) ?? null) : null,
      numero_maglia: t.numero_maglia,
      visita_scadenza: t.visita_scadenza,
      note: t.note,
    }).select('id').single()
    if (error) throw new Error(`insert tesseramento ${chiave}: ${error.message}`)
    tesseramentoIdPerChiave.set(chiave, data.id)
  }
  conteggi['tesseramenti'] = {
    lette: vRigheSquadra.length,
    migrate: tessNuovi,
    giaPresenti: tessPresenti,
    scartate: tessScartati,
    motivoScarti: 'persona o stagione non migrata',
  }

  // Pagamenti ricostruiti: SOLO per tesseramenti creati in questo run. Un
  // tesseramento già presente può avere pagamenti veri registrati a mano.
  let pagNuovi = 0
  let pagSaltati = 0
  for (const p of pagamenti) {
    const chiave = `${p.personaChiave}|${p.stagioneVecchiaId}`
    if (!tesseramentiCreati.has(chiave)) { pagSaltati += 1; continue }
    pagNuovi += 1
    if (dryRun) continue
    const { error } = await db.from('pagamenti_quota').insert({
      tesseramento_id: tesseramentoIdPerChiave.get(chiave)!,
      importo: p.importo,
      data: p.data,
      metodo: 'contanti',
      note: NOTA_RICOSTRUITO,
    })
    if (error) throw new Error(`insert pagamento ${chiave}: ${error.message}`)
  }
  conteggi['pagamenti_quota'] = {
    lette: vDati.length,
    migrate: pagNuovi,
    giaPresenti: 0,
    scartate: pagSaltati,
    motivoScarti: 'stato senza importo, o tesseramento non creato in questo run',
  }

  // Sedute. Chiave: squadra + data, con ora_inizio nulla (le sedute migrate
  // non hanno orario).
  const seduteEsistentiChiavi = new Map(
    (seduteEsistenti ?? [])
      .filter((s) => s.ora_inizio === null)
      .map((s) => [`${s.squadra_id}|${s.data}`, s.id]),
  )
  const sedutaIdPerChiave = new Map<string, string>()
  let seduteNuove = 0
  let sedutePresenti = 0
  for (const s of sedute) {
    const squadraId = squadraIdPerVecchia.get(s.squadraVecchiaId)
    if (!squadraId) continue // squadra già anomala: le sue presenze sono già contate
    const chiave = `${squadraId}|${s.data}`
    const esistente = seduteEsistentiChiavi.get(chiave)
    if (esistente) {
      sedutaIdPerChiave.set(chiave, esistente)
      sedutePresenti += 1
      continue
    }
    seduteNuove += 1
    if (dryRun) { sedutaIdPerChiave.set(chiave, `dry:${chiave}`); continue }
    const { data, error } = await db.from('sedute_allenamento').insert({
      squadra_id: squadraId,
      stagione_id: stagioneIdPerVecchia.get(s.stagioneVecchiaId)!,
      data: s.data,
      ora_inizio: null,
    }).select('id').single()
    if (error) throw new Error(`insert seduta ${chiave}: ${error.message}`)
    sedutaIdPerChiave.set(chiave, data.id)
  }
  conteggi['sedute_allenamento'] = {
    lette: sedute.length, migrate: seduteNuove, giaPresenti: sedutePresenti, scartate: 0,
  }

  // Presenze: per seduta, una insert di array. Ogni riga solo se il
  // tesseramento migrato della persona in quella stagione è sulla stessa
  // squadra della seduta: le FK composite del target rifiuterebbero il
  // resto — meglio contarlo che farlo esplodere.
  let presNuove = 0
  let presPresenti = 0
  let presScartate = 0
  for (const s of sedute) {
    const squadraId = squadraIdPerVecchia.get(s.squadraVecchiaId)
    if (!squadraId) { presScartate += s.presenze.length; continue }
    const chiaveSeduta = `${squadraId}|${s.data}`
    const sedutaId = sedutaIdPerChiave.get(chiaveSeduta)!
    const sedutaGiaPresente = seduteEsistentiChiavi.has(chiaveSeduta)
    if (sedutaGiaPresente) {
      // Seduta già nel target: le sue presenze sono un run precedente.
      presPresenti += s.presenze.length
      continue
    }
    const righe = []
    for (const p of s.presenze) {
      const chiaveTess = `${p.personaChiave}|${s.stagioneVecchiaId}`
      const tessId = tesseramentoIdPerChiave.get(chiaveTess)
      const tessSuQuestaSquadra = tesseramenti.find(
        (t) => t.personaChiave === p.personaChiave
          && t.stagioneVecchiaId === s.stagioneVecchiaId
          && t.squadraVecchiaId === s.squadraVecchiaId,
      )
      if (!tessId || !tessSuQuestaSquadra) { presScartate += 1; continue }
      righe.push({
        seduta_id: sedutaId,
        tesseramento_id: tessId,
        squadra_id: squadraId,
        stato: p.stato,
        note: p.note,
      })
    }
    presNuove += righe.length
    if (dryRun || righe.length === 0) continue
    const { error } = await db.from('presenze').insert(righe)
    if (error) throw new Error(`insert presenze seduta ${chiaveSeduta}: ${error.message}`)
  }
  conteggi['presenze'] = {
    lette: vPresenze.length,
    migrate: presNuove,
    giaPresenti: presPresenti,
    scartate: presScartate + scartateNonAllenamento,
    motivoScarti: 'tipo diverso da allenamento, o tesseramento su altra squadra',
  }

  // ---- Report --------------------------------------------------------------
  const report: DatiReport = { dryRun, conteggi, anomalie, account: accountCreati }
  writeFileSync(PERCORSO_REPORT, generaReport(report))
  console.log(`Report scritto in ${PERCORSO_REPORT}${dryRun ? ' (dry-run, nessuna scrittura)' : ''}`)
}

main().catch((errore) => {
  console.error(errore instanceof Error ? errore.message : errore)
  process.exitCode = 1
})
