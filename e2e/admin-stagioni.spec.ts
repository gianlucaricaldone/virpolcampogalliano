import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

// Serve solo all'afterAll qui sotto, per scrivere sul database indipendentemente
// dal server Next in esecuzione: in locale arriva da .env.local, in CI dall'ambiente.
try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  // L'attesa è obbligatoria: il redirect è lato client, e senza questa il
  // test procede mentre la navigazione è ancora in volo.
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

test.afterAll(async () => {
  // Questa suite crea la 2027-28 e chiude la 2026-27: senza ripristino, i file
  // E2E successivi in ordine alfabetico (stagioni.spec.ts) fallirebbero
  // assumendo la 2026-27 aperta, per una ragione che punta a un file che non
  // hanno toccato. Gira una sola volta, a fine file, indipendentemente
  // dall'esito dei singoli test qui sopra: anche se un'asserzione fallisse a
  // metà di uno di essi, il mondo torna com'era. Scrive direttamente sul
  // database, non tramite l'interfaccia: un ripristino che ripassasse
  // dall'interfaccia erediterebbe la stessa fragilità che il test "chiudere
  // una stagione" qui sotto ripara nell'altro senso (vedi il suo commento).
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
  await db.from('stagioni').update({ stato: 'aperta' }).eq('codice', '2026-27')
  await db.from('stagioni').delete().eq('codice', '2027-28')
})

// Questo caso non muta lo stato delle stagioni: va per primo così la sua
// asserzione (redirect su /2026-27) non dipende da cosa fanno i test più
// sotto, che creano la 2027-28 e chiudono la 2026-27 — l'afterAll li
// ripristina solo a fine file, non fra un test e l'altro.
test('un dirigente non entra nella gestione stagioni', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/admin/stagioni')
  await expect(page).toHaveURL(/\/2026-27$/)
})

test('l\'admin crea una stagione e la vede in elenco', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2027-28')
  await page.getByLabel('Inizio').fill('2027-09-01')
  await page.getByLabel('Fine').fill('2028-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  await expect(page.getByRole('cell', { name: '2027/2028' })).toBeVisible()
})

test('un codice malformato mostra un messaggio accanto al campo', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2027/2028')
  await page.getByLabel('Inizio').fill('2027-09-01')
  await page.getByLabel('Fine').fill('2028-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  await expect(
    page.getByRole('alert').filter({ hasText: '2026-27' }),
  ).toBeVisible()
})

test('un codice già esistente mostra il messaggio tradotto, non l\'errore Postgres', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2026-27')
  await page.getByLabel('Inizio').fill('2026-09-01')
  await page.getByLabel('Fine').fill('2027-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  const avviso = page.getByRole('alert').filter({ hasText: /già una stagione/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('chiudere una stagione la mette in sola lettura', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  // Localizzare la RIGA di 2026-27, non usare .first(): in elenco possono
  // esserci altre stagioni già chiuse, e `.first()` intercetterebbe una di
  // quelle. L'assertion passerebbe prima che 2026-27 sia davvero chiusa, e il
  // fallimento emergerebbe in un test diverso — un verde che rompe altro.
  const riga = page.getByRole('row').filter({ hasText: '2026/2027' })
  await riga.getByRole('button', { name: 'Chiudi' }).click()
  await expect(riga.getByRole('cell', { name: 'chiusa' })).toBeVisible()
  await page.goto('/2026-27')
  await expect(page.getByText('Stagione chiusa: dati in sola lettura')).toBeVisible()
})
