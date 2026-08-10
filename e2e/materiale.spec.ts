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

/** Il seed non registra consegne: questa suite le scrive e le riazzera. */
async function rimuoviProve() {
  const db = clientServizio()
  const { error } = await db
    .from('tesseramenti')
    .update({ materiale_consegnato: false, materiale_taglia: null })
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

test.beforeEach(rimuoviProve)
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

/**
 * Il SÌ/NO del materiale, non quello della visita. Sulla scheda del tesserato ce
 * ne sono due, e un `getByText('Sì')` non scoperto li prenderebbe entrambi: il
 * nome del gruppo è l'unica cosa che li distingue.
 */
function consegnato(page: import('@playwright/test').Page) {
  return page.getByRole('group', { name: 'Consegnato' })
}

test('senza nulla registrato il materiale è da consegnare e la taglia da chiedere', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${await tesseramentoDi('Uno')}`)
  await expect(page.getByText('Non consegnato, taglia da chiedere')).toBeVisible()
})

test('la taglia si registra prima della consegna', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Uno')
  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)

  // Il campo della taglia c'è anche col NO: è l'ordine reale del lavoro —
  // prima si prendono le misure, poi arriva la fornitura. Nel pannello della
  // visita il campo della data compare solo dopo il Sì, e la differenza è
  // deliberata.
  await page.getByLabel('Taglia').selectOption('M')
  await page.getByRole('button', { name: 'Salva materiale' }).click()
  await expect(page.getByText('Da consegnare · taglia M')).toBeVisible()

  const { data } = await db
    .from('tesseramenti')
    .select('materiale_consegnato, materiale_taglia')
    .eq('id', id)
    .single()
  expect(data).toEqual({ materiale_consegnato: false, materiale_taglia: 'M' })
})

test('la consegna si registra col Sì e non cancella la taglia', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Uno')
  await db.from('tesseramenti').update({ materiale_taglia: 'L' }).eq('id', id)

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  await expect(page.getByText('Da consegnare · taglia L')).toBeVisible()

  await consegnato(page).getByText('Sì', { exact: true }).click()
  await page.getByRole('button', { name: 'Salva materiale' }).click()
  await expect(page.getByText('Consegnato · taglia L')).toBeVisible()

  const { data } = await db
    .from('tesseramenti')
    .select('materiale_consegnato, materiale_taglia')
    .eq('id', id)
    .single()
  expect(data).toEqual({ materiale_consegnato: true, materiale_taglia: 'L' })
})

test('si può consegnare senza sapere la taglia', async ({ page }) => {
  const id = await tesseramentoDi('Due')
  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  await consegnato(page).getByText('Sì', { exact: true }).click()
  await page.getByRole('button', { name: 'Salva materiale' }).click()
  await expect(page.getByText('Consegnato, taglia non registrata')).toBeVisible()
})

test('l\'elenco dei tesserati filtra sul materiale', async ({ page }) => {
  const db = clientServizio()
  await db
    .from('tesseramenti')
    .update({ materiale_consegnato: true, materiale_taglia: 'M' })
    .eq('id', await tesseramentoDi('Uno'))

  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2026-27/tesseramenti')

  const conteggio = page.locator('p[aria-live="polite"]')
  await expect(conteggio).toHaveText('2 tesserati')
  await expect(page.getByRole('cell', { name: 'Sì · M' })).toBeVisible()

  await page.getByLabel('Materiale').selectOption('si')
  await expect(conteggio).toHaveText('1 di 2')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()

  await page.getByLabel('Materiale').selectOption('no')
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()

  // La taglia è una domanda a sé, nello stesso menù: chi l'ha presa e chi no.
  await page.getByLabel('Materiale').selectOption('t:M')
  await expect(conteggio).toHaveText('1 di 2')
  await page.getByLabel('Materiale').selectOption('senza')
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()

  await page.getByRole('button', { name: 'Azzera i filtri' }).click()
  await expect(conteggio).toHaveText('2 tesserati')
})

test('la rosa della squadra mostra la colonna del materiale', async ({ page }) => {
  const db = clientServizio()
  await db
    .from('tesseramenti')
    .update({ materiale_consegnato: true, materiale_taglia: 'S' })
    .eq('id', await tesseramentoDi('Uno'))
  const { data: squadra } = await db
    .from('squadre').select('id').eq('nome', 'Pulcini A').single()

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/squadre/${squadra!.id}`)
  await expect(page.getByRole('cell', { name: 'Sì · S' })).toBeVisible()
})

test('l\'allenatore legge il materiale dei suoi ma non lo scrive', async ({ page }) => {
  const db = clientServizio()
  const id = await tesseramentoDi('Uno')
  await db
    .from('tesseramenti')
    .update({ materiale_consegnato: true, materiale_taglia: 'M' })
    .eq('id', id)

  await accedi(page, 'mister@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${id}`)
  // Sapere se la sua squadra ha le divise è cosa sua; registrarne la consegna no.
  await expect(page.getByText('Consegnato · taglia M')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salva materiale' })).toHaveCount(0)
})
