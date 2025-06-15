'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

type Organization = Database['public']['Tables']['organizations']['Row']
type OrganizationMember = Database['public']['Tables']['organization_members']['Row']

interface OrganizationContextType {
  organization: Organization | null
  memberRole: string | null
  loading: boolean
  error: string | null
  switchOrganization: (orgSlug: string) => Promise<void>
  checkFeature: (feature: string) => boolean
  checkLimit: (resource: string, current: number) => boolean
  isAdmin: boolean
  isOwner: boolean
  canManage: boolean
  refetch: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

interface OrganizationProviderProps {
  children: ReactNode
  initialOrganization?: Organization | null
}

export function OrganizationProvider({ children, initialOrganization }: OrganizationProviderProps) {
  const [organization, setOrganization] = useState<Organization | null>(initialOrganization || null)
  const [memberRole, setMemberRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(!initialOrganization)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  const loadCurrentOrganization = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get organization slug from URL
      const pathParts = window.location.pathname.split('/')
      const orgIndex = pathParts.indexOf('org')
      
      if (orgIndex === -1 || !pathParts[orgIndex + 1]) {
        // No org in URL, redirect to org selection or default
        const { data: userOrgs } = await supabase
          .from('organization_members')
          .select(`
            organization:organizations(
              id,
              name,
              slug
            )
          `)
          .limit(1)
        
        if (userOrgs && userOrgs.length > 0) {
          const firstOrg = (userOrgs[0] as any).organization
          router.push(`/org/${firstOrg.slug}/dashboard`)
        } else {
          setError('Nessuna organizzazione trovata')
        }
        return
      }
      
      const orgSlug = pathParts[orgIndex + 1]
      
      // Load organization data
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', orgSlug)
        .eq('is_active', true)
        .single()
        
      if (orgError) {
        throw new Error(`Organizzazione non trovata: ${orgError.message}`)
      }
      
      // Check user membership and get role
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', orgData.id)
        .single()
        
      if (memberError) {
        throw new Error('Non hai accesso a questa organizzazione')
      }
      
      setOrganization(orgData)
      setMemberRole(memberData.role)
      
    } catch (err) {
      console.error('Error loading organization:', err)
      setError(err instanceof Error ? err.message : 'Errore caricamento organizzazione')
      setOrganization(null)
      setMemberRole(null)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  const switchOrganization = useCallback(async (orgSlug: string) => {
    try {
      const { data } = await supabase
        .from('organizations')
        .select('slug')
        .eq('slug', orgSlug)
        .eq('is_active', true)
        .single()
        
      if (data) {
        // Mantieni la stessa pagina ma cambia organization
        const currentPath = window.location.pathname
        const pathParts = currentPath.split('/')
        const orgIndex = pathParts.indexOf('org')
        
        if (orgIndex !== -1 && pathParts[orgIndex + 1]) {
          pathParts[orgIndex + 1] = orgSlug
          router.push(pathParts.join('/'))
        } else {
          router.push(`/org/${orgSlug}/dashboard`)
        }
      }
    } catch (err) {
      console.error('Error switching organization:', err)
      setError('Errore nel cambio organizzazione')
    }
  }, [supabase, router])

  const checkFeature = useCallback((feature: string): boolean => {
    if (!organization?.features) return false
    return organization.features[feature] === true
  }, [organization])

  const checkLimit = useCallback((resource: string, current: number): boolean => {
    if (!organization) return false
    
    switch (resource) {
      case 'tesserati':
        return current < organization.max_tesserati
      case 'squadre':
        return current < organization.max_squadre
      default:
        return true
    }
  }, [organization])

  const refetch = useCallback(async () => {
    await loadCurrentOrganization()
  }, [loadCurrentOrganization])

  // Computed values
  const isAdmin = memberRole === 'admin' || memberRole === 'owner'
  const isOwner = memberRole === 'owner'
  const canManage = isAdmin

  useEffect(() => {
    if (!initialOrganization) {
      loadCurrentOrganization()
    }
  }, [loadCurrentOrganization, initialOrganization])

  // Listen for route changes to update organization
  useEffect(() => {
    const handleRouteChange = () => {
      const pathParts = window.location.pathname.split('/')
      const orgIndex = pathParts.indexOf('org')
      
      if (orgIndex !== -1 && pathParts[orgIndex + 1]) {
        const currentSlug = pathParts[orgIndex + 1]
        if (organization?.slug !== currentSlug) {
          loadCurrentOrganization()
        }
      }
    }
    
    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleRouteChange)
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [organization?.slug, loadCurrentOrganization])

  const value: OrganizationContextType = {
    organization,
    memberRole,
    loading,
    error,
    switchOrganization,
    checkFeature,
    checkLimit,
    isAdmin,
    isOwner,
    canManage,
    refetch,
  }

  return (
    <OrganizationContext.Provider value={value}>
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