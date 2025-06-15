import { notFound } from 'next/navigation'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'
import { OrganizationProvider } from '@/contexts/OrganizationContext'
import ModernHeader from '@/components/layout/ModernHeader'

interface OrganizationLayoutProps {
  children: React.ReactNode
  params: { orgSlug: string }
}

export default async function OrganizationLayout({
  children,
  params,
}: OrganizationLayoutProps) {
  const supabase = createServerComponentClient<Database>({ cookies })
  
  // Verifica che l'utente sia autenticato
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    notFound()
  }
  
  // Carica l'organization
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.orgSlug)
    .eq('is_active', true)
    .single()
    
  if (orgError || !organization) {
    console.error('Organization not found:', orgError)
    notFound()
  }
  
  // Verifica che l'utente sia membro dell'organization
  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organization.id)
    .eq('user_id', user.id)
    .single()
    
  if (membershipError || !membership) {
    console.error('User is not a member of this organization:', membershipError)
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