/**
 * A quale database sta parlando questo processo. Derivato dall'URL di Supabase,
 * mai memorizzato e mai dedotto dalla porta: `next dev` incrementa la porta da
 * sé quando trova occupata quella richiesta, quindi "3001" non dice niente su
 * quale database ci sia dietro — e un giorno un server locale finirà proprio
 * sulla porta che ieri era della produzione. La sola fonte attendibile è la
 * variabile che il processo ha davvero in mano.
 */
export type Ambiente = 'locale' | 'remoto'

const HOST_LOCALI = new Set(['127.0.0.1', 'localhost', '[::1]', '::1', '0.0.0.0'])

export function ambienteDa(urlSupabase: string): Ambiente {
  let host: string
  try {
    host = new URL(urlSupabase).hostname
  } catch {
    // Un URL illeggibile non deve passare per locale: chi non sa dove sta
    // parlando va trattato come se stesse parlando alla produzione.
    return 'remoto'
  }
  return HOST_LOCALI.has(host) || host.endsWith('.local') ? 'locale' : 'remoto'
}

/**
 * Come identificare il bersaglio a schermo: l'host per il locale, il
 * riferimento del progetto per un progetto Supabase ospitato.
 */
export function riferimentoAmbiente(urlSupabase: string): string {
  let url: URL
  try {
    url = new URL(urlSupabase)
  } catch {
    return urlSupabase
  }
  const ref = url.hostname.match(/^([a-z0-9]+)\.supabase\.(co|red)$/)?.[1]
  return ref ?? (url.port ? `${url.hostname}:${url.port}` : url.hostname)
}
