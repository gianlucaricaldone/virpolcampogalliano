import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const DATA_PRIMA = '2027-04-06'
const DATA_SECONDA = '2027-04-13'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  // Le presenze se ne vanno in cascade con le sedute.
  const { error } = await clientServizio()
    .from('sedute_allenamento').delete().in('data', [DATA_PRIMA, DATA_SECONDA])
  if (error) throw error
}

/**
 * Due sedute nei Pulcini A, il tesserato presente a una sola: percentuale 50%
 * e nessuna non registrata. Il numero è scelto perché sbagliare denominatore
 * darebbe 100%, che è il difetto che questa pagina esiste per non ripetere.
 */
async function preparaSedute() {
  const db = clientServizio()
  const { data: squadra } = await db
    .from('squadre').select('id, stagione_id').eq('nome', 'Pulcini A').single()
  const { data: sedute, error } = await db
    .from('sedute_allenamento')
    .insert([
      { squadra_id: squadra!.id, stagione_id: squadra!.stagione_id, data: DATA_PRIMA },
      { squadra_id: squadra!.id, stagione_id: squadra!.stagione_id, data: DATA_SECONDA },
    ])
    .select('id')
  if (error) throw error

  const { data: tesseramento } = await db
    .from('tesseramenti')
    .select('id, persone!inner(nome)')
    .eq('squadra_id', squadra!.id)
    .eq('persone.nome', 'Uno')
    .single()
  await db.from('presenze').insert({
    seduta_id: sedute![0].id,
    tesseramento_id: tesseramento!.id,
    squadra_id: squadra!.id,
    stato: 'presente',
  })
}

test.beforeEach(async () => {
  await rimuoviProve()
  await preparaSedute()
})
test.afterAll(rimuoviProve)

async function accedi(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entra' }).click()
  await expect(page).toHaveURL(/\/\d{4}-\d{2}$/)
}

test('la percentuale usa tutte le sedute della squadra come denominatore', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2026-27/statistiche')

  const riga = page.getByRole('row').filter({ hasText: 'Giocatore Uno' })
  await expect(riga).toContainText('1 su 2')
  await expect(riga).toContainText('50.0%')
})

test('chi non ha mai una riga di presenza le vede contate come non registrate', async ({ page }) => {
  const db = clientServizio()
  // Un secondo tesserato nei Pulcini A, mai registrato in nessuna seduta.
  const { data: squadra } = await db
    .from('squadre').select('id, stagione_id').eq('nome', 'Pulcini A').single()
  const { data: persona } = await db
    .from('persone')
    .insert({ nome: 'Tre', cognome: 'Giocatore', data_nascita: '2015-05-05' })
    .select('id')
    .single()
  await db.from('tesseramenti').insert({
    persona_id: persona!.id, stagione_id: squadra!.stagione_id, squadra_id: squadra!.id,
  })

  try {
    await accedi(page, 'dirigente@virpol.test')
    await page.goto('/2026-27/statistiche')
    const riga = page.getByRole('row').filter({ hasText: 'Giocatore Tre' })
    await expect(riga).toContainText('0 su 2')
    await expect(riga).toContainText('0.0%')
  } finally {
    await db.from('tesseramenti').delete().eq('persona_id', persona!.id)
    await db.from('persone').delete().eq('id', persona!.id)
  }
})

test('il riepilogo per squadra ha la media della squadra', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2026-27/statistiche')
  // Le stesse squadre compaiono anche nella tabella per giocatore: si guarda
  // dentro la region giusta, non la prima riga che contiene quel testo.
  const perSquadra = page.getByRole('region', { name: 'Per squadra' })
  // Un tesserato, due sedute, una presenza: 50%.
  await expect(perSquadra.getByRole('row').filter({ hasText: 'Pulcini A' }))
    .toContainText('50.0%')

  // Pulcini B non ha sedute: la media non esiste, e non è zero.
  await expect(perSquadra.getByRole('row').filter({ hasText: 'Pulcini B' }))
    .toContainText('—')
})

test('un allenatore vede le statistiche dei propri e non delle altre squadre', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27/statistiche')
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(page.getByRole('row').filter({ hasText: 'Pulcini B' })).toHaveCount(0)
})
