import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const PREFISSO = 'Provasquadra'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  // Prima i tesseramenti delle persone di prova, poi le persone, poi le
  // squadre: `persone` è referenziata con `on delete restrict`, e
  // `tesseramenti.squadra_id` con `on delete set null` — cancellare la squadra
  // per prima lascerebbe il tesseramento orfano nel seed, e al giro dopo la
  // persona non comparirebbe più fra i candidati.
  const { data: persone, error: eSel } = await db
    .from('persone').select('id').like('cognome', `${PREFISSO}%`)
  if (eSel) throw eSel
  const ids = (persone ?? []).map((p) => p.id)
  if (ids.length > 0) {
    const { error: eTess } = await db.from('tesseramenti').delete().in('persona_id', ids)
    if (eTess) throw eTess
    // Anche gli incarichi: una persona può essere tesserata E nello staff — c'è
    // un test che lo verifica di proposito, e nella rosa reale sono sei — e
    // `incarichi_staff.persona_id` è `on delete restrict`. Senza questa riga la
    // delete su `persone` fallisce con 23503 dentro `beforeAll`, e l'intero file
    // non parte: un errore che sembra della prima squadra creata e viene invece
    // dalla pulizia del giro precedente.
    const { error: eInc } = await db.from('incarichi_staff').delete().in('persona_id', ids)
    if (eInc) throw eInc
    const { error: ePers } = await db.from('persone').delete().in('id', ids)
    if (ePers) throw ePers
  }
  const { error } = await db.from('squadre').delete().like('nome', `${PREFISSO}%`)
  if (error) throw error
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

function riquadroNuovoGiocatore(page: import('@playwright/test').Page) {
  return page.locator('details', { hasText: 'Aggiungi un giocatore nuovo' })
}

async function crea(page: import('@playwright/test').Page, nome: string) {
  await page.goto('/2026-27/squadre/nuova')
  await page.getByLabel('Nome').fill(nome)
  await page.getByLabel('Categoria').fill('Esordienti')
  await page.getByLabel('Annata').fill('2013')
  await page.getByRole('button', { name: 'Crea squadra' }).click()
}

test('un dirigente crea una squadra e la vede in elenco', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Alfa`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Alfa` })).toBeVisible()

  await page.goto('/2026-27/squadre')
  await expect(page.getByRole('link', { name: `${PREFISSO} Alfa` })).toBeVisible()
})

