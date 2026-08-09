import { describe, expect, it } from 'vitest'
import { ambienteDa, riferimentoAmbiente } from '@/lib/domain/ambiente'

describe('ambienteDa', () => {
  it.each([
    'http://127.0.0.1:54321',
    'http://localhost:54321',
    'http://localhost:3000',
  ])('%s è locale', (url) => {
    expect(ambienteDa(url)).toBe('locale')
  })

  it.each([
    'https://lgsmkhwhjkwicuohfmkz.supabase.co',
    'https://ctrsnztrfslewkpbfxei.supabase.co',
  ])('%s è remoto', (url) => {
    expect(ambienteDa(url)).toBe('remoto')
  })

  // Se un URL illeggibile passasse per locale, il badge direbbe "locale" e le
  // guardie degli script lascerebbero passare una scrittura verso un bersaglio
  // che nessuno ha identificato. L'unico errore che conta è questo verso.
  it.each(['', 'non-un-url', '127.0.0.1:54321'])('%s illeggibile vale remoto', (url) => {
    expect(ambienteDa(url)).toBe('remoto')
  })

  // La porta non discrimina: lo stesso numero può servire l'uno o l'altro.
  it('la porta non entra nella decisione', () => {
    expect(ambienteDa('http://127.0.0.1:3001')).toBe('locale')
    expect(ambienteDa('https://lgsmkhwhjkwicuohfmkz.supabase.co:3001')).toBe('remoto')
  })
})

describe('riferimentoAmbiente', () => {
  it('mostra host e porta in locale', () => {
    expect(riferimentoAmbiente('http://127.0.0.1:54321')).toBe('127.0.0.1:54321')
  })

  it('mostra il riferimento del progetto per un progetto ospitato', () => {
    expect(riferimentoAmbiente('https://lgsmkhwhjkwicuohfmkz.supabase.co')).toBe(
      'lgsmkhwhjkwicuohfmkz',
    )
  })

  it('restituisce la stringa grezza se non è un URL', () => {
    expect(riferimentoAmbiente('non-un-url')).toBe('non-un-url')
  })
})
