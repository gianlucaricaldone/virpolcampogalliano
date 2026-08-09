import { expect, test as guardia } from '@playwright/test'

/**
 * Gira prima di ogni altro test e ferma la suite se l'applicazione servita su
 * `baseURL` non sta parlando al database locale.
 *
 * Serve perché `reuseExistingServer` riusa qualunque cosa risponda sulla porta
 * 3000, e `npm run dev:produzione` non fissa la porta: se trova la 3000 libera
 * la occupa. In quel caso questa suite — che crea squadre, persone e
 * tesseramenti e poi li cancella — girerebbe contro la produzione. È già
 * capitato di avere due server accesi, entrambi sulla produzione, uno sulla
 * 3000 e uno sulla 3001.
 *
 * Il controllo non guarda la porta ma quello che la pagina dichiara: l'URL di
 * Supabase è una variabile `NEXT_PUBLIC_*`, quindi finisce nel documento
 * servito. Stesso principio del badge in `components/layout/BadgeAmbiente`, e
 * l'unica prova che non dipende da quale porta sia toccata a chi.
 */
guardia('la suite gira contro il database locale, non contro la produzione', async ({ request }) => {
  const html = await (await request.get('/login')).text()
  const riferimentoOspitato = html.match(/\b[a-z]{20}\b(?=<\/div>)/)?.[0]

  expect(
    html,
    riferimentoOspitato
      ? `L'applicazione sotto test parla al progetto Supabase ospitato "${riferimentoOspitato}". ` +
        'Questa suite crea e cancella dati: ferma il server che risponde su baseURL ' +
        '(quasi certamente un `npm run dev:produzione`) e lascia solo `npm run dev`.'
      : 'Nel documento servito non compare il Supabase locale: impossibile stabilire a quale ' +
        'database parli l\'applicazione, e senza quella certezza la suite non parte.',
  ).toContain('127.0.0.1:54321')
})
