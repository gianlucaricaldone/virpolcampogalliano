'use client'

import Image from 'next/image'
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
        {/* Lo stemma sulla porta d'ingresso: è la prima schermata che si vede,
            e finché c'era solo il nome scritto poteva essere il backoffice di
            qualunque cosa. */}
        <Image
          src="/images/home/virpol-logo.png"
          alt="Virpol Campogalliano"
          width={64}
          height={64}
          priority
          className="mb-4 h-16 w-16 object-contain"
        />
        <p className="font-[family-name:var(--font-archivo-black)] text-[0.6875rem] uppercase tracking-[0.16em] text-neutral-500">
          Virpol Campogalliano
        </p>
        <h1 className="mt-1.5 text-2xl">Accesso</h1>
        {messaggio && (
          <p role="status" className="mt-4 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900">
            {messaggio}
          </p>
        )}
        <form action={azione} className="mt-6 space-y-5 rounded-lg border bg-white p-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required autoComplete="username"
                 className="mt-1.5 w-full rounded-md border px-3 text-sm" />
          {campi?.email && <p role="alert" className="mt-1 text-sm text-red-700">{campi.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required
                 autoComplete="current-password"
                 className="mt-1.5 w-full rounded-md border px-3 text-sm" />
          {campi?.password && <p role="alert" className="mt-1 text-sm text-red-700">{campi.password}</p>}
        </div>
        {esito && !esito.ok && !campi && (
          <p role="alert" className="text-sm text-red-700">{esito.errore}</p>
        )}
        <button type="submit" disabled={inCorso}
                className="bottone min-h-11 w-full">
          {inCorso ? 'Accesso in corso…' : 'Entra'}
        </button>
        </form>
      </div>
    </main>
  )
}
