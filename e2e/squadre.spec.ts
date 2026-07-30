import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const PREFISSO = 'Provasquadra'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  const { error } = await db.from('squadre').delete().like('nome', `${PREFISSO}%`)
  if (error) throw error
}

test.beforeAll(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

async function crea(page: import('@playwright/test').Page, nome: string) {
  await page.goto('/2026-27/squadre/nuova')
  await page.getByLabel('Nome').fill(nome)
  await page.getByLabel('Categoria').fill('Esordienti')
  await page.getByLabel('Annata').fill('2013')
  await page.getByRole('button', { name: 'Crea squadra' }).click()
}

test('un dirigente crea una squadra e la vede in elenco', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Alfa`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Alfa` })).toBeVisible()

  await page.goto('/2026-27/squadre')
  await expect(page.getByRole('link', { name: `${PREFISSO} Alfa` })).toBeVisible()
})

test('un nome già usato nella stagione mostra il messaggio tradotto', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Beta`)
  await expect(page.getByRole('heading', { name: `${PREFISSO} Beta` })).toBeVisible()

  await crea(page, `${PREFISSO} Beta`)
  const avviso = page.getByRole('alert').filter({ hasText: /già una squadra/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('eliminare una squadra chiede conferma ed elenca le conseguenze', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await crea(page, `${PREFISSO} Gamma`)
  await page.getByRole('button', { name: 'Elimina squadra' }).click()
  await expect(page.getByText(/spariscono anche le sue sedute/i)).toBeVisible()
  await page.getByRole('button', { name: 'Elimina definitivamente' }).click()

  await expect(page).toHaveURL(/\/2026-27\/squadre$/)
  await expect(page.getByRole('link', { name: `${PREFISSO} Gamma` })).toHaveCount(0)
})

test('un allenatore vede le squadre ma non può crearne né modificarle', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/squadre')
  await expect(page.getByRole('link', { name: 'Pulcini A' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Nuova squadra' })).toHaveCount(0)

  await page.goto('/2026-27/squadre/nuova')
  await expect(page).toHaveURL(/\/2026-27\/squadre$/)

  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByText(/non hai i permessi/i)).toBeVisible()
})

test('su stagione chiusa la squadra è in sola lettura', async ({ page }) => {
  const db = clientServizio()
  const { data: stagione } = await db
    .from('stagioni').select('id').eq('codice', '2025-26').single()
  const { data: squadra } = await db
    .from('squadre')
    .upsert(
      { stagione_id: stagione!.id, nome: `${PREFISSO} Chiusa`, categoria: 'Pulcini' },
      { onConflict: 'stagione_id,nome' },
    )
    .select('id')
    .single()

  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2025-26/squadre')
  await expect(page.getByRole('link', { name: 'Nuova squadra' })).toHaveCount(0)

  await page.goto(`/2025-26/squadre/${squadra!.id}`)
  await expect(page.getByText(/stagione chiusa/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Elimina squadra' })).toHaveCount(0)
})

test('una squadra di un\'altra stagione dà 404 sotto questo codice', async ({ page }) => {
  const db = clientServizio()
  const { data: squadra } = await db
    .from('squadre').select('id').eq('nome', 'Pulcini A').single()

  await accedi(page, 'dirigente@virpol.test')
  // La squadra esiste, ma non nella 2025-26: lo status distingue "non c'è"
  // da "pagina vuota andata a buon fine".
  const risposta = await page.goto(`/2025-26/squadre/${squadra!.id}`)
  expect(risposta?.status()).toBe(404)

  const inesistente = await page.goto('/2026-27/squadre/00000000-0000-4000-8000-000000000000')
  expect(inesistente?.status()).toBe(404)
})
