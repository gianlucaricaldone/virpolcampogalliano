import { createClient } from '@supabase/supabase-js'
import { loadEnvFile } from 'node:process'
import { expect, test } from '@playwright/test'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
// Cognome riconoscibile: la pulizia cancella per questo, non per "tutto ciò
// che non è del seed" — l'anagrafica è condivisa con le altre suite.
const COGNOME = 'Provaanagrafica'
const CODICE_FISCALE = 'AAAAAA00A00A000A'

function clientServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function rimuoviProve() {
  // Anche in beforeAll: un'esecuzione interrotta a metà lascia righe che
  // farebbero fallire il test del duplicato per la ragione sbagliata.
  const db = clientServizio()
  const { error } = await db.from('persone').delete().eq('cognome', COGNOME)
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

async function compila(
  page: import('@playwright/test').Page,
  nome: string,
  codiceFiscale = '',
) {
  await page.goto('/anagrafica/nuova')
  await page.getByLabel('Cognome').fill(COGNOME)
  await page.getByLabel('Nome', { exact: true }).fill(nome)
  await page.getByLabel('Data di nascita').fill('2014-03-21')
  if (codiceFiscale) await page.getByLabel('Codice fiscale').fill(codiceFiscale)
  await page.getByRole('button', { name: 'Crea persona' }).click()
}

test('un dirigente crea una persona e la ritrova cercandola', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await compila(page, 'Prima')
  // La creazione porta sulla scheda: è lì che si aggiungono tesseramenti.
  await expect(page.getByRole('heading', { name: `${COGNOME} Prima` })).toBeVisible()

  // Il filtro si applica mentre si scrive: non c'è nessun pulsante Cerca.
  await page.goto('/anagrafica')
  await page.getByLabel('Cognome').fill(COGNOME)
  await expect(page.getByRole('link', { name: `${COGNOME} Prima` })).toBeVisible()
})

test('un codice fiscale già usato mostra il messaggio tradotto', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await compila(page, 'Cieffe', CODICE_FISCALE)
  await expect(page.getByRole('heading', { name: `${COGNOME} Cieffe` })).toBeVisible()

  await compila(page, 'Doppione', CODICE_FISCALE)
  const avviso = page.getByRole('alert').filter({ hasText: /codice fiscale/i })
  await expect(avviso).toBeVisible()
  await expect(avviso).not.toContainText('duplicate key')
})

test('archiviare toglie dall\'elenco senza cancellare', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  await compila(page, 'Archivio')
  await page.getByRole('button', { name: 'Archivia' }).click()
  await expect(page.getByText('Archiviata')).toBeVisible()

  await page.goto(`/anagrafica?q=${COGNOME}`)
  await expect(page.getByRole('link', { name: `${COGNOME} Archivio` })).toHaveCount(0)

  await page.goto(`/anagrafica?q=${COGNOME}&archiviate=1`)
  await expect(page.getByRole('link', { name: `${COGNOME} Archivio` })).toBeVisible()
})

test('un allenatore vede solo i propri tesserati e non può crearne', async ({ page }) => {
  await accedi(page, 'mister@virpol.test')
  await page.goto('/anagrafica')
  // Il seed mette Giocatore Uno nella squadra del mister e Giocatore Due in
  // un'altra: la coppia rende il test capace di fallire in entrambi i versi.
  await expect(page.getByRole('link', { name: 'Giocatore Uno' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Giocatore Due' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Nuova persona' })).toHaveCount(0)

  await page.goto('/anagrafica/nuova')
  await expect(page).toHaveURL(/\/anagrafica$/)
})

test('una persona inesistente dà 404, non una scheda vuota', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  // `response.status()`, non la sola assenza di contenuto: sotto un confine
  // Suspense un notFound() restituisce 200 con la pagina vuota, e solo lo
  // status distingue i due casi.
  const inesistente = await page.goto('/anagrafica/00000000-0000-4000-8000-000000000000')
  expect(inesistente?.status()).toBe(404)

  const malformato = await page.goto('/anagrafica/non-un-uuid')
  expect(malformato?.status()).toBe(404)
})

test('il filtro dell\'anagrafica restringe mentre si scrive e resta nell\'URL', async ({ page }) => {
  await accedi(page, 'dirigente@virpol.test')
  // Attendere la scheda dopo ogni creazione non è pignoleria: `compila` finisce
  // col click, e il `goto` della creazione successiva interrompe la Server
  // Action in volo — la seconda persona a volte non veniva creata, e il test era
  // intermittente per questo, non per il filtro che sta verificando.
  await compila(page, 'Alfa')
  await expect(page.getByRole('heading', { name: `${COGNOME} Alfa` })).toBeVisible()
  await compila(page, 'Beta')
  await expect(page.getByRole('heading', { name: `${COGNOME} Beta` })).toBeVisible()

  await page.goto('/anagrafica')
  const conteggio = page.getByText(/^\d+ (di \d+|persone|persona)$/)
  await expect(conteggio).toContainText('persone')

  // Nessun invio e nessun pulsante: le righe si riducono a ogni battuta.
  await page.getByLabel('Cognome').fill(COGNOME)
  await expect(page.getByRole('link', { name: `${COGNOME} Alfa` })).toBeVisible()
  await expect(page.getByRole('link', { name: `${COGNOME} Beta` })).toBeVisible()
  await expect(conteggio).toContainText('di')

  // Cerca anche per nome, non solo per cognome.
  await page.getByLabel('Cognome').fill('Alfa')
  await expect(page.getByRole('link', { name: `${COGNOME} Alfa` })).toBeVisible()
  await expect(page.getByRole('link', { name: `${COGNOME} Beta` })).toHaveCount(0)

  // L'URL segue il filtro senza ricaricare, quindi la ricerca è condivisibile.
  await expect(page).toHaveURL(/[?&]q=Alfa/)

  // E un collegamento con ?q= arriva già filtrato.
  await page.goto(`/anagrafica?q=${COGNOME}`)
  await expect(page.getByLabel('Cognome')).toHaveValue(COGNOME)
  await expect(page.getByRole('link', { name: `${COGNOME} Alfa` })).toBeVisible()
})
