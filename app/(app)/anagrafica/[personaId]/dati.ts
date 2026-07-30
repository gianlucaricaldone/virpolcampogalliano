import { cache } from 'react'
import { personaPerId, type Persona } from '@/lib/repos/persone'
import { supabaseServer } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lettura condivisa fra il layout (che decide il 404) e la pagina (che mostra
 * i dati). `React.cache` è request-scoped e senza TTL: deduplica dentro la
 * singola richiesta e non conserva nulla fra una richiesta e l'altra.
 *
 * Il controllo sulla forma dell'uuid non è cosmetico: un segmento arbitrario
 * arriverebbe a Postgres come 22P02 (`invalid input syntax for type uuid`),
 * cioè un 500 al posto del 404 che quel percorso merita.
 */
export const caricaPersona = cache(async (id: string): Promise<Persona | null> => {
  if (!UUID.test(id)) return null
  const db = await supabaseServer()
  return personaPerId(db, id)
})
