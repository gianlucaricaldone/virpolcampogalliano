import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Client semplice per componenti con organization context
export function createOrganizationClient(organizationId?: string) {
  return createClientComponentClient<Database>()
}

// Helper class per query comuni con organization context
export class OrganizationQueries {
  constructor(
    private supabase: SupabaseClient<Database>,
    private organizationId: string
  ) {}

  // Tesserati queries
  async getTesserati(options?: { attivi?: boolean; squadraId?: string }) {
    let query = this.supabase
      .from('tesserati')
      .select(`
        *,
        dati_stagionali:tesserati_dati_stagionali(*),
        squadre_stagioni:tesserati_squadre_stagioni(
          *,
          squadra:squadre(*)
        )
      `)
      .eq('organization_id', this.organizationId)
    
    if (options?.attivi !== undefined) {
      query = query.eq('stato', options.attivi)
    }
    
    return query.order('cognome')
  }

  async getSquadre(stagioneId?: string) {
    let query = this.supabase
      .from('squadre')
      .select(`
        *,
        allenatore:tesserati!squadre_allenatore_id_fkey(*),
        vice_allenatore:tesserati!squadre_vice_allenatore_id_fkey(*)
      `)
      .eq('organization_id', this.organizationId)
    
    if (stagioneId) {
      query = query.eq('stagione_id', stagioneId)
    }
    
    return query.order('nome')
  }

  // Statistiche e dashboard
  async getDashboardStats() {
    const [tesseratiCount, squadreCount, partiteCount] = await Promise.all([
      this.supabase
        .from('tesserati')
        .select('id', { count: 'exact' })
        .eq('organization_id', this.organizationId)
        .eq('stato', true),
      
      this.supabase
        .from('squadre')
        .select('id', { count: 'exact' })
        .eq('organization_id', this.organizationId),
      
      this.supabase
        .from('partite')
        .select('id', { count: 'exact' })
        .eq('organization_id', this.organizationId)
        .gte('data', new Date().toISOString().split('T')[0])
    ])

    return {
      tesserati: tesseratiCount.count || 0,
      squadre: squadreCount.count || 0,
      partite_future: partiteCount.count || 0
    }
  }
}

// Hook per usare OrganizationQueries nei componenti
export function useOrgQueries(organizationId?: string) {
  const client = createOrganizationClient(organizationId)
  
  if (!organizationId) {
    return null
  }
  
  return new OrganizationQueries(client, organizationId)
}