test('un nome già usato nella stagione mostra il messaggio tradotto', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Beta`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Beta` })).toBeVisible()

  await crea(page, `${PREFISSO} Beta`)
  const avviso = page.getByRole('alert').filter({ hasText: /già una squadra/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('eliminare una squadra chiede conferma ed elenca le conseguenze', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Gamma`)
  await page.getByRole('button', { name: 'Elimina squadra' }).click()
  await expect(page.getByText(/spariscono anche le sue sedute/i)).toBeVisible()
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click()

  await expect(page).toHaveURL(/\/2026-27\/squadre$/)
  await expect(page.getByRole('link', { name: `${PREFISSO} Gamma` })).toHaveCount(0)
})

test('un allenatore vede le squadre ma non può crearne né modificarle', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/squadre')
  await expect(page.getByRole('link', { name: 'Pulcini A' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nuova squadra' })).toHaveCount(0)

  await page.goto('/2026-27/squadre/nuova')
  await expect(page).toHaveURL(/\/2026-27\/squadre$/)

  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByText(/non hai i permessi/i)).toBeVisible()
})

test('su stagione chiusa la squadra è in sola lettura', async ({ page }) => {
  const db = clientServizio()
  const { data: stagione } = await db
    .from('stagioni').select('id').eq('codice', '2025-26').single()
  const { data: squadra } = await db
    .from('squadre')
    .upsert(
      { stagione_id: stagione!.id, nome: `${PREFISSO} Chiusa`, categoria: 'Pulcini' },
      { onConflict: 'stagione_id,nome' },
    )
    .select('id')
    .single()

  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2025-26/squadre')
  await expect(page.getByRole('link', { name: 'Nuova squadra' })).toHaveCount(0)

  await page.goto(`/2025-26/squadre/${squadra!.id}`)
  await expect(page.getByText(/stagione chiusa/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Elimina squadra' })).toHaveCount(0)
})

test('una squadra di un\'altra stagione dà 404 sotto questo codice', async ({ page }) => {
  const db = clientServizio()
  const { data: squadra } = await db
    .from('squadre').select('id').eq('nome', 'Pulcini A').single()

  await accedi(page, 'dirigente@virpol.test')
  // La squadra esiste, ma non nella 2025-26: lo status distingue "non c'è"
  // da "pagina vuota andata a buon fine".
  const risposta = await page.goto(`/2025-26/squadre/${squadra!.id}`)
  expect(risposta?.status()).toBe(404)

  const inesistente = await page.goto('/2026-27/squadre/00000000-0000-4000-8000-000000000000')
  expect(inesistente?.status()).toBe(404)
})

test('un dirigente tessera dalla scheda squadra, scegliendo dall\'autocomplete', async ({ page }) => {
  const db = clientServizio()
  const { error } = await db.from('persone').insert({
    nome: 'Aspirante', cognome: `${PREFISSO}rosa`,
  })
  if (error) throw error

  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Rosa`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Rosa` })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rosa (0)' })).toBeVisible()

  const form = page.locator('form', { hasText: 'Tessera in questa squadra' })
  await form.getByLabel('Cerca in anagrafica').fill(`${PREFISSO}rosa`)
  await form.getByRole('option', { name: `${PREFISSO}rosa Aspirante` }).click()
  await page.getByRole('button', { name: 'Tessera' }).click()

  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
  await expect(page.getByRole('link', { name: `${PREFISSO}rosa Aspirante` })).toBeVisible()
})

// Il filtro sta nella Server Action, non nel componente: se arrivassero al
// browser anche i già dentro, l'anagrafica finirebbe nel client con qualche riga
// barrata. Questo test guarda l'unica cosa osservabile — che non compaiano.
test('l\'autocomplete non propone chi è già in rosa né chi è già nello staff', async ({ page }) => {
  const db = clientServizio()
  const { error } = await db.from('persone').insert({
    nome: 'Unico', cognome: `${PREFISSO}doppio`,
  })
  if (error) throw error

  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Doppio`)

  const rosa = page.locator('form', { hasText: 'Tessera in questa squadra' })
  await rosa.getByLabel('Cerca in anagrafica').fill(`${PREFISSO}doppio`)
  await rosa.getByRole('option', { name: `${PREFISSO}doppio Unico` }).click()
  await page.getByRole('button', { name: 'Tessera' }).click()
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()

  // Tesserato: non è più un candidato per nessuna rosa della stagione.
  await rosa.getByLabel('Cerca in anagrafica').fill(`${PREFISSO}doppio`)
  await expect(rosa.getByText('Nessuna persona disponibile con questo cognome.')).toBeVisible()

  // Ma per lo staff sì: essere tesserato non impedisce di allenare — nella
  // rosa reale ci sono sei tesserati che allenano una squadra.
  const staff = page.locator('form', { hasText: 'Aggiungi allo staff' })
  await staff.getByLabel('Cerca in anagrafica').fill(`${PREFISSO}doppio`)
  await staff.getByRole('option', { name: `${PREFISSO}doppio Unico` }).click()
  await page.getByRole('button', { name: 'Aggiungi' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `${PREFISSO}doppio Unico` })).toBeVisible()

  // Ora è già staff di QUESTA squadra, quindi sparisce anche da lì.
  await staff.getByLabel('Cerca in anagrafica').fill(`${PREFISSO}doppio`)
  await expect(staff.getByText('Nessuna persona disponibile con questo cognome.')).toBeVisible()
})

test('un allenatore non vede il modo di tesserare nella propria squadra', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/squadre')
  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByRole('heading', { name: /^Rosa \(/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tessera' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Crea e tessera' })).toHaveCount(0)
})

test('un giocatore nuovo si crea dalla scheda squadra e conta come tesseramento', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Nuovi`)
  await expect(page.getByRole('heading', { name: 'Rosa (0)' })).toBeVisible()

  const nuovo = riquadroNuovoGiocatore(page)
  await nuovo.getByText('Aggiungi un giocatore nuovo').click()
  await nuovo.getByLabel('Nome', { exact: true }).fill('Nuovo')
  await nuovo.getByLabel('Cognome', { exact: true }).fill(`${PREFISSO}creato`)
  await nuovo.getByLabel('Data di nascita').fill('2014-05-09')
  await nuovo.getByRole('button', { name: 'Crea e tessera' }).click()

  // Il tesseramento è la ragione del gesto: la rosa deve crescere, non solo
  // l'anagrafica.
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
  await expect(page.getByRole('link', { name: `${PREFISSO}creato Nuovo` })).toBeVisible()

  // E la persona esiste davvero in anagrafica, con la data che le è stata data.
  await page.goto('/anagrafica?q=' + `${PREFISSO}creato`)
  await expect(page.getByRole('link', { name: `${PREFISSO}creato Nuovo` })).toBeVisible()
})
