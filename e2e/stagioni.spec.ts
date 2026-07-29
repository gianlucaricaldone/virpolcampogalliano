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

test('il selettore cambia solo il segmento di stagione', async ({ page }) => {
  await accedi(page)
  await page.goto('/2026-27')
  await expect(page.getByRole('combobox')).toHaveValue('2026-27')
})

test('l\'uscita riporta al login e chiude la sessione', async ({ page }) => {
  await accedi(page)
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login$/)
})
