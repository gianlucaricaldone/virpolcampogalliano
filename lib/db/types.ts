export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      incarichi_staff: {
        Row: {
          created_at: string
          id: string
          persona_id: string
          ruolo: Database["public"]["Enums"]["ruolo_staff"]
          squadra_id: string
          stagione_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          persona_id: string
          ruolo: Database["public"]["Enums"]["ruolo_staff"]
          squadra_id: string
          stagione_id: string
        }
        Update: {
          created_at?: string
          id?: string
          persona_id?: string
          ruolo?: Database["public"]["Enums"]["ruolo_staff"]
          squadra_id?: string
          stagione_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incarichi_squadra_di_stagione"
            columns: ["squadra_id", "stagione_id"]
            isOneToOne: false
            referencedRelation: "squadre"
            referencedColumns: ["id", "stagione_id"]
          },
          {
            foreignKeyName: "incarichi_staff_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persone"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamenti_quota: {
        Row: {
          created_at: string
          data: string
          id: string
          importo: number
          metodo: Database["public"]["Enums"]["metodo_pagamento"]
          note: string | null
          registrato_da: string | null
          tesseramento_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          importo: number
          metodo?: Database["public"]["Enums"]["metodo_pagamento"]
          note?: string | null
          registrato_da?: string | null
          tesseramento_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          importo?: number
          metodo?: Database["public"]["Enums"]["metodo_pagamento"]
          note?: string | null
          registrato_da?: string | null
          tesseramento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagamenti_quota_registrato_da_fkey"
            columns: ["registrato_da"]
            isOneToOne: false
            referencedRelation: "profili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_quota_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: false
            referencedRelation: "tesseramenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamenti_quota_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: false
            referencedRelation: "v_presenze"
            referencedColumns: ["tesseramento_id"]
          },
          {
            foreignKeyName: "pagamenti_quota_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: false
            referencedRelation: "v_quote"
            referencedColumns: ["tesseramento_id"]
          },
          {
            foreignKeyName: "pagamenti_quota_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: false
            referencedRelation: "v_visite"
            referencedColumns: ["tesseramento_id"]
          },
        ]
      }
      persone: {
        Row: {
          attiva: boolean
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          cognome: string
          created_at: string
          data_nascita: string
          email: string | null
          id: string
          indirizzo: string | null
          nome: string
          note: string | null
          provincia: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          attiva?: boolean
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome: string
          created_at?: string
          data_nascita: string
          email?: string | null
          id?: string
          indirizzo?: string | null
          nome: string
          note?: string | null
          provincia?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          attiva?: boolean
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          cognome?: string
          created_at?: string
          data_nascita?: string
          email?: string | null
          id?: string
          indirizzo?: string | null
          nome?: string
          note?: string | null
          provincia?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      presenze: {
        Row: {
          created_at: string
          id: string
          note: string | null
          seduta_id: string
          squadra_id: string
          stato: Database["public"]["Enums"]["stato_presenza"]
          tesseramento_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          seduta_id: string
          squadra_id: string
          stato: Database["public"]["Enums"]["stato_presenza"]
          tesseramento_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          seduta_id?: string
          squadra_id?: string
          stato?: Database["public"]["Enums"]["stato_presenza"]
          tesseramento_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presenze_seduta_di_squadra"
            columns: ["seduta_id", "squadra_id"]
            isOneToOne: false
            referencedRelation: "sedute_allenamento"
            referencedColumns: ["id", "squadra_id"]
          },
          {
            foreignKeyName: "presenze_tesseramento_di_squadra"
            columns: ["tesseramento_id", "squadra_id"]
            isOneToOne: false
            referencedRelation: "tesseramenti"
            referencedColumns: ["id", "squadra_id"]
          },
          {
            foreignKeyName: "presenze_tesseramento_di_squadra"
            columns: ["tesseramento_id", "squadra_id"]
            isOneToOne: false
            referencedRelation: "v_quote"
            referencedColumns: ["tesseramento_id", "squadra_id"]
          },
          {
            foreignKeyName: "presenze_tesseramento_di_squadra"
            columns: ["tesseramento_id", "squadra_id"]
            isOneToOne: false
            referencedRelation: "v_visite"
            referencedColumns: ["tesseramento_id", "squadra_id"]
          },
        ]
      }
      profili: {
        Row: {
          attivo: boolean
          created_at: string
          id: string
          persona_id: string | null
          ruolo: Database["public"]["Enums"]["ruolo_app"]
          updated_at: string
        }
        Insert: {
          attivo?: boolean
          created_at?: string
          id: string
          persona_id?: string | null
          ruolo: Database["public"]["Enums"]["ruolo_app"]
          updated_at?: string
        }
        Update: {
          attivo?: boolean
          created_at?: string
          id?: string
          persona_id?: string | null
          ruolo?: Database["public"]["Enums"]["ruolo_app"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profili_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persone"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_importi: {
        Row: {
          created_at: string
          id: string
          importo: number
          note: string | null
          squadra_id: string | null
          stagione_id: string | null
          tesseramento_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          importo: number
          note?: string | null
          squadra_id?: string | null
          stagione_id?: string | null
          tesseramento_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          importo?: number
          note?: string | null
          squadra_id?: string | null
          stagione_id?: string | null
          tesseramento_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_importi_squadra_id_fkey"
            columns: ["squadra_id"]
            isOneToOne: true
            referencedRelation: "squadre"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_importi_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: true
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_importi_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: true
            referencedRelation: "tesseramenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_importi_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: true
            referencedRelation: "v_presenze"
            referencedColumns: ["tesseramento_id"]
          },
          {
            foreignKeyName: "quote_importi_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: true
            referencedRelation: "v_quote"
            referencedColumns: ["tesseramento_id"]
          },
          {
            foreignKeyName: "quote_importi_tesseramento_id_fkey"
            columns: ["tesseramento_id"]
            isOneToOne: true
            referencedRelation: "v_visite"
            referencedColumns: ["tesseramento_id"]
          },
        ]
      }
      sedute_allenamento: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          id: string
          note: string | null
          ora_inizio: string | null
          squadra_id: string
          stagione_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          note?: string | null
          ora_inizio?: string | null
          squadra_id: string
          stagione_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          note?: string | null
          ora_inizio?: string | null
          squadra_id?: string
          stagione_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sedute_allenamento_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sedute_squadra_di_stagione"
            columns: ["squadra_id", "stagione_id"]
            isOneToOne: false
            referencedRelation: "squadre"
            referencedColumns: ["id", "stagione_id"]
          },
        ]
      }
      squadre: {
        Row: {
          annata: number | null
          categoria: string
          created_at: string
          id: string
          nome: string
          note: string | null
          stagione_id: string
          updated_at: string
        }
        Insert: {
          annata?: number | null
          categoria: string
          created_at?: string
          id?: string
          nome: string
          note?: string | null
          stagione_id: string
          updated_at?: string
        }
        Update: {
          annata?: number | null
          categoria?: string
          created_at?: string
          id?: string
          nome?: string
          note?: string | null
          stagione_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "squadre_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      stagioni: {
        Row: {
          codice: string
          created_at: string
          data_fine: string
          data_inizio: string
          etichetta: string
          id: string
          stato: Database["public"]["Enums"]["stato_stagione"]
          updated_at: string
        }
        Insert: {
          codice: string
          created_at?: string
          data_fine: string
          data_inizio: string
          etichetta: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_stagione"]
          updated_at?: string
        }
        Update: {
          codice?: string
          created_at?: string
          data_fine?: string
          data_inizio?: string
          etichetta?: string
          id?: string
          stato?: Database["public"]["Enums"]["stato_stagione"]
          updated_at?: string
        }
        Relationships: []
      }
      tesseramenti: {
        Row: {
          created_at: string
          id: string
          note: string | null
          numero_maglia: number | null
          persona_id: string
          squadra_id: string | null
          stagione_id: string
          updated_at: string
          visita_consegnata_il: string | null
          visita_scadenza: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          numero_maglia?: number | null
          persona_id: string
          squadra_id?: string | null
          stagione_id: string
          updated_at?: string
          visita_consegnata_il?: string | null
          visita_scadenza?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          numero_maglia?: number | null
          persona_id?: string
          squadra_id?: string | null
          stagione_id?: string
          updated_at?: string
          visita_consegnata_il?: string | null
          visita_scadenza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tesseramenti_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesseramenti_squadra_di_stagione"
            columns: ["squadra_id", "stagione_id"]
            isOneToOne: false
            referencedRelation: "squadre"
            referencedColumns: ["id", "stagione_id"]
          },
          {
            foreignKeyName: "tesseramenti_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_presenze: {
        Row: {
          assenti: number | null
          giustificati: number | null
          infortuni: number | null
          non_registrate: number | null
          percentuale: number | null
          presenti: number | null
          sedute_squadra: number | null
          tesseramento_id: string | null
        }
        Relationships: []
      }
      v_quote: {
        Row: {
          livello_importo: string | null
          pagato: number | null
          persona_id: string | null
          quota_attesa: number | null
          residuo: number | null
          squadra_id: string | null
          stagione_id: string | null
          stato: string | null
          tesseramento_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tesseramenti_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesseramenti_squadra_di_stagione"
            columns: ["squadra_id", "stagione_id"]
            isOneToOne: false
            referencedRelation: "squadre"
            referencedColumns: ["id", "stagione_id"]
          },
          {
            foreignKeyName: "tesseramenti_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
      v_visite: {
        Row: {
          giorni_alla_scadenza: number | null
          persona_id: string | null
          squadra_id: string | null
          stagione_id: string | null
          stato_visita: string | null
          tesseramento_id: string | null
          visita_consegnata_il: string | null
          visita_scadenza: string | null
        }
        Insert: {
          giorni_alla_scadenza?: never
          persona_id?: string | null
          squadra_id?: string | null
          stagione_id?: string | null
          stato_visita?: never
          tesseramento_id?: string | null
          visita_consegnata_il?: string | null
          visita_scadenza?: string | null
        }
        Update: {
          giorni_alla_scadenza?: never
          persona_id?: string | null
          squadra_id?: string | null
          stagione_id?: string | null
          stato_visita?: never
          tesseramento_id?: string | null
          visita_consegnata_il?: string | null
          visita_scadenza?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tesseramenti_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "persone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tesseramenti_squadra_di_stagione"
            columns: ["squadra_id", "stagione_id"]
            isOneToOne: false
            referencedRelation: "squadre"
            referencedColumns: ["id", "stagione_id"]
          },
          {
            foreignKeyName: "tesseramenti_stagione_id_fkey"
            columns: ["stagione_id"]
            isOneToOne: false
            referencedRelation: "stagioni"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      metodo_pagamento: "contanti" | "bonifico" | "altro"
      ruolo_app: "admin" | "dirigente" | "allenatore"
      ruolo_staff: "allenatore" | "vice_allenatore" | "dirigente_squadra"
      stato_presenza: "presente" | "assente" | "giustificato" | "infortunato"
      stato_stagione: "aperta" | "chiusa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      metodo_pagamento: ["contanti", "bonifico", "altro"],
      ruolo_app: ["admin", "dirigente", "allenatore"],
      ruolo_staff: ["allenatore", "vice_allenatore", "dirigente_squadra"],
      stato_presenza: ["presente", "assente", "giustificato", "infortunato"],
      stato_stagione: ["aperta", "chiusa"],
    },
  },
} as const

