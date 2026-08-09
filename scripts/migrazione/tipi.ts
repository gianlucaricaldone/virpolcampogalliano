/**
 * Forme delle righe del vecchio schema (hosted, 47 migration) così come
 * escono da PostgREST, e strutture di lavoro della migrazione. Solo i campi
 * che la migrazione legge: il resto non esiste per questo script.
 */

export type Anomalia = {
  /** classe dell'anomalia, es. 'stagione_nome_invalido' */
  tipo: string
  /** id della riga vecchia */
  id: string
  /** chiave naturale leggibile, per ritrovare la riga a occhio */
  chiave: string
  dettaglio: string
}

export type VecchiaStagione = {
  id: string
  nome: string
  data_inizio: string
  data_fine: string
  archiviata: boolean
}

export type VecchioUtente = {
  id: string
  email: string
  role: string
  roles: string[] | null
  nome: string | null
  cognome: string | null
  telefono: string | null
}

export type VecchioTesserato = {
  id: string
  nome: string
  cognome: string
  /**
   * Nullable per davvero: nei dati reali (non nei fixture di test) l'intera
   * tabella storica non ha mai avuto questo campo popolato. `trasformaTesserati`
   * tratta l'assenza come anomalia, mai come '' o una data inventata.
   */
  data_nascita: string | null
  codice_fiscale: string | null
  email: string | null
  telefono: string | null
  indirizzo: string | null
  citta: string | null
  cap: string | null
}

export type VecchiaSquadra = {
  id: string
  nome: string
  categoria: string
  annata: number | null
  stagione_id: string | null
}

export type VecchioTesseramentoSquadra = {
  id: string
  tesserato_id: string
  squadra_id: string
  stagione_id: string
  numero_maglia: number | null
  data_tesseramento: string | null
  note: string | null
}

export type VecchiDatiStagionali = {
  id: string
  tesserato_id: string
  stagione_id: string
  stato_pagamento: string
  note_pagamento: string | null
  visita_sportiva: boolean
  scadenza_certificato: string | null
  updated_at: string
}

export type VecchiaPresenza = {
  id: string
  tesserato_id: string
  squadra_id: string | null
  stagione_id: string | null
  data: string
  tipo: string
  presente: boolean
  note: string | null
}
