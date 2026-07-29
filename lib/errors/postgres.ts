type ErrorePostgres = { code: string; message: string }

function isErrorePostgres(e: unknown): e is ErrorePostgres {
  return (
    typeof e === 'object' && e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { message?: unknown }).message === 'string'
  )
}

const perVincolo: Record<string, string> = {
  tesseramenti_squadra_maglia_uidx:
    'Questo numero di maglia è già assegnato a un altro giocatore della squadra',
  tesseramenti_persona_id_stagione_id_key:
    'Questa persona è già tesserata in questa stagione',
  sedute_squadra_data_ora_key:
    'Esiste già una seduta per questa squadra in quel giorno e a quell\'ora',
  stagioni_codice_key: 'Esiste già una stagione con questo codice',
  squadre_stagione_id_nome_key: 'Esiste già una squadra con questo nome nella stagione',
  persone_codice_fiscale_key: 'Esiste già una persona con questo codice fiscale',
  presenze_seduta_id_tesseramento_id_key:
    'Questo giocatore ha già una presenza registrata per la seduta',
  stagioni_codice_forma: 'Il codice della stagione deve avere la forma 2026-27',
  stagioni_date_coerenti: 'La data di fine deve essere successiva a quella di inizio',
  tesseramenti_maglia_intervallo: 'Il numero di maglia deve essere compreso fra 1 e 99',
  quote_importi_un_solo_livello:
    'Un importo deve riferirsi a un solo livello: stagione, squadra oppure tesseramento',
  pagamenti_importo_positivo: 'L\'importo del versamento deve essere maggiore di zero',
  profili_allenatore_ha_persona:
    'Un allenatore deve essere collegato a una persona in anagrafica',
}

/**
 * Traduce gli errori del database in messaggi per l'utente.
 * Restituisce null se l'errore non è riconosciuto: chi chiama decide se
 * mostrare un messaggio generico o lasciar propagare.
 */
export function traduciErrorePostgres(e: unknown): string | null {
  if (!isErrorePostgres(e)) return null

  if (e.code === '23505' || e.code === '23514') {
    for (const [vincolo, messaggio] of Object.entries(perVincolo)) {
      if (e.message.includes(vincolo)) return messaggio
    }
    return e.code === '23505' ? 'Valore già presente' : 'Valore non ammesso'
  }
  if (e.code === '23503') return 'Elemento collegato non più esistente: ricarica la pagina'
  if (e.code === '42501') return 'Operazione non consentita'
  return null
}
