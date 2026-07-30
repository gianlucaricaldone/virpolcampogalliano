'use client'

import { useActionState } from 'react'
import { accedi } from '@/app/(auth)/login/actions'

export function FormAccesso({ messaggio }: { messaggio?: string }) {
  const [esito, azione, inCorso] = useActionState(accedi, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    // Un riquadro su fondo grigio, come ogni altra superficie del backoffice.
    // Prima il form galleggiava in mezzo al bianco senza nulla che lo
    // trattenesse, e la prima schermata dell'applicazione non diceva nemmeno
    // di che applicazione si trattasse.
    <main className="flex min-h-dvh flex-col justify-center bg-neutral-50 p-6">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-sm font-semibold tracking-wide text-neutral-500">
          Virpol Campogalliano
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Accesso</h1>
        {messaggio && (
          <p role="status" className="mt-4 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
            {messaggio}
          </p>
        )}
        <form action={azione} className="mt-6 space-y-4 rounded border bg-white p-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username"
                 className="mt-1 w-full rounded border px-3 py-2" />
          {campi?.email && <p role="alert" className="mt-1 text-sm text-red-700">{campi.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required
                 autoComplete="current-password"
                 className="mt-1 w-full rounded border px-3 py-2" />
          {campi?.password && <p role="alert" className="mt-1 text-sm text-red-700">{campi.password}</p>}
        </div>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
        <button type="submit" disabled={inCorso}
                className="min-h-11 w-full rounded bg-neutral-900 px-3 text-white disabled:opacity-60">
          {inCorso ? 'Accesso in corso…' : 'Entra'}
        </button>
        </form>
      </div>
    </main>
  )
}
