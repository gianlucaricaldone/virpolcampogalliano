# 🚀 Claude Code - Migrazione Multi-Organization per VirpolCampogalliano

## 📋 Obiettivo
Trasformare il progetto VirpolCampogalliano da single-tenant (una sola società sportiva) a multi-tenant SaaS, permettendo a multiple organizzazioni di usare la stessa istanza con completo isolamento dei dati.

## 🎯 Strategia di Migrazione
Procederemo in fasi incrementali per minimizzare rischi e mantenere il sistema funzionante durante la transizione.

## 📁 FASE 1: Database Schema Evolution

### 1.1 Crea tabella organizations
```sql
-- File: supabase/migrations/025_add_organizations_table.sql

-- Tabella principale per le organizzazioni
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#3b82f6',
  secondary_color VARCHAR(7) DEFAULT '#1e40af',
  
  -- Subscription info
  subscription_plan VARCHAR(20) DEFAULT 'base' CHECK (subscription_plan IN ('base', 'plus', 'enterprise', 'trial')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'suspended', 'cancelled')),
  subscription_started_at TIMESTAMP DEFAULT NOW(),
  subscription_expires_at TIMESTAMP,
  trial_ends_at TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days'),
  
  -- Limiti del piano
  max_tesserati INTEGER DEFAULT 100,
  max_squadre INTEGER DEFAULT 10,
  max_storage_gb INTEGER DEFAULT 5,
  
  -- Features flags
  features JSONB DEFAULT '{
    "sms": true,
    "email": true,
    "export": true,
    "api_access": false,
    "custom_domain": false,
    "white_label": false
  }'::jsonb,
  
  -- Metadata
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Soft delete
  deleted_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Indici per performance
CREATE INDEX idx_organizations_slug ON organizations(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_organizations_status ON organizations(subscription_status) WHERE is_active = true;
CREATE INDEX idx_organizations_expires ON organizations(subscription_expires_at) WHERE subscription_status = 'active';

-- Trigger per updated_at
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Tabella per membri dell'organizzazione
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org ON organization_members(organization_id, role);
```

### 1.2 Aggiungi organization_id a TUTTE le tabelle esistenti
```sql
-- File: supabase/migrations/026_add_organization_id_to_all_tables.sql

-- Helper function per aggiungere organization_id in modo consistente
CREATE OR REPLACE FUNCTION add_organization_column(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    ALTER TABLE %I 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id),
    ADD COLUMN IF NOT EXISTS migrated_at TIMESTAMP;
    
    CREATE INDEX IF NOT EXISTS idx_%I_org_id ON %I(organization_id);
  ', table_name, table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Applica a tutte le tabelle principali
SELECT add_organization_column('stagioni_sportive');
SELECT add_organization_column('users'); -- per link user-org
SELECT add_organization_column('tesserati');
SELECT add_organization_column('squadre');
SELECT add_organization_column('tesserati_squadre_stagioni');
SELECT add_organization_column('tesserati_dati_stagionali');
SELECT add_organization_column('presenze');
SELECT add_organization_column('partite');
SELECT add_organization_column('convocazioni');
SELECT add_organization_column('magazzino');
SELECT add_organization_column('movimenti_magazzino');
SELECT add_organization_column('assegnazioni_materiale');
SELECT add_organization_column('tornei');
SELECT add_organization_column('iscrizioni_torneo');
SELECT add_organization_column('eventi');
SELECT add_organization_column('prenotazioni_eventi');
SELECT add_organization_column('eventi_economici');
SELECT add_organization_column('movimenti_economici');
SELECT add_organization_column('campi');
SELECT add_organization_column('calendario_campi');
SELECT add_organization_column('avversari');
SELECT add_organization_column('categorie_avversari');
SELECT add_organization_column('parametri_sistema');

-- Cleanup
DROP FUNCTION add_organization_column(text);
```

