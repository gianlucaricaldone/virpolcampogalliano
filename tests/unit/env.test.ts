import { describe, expect, it } from 'vitest'
import { leggiEnv } from '@/lib/env'

const completo = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'chiave',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
}

describe('leggiEnv', () => {
  it('restituisce le variabili quando sono tutte presenti', () => {
    expect(leggiEnv(completo)).toEqual(completo)
  })

  it('nomina la variabile mancante nel messaggio di errore', () => {
    const { NEXT_PUBLIC_SUPABASE_ANON_KEY: _omessa, ...parziale } = completo
    expect(() => leggiEnv(parziale)).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('rifiuta un URL malformato', () => {
    expect(() => leggiEnv({ ...completo, NEXT_PUBLIC_SUPABASE_URL: 'non-un-url' }))
      .toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('non accetta la service role fra le variabili applicative', () => {
    const conServiceRole = { ...completo, SUPABASE_SERVICE_ROLE_KEY: 'segreto' }
    expect(leggiEnv(conServiceRole)).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
  })
})
