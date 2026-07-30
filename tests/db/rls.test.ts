import { describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  asAnon, asUser, creaIncarico, creaPersona, creaSeduta, creaSquadra, creaStagione,
  creaTesseramento, creaUtenteAuth, impostaQuota, inRollback, registraPagamento, registraPresenza,
} from './harness'

/**
 * Due squadre nella stessa stagione. L'allenatore ha un incarico solo su A.
 * È lo scenario su cui si misura ogni diniego.
 */
async function dueSquadre(c: Client) {
  // Codice di default (casuale): un valore fisso qui scontrerebbe la riga
  // '2026-27' committata da scripts/seed-dev.ts se questa suite girasse dopo
  // seed:dev, con un errore di vincolo unique attribuito al test sbagliato.
  const stagione = await creaStagione(c)
  const squadraA = await creaSquadra(c, stagione, { nome: 'A' })
  const squadraB = await creaSquadra(c, stagione, { nome: 'B' })

  const personaMister = await creaPersona(c, { codiceFiscale: 'MISTER' })
  await creaIncarico(c, { personaId: personaMister, stagioneId: stagione, squadraId: squadraA })
  const mister = await creaUtenteAuth(c, { ruolo: 'allenatore', personaId: personaMister })
  const dirigente = await creaUtenteAuth(c, { ruolo: 'dirigente' })
  const admin = await creaUtenteAuth(c, { ruolo: 'admin' })

  const giocatoreA = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-A' }),
    stagioneId: stagione, squadraId: squadraA,
  })
  const giocatoreB = await creaTesseramento(c, {
    personaId: await creaPersona(c, { codiceFiscale: 'GIOC-B' }),
    stagioneId: stagione, squadraId: squadraB,
  })
  const sedutaA = await creaSeduta(c, { squadraId: squadraA, stagioneId: stagione, data: '2026-10-01' })
  const sedutaB = await creaSeduta(c, { squadraId: squadraB, stagioneId: stagione, data: '2026-10-01' })

  return { stagione, squadraA, squadraB, mister, dirigente, admin, giocatoreA, giocatoreB, sedutaA, sedutaB }
}

async function conta(c: Client, sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await c.query(sql, params)
  return rows.length
}

/**
 * Privilegi di tabella per un ruolo, letti da pg_class.relacl via aclexplode
 * invece che da information_schema.table_privileges: su PostgreSQL 17.6
 * quella vista non riporta MAINTAIN — verificato concedendolo su una tabella
 * di prova: pg_class.relacl lo conteneva, la vista no — quindi un confronto
 * su quella vista per MAINTAIN è decorativo, non potrebbe mai fallire nemmeno
 * se il privilegio venisse concesso per errore. aclexplode espande invece
 * ogni voce dell'ACL reale, MAINTAIN compreso.
 */
async function privilegiTabella(
  c: Client, grantee: string,
): Promise<{ table_name: string; privilege_type: string }[]> {
  const { rows } = await c.query(
    `select c.relname as table_name, a.privilege_type
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral aclexplode(c.relacl) as a(grantor, grantee, privilege_type, is_grantable)
     join pg_roles r on r.oid = a.grantee
     where n.nspname = 'public' and c.relkind in ('r', 'v') and r.rolname = $1
     order by 1, 2`,
    [grantee],
  )
  return rows
}

describe('funzioni helper', () => {
  it('mio_ruolo legge il ruolo del profilo corrente', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBe('dirigente')
    }))

  it('mie_squadre restituisce solo le squadre con incarico', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const squadre = await asUser(c, mister, async () => {
        const { rows } = await c.query('select * from app.mie_squadre() as s')
        return rows.map((r) => r.s)
      })
      expect(squadre).toEqual([squadraA])
    }))

  it('un profilo disattivato non ha ruolo', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await c.query('update public.profili set attivo = false where id = $1', [dirigente])
      const ruolo = await asUser(c, dirigente, async () => {
        const { rows } = await c.query('select app.mio_ruolo() as r')
        return rows[0].r
      })
      expect(ruolo).toBeNull()
    }))
})