### 1.3 Migra dati esistenti a organization default
```sql
-- File: supabase/migrations/027_migrate_existing_data_to_default_org.sql

-- Crea organization di default per dati esistenti
INSERT INTO organizations (
  id,
  name,
  slug,
  subscription_plan,
  max_tesserati,
  max_squadre,
  created_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- UUID fisso per riferimento
  'Virpol Campogalliano',
  'virpol-campogalliano',
  'enterprise', -- dai tutti i permessi alla org originale
  9999,
  999,
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Migra tutti i dati esistenti alla default organization
UPDATE stagioni_sportive 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    migrated_at = NOW()
WHERE organization_id IS NULL;

UPDATE tesserati 
SET organization_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    migrated_at = NOW()
WHERE organization_id IS NULL;

-- Ripeti per tutte le tabelle...
-- (Usa una funzione per automatizzare)

CREATE OR REPLACE FUNCTION migrate_table_to_default_org(table_name text)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    UPDATE %I 
    SET organization_id = ''a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'',
        migrated_at = NOW()
    WHERE organization_id IS NULL;
  ', table_name);
END;
$$ LANGUAGE plpgsql;

-- Applica a tutte le tabelle
SELECT migrate_table_to_default_org('squadre');
SELECT migrate_table_to_default_org('tesserati_squadre_stagioni');
-- ... continua per tutte le tabelle

-- Dopo la migrazione, rendi organization_id NOT NULL
ALTER TABLE stagioni_sportive ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE tesserati ALTER COLUMN organization_id SET NOT NULL;
-- ... per tutte le tabelle
```

## 🔒 FASE 2: Row Level Security (RLS)

### 2.1 Setup RLS Helper Functions
```sql
-- File: supabase/migrations/028_rls_helper_functions.sql

-- Funzione per ottenere l'organization corrente dal JWT
CREATE OR REPLACE FUNCTION auth.current_organization_id()
RETURNS UUID AS $$
BEGIN
  RETURN COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    auth.jwt()->>'organization_id'
  )::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per verificare membership
CREATE OR REPLACE FUNCTION auth.is_organization_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funzione per ottenere il ruolo nell'organization
CREATE OR REPLACE FUNCTION auth.organization_role(org_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2.2 Applica RLS Policies
```sql
-- File: supabase/migrations/029_apply_rls_policies.sql

