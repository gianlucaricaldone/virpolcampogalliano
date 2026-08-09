import { ambienteDa, riferimentoAmbiente } from '@/lib/domain/ambiente'
import { env } from '@/lib/env'

export function register() {
  const { NEXT_PUBLIC_SUPABASE_URL } = env() // lancia e impedisce l'avvio se manca una variabile

  // Stampato a ogni avvio: la porta non dice a quale database si sta parlando
  // (Next la incrementa da sé se è occupata), quindi il log lo dichiara.
  const ambiente = ambienteDa(NEXT_PUBLIC_SUPABASE_URL)
  const riga = `database: ${ambiente.toUpperCase()} · ${riferimentoAmbiente(NEXT_PUBLIC_SUPABASE_URL)}`
  console.log(ambiente === 'remoto' ? `\n⚠️  ${riga} — ogni modifica è reale\n` : `${riga}\n`)
}
