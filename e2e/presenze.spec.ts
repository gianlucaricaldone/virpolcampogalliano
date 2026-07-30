import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
// Le sedute create qui hanno una data riconoscibile: la pulizia toglie quelle
// e non quelle di altre suite.
const DATA_SEDUTA = '2027-03-05'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  // Le presenze se ne vanno in cascade con la seduta.
  const { error } = await clientServizio()
    .from('sedute_allenamento').delete().eq('data', DATA_SEDUTA)
  if (error) throw error
}

async function squadraDi(nome: string): Promise<string> {
  const { data, error } = await clientServizio()
    .from('squadre').select('id').eq('nome', nome).single()
  if (error) throw error
  return data.id
}

test.beforeEach(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

/**
 * Esegue un gesto sul foglio e aspetta la risposta della Server Action.
 *
 * Senza questa attesa il test è ingannato dal proprio soggetto: lo stato
 * ottimistico compare prima che il server risponda, quindi l'asserzione sul
 * conteggio passa subito e il `reload()` successivo annulla la richiesta
 * ancora in volo. Il risultato è un salvataggio che non avviene, e un test che
 * accusa il codice invece di sé stesso — verificato di persona.
 */
async function conSalvataggio(
  page: import('@playwright/test').Page,
  gesto: () => Promise<void>,
) {
  const risposta = page.waitForResponse((r) => r.request().method() === 'POST')
  await gesto()
  await risposta
}

async function creaSeduta(page: import('@playwright/test').Page, squadraId: string) {
  await page.goto(`/2026-27/presenze/${squadraId}`)
  await page.getByLabel('Data').fill(DATA_SEDUTA)
  await page.getByRole('button', { name: 'Nuova seduta' }).click()
  await expect(page).toHaveURL(new RegExp(`/2026-27/presenze/${squadraId}/[0-9a-f-]{36}$`))
}

test('l\'allenatore crea una seduta e compila il foglio della propria squadra', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  // Vede solo le squadre su cui ha un incarico.
  await page.goto('/2026-27/presenze')
  await expect(page.getByRole('link', { name: /Pulcini A/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Pulcini B/ })).toHaveCount(0)

  await creaSeduta(page, await squadraDi('Pulcini A'))
  await expect(page.getByText('0 di 1 compilate')).toBeVisible()

  await conSalvataggio(page, () =>
    page.getByRole('button', { name: 'Presente: Giocatore Uno' }).click())
  await expect(page.getByText('1 di 1 compilate')).toBeVisible()

  // Il dato è davvero salvato, non solo ottimistico.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Presente: Giocatore Uno' }))
    .toHaveAttribute('aria-pressed', 'true')
})

test('ripremere lo stesso stato riporta la riga a non compilata', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await creaSeduta(page, await squadraDi('Pulcini A'))

  await conSalvataggio(page, () =>
    page.getByRole('button', { name: 'Assente: Giocatore Uno' }).click())
  await expect(page.getByText('1 di 1 compilate')).toBeVisible()
  await conSalvataggio(page, () =>
    page.getByRole('button', { name: 'Assente: Giocatore Uno' }).click())
  await expect(page.getByText('0 di 1 compilate')).toBeVisible()

  await page.reload()
  await expect(page.getByText('0 di 1 compilate')).toBeVisible()
})

test('"tutti presenti" compila la rosa intera', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await creaSeduta(page, await squadraDi('Pulcini A'))
  await conSalvataggio(page, () => page.getByRole('button', { name: 'Tutti presenti' }).click())
  await expect(page.getByText('1 di 1 compilate')).toBeVisible()
  await page.reload()
  await expect(page.getByText('1 di 1 compilate')).toBeVisible()
})

test('due sedute nello stesso giorno e alla stessa ora sono rifiutate', async ({ page }) => {
  const squadraId = await squadraDi('Pulcini A')
  await accedi(page, 'dirigente@virpol.test')
  await creaSeduta(page, squadraId)

  await page.goto(`/2026-27/presenze/${squadraId}`)
  await page.getByLabel('Data').fill(DATA_SEDUTA)
  await page.getByRole('button', { name: 'Nuova seduta' }).click()
  const avviso = page.getByRole('alert').filter({ hasText: /già una seduta/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('se il salvataggio fallisce la spunta torna indietro e lo dice', async ({ page }) => {
  // La stagione viene chiusa a foglio già aperto: il click successivo trova
  // una policy che nega, e il rollback ottimistico deve essere visibile —
  // una spunta che resta fa credere di aver salvato, e lo si scopre settimane
  // dopo guardando le statistiche.
  const db = clientServizio()
  const squadraId = await squadraDi('Pulcini A')
  await accedi(page, 'dirigente@virpol.test')
  await creaSeduta(page, squadraId)

  await db.from('stagioni').update({ stato: 'chiusa' }).eq('codice', '2026-27')
  try {
    await page.getByRole('button', { name: 'Presente: Giocatore Uno' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /stagione è chiusa/i })).toBeVisible()
    await expect(page.getByText('0 di 1 compilate')).toBeVisible()
  } finally {
    await db.from('stagioni').update({ stato: 'aperta' }).eq('codice', '2026-27')
  }
})

test('un foglio sotto la squadra sbagliata dà 404', async ({ page }) => {
  const squadraA = await squadraDi('Pulcini A')
  const squadraB = await squadraDi('Pulcini B')
  await accedi(page, 'dirigente@virpol.test')
  await creaSeduta(page, squadraA)
  const sedutaId = page.url().split('/').pop()!

  const sbagliata = await page.goto(`/2026-27/presenze/${squadraB}/${sedutaId}`)
  expect(sbagliata?.status()).toBe(404)

  const inesistente = await page.goto(
    `/2026-27/presenze/${squadraA}/00000000-0000-4000-8000-000000000000`,
  )
  expect(inesistente?.status()).toBe(404)
})

test('l\'allenatore non apre il foglio di un\'altra squadra', async ({ page }) => {
  // La seduta si crea con il client di servizio e non dall'interfaccia: un
  // secondo `accedi` nella stessa pagina non mostrerebbe nemmeno il form,
  // perché il middleware rimanda al backoffice chi ha già una sessione.
  const db = clientServizio()
  const squadraB = await squadraDi('Pulcini B')
  const { data: squadra } = await db
    .from('squadre').select('stagione_id').eq('id', squadraB).single()
  const { data: seduta, error } = await db
    .from('sedute_allenamento')
    .insert({ squadra_id: squadraB, stagione_id: squadra!.stagione_id, data: DATA_SEDUTA })
    .select('id')
    .single()
  if (error) throw error
  const sedutaId = seduta.id

  await accedi(page, 'mister@virpol.test')
  // Le RLS gliela nascondono: 404 e non "non autorizzato", che gli
  // confermerebbe che quella seduta esiste.
  const risposta = await page.goto(`/2026-27/presenze/${squadraB}/${sedutaId}`)
  expect(risposta?.status()).toBe(404)
})