-- Template per RLS policy
CREATE OR REPLACE FUNCTION create_organization_rls_policies(table_name text)
RETURNS void AS $$
BEGIN
  -- Drop existing policies
  EXECUTE format('DROP POLICY IF EXISTS %I_org_isolation ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_select ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_insert ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_update ON %I', table_name, table_name);
  EXECUTE format('DROP POLICY IF EXISTS %I_org_delete ON %I', table_name, table_name);
  
  -- Enable RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Create new policies
  -- SELECT: solo membri dell'org possono vedere
  EXECUTE format('
    CREATE POLICY %I_org_select ON %I
    FOR SELECT USING (
      auth.is_organization_member(organization_id)
    )
  ', table_name, table_name);
  
  -- INSERT: solo admin/owner possono inserire
  EXECUTE format('
    CREATE POLICY %I_org_insert ON %I
    FOR INSERT WITH CHECK (
      auth.is_organization_member(organization_id) AND
      auth.organization_role(organization_id) IN (''admin'', ''owner'')
    )
  ', table_name, table_name);
  
  -- UPDATE: basato su ruolo
  EXECUTE format('
    CREATE POLICY %I_org_update ON %I
    FOR UPDATE USING (
      auth.is_organization_member(organization_id) AND
      auth.organization_role(organization_id) IN (''admin'', ''owner'')
    )
  ', table_name, table_name);
  
  -- DELETE: solo owner
  EXECUTE format('
    CREATE POLICY %I_org_delete ON %I
    FOR DELETE USING (
      auth.is_organization_member(organization_id) AND
      auth.organization_role(organization_id) = ''owner''
    )
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Applica a tutte le tabelle
SELECT create_organization_rls_policies('tesserati');
SELECT create_organization_rls_policies('squadre');
SELECT create_organization_rls_policies('presenze');
-- ... continua per tutte le tabelle
```

## 🎨 FASE 3: Frontend Updates

### 3.1 Organization Context Provider
```typescript
// File: lib/contexts/OrganizationContext.tsx

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  primary_color: string
  subscription_plan: string
  features: Record<string, boolean>
  max_tesserati: number
  max_squadre: number
}

interface OrganizationContextType {
  organization: Organization | null
  loading: boolean
  error: string | null
  switchOrganization: (orgId: string) => Promise<void>
  checkFeature: (feature: string) => boolean
  checkLimit: (resource: string, current: number) => boolean
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadCurrentOrganization()
  }, [])

  const loadCurrentOrganization = async () => {
    try {
      // Get org from URL or user's default
      const orgSlug = window.location.pathname.split('/')[2]
      
      if (orgSlug) {
        const { data, error } = await supabase
          .from('organizations')
          .select('*')
          .eq('slug', orgSlug)
          .single()
          
        if (error) throw error
        setOrganization(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento organizzazione')
    } finally {
      setLoading(false)
    }
  }

  const switchOrganization = async (orgId: string) => {
    const { data } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', orgId)
      .single()
      
    if (data) {
      router.push(`/org/${data.slug}/dashboard`)
    }
  }

  const checkFeature = (feature: string): boolean => {
    return organization?.features?.[feature] ?? false
  }

  const checkLimit = (resource: string, current: number): boolean => {
    if (!organization) return false
    
    switch (resource) {
      case 'tesserati':
        return current < organization.max_tesserati
      case 'squadre':
        return current < organization.max_squadre
      default:
        return true
    }
  }

  return (
    <OrganizationContext.Provider value={{
      organization,
      loading,
      error,
      switchOrganization,
      checkFeature,
      checkLimit
    }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export const useOrganization = () => {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization deve essere usato dentro OrganizationProvider')
  }
  return context
}
```

### 3.2 Update Supabase Client
```typescript
// File: lib/supabase/client.ts

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export function createOrganizationClient(organizationId?: string) {
  const client = createClientComponentClient<Database>()
  
  // Se abbiamo un organizationId, lo includiamo in tutte le query
  if (organizationId) {
    // Intercetta tutte le query per aggiungere organization filter
    const originalFrom = client.from.bind(client)
    
    client.from = function(table: string) {
      const query = originalFrom(table)
      
      // Auto-aggiungi organization_id filter per sicurezza extra
      const originalSelect = query.select.bind(query)
      query.select = function(...args: any[]) {
        const selectQuery = originalSelect(...args)
        
        // Tabelle che richiedono org filter
        const orgTables = [
          'tesserati', 'squadre', 'presenze', 'partite', 
          'magazzino', 'tornei', 'eventi'
        ]
        
        if (orgTables.includes(table)) {
          return selectQuery.eq('organization_id', organizationId)
        }
        
        return selectQuery
      }
      
      return query
    }
  }
  
  return client
}

// Hook helper
export function useSupabaseOrg() {
  const { organization } = useOrganization()
  return createOrganizationClient(organization?.id)
}
```

### 3.3 Update Routing Structure
```typescript
// File: app/(auth)/org/[orgSlug]/layout.tsx

import { notFound } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { OrganizationProvider } from '@/lib/contexts/OrganizationContext'
import { ModernHeader } from '@/components/layout/ModernHeader'

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  const supabase = createServerComponentClient({ cookies })
  
  // Verifica che l'utente abbia accesso all'org
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    notFound()
  }
  
  // Carica organization
  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.orgSlug)
    .single()
    
  if (error || !organization) {
    notFound()
  }
  
  // Verifica membership
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .single()
    
  if (!membership) {
    notFound()
  }
  
  return (
    <OrganizationProvider initialOrganization={organization}>
      <div className="min-h-screen bg-gray-50">
        <ModernHeader />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </OrganizationProvider>
  )
}
```

### 3.4 Update Components per Multi-org
```typescript
// File: components/OrganizationSwitcher.tsx

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<any[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string>('')
  const router = useRouter()
  const supabase = createClientComponentClient()

  useEffect(() => {
    loadUserOrganizations()
  }, [])

  const loadUserOrganizations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { data } = await supabase
        .from('organization_members')
        .select(`
          organization:organizations(
            id,
            name,
            slug,
            logo_url
          )
        `)
        .eq('user_id', user.id)
        
      if (data) {
        setOrganizations(data.map(d => d.organization))
        
        // Set current from URL
        const currentSlug = window.location.pathname.split('/')[2]
        const current = data.find(d => d.organization.slug === currentSlug)
        if (current) {
          setCurrentOrgId(current.organization.id)
        }
      }
    }
  }

  const handleSwitch = (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      // Mantieni la stessa pagina ma cambia org
      const currentPath = window.location.pathname
      const pathParts = currentPath.split('/')
      pathParts[2] = org.slug // Sostituisci org slug
      router.push(pathParts.join('/'))
    }
  }

  if (organizations.length <= 1) {
    return null // Non mostrare switcher se c'è solo una org
  }

  return (
    <Select value={currentOrgId} onValueChange={handleSwitch}>
      <SelectTrigger className="w-[200px]">
        <Building2 className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Seleziona società" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.id}>
            <div className="flex items-center">
              {org.logo_url && (
                <img 
                  src={org.logo_url} 
                  alt={org.name} 
                  className="w-4 h-4 mr-2 rounded"
                />
              )}
              {org.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

## 🎯 FASE 4: Update Query e API

### 4.1 Update tutti i file con query Supabase
```typescript
// Esempio: app/(auth)/org/[orgSlug]/tesserati/page.tsx

// PRIMA:
const { data } = await supabase
  .from('tesserati')
  .select('*')
  
// DOPO:
const { data } = await supabase
  .from('tesserati')
  .select('*')
  .eq('organization_id', organization.id) // Aggiungi sempre questo filtro!
```

### 4.2 Helper per Query comuni
```typescript
// File: lib/queries/organization-queries.ts

import { SupabaseClient } from '@supabase/supabase-js'

export class OrganizationQueries {
  constructor(
    private supabase: SupabaseClient,
    private organizationId: string
  ) {}

  async getTesserati() {
    return this.supabase
      .from('tesserati')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('stato', true)
      .order('cognome')
  }

  async getSquadre(stagioneId: string) {
    return this.supabase
      .from('squadre')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('stagione_id', stagioneId)
      .order('nome')
  }

  // ... altri metodi per ogni tabella
}

// Hook per usarlo nei componenti
export function useOrgQueries() {
  const { organization } = useOrganization()
  const supabase = createClientComponentClient()
  
  if (!organization) {
    throw new Error('Organization non caricata')
  }
  
  return new OrganizationQueries(supabase, organization.id)
}
```

## 🚀 FASE 5: Testing e Rollout

### 5.1 Testing Script
```typescript
// File: scripts/test-multi-tenant.ts

async function testMultiTenantIsolation() {
  // 1. Crea 2 test organizations
  const org1 = await createTestOrganization('test-org-1')
  const org2 = await createTestOrganization('test-org-2')
  
  // 2. Crea utenti per ogni org
  const user1 = await createTestUser(org1.id)
  const user2 = await createTestUser(org2.id)
  
  // 3. Crea dati in org1
  const tesserato1 = await createTestTesserato(org1.id, user1)
  
  // 4. Verifica che user2 NON possa vedere dati di org1
  const canSee = await tryToAccessTesserato(tesserato1.id, user2)
  
  if (canSee) {
    throw new Error('SECURITY BREACH: Cross-org data access!')
  }
  
  console.log('✅ Multi-tenant isolation working correctly')
}
```

### 5.2 Migration Checklist
```markdown
## Pre-Migration
- [ ] Backup completo database
- [ ] Test migrations in ambiente staging
- [ ] Preparare rollback plan

## Migration Steps
- [ ] Eseguire migrations 025-029 in ordine
- [ ] Verificare che tutti i dati siano migrati
- [ ] Testare accesso con utenti esistenti
- [ ] Verificare che RLS funzioni correttamente

## Post-Migration
- [ ] Update di TUTTI i componenti per usare organization_id
- [ ] Test completo di tutte le funzionalità
- [ ] Monitoring per errori nei primi giorni
- [ ] Documentazione per utenti su come switchare org
```

## 📝 Note Importanti per Claude Code

1. **SEMPRE** includere `organization_id` in ogni query
2. **MAI** fare query senza filtro organization
3. **VERIFICARE** che RLS sia attivo su ogni tabella
4. **TESTARE** isolamento dati tra organizations
5. **AGGIORNARE** tutti i form per includere organization_id negli insert

## 🆘 Troubleshooting Comuni

### "RLS violation" errors
- Verifica che l'utente sia membro dell'organization
- Controlla che organization_id sia presente nella query
- Debug con `EXPLAIN` per vedere quale policy blocca

### Performance degradation
- Aggiungi indici su organization_id per ogni tabella
- Considera partitioning per tabelle molto grandi
- Usa connection pooling per multi-org

### Login/Auth issues
- Verifica JWT claims per organization_id
- Controlla organization_members table
- Debug con Supabase logs

## 🎉 Success Criteria

La migrazione è completa quando:
1. ✅ Tutti i dati hanno organization_id
2. ✅ RLS previene accesso cross-org
3. ✅ UI permette switch tra organizations
4. ✅ Performance rimane accettabile
5. ✅ Nessun errore in produzione per 48h

Buona migrazione! 🚀