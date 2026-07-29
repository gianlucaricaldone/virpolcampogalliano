import { createClient } from '@supabase/supabase-js'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { cambiaStato, creaStagione, elencaStagioni } from '@/lib/repos/stagioni'
import type { Database } from '@/lib/db/types'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const db = createClient<Database>(URL, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

beforeEach(async () => {
  // stagioni ← squadre è on delete restrict: una squadra committata da un
  // test precedente basterebbe a rendere questa delete un no-op silenzioso,
  // e il fallimento emergerebbe altrove, in un test che non ha toccato nulla.
  const { error } = await db.from('stagioni').delete().neq('codice', '')
  if (error) throw error
})

// Questa suite scrive con un client service-role vero, fuori da qualunque
// transazione annullata: senza un afterAll, l'ultimo test del file lascia le
// sue righe committate per chiunque legga stagioni dopo — seed:dev incluso,
// se girasse dopo test:db invece che prima. Quale dei due file
// repo-stagioni*.test.ts gira per ultimo non è deterministico (vitest non
// ordina i file alfabeticamente), quindi non basta pulire a inizio file: va
// pulito anche alla fine. Stesso pattern già in uso in sessione.test.ts per
// lo stesso motivo.
afterAll(async () => {
  const { error } = await db.from('stagioni').delete().neq('codice', '')
  if (error) throw error
})

const valida = {
  codice: '2026-27', etichetta: '2026/2027',
  dataInizio: '2026-09-01', dataFine: '2027-06-30',
}

describe('creaStagione', () => {
  it('crea una stagione aperta', async () => {
    const creata = await creaStagione(db, valida)
    expect(creata).toMatchObject({ codice: '2026-27', stato: 'aperta' })
  })

  it('propaga l\'errore del vincolo sulla forma del codice', async () => {
    await expect(creaStagione(db, { ...valida, codice: '2026/2027' })).rejects.toMatchObject({
      code: '23514',
    })
  })

  it('propaga l\'errore sul codice duplicato', async () => {
    await creaStagione(db, valida)
    await expect(creaStagione(db, valida)).rejects.toMatchObject({ code: '23505' })
  })

  it('propaga l\'errore sulle date incoerenti', async () => {
    await expect(
      creaStagione(db, { ...valida, dataInizio: '2027-09-01', dataFine: '2026-06-30' }),
    ).rejects.toMatchObject({ code: '23514' })
  })
})

describe('cambiaStato', () => {
  it('chiude e riapre una stagione', async () => {
    const creata = await creaStagione(db, valida)
    await cambiaStato(db, creata.id, 'chiusa')
    expect((await elencaStagioni(db))[0].stato).toBe('chiusa')
    await cambiaStato(db, creata.id, 'aperta')
    expect((await elencaStagioni(db))[0].stato).toBe('aperta')
  })
})
