'use client'

import { useActionState } from 'react'
import { accedi } from './actions'

export default function Accesso() {
  const [esito, azione, inCorso] = useActionState(accedi, null)
  const campi = esito && !esito.ok ? esito.campi : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
      <h1 className="text-xl font-semibold">Accesso</h1>
      <form action={azione} className="mt-6 space-y-4">
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
                className="w-full rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-60">
          {inCorso ? 'Accesso in corso…' : 'Entra'}
        </button>
      </form>
    </main>
  )
}
