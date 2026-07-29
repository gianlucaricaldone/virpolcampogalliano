import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Binario locale, non npx: npx risolve il pacchetto ad ogni chiamata (rete
// inclusa), che è la maggior parte del costo e la causa dei timeout visti
// con quattro spawn nello stesso file. Il percorso è costruito dalla radice
// del repo per non dipendere dalla working directory del processo.
const ESLINT = path.join(process.cwd(), 'node_modules', '.bin', 'eslint')

// Ogni caso spawna un processo eslint: normalmente ~1-2s, ma un'esecuzione
// misurata durante la verifica di questo file ha impiegato 34s a causa di
// contesa sulla macchina di sviluppo (altri processi concorrenti), superando
// anche una soglia di 30s. 60s lascia margine reale su un runner CI lento e
// conteso senza nascondere un'esecuzione che si blocca davvero.
const TIMEOUT_SPAWN = 60_000

function eseguiEslint(percorso: string): { codice: number; output: string } {
  try {
    const output = execFileSync(ESLINT, [percorso], { encoding: 'utf8' })
    return { codice: 0, output }
  } catch (e) {
    const errore = e as { status?: number; stdout?: string; stderr?: string }
    return { codice: errore.status ?? 1, output: `${errore.stdout ?? ''}${errore.stderr ?? ''}` }
  }
}

describe('regola sul client service role', () => {
  it('rifiuta un import di lib/supabase/admin sotto app/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/app/importa-admin.tsx')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)

  it('non segnala nulla su un file che non importa admin', () => {
    const esito = eseguiEslint('lib/env.ts')
    expect(esito.codice).toBe(0)
  }, TIMEOUT_SPAWN)

  it('rifiuta un import relativo di supabase/admin sotto lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/importa-admin.ts')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)

  it('non segnala nulla su un file pulito dentro lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/pulito.ts')
    expect(esito.codice).toBe(0)
  }, TIMEOUT_SPAWN)

  it('rifiuta un import relativo di supabase/admin da un .tsx dentro lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/importa-admin-tsx.tsx')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)

  // scripts/env espone envScript(), che legge la stessa service role di
  // lib/supabase/admin: `import { envScript } from '@/scripts/env'` seguito
  // da createClient(url, chiave) produce, in due righe, un client che ignora
  // ogni RLS — e la regola originale, che sorvegliava solo /supabase/admin$,
  // lo lasciava passare.
  it('rifiuta un import relativo di scripts/env dentro lib/repos/', () => {
    const esito = eseguiEslint('tests/lint/fixtures/lib/repos/importa-env-script.ts')
    expect(esito.codice).not.toBe(0)
    expect(esito.output).toMatch(/service role/i)
  }, TIMEOUT_SPAWN)
})
