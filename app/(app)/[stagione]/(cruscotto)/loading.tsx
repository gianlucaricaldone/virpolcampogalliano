/**
 * Dentro il gruppo di rotta `(cruscotto)`, non a livello di `[stagione]`.
 *
 * `loading.tsx` crea un confine Suspense che avvolge tutto ciò che sta sotto
 * il suo segmento: non solo la pagina fratello, ma anche i layout dei segmenti
 * annidati. Con lo streaming avviato lo status è già impegnato a 200, quindi
 * un `notFound()` più in basso rende la not-found con status 200 — la pagina
 * sembra esistere a qualunque monitor o regola di retry.
 *
 * Verificato di persona due volte, e la seconda ha smentito la conclusione
 * della prima: spostare il `notFound()` dalla `page.tsx` al `layout.tsx` del
 * segmento di dettaglio **non basta** se un `loading.tsx` sta più in alto. Con
 * il file a livello `[stagione]/`, `/2025-26/squadre/<id-di-un'altra-stagione>`
 * rispondeva 200 pur avendo il controllo nel layout di `[squadraId]`.
 *
 * Un gruppo di rotta non aggiunge segmenti all'URL ma limita il confine a ciò
 * che contiene: qui avvolge il solo cruscotto, e le rotte sorelle (`squadre/`,
 * e quelle che verranno) restano fuori.
 *
 * Regola operativa: nessun `loading.tsx` su un segmento che abbia sotto di sé
 * una rotta di dettaglio con `notFound()`. Gli E2E che asseriscono
 * `response.status()` sono ciò che lo rende verificabile invece che sperato.
 */
export default function Caricamento() {
  return <p className="p-6 text-neutral-600">Caricamento…</p>
}
