import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const COGNOME = 'Provatess'
// Data riconoscibile: la seduta creata qui va rimossa senza toccare quelle di
// altre suite.
const DATA_SEDUTA = '2027-01-15'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  await db.from('sedute_allenamento').delete().eq('data', DATA_SEDUTA)

  const { data: persone } = await db.from('persone').select('id').like('cognome', `${COGNOME}%`)
  const ids = (persone ?? []).map((p) => p.id)
  if (ids.length === 0) return
  // Ordine inverso di dipendenza: le FK verso persone sono `restrict`.
  await db.from('incarichi_staff').delete().in('persona_id', ids)
  await db.from('tesseramenti').delete().in('persona_id', ids)
  const { error } = await db.from('persone').delete().in('id', ids)
  if (error) throw error
}

async function creaPersona(nome: string): Promise<string> {
  const db = clientServizio()
  const { data, error } = await db
    .from('persone')
    .insert({ nome, cognome: COGNOME, data_nascita: '2014-06-01' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

test.beforeAll(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

async function tessera(
  page: import('@playwright/test').Page,
  nome: string,
  squadra: string,
  maglia = '',
) {
  await page.goto(`/2026-27/tesseramenti/nuovo?q=${COGNOME}`)
  await page.getByRole('radio', { name: new RegExp(`${COGNOME} ${nome}`) }).check()
  await page.getByLabel('Squadra').selectOption({ label: squadra })
  if (maglia) await page.getByLabel('Numero di maglia').fill(maglia)
  await page.getByRole('button', { name: 'Tessera' }).click()
}

test('si tessera cercando in anagrafica, non reinserendo la persona', async ({ page }) => {
  await creaPersona('Alfa')
  await accedi(page, 'dirigente@virpol.test')
  await tessera(page, 'Alfa', 'Pulcini A', '23')

  await expect(page.getByRole('heading', { name: `${COGNOME} Alfa` })).toBeVisible()
  await page.goto('/2026-27/squadre')
  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByRole('link', { name: `${COGNOME} Alfa` })).toBeVisible()
})

test('chi è già tesserato non ricompare fra i candidati', async ({ page }) => {
  await creaPersona('Beta')
  await accedi(page, 'dirigente@virpol.test')
  await tessera(page, 'Beta', 'Pulcini A')
  await expect(page.getByRole('heading', { name: `${COGNOME} Beta` })).toBeVisible()

  await page.goto(`/2026-27/tesseramenti/nuovo?q=${COGNOME}`)
  await expect(page.getByRole('radio', { name: new RegExp(`${COGNOME} Beta`) })).toHaveCount(0)
})

test('un numero di maglia occupato dice chi ce l\'ha', async ({ page }) => {
  await creaPersona('Gamma')
  await accedi(page, 'dirigente@virpol.test')
  // Il seed dà la 10 a Giocatore Uno nei Pulcini A.
  await tessera(page, 'Gamma', 'Pulcini A', '10')
  const avviso = page.getByRole('alert').filter({ hasText: /Giocatore Uno/ })
  await expect(avviso).toBeVisible()
  await expect(avviso).toContainText('10')
})

test('spostare chi ha presenze spiega che vanno cancellate prima', async ({ page }) => {
  const db = clientServizio()
  const { data: squadra } = await db.from('squadre').select('id, stagione_id').eq('nome', 'Pulcini A').single()
  const { data: tesseramento } = await db
    .from('tesseramenti')
    .select('id, persone!inner(nome)')
    .eq('squadra_id', squadra!.id)
    .eq('persone.nome', 'Uno')
    .single()
  const { data: seduta } = await db
    .from('sedute_allenamento')
    .insert({ squadra_id: squadra!.id, stagione_id: squadra!.stagione_id, data: DATA_SEDUTA })
    .select('id')
    .single()
  await db.from('presenze').insert({
    seduta_id: seduta!.id,
    tesseramento_id: tesseramento!.id,
    squadra_id: squadra!.id,
    stato: 'presente',
  })

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${tesseramento!.id}`)
  await page.getByLabel('Squadra').selectOption({ label: 'Pulcini B' })
  await page.getByRole('button', { name: 'Salva assegnazione' }).click()

  await expect(page.getByRole('alert').filter({ hasText: /presenze registrate/i })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Squadra')).toHaveValue(squadra!.id)
})

test('un allenatore legge la propria rosa ma non la modifica', async ({ page }) => {
  const db = clientServizio()
  const { data: tesseramento } = await db
    .from('tesseramenti')
    .select('id, persone!inner(nome)')
    .eq('persone.nome', 'Uno')
    .single()

  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/tesseramenti')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Tessera una persona' })).toHaveCount(0)

  await page.goto(`/2026-27/tesseramenti/${tesseramento!.id}`)
  await expect(page.getByRole('button', { name: 'Salva assegnazione' })).toHaveCount(0)

  await page.goto('/2026-27/tesseramenti/nuovo')
  await expect(page).toHaveURL(/\/2026-27\/tesseramenti$/)
})

test('lo staff si aggiunge e si toglie dalla scheda squadra', async ({ page }) => {
  await creaPersona('Delta')
  await accedi(page, 'dirigente@virpol.test')
  const db = clientServizio()
  const { data: squadra } = await db.from('squadre').select('id').eq('nome', 'Pulcini B').single()

  await page.goto(`/2026-27/squadre/${squadra!.id}`)
  // La ricerca non è più un parametro nell'URL: si scrive nell'autocomplete e
  // si sceglie dall'elenco che si apre.
  const form = page.locator('form', { hasText: 'Aggiungi allo staff' })
  await form.getByLabel('Cerca in anagrafica').fill(COGNOME)
  await form.getByRole('option', { name: new RegExp(`${COGNOME} Delta`) }).click()
  await page.getByLabel('Ruolo').selectOption('vice_allenatore')
  await page.getByRole('button', { name: 'Aggiungi' }).click()

  const voce = page.getByRole('listitem').filter({ hasText: `${COGNOME} Delta` })
  await expect(voce).toContainText('Vice allenatore')

  await voce.getByRole('button', { name: 'Rimuovi' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `${COGNOME} Delta` })).toHaveCount(0)
})

test('un tesseramento inesistente o di un\'altra stagione dà 404', async ({ page }) => {
  const db = clientServizio()
  const { data: tesseramento } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Due').single()

  await accedi(page, 'dirigente@virpol.test')
  const altraStagione = await page.goto(`/2025-26/tesseramenti/${tesseramento!.id}`)
  expect(altraStagione?.status()).toBe(404)

  const inesistente = await page.goto('/2026-27/tesseramenti/00000000-0000-4000-8000-000000000000')
  expect(inesistente?.status()).toBe(404)
})

test('i filtri dell\'elenco valgono su nome, visita e quota', async ({ page }) => {
  const db = clientServizio()
  await accedi(page, 'dirigente@virpol.test')

  // Uno con la visita consegnata, l'altro no: il seed non li distingue.
  const { data: uno } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Uno').single()
  await db.from('tesseramenti').update({ visita_consegnata: true }).eq('id', uno!.id)

  await page.goto('/2026-27/tesseramenti')
  // `aria-live` invece del testo: la pagina ha già un suo conteggio di
  // tesserati, e cercare per testo ne pescava due.
  const conteggio = page.locator('p[aria-live="polite"]')
  await expect(conteggio).toContainText('tesserati')

  // Nome: si restringe a ogni battuta, senza invio.
  await page.getByLabel('Nome').fill('Uno')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(conteggio).toContainText('di')

  await page.getByRole('button', { name: 'Azzera i filtri' }).click()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()

  // Visita: consegnata solo Uno.
  await page.getByLabel('Visita').selectOption('si')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)

  await page.getByLabel('Visita').selectOption('no')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()

  // Quota: senza importi configurati v_quote li dà saldati entrambi, quindi
  // "non pagato" non deve trovare nessuno e "saldato" tutti e due.
  await page.getByLabel('Visita').selectOption('')
  await page.getByLabel('Quota').selectOption('non_pagato')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toHaveCount(0)
  await page.getByLabel('Quota').selectOption('saldato')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()
})

test('all\'allenatore non si offre il filtro sulla quota', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/tesseramenti')
  // Nome e visita sì: sono dati che vede davvero.
  await expect(page.getByLabel('Nome')).toBeVisible()
  await expect(page.getByLabel('Visita')).toBeVisible()
  // La quota no: per lui v_quote risponderebbe "saldato" per chiunque, e
  // filtrare su quel valore vorrebbe dire filtrare su un dato inventato.
  await expect(page.getByLabel('Quota')).toHaveCount(0)
})

test('i filtri stanno in una barra sola, e "senza squadra" disabilita il menù', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2026-27/tesseramenti')

  // `exact`: l'etichetta della casella "Solo chi non ha una squadra" contiene
  // la parola "squadra", e senza il vincolo il locator ne pesca due.
  const menuSquadra = page.getByLabel('Squadra', { exact: true })

  // Un solo riquadro di filtri: prima erano due, il form GET della squadra e
  // quello client, e nulla diceva perché.
  await expect(menuSquadra).toBeVisible()
  await expect(page.getByLabel('Nome')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Filtra' })).toHaveCount(0)

  // La squadra naviga da sé: cambia le righe lette, quindi passa dal server.
  await menuSquadra.selectOption({ label: 'Pulcini B' })
  await expect(page).toHaveURL(/[?&]squadra=/)
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toHaveCount(0)

  // "Solo chi non ha una squadra" ha la precedenza, e si vede: il menù si
  // disabilita invece di restare attivo e ignorato.
  // `click` e non `check`: la casella è controllata dal parametro nell'URL, e il
  // suo stato cambia quando arriva la pagina nuova — `check` pretende invece che
  // cambi nell'istante del click.
  await page.getByRole('checkbox', { name: 'Solo chi non ha una squadra' }).click()
  await expect(page).toHaveURL(/[?&]senza=1/)
  await expect(page.getByLabel('Squadra', { exact: true })).toBeDisabled()
})
