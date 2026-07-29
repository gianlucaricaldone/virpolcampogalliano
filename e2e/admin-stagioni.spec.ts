import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  // Il click avvia una Server Action che reindirizza lato client: senza
  // attendere l'arrivo, il goto successivo verso /admin/stagioni parte prima
  // che il cookie di sessione sia stabilito e la richiesta torna al login.
  await expect(page).toHaveURL(/\/2026-27$/)
}

test('l\'admin crea una stagione e la vede in elenco', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/stagioni')
  await page.getByLabel('Codice').fill('2027-28')
  await page.getByLabel('Inizio').fill('2027-09-01')
  await page.getByLabel('Fine').fill('2028-06-30')
  await page.getByRole('button', { name: 'Crea stagione' }).click()
  await expect(page.getByRole('cell', { name: '2027/2028' })).toBeVisible()

  // La 2027-28 appena creata è più recente della 2026-27 seminata dagli altri
  // file E2E: se restasse aperta diventerebbe lei la stagione corrente e
  // sposterebbe l'atterraggio dopo il login (accesso.spec.ts, stagioni.spec.ts
  // atterrano su /2026-27). La chiudiamo qui: è "una stagione separata da
  // chiudere", creata solo per essere verificata in elenco.
  const riga2027 = page.getByRole('row').filter({ hasText: '2027/2028' })
  await riga2027.getByRole('button', { name: 'Chiudi' }).click()
  await expect(riga2027.getByRole('cell', { name: 'chiusa' })).toBeVisible()
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
  // A questo punto la 2027-28 è già chiusa (test precedente) e mostra già una
  // cella "chiusa": un controllo con .first() sulla cella, senza ancorarlo
  // alla riga giusta, risulterebbe vero anche se il click sotto non avesse
  // ancora effetto, e la navigazione successiva partirebbe prima che
  // l'azione sia davvero completata. Si verifica quindi la riga 2026-27.
  const riga2026 = page.getByRole('row').filter({ hasText: '2026/2027' })
  await riga2026.getByRole('button', { name: 'Chiudi' }).click()
  await expect(riga2026.getByRole('cell', { name: 'chiusa' })).toBeVisible()
  await page.goto('/2026-27')
  await expect(page.getByText('Stagione chiusa: dati in sola lettura')).toBeVisible()

  // Ripristina lo stato per i file E2E successivi (in ordine alfabetico dopo
  // questo: stagioni.spec.ts), che assumono la 2026-27 aperta.
  await page.goto('/admin/stagioni')
  await riga2026.getByRole('button', { name: 'Riapri' }).click()
  await expect(riga2026.getByRole('cell', { name: 'aperta' })).toBeVisible()
})

test('un dirigente non entra nella gestione stagioni', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/admin/stagioni')
  await expect(page).toHaveURL(/\/2026-27$/)
})
