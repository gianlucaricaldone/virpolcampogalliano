import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

// Serve solo ai test di disattivazione qui sotto, per scrivere sul database
// indipendentemente dal server Next in esecuzione: in locale arriva da
// .env.local, in CI dall'ambiente.
try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

test.afterAll(async () => {
  // Il test di disattivazione qui sotto disattiva mister@virpol.test: senza
  // questo ripristino resterebbe disattivato per il resto della suite E2E,
  // che gira su un unico database condiviso. Idempotente: non fa nulla se
  // l'utente non esiste o è già attivo.
  const db = clientServizio()
  const { data } = await db.auth.admin.listUsers()
  const mister = data.users.find((u) => u.email === 'mister@virpol.test')
  if (mister) await db.from('profili').update({ attivo: true }).eq('id', mister.id)
})

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

test('un profilo disattivato porta al login, non a un ciclo di redirect', async ({ page }) => {
  const db = clientServizio()
  const { data } = await db.auth.admin.listUsers()
  const mister = data.users.find((u) => u.email === 'mister@virpol.test')!

  await page.goto('/login')
  await page.getByLabel('Email').fill('mister@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/2026-27$/)

  // auth.getUser() continuerà a riuscire: Supabase Auth non sa nulla di
  // profili. Senza il fix per la disattivazione, il prossimo /gestione
  // finirebbe in ERR_TOO_MANY_REDIRECTS fra middleware e (app)/layout.tsx.
  await db.from('profili').update({ attivo: false }).eq('id', mister.id)

  await page.goto('/gestione')
  await expect(page).toHaveURL(/\/login\?sessione=terminata$/)
  await expect(page.getByRole('heading', { name: 'Accesso' })).toBeVisible()
})

test('su telefono le voci stanno in un pannello che si apre e si chiude navigando', async ({ page }) => {
  // 390px: il viewport su cui la barra a capo occupava tre righe.
  await page.setViewportSize({ width: 390, height: 780 })
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)

  const pannello = page.locator('#menu-backoffice')
  const apri = page.getByRole('button', { name: 'Apri il menù' })

  // A pannello chiuso nessuna voce è raggiungibile, ma Esci sì: è l'unica che
  // si cerca di fretta e non deve costare due gesti.
  await expect(pannello).toBeHidden()
  await expect(page.getByRole('button', { name: 'Esci' })).toBeVisible()

  await apri.click()
  await expect(pannello).toBeVisible()
  await expect(apri).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chiudi il menù' })).toHaveAttribute('aria-expanded', 'true')

  // Il layout non si rimonta fra una pagina e l'altra: senza l'effetto sul
  // percorso il pannello resterebbe aperto sopra la pagina appena raggiunta.
  await pannello.getByRole('link', { name: 'Anagrafica' }).click()
  await expect(page).toHaveURL(/\/anagrafica$/)
  await expect(pannello).toBeHidden()

  // Da desktop il pannello non serve e il pulsante non c'è.
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.getByRole('button', { name: 'Apri il menù' })).toBeHidden()
  await expect(page.getByRole('link', { name: 'Anagrafica' })).toBeVisible()
})
