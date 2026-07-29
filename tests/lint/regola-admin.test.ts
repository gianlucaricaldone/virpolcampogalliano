import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

function eseguiEslint(percorso: string): { codice: number; output: string } {
  try {
    const output = execFileSync('npx', ['eslint', percorso], { encoding: 'utf8' })
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
  })

  it('non segnala nulla su un file che non importa admin', () => {
    const esito = eseguiEslint('lib/env.ts')
    expect(esito.codice).toBe(0)
  })
})
