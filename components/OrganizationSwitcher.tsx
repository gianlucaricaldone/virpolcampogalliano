'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'
import { useOrganization } from '@/contexts/OrganizationContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

type Organization = Database['public']['Tables']['organizations']['Row']

interface UserOrganization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  role: string
}

export function OrganizationSwitcher() {
  const [organizations, setOrganizations] = useState<UserOrganization[]>([])
  const [loading, setLoading] = useState(true)
  const { organization, switchOrganization } = useOrganization()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    loadUserOrganizations()
  }, [])

  const loadUserOrganizations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data, error } = await supabase
          .from('organization_members')
          .select(`
            role,
            organization:organizations!inner(
              id,
              name,
              slug,
              logo_url
            )
          `)
          .eq('user_id', user.id)
          .order('joined_at', { ascending: true })
        
        if (error) {
          console.error('Error loading organizations:', error)
          return
        }
        
        if (data) {
          const userOrgs = data.map(item => ({
            id: (item.organization as any).id,
            name: (item.organization as any).name,
            slug: (item.organization as any).slug,
            logo_url: (item.organization as any).logo_url,
            role: item.role
          }))
          
          setOrganizations(userOrgs)
        }
      }
    } catch (error) {
      console.error('Error loading user organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (orgSlug: string) => {
    try {
      await switchOrganization(orgSlug)
    } catch (error) {
      console.error('Error switching organization:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        <div className="w-32 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (organizations.length <= 1) {
    // Se c'è solo una organizzazione, mostra solo il nome
    return organization ? (
      <div className="flex items-center space-x-2">
        <Building2 className="w-5 h-5 text-gray-600" />
        <span className="font-medium text-gray-900">{organization.name}</span>
      </div>
    ) : null
  }

  return (
    <Select 
      value={organization?.slug || ''} 
      onValueChange={handleSwitch}
    >
      <SelectTrigger className="w-[200px]">
        <Building2 className="mr-2 h-4 w-4" />
        <SelectValue placeholder="Seleziona società" />
      </SelectTrigger>
      <SelectContent>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={org.slug}>
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