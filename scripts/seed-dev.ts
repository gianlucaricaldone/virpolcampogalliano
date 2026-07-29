/**
 * Dati minimi per sviluppo ed E2E. Idempotente: rieseguibile senza duplicare.
 * Uso: npm run seed:dev
 */
import { loadEnvFile } from 'node:process'
import { supabaseAdmin } from '@/lib/supabase/admin'

// In locale le variabili arrivano da .env.local; in CI arrivano già
// dall'ambiente (vedi vitest.db.config.ts per lo stesso schema).
try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

const PASSWORD = 'virpol-dev-123'
const UTENTI = [
  { email: 'admin@virpol.test', ruolo: 'admin' as const },
  { email: 'dirigente@virpol.test', ruolo: 'dirigente' as const },
  { email: 'mister@virpol.test', ruolo: 'allenatore' as const },
]

async function main() {
  const db = supabaseAdmin()

  const { data: stagioneEsistente } = await db
    .from('stagioni').select('id').eq('codice', '2026-27').maybeSingle()
  const stagioneId = stagioneEsistente?.id ?? (
    await db.from('stagioni').insert({
      codice: '2026-27', etichetta: '2026/2027',
      data_inizio: '2026-09-01', data_fine: '2027-06-30',
    }).select('id').single()
  ).data!.id

  const { data: esistenti } = await db.auth.admin.listUsers()
  for (const utente of UTENTI) {
    let id = esistenti.users.find((u) => u.email === utente.email)?.id
    if (!id) {
      const { data, error } = await db.auth.admin.createUser({
        email: utente.email, password: PASSWORD, email_confirm: true,
      })
      if (error) throw error
      id = data.user.id
    }

    let personaId: string | null = null
    if (utente.ruolo === 'allenatore') {
      const { data: persona } = await db
        .from('persone').select('id').eq('email', utente.email).maybeSingle()
      personaId = persona?.id ?? (
        await db.from('persone').insert({
          nome: 'Mister', cognome: 'Prova', data_nascita: '1980-01-01', email: utente.email,
        }).select('id').single()
      ).data!.id
    }

    await db.from('profili').upsert({ id, ruolo: utente.ruolo, persona_id: personaId })
    console.log(`profilo pronto: ${utente.email} (${utente.ruolo})`)
  }
  console.log(`stagione pronta: 2026-27 (${stagioneId})`)
  console.log(`password per tutti: ${PASSWORD}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
