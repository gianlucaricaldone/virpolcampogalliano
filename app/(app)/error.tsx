'use client'

/**
 * Rete di sicurezza per i bug veri: eseguiAzione() (lib/azioni.ts) rilancia
 * qui tutto ciò che non è un errore di validazione o di autorizzazione
 * previsto. Senza questo file, un'eccezione non gestita mostrava la pagina
 * di produzione generica di Next invece di qualcosa di riconoscibile.
 */
export default function ErroreBackoffice({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Si è verificato un errore</h1>
      <p className="text-neutral-600">
        Qualcosa non ha funzionato. Riprova; se il problema persiste, contatta un amministratore.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bottone"
      >
        Riprova
      </button>
    </main>
  )
}
