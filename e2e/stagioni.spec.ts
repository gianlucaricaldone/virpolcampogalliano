import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

async function accedi(page: import('@playwright/test').Page, email = 'admin@virpol.test') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
}

test('/gestione porta alla stagione corrente', async ({ page }) => {
  await accedi(page)
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/2026-27$/)
  await expect(page.getByRole('heading', { name: 'Stagione 2026/2027' })).toBeVisible()
})

test('un codice stagione inesistente dà 404, non una pagina bianca', async ({ page }) => {
  await accedi(page)
  const risposta = await page.goto('/1999-00')
  expect(risposta?.status()).toBe(404)
})

test('il selettore mostra le stagioni chiuse come tali e ne cambia solo il segmento', async ({ page }) => {
  await accedi(page)
  await page.goto('/2026-27')
  // Non `getByRole('combobox')`: il cruscotto ha anche il filtro Squadra, e
  // due combobox violano la modalità strict. Il selettore di stagione è
  // l'unico etichettato "Stagione" — il nome accessibile include il testo
  // delle opzioni, quindi la corrispondenza è per prefisso.
  const selettore = page.getByLabel(/^Stagione/)
  await expect(selettore).toHaveValue('2026-27')

  // scripts/seed-dev.ts semina anche la 2025-26, chiusa: prima di questo il
  // selettore aveva una sola opzione e nessun test poteva verificare né
  // l'etichetta "(chiusa)" né che selezionarne una diversa sposti davvero il
  // segmento di stagione nell'URL — cancellando SelettoreStagione.cambia()
  // per intero, questo stesso test restava verde.
  await expect(selettore.locator('option[value="2025-26"]')).toHaveText('2025/2026 (chiusa)')

  await selettore.selectOption('2025-26')
  await expect(page).toHaveURL(/\/2025-26$/)
})

test('l\'uscita riporta al login e chiude la sessione', async ({ page }) => {
  await accedi(page)
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login$/)
})
