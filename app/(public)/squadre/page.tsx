import { clientPubblico } from '@/lib/supabase/pubblico'

// Dati dal database, non dall'array statico del sito vecchio (squadre/page.tsx,
// 258 righe): quello elencava otto categorie inventate con allenatori, orari e
// obiettivi di fantasia. Qui restano solo nome, categoria e annata, quelli che
// v_squadre_pubbliche espone per la stagione corrente — vedi Task 1.
export const revalidate = 3600

export const metadata = {
  title: 'Squadre — Virpol Campogalliano',
  description: 'Le squadre della stagione in corso.',
}

export default async function PaginaSquadre() {
  const { data, error } = await clientPubblico()
    .from('v_squadre_pubbliche')
    .select('nome, categoria, annata')
  if (error) throw error
  const squadre = data ?? []

  const categorie = [...new Set(squadre.map((s) => s.categoria))]

  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-bold text-neutral-900">Le Nostre Squadre</h1>
        <p className="mx-auto mt-4 max-w-2xl text-xl text-neutral-600">
          Le squadre della stagione in corso, categoria per categoria.
        </p>
      </div>

      {squadre.length === 0 ? (
        <p className="text-center text-lg text-neutral-600">
          Le squadre della nuova stagione sono in preparazione.
        </p>
      ) : (
        categorie.map((categoria) => (
          <div key={categoria} className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-neutral-900">
              <span className="text-blue-600">{categoria}</span>
            </h2>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {squadre
                .filter((s) => s.categoria === categoria)
                .map((s) => (
                  <li
                    key={s.nome}
                    className="rounded-lg border bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <p className="text-lg font-semibold text-neutral-900">{s.nome}</p>
                    {s.annata && (
                      <p className="mt-1 text-sm text-neutral-600">annata {s.annata}</p>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
