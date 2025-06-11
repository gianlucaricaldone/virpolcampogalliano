export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          role: 'admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore'
          roles: ('admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id: string[] | null
          nome: string | null
          cognome: string | null
          telefono: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          role?: 'admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore'
          roles?: ('admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id?: string[] | null
          nome?: string | null
          cognome?: string | null
          telefono?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: 'admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore'
          roles?: ('admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id?: string[] | null
          nome?: string | null
          cognome?: string | null
          telefono?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      squadre: {
        Row: {
          id: string
          nome: string
          categoria: string
          annata: number
          foto_squadra: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          categoria: string
          annata: number
          foto_squadra?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          categoria?: string
          annata?: number
          foto_squadra?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tesserati: {
        Row: {
          id: string
          nome: string
          cognome: string
          data_nascita: string
          codice_fiscale: string
          squadra_id: string
          ruolo_squadra: string
          email: string | null
          telefono: string | null
          indirizzo: string | null
          citta: string | null
          cap: string | null
          documento_identita: string | null
          certificato_medico: string | null
          scadenza_certificato: string | null
          stato_pagamento: 'pagato' | 'non_pagato' | 'parziale'
          note_pagamento: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cognome: string
          data_nascita: string
          codice_fiscale: string
          squadra_id: string
          ruolo_squadra: string
          email?: string | null
          telefono?: string | null
          indirizzo?: string | null
          citta?: string | null
          cap?: string | null
          documento_identita?: string | null
          certificato_medico?: string | null
          scadenza_certificato?: string | null
          stato_pagamento?: 'pagato' | 'non_pagato' | 'parziale'
          note_pagamento?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cognome?: string
          data_nascita?: string
          codice_fiscale?: string
          squadra_id?: string
          ruolo_squadra?: string
          email?: string | null
          telefono?: string | null
          indirizzo?: string | null
          citta?: string | null
          cap?: string | null
          documento_identita?: string | null
          certificato_medico?: string | null
          scadenza_certificato?: string | null
          stato_pagamento?: 'pagato' | 'non_pagato' | 'parziale'
          note_pagamento?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      presenze: {
        Row: {
          id: string
          tesserato_id: string
          data: string
          tipo: 'allenamento' | 'partita' | 'torneo' | 'evento'
          presente: boolean
          note: string | null
          squadra_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tesserato_id: string
          data: string
          tipo: 'allenamento' | 'partita' | 'torneo' | 'evento'
          presente?: boolean
          note?: string | null
          squadra_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tesserato_id?: string
          data?: string
          tipo?: 'allenamento' | 'partita' | 'torneo' | 'evento'
          presente?: boolean
          note?: string | null
          squadra_id?: string | null
          squadra_id?: string | null
          created_at?: string
        }
      }
      partite: {
        Row: {
          id: string
          squadra_id: string
          data: string
          ora: string
          campo: string
          avversario: string
          risultato: string | null
          tipo_competizione: string
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          squadra_id: string
          data: string
          ora: string
          campo: string
          avversario: string
          risultato?: string | null
          tipo_competizione: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          squadra_id?: string
          data?: string
          ora?: string
          campo?: string
          avversario?: string
          risultato?: string | null
          tipo_competizione?: string
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      report_allenatori: {
        Row: {
          id: string
          allenatore_id: string
          squadra_id: string | null
          data: string
          tipo_attivita: 'allenamento' | 'partita' | 'torneo' | 'evento'
          report: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          allenatore_id: string
          squadra_id?: string | null
          data?: string
          tipo_attivita: 'allenamento' | 'partita' | 'torneo' | 'evento'
          report: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          allenatore_id?: string
          squadra_id?: string | null
          data?: string
          tipo_attivita?: 'allenamento' | 'partita' | 'torneo' | 'evento'
          report?: string
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      statistiche_presenze: {
        Row: {
          squadra_id: string | null
          squadra_nome: string | null
          tesserato_id: string
          tesserato_nome: string
          settimana: string
          mese: string
          tipo: 'allenamento' | 'partita' | 'torneo' | 'evento'
          presenze: number
          totale: number
          percentuale: number
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'dirigente' | 'allenatore' | 'tesserato' | 'genitore'
      stato_pagamento: 'pagato' | 'non_pagato' | 'parziale'
      tipo_presenza: 'allenamento' | 'partita' | 'torneo' | 'evento'
    }
  }
}