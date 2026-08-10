import { describe, expect, it } from 'vitest'
import { linkGoogleMaps, linkWaze, SEDE } from '@/lib/costanti'

/*
 * Questi due link sono l'unica «indicazione stradale» che /dove-siamo offre: non
 * c'è nessuna mappa incorporata. Se si rompono, la pagina non dice più dove
 * siamo — e prima erano `https://maps.google.com` e `https://waze.com`, cioè le
 * due homepage, che è il modo in cui si rompono senza sembrare rotti.
 */
describe('link di navigazione verso la sede', () => {
  it.each([
    ['Google Maps', linkGoogleMaps()],
    ['Waze', linkWaze()],
  ])('%s punta a un luogo, non a una homepage', (_nome, url) => {
    expect(url).toMatch(/^https:\/\//)
    // L'indirizzo dev'esserci, e codificato: con gli spazi grezzi dentro una
    // query string il link si tronca alla prima parola in qualche client.
    expect(url).toContain(encodeURIComponent(SEDE.ricerca))
    expect(url).not.toContain(' ')
  })

  it('la ricerca nomina il centro e la via, che sono ciò che le mappe risolvono', () => {
    expect(SEDE.ricerca).toContain('Lauro Bolelli')
    expect(SEDE.ricerca).toContain('Via Enrico Mattei 15')
    expect(SEDE.ricerca).toContain('Campogalliano')
  })

  it('Waze parte già in navigazione', () => {
    // Senza `navigate=yes` Waze apre la scheda del luogo e chiede un altro
    // tocco: chi legge questa pagina è in macchina.
    expect(linkWaze()).toContain('navigate=yes')
  })
})
