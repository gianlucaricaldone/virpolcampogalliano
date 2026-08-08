import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const COGNOME = 'Provautente'
const EMAIL_NUOVA = 'provautente@virpol.test'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  const { data } = await db.auth.admin.listUsers({ perPage: 200 })
  const creato = data.users.find((u) => u.email === EMAIL_NUOVA)
  // Cancellare l'utente Auth porta via il profilo per cascade; la persona va
  // dopo, perché profili.persona_id è on delete restrict.
  if (creato) await db.auth.admin.deleteUser(creato.id)
  await db.from('persone').delete().eq('cognome', COGNOME)
}

test.beforeEach(async () => {
  await rimuoviProve()
  const db = clientServizio()
  const { error } = await db.from('persone').insert({
    nome: 'Rocco', cognome: COGNOME, data_nascita: '1985-02-11',
  })
  if (error) throw error
})
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Entra' }).click()
  // L'attesa è obbligatoria, come nell'accedi() di ogni altra suite E2E: il
  // redirect è lato client (Server Action + next/navigation), e senza
  // attendere il test procede mentre la navigazione è ancora in volo — la
  // richiesta successiva parte prima che il cookie di sessione sia arrivato
  // e cade sul login. Qui l'esito può essere una stagione (login riuscito) o
  // di nuovo /login con ?sessione=terminata (profilo disattivato): si
  // attende che l'URL cambi da quello di partenza, qualunque sia l'esito.
  await page.waitForURL((url) => url.pathname !== '/login' || url.search !== '')
}

test('l\'admin crea un mister e quel mister entra davvero', async ({ page, browser }) => {
  await accedi(page, 'admin@virpol.test')
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)

  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill(EMAIL_NUOVA)
  await page.getByLabel('Ruolo').selectOption('allenatore')
  await page.getByRole('radio', { name: new RegExp(`${COGNOME} Rocco`) }).check()
  await page.getByRole('button', { name: 'Crea utente' }).click()

  await expect(page.getByText('rocco_VIRPOL_1234')).toBeVisible()
  await expect(page.getByRole('cell', { name: EMAIL_NUOVA })).toBeVisible()

  // Contesto nuovo: la pagina corrente ha già la sessione dell'admin, e il
  // middleware rimanderebbe indietro chi apre /login con un cookie valido.
  const contesto = await browser.newContext()
  const paginaMister = await contesto.newPage()
  await accedi(paginaMister, EMAIL_NUOVA, 'rocco_VIRPOL_1234')
  await expect(paginaMister).toHaveURL(/\/\d{4}-\d{2}$/)
  // Nessun incarico: vede il messaggio, non un elenco altrui.
  await paginaMister.goto('/2026-27/presenze')
  await expect(paginaMister.getByText(/non hai incarichi/i)).toBeVisible()
  await contesto.close()
})

test('un utente disattivato non entra più', async ({ page, browser }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill(EMAIL_NUOVA)
  await page.getByLabel('Ruolo').selectOption('dirigente')
  await page.getByRole('button', { name: 'Crea utente' }).click()
  await expect(page.getByRole('cell', { name: EMAIL_NUOVA })).toBeVisible()

  await page.getByRole('row').filter({ hasText: EMAIL_NUOVA })
    .getByRole('button', { name: 'Disattiva' }).click()
  await expect(page.getByRole('row').filter({ hasText: EMAIL_NUOVA }))
    .toContainText('disattivato')

  const contesto = await browser.newContext()
  const paginaBloccata = await contesto.newPage()
  await accedi(paginaBloccata, EMAIL_NUOVA, 'provautente_VIRPOL_1234')
  await expect(paginaBloccata).toHaveURL(/\/login/)
  await contesto.close()
})

test('l\'admin non può disattivare sé stesso', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto('/admin/utenti')
  const propria = page.getByRole('row').filter({ hasText: 'admin@virpol.test' })
  await expect(propria.getByRole('button', { name: 'Disattiva' })).toHaveCount(0)
})

test('un dirigente non entra nella gestione utenti', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await expect(page.getByRole('link', { name: 'Utenti' })).toHaveCount(0)
  await page.goto('/admin/utenti')
  await expect(page).toHaveURL(/\/2026-27$/)
})

test('un\'email già usata lo dice, invece di lasciare un utente a metà', async ({ page }) => {
  await accedi(page, 'admin@virpol.test')
  await page.goto(`/admin/utenti?q=${COGNOME}`)
  await page.getByLabel('Email').fill('admin@virpol.test')
  await page.getByLabel('Ruolo').selectOption('dirigente')
  await page.getByRole('button', { name: 'Crea utente' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /già un utente/i })).toBeVisible()
})
