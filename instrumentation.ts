import { env } from '@/lib/env'

export function register() {
  env() // lancia e impedisce l'avvio se manca una variabile
}
