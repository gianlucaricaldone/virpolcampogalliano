type Dati = Record<string, string | number | boolean | null | undefined>

/**
 * Log strutturato senza dati personali: solo identificativi ed eventi.
 * Mai nomi, cognomi, codici fiscali o email — i log di produzione non
 * devono diventare un archivio di dati di minori.
 */
function scrivi(livello: 'info' | 'warn' | 'error', evento: string, dati?: Dati) {
  const riga = JSON.stringify({ livello, evento, ...dati })
  if (livello === 'error') console.error(riga)
  else if (livello === 'warn') console.warn(riga)
  else if (process.env.NODE_ENV !== 'production') console.log(riga)
}

export const log = {
  info: (evento: string, dati?: Dati) => scrivi('info', evento, dati),
  warn: (evento: string, dati?: Dati) => scrivi('warn', evento, dati),
  error: (evento: string, dati?: Dati) => scrivi('error', evento, dati),
}
