import Link from 'next/link'

/** Copre anche il notFound() di [stagione]/layout.tsx per un codice inesistente. */
export default function NonTrovato() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Pagina non trovata</h1>
      <p className="text-neutral-600">La pagina cercata non esiste o è stata spostata.</p>
      <Link href="/gestione" className="underline">Torna alla gestione</Link>
    </main>
  )
}
