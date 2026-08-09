import Link from 'next/link'

// Estratto da contatti/page.tsx per restare nel budget di ~150 righe a
// pagina: i quattro recapiti di reparto e le tre informazioni principali
// (indirizzo, orari segreteria, emergenze), verbatim dal sito vecchio.
const CONTATTI = [
  {
    nome: 'Segreteria Generale',
    ruolo: 'Informazioni e Iscrizioni',
    telefono: '059 123456',
    email: 'info@virpolcampogalliano.it',
    orari: 'Lun-Ven 18:00-20:00, Sab 15:00-18:00',
  },
  {
    nome: 'Responsabile Scuola Calcio',
    ruolo: 'Marco Rossi',
    telefono: '347 1234567',
    email: 'scuolacalcio@virpolcampogalliano.it',
    orari: 'Disponibile durante allenamenti',
  },
  {
    nome: 'Settore Giovanile',
    ruolo: 'Andrea Bianchi',
    telefono: '335 9876543',
    email: 'giovanile@virpolcampogalliano.it',
    orari: 'Mar-Gio 19:00-20:00',
  },
  {
    nome: 'Prima Squadra',
    ruolo: 'Giuseppe Viola',
    telefono: '328 5551234',
    email: 'primasquadra@virpolcampogalliano.it',
    orari: 'Su appuntamento',
  },
]

export function RecapitiContatto() {
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-center text-3xl font-bold text-neutral-900">
          Le Nostre <span className="text-blue-600">Informazioni</span>
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-lg text-neutral-600">
          Contatta direttamente il reparto di tuo interesse per ricevere
          informazioni specifiche e dettagliate
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CONTATTI.map((c) => (
            <div key={c.nome} className="rounded-lg border bg-white p-6 text-center shadow-sm">
              <p className="font-semibold text-neutral-900">{c.nome}</p>
              <p className="text-sm text-neutral-600">{c.ruolo}</p>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>
                  <a href={`tel:${c.telefono.replace(/\s/g, '')}`} className="hover:text-blue-600">
                    {c.telefono}
                  </a>
                </p>
                <p className="break-all">
                  <a href={`mailto:${c.email}`} className="hover:text-blue-600">
                    {c.email}
                  </a>
                </p>
                <p className="text-xs text-neutral-500">{c.orari}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-neutral-900">Indirizzo</p>
            <p className="mt-3 text-neutral-600">Centro Sportivo Virpol</p>
            <p className="text-neutral-600">Via dello Sport, 1</p>
            <p className="text-neutral-600">41011 Campogalliano (MO)</p>
            <Link href="/dove-siamo" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
              Come arrivare →
            </Link>
          </div>

          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-neutral-900">Orari Segreteria</p>
            <div className="mt-3 space-y-1 text-neutral-600">
              <p><span className="font-medium">Lun-Ven:</span> 18:00 - 20:00</p>
              <p><span className="font-medium">Sabato:</span> 15:00 - 18:00</p>
              <p><span className="font-medium">Domenica:</span> Chiuso</p>
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Durante le partite domenicali siamo disponibili presso il campo.
            </p>
          </div>

          <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
            <p className="font-semibold text-neutral-900">Emergenze</p>
            <p className="mt-3 text-neutral-600">
              Per urgenze durante allenamenti o partite:
            </p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">333 1234567</p>
            <p className="mt-2 text-sm text-neutral-500">
              Disponibile solo per emergenze mediche o situazioni urgenti.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
