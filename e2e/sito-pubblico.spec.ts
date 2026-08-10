import { expect, test } from '@playwright/test'

// Nessuna sessione: il sito pubblico si visita da anonimi. Gli status si
// asseriscono su response.status(), non sul contenuto: con lo streaming un
// 200 può contenere una pagina d'errore (docs/TRAPPOLE.md §7).

const PAGINE_PUBBLICHE = ['/', '/squadre', '/contatti', '/dove-siamo']

test('la home risponde e mostra le sezioni', async ({ page }) => {
  const risposta = await page.goto('/')
  expect(risposta?.status()).toBe(200)
  await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible()
  await expect(page.locator('#chi-siamo')).toBeVisible()
})

test('i numeri della home vengono dal database e non sono zero', async ({ page }) => {
  await page.goto('/')
  // `data-numero` e non il testo: i due riquadri possono mostrare la stessa
  // cifra, e cercare «2» prenderebbe quello sbagliato senza dirlo.
  const squadre = Number(await page.locator('[data-numero="squadre"] div').first().innerText())
  const atleti = Number(await page.locator('[data-numero="atleti"] div').first().innerText())
  // Maggiore di zero, non la cifra esatta: sotto `build && start` sarebbe 2 e 2,
  // ma con un dev server riusato le suite che girano prima creano tesseramenti
  // nella stagione corrente. Lo zero è il difetto vero da intercettare — è
  // quello che comparirebbe se la vista finisse security_invoker in produzione.
  expect(squadre).toBeGreaterThan(0)
  expect(atleti).toBeGreaterThan(0)
})

test('dalla home spariscono le cifre inventate e il 2009', async ({ page }) => {
  await page.goto('/')
  for (const inventato of ['Anni di Storia', 'Trofei Vinti', '15+', '180+', '42+']) {
    await expect(page.getByText(inventato)).toHaveCount(0)
  }
  // Il footer sta nel layout, quindi questa assertion vale per tutte e quattro
  // le pagine pubbliche in una volta.
  await expect(page.getByText(/dal 2009/i)).toHaveCount(0)
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

test('i contatti dicono che sono in lavorazione, invece di dare recapiti falsi', async ({ page }) => {
  await page.goto('/contatti')
  await expect(page.getByText('Lavori in corso')).toBeVisible()
  // Dentro `main`: l'indirizzo sta anche nel footer, e senza questo confine il
  // test passerebbe anche se il contenuto della pagina fosse vuoto.
  await expect(page.getByRole('main').getByText('Via Enrico Mattei 15')).toBeVisible()
})

test('dove siamo porta al centro sportivo vero', async ({ page }) => {
  await page.goto('/dove-siamo')
  // `.first()` su entrambi: la pagina nomina la sede due volte, nel sottotitolo
  // e nella scheda dell'indirizzo. Qui basta che ci sia.
  const contenuto = page.getByRole('main')
  await expect(contenuto.getByText('Via Enrico Mattei 15').first()).toBeVisible()
  await expect(contenuto.getByText(/Lauro Bolelli/).first()).toBeVisible()

  // I due pulsanti sono l'unica indicazione stradale della pagina: puntavano
  // alle homepage di Maps e Waze, che è come si rompe un link senza sembrare
  // rotto.
  const maps = page.getByRole('link', { name: 'Apri in Google Maps' })
  await expect(maps).toHaveAttribute('href', /Via%20Enrico%20Mattei%2015/)
  const waze = page.getByRole('link', { name: 'Naviga con Waze' })
  await expect(waze).toHaveAttribute('href', /Lauro%20Bolelli/)
})

test('nessuna pagina pubblica pubblica un telefono o una email', async ({ page }) => {
  // La guardia contro il rientro. Il sito aveva cinque telefoni segnaposto e
  // quattro email su un dominio non verificato: finché non ci sono quelli veri,
  // un `tel:` o un `mailto:` in una pagina pubblica è un dato inventato tornato
  // dentro, e questo test è l'unico posto che se ne accorge.
  for (const percorso of PAGINE_PUBBLICHE) {
    await page.goto(percorso)
    await expect(page.locator('a[href^="tel:"]')).toHaveCount(0)
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
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
