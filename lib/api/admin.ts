/**
 * API layer centralizzato per Admin
 * Ottimizzazioni: query unificate, caching, error handling consistente
 */

import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']

interface UserStats {
  admin: number
  dirigente: number
  allenatore: number
  vice_allenatore: number
  tesserato: number
  genitore: number
  withEmail: number
  withoutEmail: number
  total: number
}

export const adminApi = {
  /**
   * Ottimizzazione: singola query per ottenere tutti gli utenti con statistiche aggregate
   */
  async getUsers(): Promise<{ users: User[], stats: UserStats }> {
    const supabase = createClient()
    
    try {
      // Single query per tutti gli utenti
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const usersData = users || []
      
      // Calcola statistiche localmente invece di fare query separate
      const stats: UserStats = {
        admin: 0,
        dirigente: 0,
        allenatore: 0,
        vice_allenatore: 0,
        tesserato: 0,
        genitore: 0,
        withEmail: 0,
        withoutEmail: 0,
        total: usersData.length
      }

      usersData.forEach(user => {
        // Count roles (supporting both roles array and single role field)
        const userRoles = user.roles || (user.role ? [user.role] : [])
        
        userRoles.forEach((role: string) => {
          switch (role) {
            case 'admin':
              stats.admin++
              break
            case 'dirigente':
              stats.dirigente++
              break
            case 'allenatore':
              stats.allenatore++
              break
            case 'vice_allenatore':
              stats.vice_allenatore++
              break
            case 'tesserato':
              stats.tesserato++
              break
            case 'genitore':
              stats.genitore++
              break
          }
        })

        // Count email stats
        if (user.email) {
          stats.withEmail++
        } else {
          stats.withoutEmail++
        }
      })

      return { users: usersData, stats }
    } catch (error) {
      console.error('Error fetching users and stats:', error)
      throw error
    }
  },

  /**
   * Invia email di invito a un utente
   */
  async sendInviteEmail(user: User): Promise<void> {
    if (!user.email) {
      throw new Error('Questo utente non ha un indirizzo email configurato')
    }

    const supabase = createClient()

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          shouldCreateUser: true,
          data: {
            nome: user.nome,
            cognome: user.cognome,
            role: user.role,
            profile_link_id: user.id
          }
        }
      })

      if (error) throw error
    } catch (error) {
      console.error('Error sending invite email:', error)
      throw error
    }
  },

  /**
   * Elimina un utente (se implementato)
   */
  async deleteUser(userId: string): Promise<void> {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting user:', error)
      throw error
    }
  },

  /**
   * Filtra utenti per ruolo, ricerca e tab
   */
  filterUsers(
    users: User[], 
    searchTerm: string, 
    selectedRole: string | null, 
    activeTab: 'all' | 'allenatori'
  ): User[] {
    return users.filter(user => {
      // Search filter
      const matchesSearch = !searchTerm || (
        user.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.cognome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      
      // Tab filter
      const matchesTab = activeTab === 'all' || 
        (activeTab === 'allenatori' && (
          user.roles?.includes('allenatore') || user.role === 'allenatore' ||
          user.roles?.includes('vice_allenatore') || user.role === 'vice_allenatore'
        ))
      
      // Role filter
      const matchesRole = !selectedRole || 
        user.roles?.includes(selectedRole as any) || 
        user.role === selectedRole
      
      return matchesSearch && matchesTab && matchesRole
    })
  }
}