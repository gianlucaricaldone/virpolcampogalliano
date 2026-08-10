import { ambienteDa, riferimentoAmbiente } from '@/lib/domain/ambiente'

/**
 * Dice sempre a quale database è collegata la pagina che stai guardando.
 * Compare in entrambi i casi, non solo sul remoto: se comparisse solo sulla
 * produzione, la sua assenza sarebbe indistinguibile da un componente rotto,
 * e l'unica lettura sbagliata che conta è credersi in locale mentre si sta
 * modificando la produzione.
 */
export function BadgeAmbiente() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ambiente = ambienteDa(url)
  const remoto = ambiente === 'remoto'

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-2 right-2 z-50 rounded-md px-1.5 py-0.5 font-mono text-[9px] leading-none shadow-sm sm:bottom-3 sm:right-3 sm:px-2.5 sm:py-1 sm:text-[11px] ${
        remoto
          ? 'bg-red-600 text-white ring-1 ring-red-900/30'
          : 'bg-neutral-200/90 text-neutral-700 ring-1 ring-neutral-400/40'
      }`}
    >
      {remoto ? 'PRODUZIONE' : 'locale'} · {riferimentoAmbiente(url)}
    </div>
  )
}