describe('allenatore — lettura', () => {
  it('vede i tesseramenti della propria squadra', () =>
    inRollback(async (c) => {
      const { mister, squadraA } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('NON vede i tesseramenti della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.tesseramenti where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le persone della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, `select id from public.persone where codice_fiscale = 'GIOC-B'`),
      )
      expect(n).toBe(0)
    }))

  it('NON vede le sedute della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB } = await dueSquadre(c)
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraB]),
      )
      expect(n).toBe(0)
    }))
})

describe('allenatore — scrittura', () => {
  it('inserisce presenze sulla propria seduta', () =>
    inRollback(async (c) => {
      const { mister, sedutaA, giocatoreA } = await dueSquadre(c)
      // registraPresenza ricava squadra_id dalla seduta stessa: la riga resta
      // consistente per costruzione, non per un valore passato a parte.
      await asUser(c, mister, () => registraPresenza(c, sedutaA, giocatoreA, 'presente'))
      const { rows } = await c.query('select count(*)::int as n from public.presenze')
      expect(rows[0].n).toBe(1)
    }))

  it('NON inserisce presenze sulla seduta della squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB, sedutaB, giocatoreB } = await dueSquadre(c)
      // Insert diretto (non registraPresenza): mister non vede nemmeno la
      // seduta B tramite la propria policy di SELECT, quindi il derive via
      // subquery non inserirebbe righe e mascherarebbe il diniego della
      // WITH CHECK con l'errore "seduta inesistente" dell'helper. squadra_id
      // è comunque quello vero della seduta, non un valore a caso.
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.presenze (seduta_id, tesseramento_id, squadra_id, stato)
             values ($1, $2, $3, 'presente')`,
            [sedutaB, giocatoreB, squadraB],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON modifica i tesseramenti', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      const esito = await asUser(c, mister, () =>
        c.query('update public.tesseramenti set numero_maglia = 7 where id = $1', [giocatoreA]),
      )
      expect(esito.rowCount).toBe(0) // nessuna riga aggiornabile: la USING non passa
    }))

  it('NON crea squadre', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON crea persone', () =>
    inRollback(async (c) => {
      const { mister } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.persone (nome, cognome, data_nascita)
             values ('Nuovo', 'Giocatore', '2015-01-01')`,
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON crea sedute sulla squadra altrui', () =>
    inRollback(async (c) => {
      const { mister, squadraB, stagione } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.sedute_allenamento (squadra_id, stagione_id, data)
             values ($1, $2, '2026-10-08')`,
            [squadraB, stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('allenatore — dati finanziari', () => {
  it('NON legge quote_importi', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      const n = await asUser(c, mister, () => conta(c, 'select id from public.quote_importi'))
      expect(n).toBe(0)
    }))

  it('NON legge pagamenti_quota', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      await registraPagamento(c, giocatoreA, 125)
      const n = await asUser(c, mister, () => conta(c, 'select id from public.pagamenti_quota'))
      expect(n).toBe(0)
    }))

  it('da v_quote non ricava cifre reali', () =>
    inRollback(async (c) => {
      const { mister, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, mister, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '0.00', pagato: '0.00', stato: 'saldato' })
    }))

  it('il dirigente legge le cifre reali', () =>
    inRollback(async (c) => {
      const { dirigente, stagione, giocatoreA } = await dueSquadre(c)
      await impostaQuota(c, { stagioneId: stagione, importo: 250 })
      await registraPagamento(c, giocatoreA, 125)
      const righe = await asUser(c, dirigente, async () => {
        const { rows } = await c.query(
          `select quota_attesa::text, pagato::text, stato from public.v_quote
           where tesseramento_id = $1`,
          [giocatoreA],
        )
        return rows
      })
      expect(righe[0]).toMatchObject({ quota_attesa: '250.00', pagato: '125.00', stato: 'parziale' })
    }))

  // La suite finora provava solo che l'allenatore non LEGGE queste due
  // tabelle. Senza queste, una futura policy quote_ins permissiva lascerebbe
  // un allenatore fissare l'importo di una quota con la suite verde: la RLS
  // è l'unica barriera, e l'assenza di una policy va provata anche in scrittura.
  it('NON scrive quote_importi', () =>
    inRollback(async (c) => {
      const { mister, stagione } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.quote_importi (stagione_id, importo) values ($1, 100)`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('NON scrive pagamenti_quota', () =>
    inRollback(async (c) => {
      const { mister, giocatoreA } = await dueSquadre(c)
      await expect(
        asUser(c, mister, () =>
          c.query(
            `insert into public.pagamenti_quota (tesseramento_id, importo, data)
             values ($1, 50, '2026-09-15')`,
            [giocatoreA],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('stagione chiusa', () => {
  it('resta leggibile', () =>
    inRollback(async (c) => {
      const { mister, stagione, squadraA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      const n = await asUser(c, mister, () =>
        conta(c, 'select id from public.sedute_allenamento where squadra_id = $1', [squadraA]),
      )
      expect(n).toBe(1)
    }))

  it('rifiuta le scritture dell\'allenatore', () =>
    inRollback(async (c) => {
      const { mister, stagione, sedutaA, giocatoreA } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, mister, () => registraPresenza(c, sedutaA, giocatoreA, 'presente')),
      ).rejects.toThrow(/row-level security/)
    }))

  it('rifiuta le scritture del dirigente', () =>
    inRollback(async (c) => {
      const { dirigente, stagione } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Tardiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('rifiuta le scritture dell\'admin', () =>
    inRollback(async (c) => {
      const { admin, stagione } = await dueSquadre(c)
      await c.query(`update public.stagioni set stato = 'chiusa' where id = $1`, [stagione])
      await expect(
        asUser(c, admin, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Tardiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))
})

describe('dirigente e admin', () => {
  it('il dirigente vede i tesseramenti di tutte le squadre', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      const n = await asUser(c, dirigente, () => conta(c, 'select id from public.tesseramenti'))
      expect(n).toBe(2)
    }))

  it('il dirigente NON crea stagioni', () =>
    inRollback(async (c) => {
      const { dirigente } = await dueSquadre(c)
      await expect(
        asUser(c, dirigente, () =>
          c.query(
            `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
             values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
          ),
        ),
      ).rejects.toThrow(/row-level security/)
    }))

  it('l\'admin crea stagioni', () =>
    inRollback(async (c) => {
      const { admin } = await dueSquadre(c)
      await asUser(c, admin, () =>
        c.query(
          `insert into public.stagioni (codice, etichetta, data_inizio, data_fine)
           values ('2027-28', '2027/2028', '2027-09-01', '2028-06-30')`,
        ),
      )
      const { rows } = await c.query('select count(*)::int as n from public.stagioni')
      expect(rows[0].n).toBe(2)
    }))
})

describe('utente anonimo', () => {
  it('legge stagioni e squadre', () =>
    inRollback(async (c) => {
      await dueSquadre(c)
      const esito = await asAnon(c, async () => ({
        stagioni: await conta(c, 'select id from public.stagioni'),
        squadre: await conta(c, 'select id from public.squadre'),
      }))
      expect(esito).toEqual({ stagioni: 1, squadre: 2 })
    }))

  it.each([
    'persone', 'profili', 'tesseramenti', 'incarichi_staff',
    'sedute_allenamento', 'presenze', 'quote_importi', 'pagamenti_quota',
  ])('NON raggiunge %s', (tabella) =>
    inRollback(async (c) => {
      await dueSquadre(c)
      // anon non ha nemmeno il privilegio di tabella: il rifiuto arriva prima
      // che una policy venga valutata. È la barriera esterna delle due.
      await expect(
        asAnon(c, () => c.query(`select * from public.${tabella}`)),
      ).rejects.toThrow(/permission denied/)
    }))

  it('NON scrive squadre, che invece legge', () =>
    inRollback(async (c) => {
      const { stagione } = await dueSquadre(c)
      // Oggi a rifiutare è il privilegio di tabella (anon ha solo select su
      // squadre, non insert), non una policy: la stessa riga con la policy
      // sola direbbe row-level security. Entrambe restano nella regex perché
      // è la barriera che fa scattare per prima a decidere il messaggio.
      await expect(
        asAnon(c, () =>
          c.query(
            `insert into public.squadre (stagione_id, nome, categoria)
             values ($1, 'Abusiva', 'X')`,
            [stagione],
          ),
        ),
      ).rejects.toThrow(/row-level security|permission denied/)
    }))

  it('anon non ha privilegi né policy oltre stagioni e squadre', () =>
    inRollback(async (c) => {
      const privilegi = await privilegiTabella(c, 'anon')
      expect(privilegi).toEqual([
        { table_name: 'squadre', privilege_type: 'SELECT' },
        { table_name: 'stagioni', privilege_type: 'SELECT' },
      ])
      const { rows: policy } = await c.query(
        `select tablename, policyname from pg_policies
         where schemaname = 'public' and 'anon' = any(roles) order by 1`)
      expect(policy).toEqual([
        { tablename: 'squadre', policyname: 'squadre_sel' },
        { tablename: 'stagioni', policyname: 'stagioni_sel' },
      ])
    }))
})

// La suite sopra copre anon catalogo per catalogo, ma il Critical che questo
// schema doveva chiudere era che AUTHENTICATED — ogni allenatore — poteva
// TRUNCATE public.persone: un privilegio di tabella, non una riga, quindi
// nessuna policy RLS può filtrarlo. Una migration futura che concedesse
// `all on all tables` ad authenticated, o una tabella nuova con GRANT ALL,
// lo farebbe tornare con la suite verde se solo anon fosse sorvegliato.
describe('privilegi di tabella per authenticated', () => {
  const TABELLE = [
    'incarichi_staff', 'pagamenti_quota', 'persone', 'presenze', 'profili',
    'quote_importi', 'sedute_allenamento', 'squadre', 'stagioni', 'tesseramenti',
  ]
  // v_visite è arrivata con la gestione della visita medica: la sua SELECT è
  // voluta e va aggiunta qui, non aggirata. Che questo test sia diventato
  // rosso da solo, al primo grant nuovo, è esattamente il suo mestiere.
  const VISTE = ['v_presenze', 'v_quote', 'v_visite']

  it('ha esattamente le quattro DML sulle dieci tabelle e SELECT sulle tre viste', () =>
    inRollback(async (c) => {
      const privilegi = await privilegiTabella(c, 'authenticated')
      const atteso = [
        ...TABELLE.flatMap((t) =>
          ['DELETE', 'INSERT', 'SELECT', 'UPDATE'].map((p) => ({ table_name: t, privilege_type: p }))),
        ...VISTE.map((v) => ({ table_name: v, privilege_type: 'SELECT' })),
      ].sort((a, b) =>
        a.table_name.localeCompare(b.table_name) || a.privilege_type.localeCompare(b.privilege_type))
      expect(privilegi).toEqual(atteso)
    }))

  it('né anon né authenticated hanno TRUNCATE, REFERENCES, TRIGGER o MAINTAIN su nulla in public', () =>
    inRollback(async (c) => {
      const vietati = new Set(['TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'])
      for (const grantee of ['anon', 'authenticated']) {
        const privilegi = await privilegiTabella(c, grantee)
        expect(privilegi.filter((p) => vietati.has(p.privilege_type))).toEqual([])
      }
    }))
})
