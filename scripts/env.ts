import { z } from 'zod'

/** Ambiente degli script: include la service role, che l'applicazione non vede. */
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

export function envScript() {
  const esito = schema.safeParse(process.env)
  if (!esito.success) {
    const problemi = esito.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Ambiente script incompleto: ${problemi}`)
  }
  return esito.data
}
