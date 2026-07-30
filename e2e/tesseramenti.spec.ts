import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const COGNOME = 'Provatess'
// Data riconoscibile: la seduta creata qui va rimossa senza toccare quelle di
// altre suite.
const DATA_SEDUTA = '2027-01-15'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  const db = clientServizio()
  await db.from('sedute_allenamento').delete().eq('data', DATA_SEDUTA)

  const { data: persone } = await db.from('persone').select('id').like('cognome', `${COGNOME}%`)
  const ids = (persone ?? []).map((p) => p.id)
  if (ids.length === 0) return
  // Ordine inverso di dipendenza: le FK verso persone sono `restrict`.
  await db.from('incarichi_staff').delete().in('persona_id', ids)
  await db.from('tesseramenti').delete().in('persona_id', ids)
  const { error } = await db.from('persone').delete().in('id', ids)
  if (error) throw error
}

async function creaPersona(nome: string): Promise<string> {
  const db = clientServizio()
  const { data, error } = await db
    .from('persone')
    .insert({ nome, cognome: COGNOME, data_nascita: '2014-06-01' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
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

async function tessera(
  page: import('@playwright/test').Page,
  nome: string,
  squadra: string,
  maglia = '',
) {
  await page.goto(`/2026-27/tesseramenti/nuovo?q=${COGNOME}`)
  await page.getByRole('radio', { name: new RegExp(`${COGNOME} ${nome}`) }).check()
  await page.getByLabel('Squadra').selectOption({ label: squadra })
  if (maglia) await page.getByLabel('Numero di maglia').fill(maglia)
  await page.getByRole('button', { name: 'Tessera' }).click()
}

test('si tessera cercando in anagrafica, non reinserendo la persona', async ({ page }) => {
  await creaPersona('Alfa')
  await accedi(page, 'dirigente@virpol.test')
  await tessera(page, 'Alfa', 'Pulcini A', '23')

  await expect(page.getByRole('heading', { name: `${COGNOME} Alfa` })).toBeVisible()
  await page.goto('/2026-27/squadre')
  await page.getByRole('link', { name: 'Pulcini A' }).click()
  await expect(page.getByRole('link', { name: `${COGNOME} Alfa` })).toBeVisible()
})

test('chi è già tesserato non ricompare fra i candidati', async ({ page }) => {
  await creaPersona('Beta')
  await accedi(page, 'dirigente@virpol.test')
  await tessera(page, 'Beta', 'Pulcini A')
  await expect(page.getByRole('heading', { name: `${COGNOME} Beta` })).toBeVisible()

  await page.goto(`/2026-27/tesseramenti/nuovo?q=${COGNOME}`)
  await expect(page.getByRole('radio', { name: new RegExp(`${COGNOME} Beta`) })).toHaveCount(0)
})

test('un numero di maglia occupato dice chi ce l\'ha', async ({ page }) => {
  await creaPersona('Gamma')
  await accedi(page, 'dirigente@virpol.test')
  // Il seed dà la 10 a Giocatore Uno nei Pulcini A.
  await tessera(page, 'Gamma', 'Pulcini A', '10')
  const avviso = page.getByRole('alert').filter({ hasText: /Giocatore Uno/ })
  await expect(avviso).toBeVisible()
  await expect(avviso).toContainText('10')
})

test('spostare chi ha presenze spiega che vanno cancellate prima', async ({ page }) => {
  const db = clientServizio()
  const { data: squadra } = await db.from('squadre').select('id, stagione_id').eq('nome', 'Pulcini A').single()
  const { data: tesseramento } = await db
    .from('tesseramenti')
    .select('id, persone!inner(nome)')
    .eq('squadra_id', squadra!.id)
    .eq('persone.nome', 'Uno')
    .single()
  const { data: seduta } = await db
    .from('sedute_allenamento')
    .insert({ squadra_id: squadra!.id, stagione_id: squadra!.stagione_id, data: DATA_SEDUTA })
    .select('id')
    .single()
  await db.from('presenze').insert({
    seduta_id: seduta!.id,
    tesseramento_id: tesseramento!.id,
    squadra_id: squadra!.id,
    stato: 'presente',
  })

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27/tesseramenti/${tesseramento!.id}`)
  await page.getByLabel('Squadra').selectOption({ label: 'Pulcini B' })
  await page.getByRole('button', { name: 'Salva assegnazione' }).click()

  await expect(page.getByRole('alert').filter({ hasText: /presenze registrate/i })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Squadra')).toHaveValue(squadra!.id)
})

test('un allenatore legge la propria rosa ma non la modifica', async ({ page }) => {
  const db = clientServizio()
  const { data: tesseramento } = await db
    .from('tesseramenti')
    .select('id, persone!inner(nome)')
    .eq('persone.nome', 'Uno')
    .single()

  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/tesseramenti')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Tessera una persona' })).toHaveCount(0)

  await page.goto(`/2026-27/tesseramenti/${tesseramento!.id}`)
  await expect(page.getByRole('button', { name: 'Salva assegnazione' })).toHaveCount(0)

  await page.goto('/2026-27/tesseramenti/nuovo')
  await expect(page).toHaveURL(/\/2026-27\/tesseramenti$/)
})

test('lo staff si aggiunge e si toglie dalla scheda squadra', async ({ page }) => {
  await creaPersona('Delta')
  await accedi(page, 'dirigente@virpol.test')
  const db = clientServizio()
  const { data: squadra } = await db.from('squadre').select('id').eq('nome', 'Pulcini B').single()

  await page.goto(`/2026-27/squadre/${squadra!.id}?staff=${COGNOME}`)
  await page.getByRole('radio', { name: new RegExp(`${COGNOME} Delta`) }).check()
  await page.getByLabel('Ruolo').selectOption('vice_allenatore')
  await page.getByRole('button', { name: 'Aggiungi' }).click()

  const voce = page.getByRole('listitem').filter({ hasText: `${COGNOME} Delta` })
  await expect(voce).toContainText('Vice allenatore')

  await voce.getByRole('button', { name: 'Rimuovi' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: `${COGNOME} Delta` })).toHaveCount(0)
})

test('un tesseramento inesistente o di un\'altra stagione dà 404', async ({ page }) => {
  const db = clientServizio()
  const { data: tesseramento } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Due').single()

  await accedi(page, 'dirigente@virpol.test')
  const altraStagione = await page.goto(`/2025-26/tesseramenti/${tesseramento!.id}`)
  expect(altraStagione?.status()).toBe(404)

  const inesistente = await page.goto('/2026-27/tesseramenti/00000000-0000-4000-8000-000000000000')
  expect(inesistente?.status()).toBe(404)
})
