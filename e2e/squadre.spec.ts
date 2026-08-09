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

test('un dirigente tessera dalla scheda squadra, senza passare dall\'elenco', async ({ page }) => {
  const db = clientServizio()
  const { error } = await db.from('persone').insert({
    nome: 'Aspirante', cognome: `${PREFISSO}rosa`,
  })
  if (error) throw error

  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Rosa`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Rosa` })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rosa (0)' })).toBeVisible()

  // La ricerca sta nell'URL: senza, il tesseramento riuscito ricarica la
  // pagina e la lista dei candidati sparirebbe.
  await page.getByLabel('Cerca in anagrafica').first().fill(`${PREFISSO}rosa`)
  await page.getByRole('button', { name: 'Cerca' }).first().click()

  await page.getByRole('radio', { name: `${PREFISSO}rosa Aspirante` }).check()
  await page.getByLabel('Numero di maglia').fill('17')
  await page.getByRole('button', { name: 'Tessera' }).click()

  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
  await expect(page.getByRole('link', { name: `${PREFISSO}rosa Aspirante` })).toBeVisible()
})

test('un numero di maglia occupato dice chi ce l\'ha, dalla scheda squadra', async ({ page }) => {
  const db = clientServizio()
  const { error } = await db.from('persone').insert([
    { nome: 'Primo', cognome: `${PREFISSO}maglia` },
    { nome: 'Secondo', cognome: `${PREFISSO}maglia` },
  ])
  if (error) throw error

  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Maglia`)

  for (const nome of ['Primo', 'Secondo']) {
    await page.getByLabel('Cerca in anagrafica').first().fill(`${PREFISSO}maglia`)
    await page.getByRole('button', { name: 'Cerca' }).first().click()
    await page.getByRole('radio', { name: `${PREFISSO}maglia ${nome}` }).check()
    await page.getByLabel('Numero di maglia').fill('9')
    await page.getByRole('button', { name: 'Tessera' }).click()
    if (nome === 'Primo') await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
  }

  // `filter`: getByRole('alert') pesca anche l'annunciatore di rotta di Next,
  // che è un alert vuoto sempre presente nel documento.
  const avviso = page.getByRole('alert').filter({ hasText: /Il numero 9/ })
  await expect(avviso).toBeVisible()
  await expect(avviso).toContainText(`${PREFISSO}maglia Primo`)
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
})

test('un allenatore non vede il modo di tesserare nella propria squadra', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/squadre')
  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByRole('heading', { name: /^Rosa \(/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tessera' })).toHaveCount(0)
})

test('un giocatore nuovo si crea dalla scheda squadra e conta come tesseramento', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Nuovi`)
  await expect(page.getByRole('heading', { name: 'Rosa (0)' })).toBeVisible()

  // Circoscritto al riquadro: in pagina ci sono anche il campo Nome della
  // squadra e il campo Cognome della ricerca, e `getByLabel('Nome')` non
  // distingue né un'etichetta contenuta in un'altra ("Cognome") né due campi
  // con la stessa etichetta in form diversi.
  const nuovo = riquadroNuovoGiocatore(page)
  await nuovo.getByText('Aggiungi un giocatore nuovo').click()
  await nuovo.getByLabel('Nome', { exact: true }).fill('Nuovo')
  await nuovo.getByLabel('Cognome', { exact: true }).fill(`${PREFISSO}creato`)
  await nuovo.getByLabel('Data di nascita').fill('2014-05-09')
  await nuovo.getByLabel('Maglia', { exact: true }).fill('23')
  await nuovo.getByRole('button', { name: 'Crea e tessera' }).click()

  // Il tesseramento è la ragione del gesto: la rosa deve crescere, non solo
  // l'anagrafica.
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()
  await expect(page.getByRole('link', { name: `${PREFISSO}creato Nuovo` })).toBeVisible()

  // E la persona esiste davvero in anagrafica, con la data che le è stata data.
  await page.goto('/anagrafica?q=' + `${PREFISSO}creato`)
  await expect(page.getByRole('link', { name: `${PREFISSO}creato Nuovo` })).toBeVisible()
})

test('una maglia occupata non lascia in anagrafica un giocatore mai tesserato', async ({ page }) => {
  const db = clientServizio()
  const { error } = await db.from('persone').insert({ nome: 'Primo', cognome: `${PREFISSO}occupa` })
  if (error) throw error

  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Occupata`)
  await page.getByLabel('Cerca in anagrafica').first().fill(`${PREFISSO}occupa`)
  await page.getByRole('button', { name: 'Cerca' }).first().click()
  await page.getByRole('radio', { name: `${PREFISSO}occupa Primo` }).check()
  await page.getByLabel('Numero di maglia').fill('23')
  await page.getByRole('button', { name: 'Tessera' }).click()
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()

  // Stessa maglia, ma per un giocatore che non esiste ancora: il numero si
  // verifica PRIMA di creare la persona, quindi l'anagrafica non deve
  // guadagnare una riga che nessuno potrebbe più togliere — persone_del è
  // concessa al solo admin.
  const nuovo = riquadroNuovoGiocatore(page)
  await nuovo.getByText('Aggiungi un giocatore nuovo').click()
  await nuovo.getByLabel('Nome', { exact: true }).fill('Secondo')
  await nuovo.getByLabel('Cognome', { exact: true }).fill(`${PREFISSO}scartato`)
  await nuovo.getByLabel('Maglia', { exact: true }).fill('23')
  await nuovo.getByRole('button', { name: 'Crea e tessera' }).click()

  const avviso = page.getByRole('alert').filter({ hasText: /Il numero 23/ })
  await expect(avviso).toBeVisible()
  await expect(avviso).toContainText(`${PREFISSO}occupa Primo`)
  await expect(page.getByRole('heading', { name: 'Rosa (1)' })).toBeVisible()

  const { data: orfani } = await db.from('persone').select('id').eq('cognome', `${PREFISSO}scartato`)
  expect(orfani).toEqual([])
})
