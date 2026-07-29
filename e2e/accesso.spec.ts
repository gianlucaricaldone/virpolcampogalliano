import { expect, test } from '@playwright/test'

const PASSWORD = 'virpol-dev-123'

test('un utente non autenticato che apre il backoffice finisce sul login', async ({ page }) => {
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Accesso' })).toBeVisible()
})

test('credenziali errate mostrano un messaggio e non fanno entrare', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill('sbagliata')
  await page.getByRole('button', { name: 'Entra' }).click()
  // Next.js monta anche un announcer di rotta con role="alert" (vuoto, per
  // gli screen reader): getByRole('alert') da solo risulta ambiguo. Si filtra
  // sul testo per prendere il messaggio del form, non l'announcer.
  await expect(page.getByRole('alert').filter({ hasText: /non corretti/i })).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('l\'admin accede e viene portato sulla stagione corrente', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
})

test('chi è già autenticato non vede il login', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)
  await page.goto('/login')
  await expect(page).toHaveURL(/\/2026-27$/)
})
