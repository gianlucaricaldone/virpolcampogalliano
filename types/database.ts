export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          subscription_plan: 'base' | 'plus' | 'enterprise' | 'trial'
          subscription_status: 'active' | 'inactive' | 'suspended' | 'cancelled'
          subscription_started_at: string | null
          subscription_expires_at: string | null
          trial_ends_at: string | null
          max_tesserati: number
          max_squadre: number
          max_storage_gb: number
          features: Record<string, any>
          settings: Record<string, any>
          created_at: string
          updated_at: string
          created_by: string | null
          deleted_at: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          subscription_plan?: 'base' | 'plus' | 'enterprise' | 'trial'
          subscription_status?: 'active' | 'inactive' | 'suspended' | 'cancelled'
          subscription_started_at?: string | null
          subscription_expires_at?: string | null
          trial_ends_at?: string | null
          max_tesserati?: number
          max_squadre?: number
          max_storage_gb?: number
          features?: Record<string, any>
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          subscription_plan?: 'base' | 'plus' | 'enterprise' | 'trial'
          subscription_status?: 'active' | 'inactive' | 'suspended' | 'cancelled'
          subscription_started_at?: string | null
          subscription_expires_at?: string | null
          trial_ends_at?: string | null
          max_tesserati?: number
          max_squadre?: number
          max_storage_gb?: number
          features?: Record<string, any>
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
          created_by?: string | null
          deleted_at?: string | null
          is_active?: boolean
        }
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member' | 'viewer'
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'member' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string | null
          role: 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'
          roles: ('admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id: string[] | null
          nome: string | null
          cognome: string | null
          telefono: string | null
          has_logged_in: boolean | null
          organization_id: string | null
          migrated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          email?: string | null
          role?: 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'
          roles?: ('admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id?: string[] | null
          nome?: string | null
          cognome?: string | null
          telefono?: string | null
          has_logged_in?: boolean | null
          organization_id?: string | null
          migrated_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string | null
          email?: string | null
          role?: 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'
          roles?: ('admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore')[] | null
          squadra_id?: string[] | null
          nome?: string | null
          cognome?: string | null
          telefono?: string | null
          has_logged_in?: boolean | null
          organization_id?: string | null
          migrated_at?: string | null
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
          stagione_id: string | null
          foto_squadra: string | null
          allenatore: string | null
          allenatore_id: string | null
          vice_allenatore_1: string | null
          vice_allenatore_2: string | null
          vice_allenatore_1_id: string | null
          vice_allenatore_2_id: string | null
          dirigente: string | null
          dirigente_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          categoria: string
          annata: number
          stagione_id?: string | null
          foto_squadra?: string | null
          allenatore?: string | null
          allenatore_id?: string | null
          vice_allenatore_1?: string | null
          vice_allenatore_2?: string | null
          vice_allenatore_1_id?: string | null
          vice_allenatore_2_id?: string | null
          dirigente?: string | null
          dirigente_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          categoria?: string
          annata?: number
          stagione_id?: string | null
          foto_squadra?: string | null
          allenatore?: string | null
          allenatore_id?: string | null
          vice_allenatore_1?: string | null
          vice_allenatore_2?: string | null
          vice_allenatore_1_id?: string | null
          vice_allenatore_2_id?: string | null
          dirigente?: string | null
          dirigente_id?: string | null
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
          codice_cartellino: string | null
          email: string | null
          telefono: string | null
          indirizzo: string | null
          citta: string | null
          cap: string | null
          documento_identita: string | null
          stato: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          cognome: string
          data_nascita: string
          codice_fiscale: string
          codice_cartellino?: string | null
          email?: string | null
          telefono?: string | null
          indirizzo?: string | null
          citta?: string | null
          cap?: string | null
          documento_identita?: string | null
          stato?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          cognome?: string
          data_nascita?: string
          codice_fiscale?: string
          codice_cartellino?: string | null
          email?: string | null
          telefono?: string | null
          indirizzo?: string | null
          citta?: string | null
          cap?: string | null
          documento_identita?: string | null
          stato?: boolean
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
          stagione_id: string | null
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
          stagione_id?: string | null
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
          stagione_id?: string | null
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
          categoria_avversario_id: string | null
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
          categoria_avversario_id?: string | null
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
          categoria_avversario_id?: string | null
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
      stagioni_sportive: {
        Row: {
          id: string
          nome: string
          anno_inizio: number
          anno_fine: number
          data_inizio: string
          data_fine: string
          descrizione: string | null
          attiva: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          anno_inizio?: number
          anno_fine?: number
          data_inizio: string
          data_fine: string
          descrizione?: string | null
          attiva?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          anno_inizio?: number
          anno_fine?: number
          data_inizio?: string
          data_fine?: string
          descrizione?: string | null
          attiva?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tesserati_squadre_stagioni: {
        Row: {
          id: string
          tesserato_id: string
          squadra_id: string
          stagione_id: string
          ruolo_squadra: string | null
          numero_maglia: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tesserato_id: string
          squadra_id: string
          stagione_id: string
          ruolo_squadra?: string | null
          numero_maglia?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tesserato_id?: string
          squadra_id?: string
          stagione_id?: string
          ruolo_squadra?: string | null
          numero_maglia?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      tesserati_dati_stagionali: {
        Row: {
          id: string
          tesserato_id: string
          stagione_id: string
          stato_pagamento: 'pagato' | 'non_pagato' | 'parziale' | 'in_sospeso'
          note_pagamento: string | null
          visita_sportiva: boolean
          scadenza_certificato: string | null
          certificato_medico: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tesserato_id: string
          stagione_id: string
          stato_pagamento?: 'pagato' | 'non_pagato' | 'parziale' | 'in_sospeso'
          note_pagamento?: string | null
          visita_sportiva?: boolean
          scadenza_certificato?: string | null
          certificato_medico?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tesserato_id?: string
          stagione_id?: string
          stato_pagamento?: 'pagato' | 'non_pagato' | 'parziale' | 'in_sospeso'
          note_pagamento?: string | null
          visita_sportiva?: boolean
          scadenza_certificato?: string | null
          certificato_medico?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      eventi: {
        Row: {
          id: string
          nome: string
          descrizione: string | null
          data_evento: string
          luogo: string | null
          costo_persona: number | null
          max_partecipanti: number | null
          tipologia: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          descrizione?: string | null
          data_evento: string
          luogo?: string | null
          costo_persona?: number | null
          max_partecipanti?: number | null
          tipologia?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          descrizione?: string | null
          data_evento?: string
          luogo?: string | null
          costo_persona?: number | null
          max_partecipanti?: number | null
          tipologia?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      prenotazioni_eventi: {
        Row: {
          id: string
          evento_id: string
          nome_partecipante: string
          email: string | null
          telefono: string | null
          note: string | null
          confermato: boolean
          presente: boolean
          no_maiale: boolean
          vegetariano_vegano: boolean
          celiaco: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          evento_id: string
          nome_partecipante: string
          email?: string | null
          telefono?: string | null
          note?: string | null
          confermato?: boolean
          presente?: boolean
          no_maiale?: boolean
          vegetariano_vegano?: boolean
          celiaco?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          evento_id?: string
          nome_partecipante?: string
          email?: string | null
          telefono?: string | null
          note?: string | null
          confermato?: boolean
          presente?: boolean
          no_maiale?: boolean
          vegetariano_vegano?: boolean
          celiaco?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      parametri_sistema: {
        Row: {
          id: string
          chiave: string
          valore: string | null
          descrizione: string | null
          tipo: 'string' | 'number' | 'boolean' | 'json'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chiave: string
          valore?: string | null
          descrizione?: string | null
          tipo?: 'string' | 'number' | 'boolean' | 'json'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chiave?: string
          valore?: string | null
          descrizione?: string | null
          tipo?: 'string' | 'number' | 'boolean' | 'json'
          created_at?: string
          updated_at?: string
        }
      }
      avversari: {
        Row: {
          id: string
          nome: string
          nome_societa: string | null
          categoria_id: string | null
          citta: string | null
          provincia: string | null
          telefono: string | null
          email: string | null
          sito_web: string | null
          contatto_email: string | null
          contatto_telefono: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          nome_societa?: string | null
          categoria_id?: string | null
          citta?: string | null
          provincia?: string | null
          telefono?: string | null
          email?: string | null
          sito_web?: string | null
          contatto_email?: string | null
          contatto_telefono?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          nome_societa?: string | null
          categoria_id?: string | null
          citta?: string | null
          provincia?: string | null
          telefono?: string | null
          email?: string | null
          sito_web?: string | null
          contatto_email?: string | null
          contatto_telefono?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categorie_avversari: {
        Row: {
          id: string
          nome: string
          nome_categoria: string | null
          descrizione: string | null
          responsabile_nome: string | null
          responsabile_telefono: string | null
          responsabile_email: string | null
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          nome_categoria?: string | null
          descrizione?: string | null
          responsabile_nome?: string | null
          responsabile_telefono?: string | null
          responsabile_email?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          nome_categoria?: string | null
          descrizione?: string | null
          responsabile_nome?: string | null
          responsabile_telefono?: string | null
          responsabile_email?: string | null
          note?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tornei: {
        Row: {
          id: string
          nome: string
          data_inizio: string
          data_fine: string
          stato: string
          regolamento: any
          costo_iscrizione: number
          attivo: boolean
          iscrizioni_aperte: boolean
          descrizione: string | null
          luogo: string | null
          numero_squadre_max: number | null
          numero_squadre_iscritte: number
          contatto_email: string | null
          contatto_telefono: string | null
          immagine_copertina: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          data_inizio: string
          data_fine: string
          stato?: string
          regolamento?: any
          costo_iscrizione?: number
          attivo?: boolean
          iscrizioni_aperte?: boolean
          descrizione?: string | null
          luogo?: string | null
          numero_squadre_max?: number | null
          numero_squadre_iscritte?: number
          contatto_email?: string | null
          contatto_telefono?: string | null
          immagine_copertina?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          data_inizio?: string
          data_fine?: string
          stato?: string
          regolamento?: any
          costo_iscrizione?: number
          attivo?: boolean
          iscrizioni_aperte?: boolean
          descrizione?: string | null
          luogo?: string | null
          numero_squadre_max?: number | null
          numero_squadre_iscritte?: number
          contatto_email?: string | null
          contatto_telefono?: string | null
          immagine_copertina?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      iscrizioni_torneo: {
        Row: {
          id: string
          torneo_id: string
          squadra_id: string
          data_iscrizione: string
          confermata: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          torneo_id: string
          squadra_id: string
          data_iscrizione?: string
          confermata?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          torneo_id?: string
          squadra_id?: string
          data_iscrizione?: string
          confermata?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      movimenti_economici: {
        Row: {
          id: string
          tipo: 'entrata' | 'uscita'
          categoria: string
          sottocategoria: string | null
          importo: number
          descrizione: string
          data_movimento: string
          metodo_pagamento: string
          riferimento: string | null
          note: string | null
          tesserato_id: string | null
          evento_id: string | null
          stagione_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tipo: 'entrata' | 'uscita'
          categoria: string
          sottocategoria?: string | null
          importo: number
          descrizione: string
          data_movimento: string
          metodo_pagamento?: string
          riferimento?: string | null
          note?: string | null
          tesserato_id?: string | null
          evento_id?: string | null
          stagione_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tipo?: 'entrata' | 'uscita'
          categoria?: string
          sottocategoria?: string | null
          importo?: number
          descrizione?: string
          data_movimento?: string
          metodo_pagamento?: string
          riferimento?: string | null
          note?: string | null
          tesserato_id?: string | null
          evento_id?: string | null
          stagione_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categorie_economiche: {
        Row: {
          id: string
          nome: string
          tipo: 'entrata' | 'uscita' | 'entrambi'
          descrizione: string | null
          colore: string
          attiva: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          nome: string
          tipo: 'entrata' | 'uscita' | 'entrambi'
          descrizione?: string | null
          colore?: string
          attiva?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          tipo?: 'entrata' | 'uscita' | 'entrambi'
          descrizione?: string | null
          colore?: string
          attiva?: boolean
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
      v_economia_stats: {
        Row: {
          stagione_id: string | null
          tipo: 'entrata' | 'uscita'
          categoria: string
          totale: number
          numero_movimenti: number
          importo_medio: number
          data_primo_movimento: string
          data_ultimo_movimento: string
        }
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'
      stato_pagamento: 'pagato' | 'non_pagato' | 'parziale' | 'in_sospeso'
      tipo_presenza: 'allenamento' | 'partita' | 'torneo' | 'evento'
      tipologia_evento: 'cena' | 'altro'
    }
  }
}