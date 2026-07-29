import { z } from 'zod'

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.string().url(),
})

export type Env = z.infer<typeof schema>

/** Valida un insieme di variabili. Lancia elencando quelle non valide. */
export function leggiEnv(source: Record<string, string | undefined>): Env {
  const esito = schema.safeParse(source)
  if (!esito.success) {
    const problemi = esito.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Configurazione ambiente non valida — ${problemi}`)
  }
  return esito.data
}

let cache: Env | null = null

/**
 * Ambiente applicativo. La lettura è pigra e memorizzata: importare questo
 * modulo non deve mai lanciare, altrimenti i test unitari non possono
 * caricarlo senza un ambiente completo.
 */
export function env(): Env {
  cache ??= leggiEnv(process.env)
  return cache
}
