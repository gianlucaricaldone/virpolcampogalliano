import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

/** Il seed non registra visite: questa suite le scrive e le riazzera. */
async function rimuoviProve() {
  const db = clientServizio()
  const { error } = await db
    .from('tesseramenti')
    .update({ visita_scadenza: null, visita_consegnata_il: null })
    .not('id', 'is', null)
  if (error) throw error
}

async function tesseramentoDi(nome: string): Promise<string> {
  const db = clientServizio()
  const { data, error } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', nome).single()
  if (error) throw error
  return data.id
}

function giorniDaOggi(giorni: number): string {
  const data = new Date()
  data.setDate(data.getDate() + giorni)
  return data.toISOString().slice(0, 10)
}

test.beforeEach(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

test('senza scadenza la visita risulta mancante', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${await tesseramentoDi('Uno')}`)
  await expect(page.getByText('Nessuna visita registrata')).toBeVisible()
})

test('registrare una scadenza futura la rende valida', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${await tesseramentoDi('Uno')}`)
  await page.getByLabel('Scadenza').fill(giorniDaOggi(200))
  await page.getByLabel('Consegnata il').fill(giorniDaOggi(0))
  await page.getByRole('button', { name: 'Salva visita' }).click()
  await expect(page.getByText(/Valida fino al/)).toBeVisible()
})

test('una scadenza passata dice da quanto è scaduta', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Due')
  await db.from('tesseramenti').update({ visita_scadenza: giorniDaOggi(-3) }).eq('id', id)

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  await expect(page.getByText('Scaduta da 3 giorni')).toBeVisible()
})

test('entro trenta giorni avvisa prima che scada', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Due')
  await db.from('tesseramenti').update({ visita_scadenza: giorniDaOggi(10) }).eq('id', id)

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  await expect(page.getByText('Scade fra 10 giorni')).toBeVisible()
})

test('l\'allenatore legge la visita dei suoi ma non la scrive', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Uno')
  await db.from('tesseramenti').update({ visita_scadenza: giorniDaOggi(-1) }).eq('id', id)

  await accedi(page, 'mister@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  // Sapere chi non può scendere in campo è esattamente il suo mestiere.
  await expect(page.getByText('Scaduta da 1 giorno')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salva visita' })).toHaveCount(0)
})
