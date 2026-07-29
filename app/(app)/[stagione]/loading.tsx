/**
 * Non in app/(app)/loading.tsx: quel livello è antenato di [stagione]/layout.tsx,
 * che chiama notFound() per un codice stagione inesistente. loading.js avvolge
 * in una Suspense tutto ciò che sta sotto — page.js e figli, non il layout.js
 * dello stesso segmento (vedi i docs di Next.js su loading.js e su notFound()
 * "called after streaming has started returns a 200 status code"). Con un
 * loading.tsx più in alto, quel notFound() diventerebbe un 200 in streaming
 * invece di un vero 404 — verificato di persona: il test e2e
 * "un codice stagione inesistente dà 404" passava a 200 finché il file stava
 * un livello sopra. Qui, un fratello di [stagione]/layout.tsx, avvolge solo
 * [stagione]/page.tsx e non il layout che fa il controllo.
 */
export default function Caricamento() {
  return <p className="p-6 text-neutral-600">Caricamento…</p>
}
