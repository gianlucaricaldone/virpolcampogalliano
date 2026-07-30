import { z } from 'zod'

/**
 * Campo facoltativo: la stringa vuota che arriva da un input HTML diventa
 * `null`, mai `''`. Su una colonna UNIQUE e nullable la differenza è fra due
 * righe ammesse e un vincolo violato — Postgres considera distinti due NULL,
 * uguali due stringhe vuote.
 */
export function facoltativo<T extends z.ZodType<string>>(schema: T, maiuscolo = false) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v ?? null
    const pulito = maiuscolo ? v.trim().toUpperCase() : v.trim()
    return pulito === '' ? null : pulito
  }, schema.nullable())
}

/** Come `facoltativo`, per un intero: '' diventa null, '2015' diventa 2015. */
export function facoltativoIntero(schema: z.ZodNumber) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v ?? null
    const pulito = v.trim()
    if (pulito === '') return null
    // Non `Number(v)`: 'abc' darebbe NaN, che passerebbe per un numero e
    // finirebbe nel database come null silenzioso.
    const numero = Number(pulito)
    return Number.isFinite(numero) ? numero : pulito
  }, schema.nullable())
}
