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

function giorniDaOggi(giorni: number): string {
  const data = new Date()
  data.setDate(data.getDate() + giorni)
  return data.toISOString().slice(0, 10)
}

/** Il seed non ha né quote né visite: questa suite le mette e le toglie. */
async function rimuoviProve() {
  const db = clientServizio()
  const { data: stagione } = await db.from('stagioni').select('id').eq('codice', '2026-27').single()
  const { data: tesseramenti } = await db
    .from('tesseramenti').select('id').eq('stagione_id', stagione!.id)
  const ids = (tesseramenti ?? []).map((t) => t.id)
  if (ids.length > 0) {
    await db.from('pagamenti_quota').delete().in('tesseramento_id', ids)
    await db.from('quote_importi').delete().in('tesseramento_id', ids)
    await db
      .from('tesseramenti')
      .update({ visita_scadenza: null, visita_consegnata_il: null })
      .in('id', ids)
  }
  await db.from('quote_importi').delete().eq('stagione_id', stagione!.id)
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

test('il cruscotto elenca chi deve pagare e chi deve portare la visita', async ({ page }) => {
  const db = clientServizio()
  const { data: stagione } = await db.from('stagioni').select('id').eq('codice', '2026-27').single()
  await db.from('quote_importi').insert({ stagione_id: stagione!.id, importo: 200 })

  const { data: uno } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Uno').single()
  // Uno ha pagato ma ha la visita scaduta; Due non ha pagato e ha la visita
  // valida: la coppia rende il test capace di fallire in entrambi i versi.
  await db.from('pagamenti_quota').insert({
    tesseramento_id: uno!.id, importo: 200, data: giorniDaOggi(0),
  })
  await db.from('tesseramenti').update({ visita_scadenza: giorniDaOggi(-4) }).eq('id', uno!.id)

  const { data: due } = await db
    .from('tesseramenti').select('id, persone!inner(nome)').eq('persone.nome', 'Due').single()
  await db.from('tesseramenti').update({ visita_scadenza: giorniDaOggi(300) }).eq('id', due!.id)

  await accedi(page, 'dirigente@virpol.test')
  await page.goto('/2026-27')

  const quote = page.getByRole('region').filter({ hasText: 'Quote da incassare' })
  const visite = page.getByRole('region').filter({ hasText: 'Visite mediche da sistemare' })

  await expect(quote.getByRole('link', { name: 'Giocatore Due' })).toBeVisible()
  await expect(quote.getByRole('link', { name: 'Giocatore Uno' })).toHaveCount(0)
  await expect(visite.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(visite.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(visite).toContainText('Scaduta da 4 giorni')
})

test('il filtro per squadra vale su entrambi i riquadri', async ({ page }) => {
  const db = clientServizio()
  const { data: squadra } = await db.from('squadre').select('id').eq('nome', 'Pulcini A').single()

  await accedi(page, 'dirigente@virpol.test')
  await page.goto(`/2026-27?squadra=${squadra!.id}`)
  // Con le visite azzerate dal beforeEach sono entrambi "mancante": il filtro
  // deve lasciare solo il giocatore dei Pulcini A.
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
})

test('all\'allenatore il riquadro delle quote non compare affatto', async ({ page }) => {
  const db = clientServizio()
  const { data: stagione } = await db.from('stagioni').select('id').eq('codice', '2026-27').single()
  await db.from('quote_importi').insert({ stagione_id: stagione!.id, importo: 200 })

  await accedi(page, 'mister@virpol.test')
  await page.goto('/2026-27')

  await expect(page.getByText('Visite mediche da sistemare')).toBeVisible()
  // Né il riquadro né la frase "nessuna quota aperta": non è un elenco vuoto,
  // è un elenco che non gli viene chiesto.
  await expect(page.getByText('Quote da incassare')).toHaveCount(0)
  await expect(page.getByText('Nessuna quota aperta')).toHaveCount(0)
  // E vede solo i propri: Giocatore Due è dei Pulcini B.
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
})
