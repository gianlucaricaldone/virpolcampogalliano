import { expect, test } from '@playwright/test'

// Nessuna sessione: il sito pubblico si visita da anonimi. Gli status si
// asseriscono su response.status(), non sul contenuto: con lo streaming un
// 200 può contenere una pagina d'errore (docs/TRAPPOLE.md §7).

test('la home risponde e mostra le sezioni', async ({ page }) => {
  const risposta = await page.goto('/')
  expect(risposta?.status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible()
  await expect(page.locator('#chi-siamo')).toBeVisible()
})

test('le squadre della stagione corrente si leggono da anonimi', async ({ page }) => {
  const risposta = await page.goto('/squadre')
  expect(risposta?.status()).toBe(200)
  await expect(page.getByText('Pulcini A')).toBeVisible()
  await expect(page.getByText('Pulcini B')).toBeVisible()
})

test('contatti e dove siamo rispondono', async ({ page }) => {
  for (const percorso of ['/contatti', '/dove-siamo']) {
    const risposta = await page.goto(percorso)
    expect(risposta?.status()).toBe(200)
  }
})

test('Accedi porta al login', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/login/)
})

test('il backoffice resta protetto', async ({ page }) => {
  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login/)
})
