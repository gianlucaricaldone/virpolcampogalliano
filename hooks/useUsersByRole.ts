import { useState, useEffect, useMemo } from 'react'
import { getSupabaseClient, getCachedQuery, setCachedQuery } from '@/lib/supabase/singleton'
import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']

interface UseUsersByRoleOptions {
  orderBy?: 'nome' | 'cognome' | 'email'
  ascending?: boolean
  includeInactive?: boolean
}

export function useUsersByRole(
  roles: string[], 
  options: UseUsersByRoleOptions = {}
) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    orderBy = 'cognome', 
    ascending = true, 
    includeInactive = false 
  } = options

  const cacheKey = useMemo(() => {
    const rolesKey = roles.sort().join('_')
    const optionsKey = `${orderBy}_${ascending}_${includeInactive}`
    return `users_by_role_${rolesKey}_${optionsKey}`
  }, [roles, orderBy, ascending, includeInactive])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Check cache first
        const cached = getCachedQuery<User[]>(cacheKey)
        if (cached) {
          setUsers(cached)
          setLoading(false)
          return
        }

        setLoading(true)
        const supabase = getSupabaseClient()
        if (!supabase) {
          throw new Error('Supabase client not available')
        }
        
        // Build role condition for both single role and multiple roles
        const roleConditions = roles.map(role => 
          `role.eq.${role},roles.cs.{${role}}`
        ).join(',')

        const query = supabase
          .from('users')
          .select('*')
          .or(roleConditions)
          .order(orderBy, { ascending })

        // Note: Users table doesn't have a 'stato' field
        // If we need to filter inactive users, we should use a different approach

        const { data, error: queryError } = await query

        if (queryError) {
          throw queryError
        }

        const userData = data || []
        
        // Cache for 5 minutes
        setCachedQuery(cacheKey, userData, 5 * 60 * 1000)
        
        setUsers(userData)
        setError(null)
      } catch (err) {
        console.error('Error fetching users by role:', err)
        setError(err instanceof Error ? err.message : 'Error fetching users')
        setUsers([])
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [cacheKey, roles, orderBy, ascending, includeInactive])

  return { users, loading, error }
}

// Hook specializzato per utenti con ruoli di staff
export function useStaffUsers(options?: UseUsersByRoleOptions) {
  return useUsersByRole(['admin', 'dirigente', 'allenatore', 'vice_allenatore'], options)
}

// Hook specializzato per allenatori
export function useAllenatori(options?: UseUsersByRoleOptions) {
  return useUsersByRole(['allenatore', 'vice_allenatore'], options)
}

// Hook specializzato per dirigenti
export function useDirigenti(options?: UseUsersByRoleOptions) {
  return useUsersByRole(['admin', 'dirigente'], options)
}