import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/**
 * Gli importi e i versamenti del seed non esistono: questa suite li crea e li
 * toglie. Senza il ripristino, il cruscotto scadenze e le altre suite
 * vedrebbero quote configurate che non si aspettano.
 */
async function rimuoviProve() {
  const db = clientServizio()
  const { data: stagione } = await db.from('stagioni').select('id').eq('codice', '2026-27').single()
  const { data: squadre } = await db.from('squadre').select('id').eq('stagione_id', stagione!.id)
  const { data: tesseramenti } = await db
    .from('tesseramenti').select('id').eq('stagione_id', stagione!.id)

  const idTesseramenti = (tesseramenti ?? []).map((t) => t.id)
  if (idTesseramenti.length > 0) {
    await db.from('pagamenti_quota').delete().in('tesseramento_id', idTesseramenti)
    await db.from('quote_importi').delete().in('tesseramento_id', idTesseramenti)
  }
  const idSquadre = (squadre ?? []).map((s) => s.id)
  if (idSquadre.length > 0) await db.from('quote_importi').delete().in('squadra_id', idSquadre)
  await db.from('quote_importi').delete().eq('stagione_id', stagione!.id)
}

// beforeEach e non beforeAll: i casi qui sotto lasciano versamenti registrati,
// e il successivo troverebbe due pulsanti "Annulla" dove ne aspetta uno. Con
// una tabella condivisa, l'indipendenza fra test va ricostruita a ogni test.
test.beforeEach(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

async function apriImporti(page: import('@playwright/test').Page) {
  await page.goto('/2026-27/quote')
  // `<details>` e non un pulsante con stato React: si apre cliccando il summary.
  await page.getByText('Importi della stagione').click()
}

test('l\'importo di stagione vale per tutti, quello di squadra lo sovrascrive', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await apriImporti(page)

  await page.getByLabel('Tutta la stagione 2026/2027').fill('250,00')
  await page.getByLabel('Tutta la stagione 2026/2027').press('Enter')
  const riga = page.getByRole('row').filter({ hasText: 'Giocatore Uno' })
  await expect(riga).toContainText('250,00')
  // Il livello va detto: senza, un override sembra un errore di calcolo.
  await expect(riga).toContainText('stagione')

  await apriImporti(page)
  await page.getByLabel('Pulcini A').fill('280')
  await page.getByLabel('Pulcini A').press('Enter')
  const dopo = page.getByRole('row').filter({ hasText: 'Giocatore Uno' })
  await expect(dopo).toContainText('280,00')
  await expect(dopo).toContainText('squadra')
  // L'altra squadra resta sul default della stagione.
  await expect(page.getByRole('row').filter({ hasText: 'Giocatore Due' })).toContainText('250,00')
})

test('un versamento parziale porta lo stato a parziale, il saldo a saldato', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await apriImporti(page)
  await page.getByLabel('Tutta la stagione 2026/2027').fill('250')
  await page.getByLabel('Tutta la stagione 2026/2027').press('Enter')

  await page.getByRole('link', { name: 'Giocatore Uno' }).click()
  // "Metà" non è un caso speciale: è un versamento di importo pari a metà, e
  // il pulsante si limita a precompilare il campo.
  await page.getByRole('button', { name: /Metà quota/ }).click()
  await page.getByRole('button', { name: 'Registra versamento' }).click()
  await expect(page.getByText('parziale')).toBeVisible()

  await page.getByRole('button', { name: /Saldo/ }).click()
  await page.getByRole('button', { name: 'Registra versamento' }).click()
  await expect(page.getByText('saldato')).toBeVisible()
})

test('chi versa più del dovuto ha un credito, non un errore', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await apriImporti(page)
  await page.getByLabel('Tutta la stagione 2026/2027').fill('100')
  await page.getByLabel('Tutta la stagione 2026/2027').press('Enter')

  await page.getByRole('link', { name: 'Giocatore Due' }).click()
  await page.getByLabel('Importo', { exact: true }).fill('150')
  await page.getByRole('button', { name: 'Registra versamento' }).click()

  await expect(page.getByText('Credito')).toBeVisible()
  await page.goto('/2026-27/quote')
  await expect(page.getByRole('row').filter({ hasText: 'Giocatore Due' }))
    .toContainText('credito')
})

test('annullare un versamento riporta indietro lo stato', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await apriImporti(page)
  await page.getByLabel('Tutta la stagione 2026/2027').fill('200')
  await page.getByLabel('Tutta la stagione 2026/2027').press('Enter')

  await page.getByRole('link', { name: 'Giocatore Uno' }).click()
  await page.getByLabel('Importo', { exact: true }).fill('200')
  await page.getByRole('button', { name: 'Registra versamento' }).click()
  await expect(page.getByText('saldato')).toBeVisible()

  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(page.getByText('non pagato')).toBeVisible()
})

test('un importo scritto male non arriva al database', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await apriImporti(page)
  await page.getByLabel('Tutta la stagione 2026/2027').fill('duecento')
  await page.getByLabel('Tutta la stagione 2026/2027').press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: /importo valido/i })).toBeVisible()
})

test('l\'allenatore non ha accesso alle quote, nemmeno per URL', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await expect(page.getByRole('link', { name: 'Quote' })).toHaveCount(0)

  await page.goto('/2026-27/quote')
  await expect(page).toHaveURL(/\/2026-27$/)

  const db = clientServizio()
  const { data: tesseramento } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Uno').single()
  await page.goto(`/2026-27/tesseramenti/${tesseramento!.id}`)
  await expect(page.getByText('Quota di iscrizione')).toHaveCount(0)
})
