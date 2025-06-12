import { Database } from '@/types/database'

type User = Database['public']['Tables']['users']['Row']
type UserProfile = Database['public']['Tables']['users']['Row']

/**
 * Verifica se un utente ha un ruolo specifico
 */
export function hasRole(userOrProfile: User | UserProfile | null, role: string): boolean {
  if (!userOrProfile) return false
  
  // Se esiste il campo roles (array), usalo
  if (userOrProfile.roles && userOrProfile.roles.length > 0) {
    return userOrProfile.roles.includes(role as any)
  }
  
  // Altrimenti fallback al campo role singolo
  return userOrProfile.role === role
}

/**
 * Verifica se un utente ha almeno uno dei ruoli specificati
 */
export function hasAnyRole(userOrProfile: User | UserProfile | null, roles: string[]): boolean {
  if (!userOrProfile) return false
  
  return roles.some(role => hasRole(userOrProfile, role))
}

/**
 * Verifica se un utente ha tutti i ruoli specificati
 */
export function hasAllRoles(userOrProfile: User | UserProfile | null, roles: string[]): boolean {
  if (!userOrProfile) return false
  
  return roles.every(role => hasRole(userOrProfile, role))
}

/**
 * Ottiene tutti i ruoli di un utente (sia dal campo role che dall'array roles)
 */
export function getUserRoles(userOrProfile: User | UserProfile | null): string[] {
  if (!userOrProfile) return []
  
  const roles: string[] = []
  
  // Aggiungi ruolo principale se esiste
  if (userOrProfile.role) {
    roles.push(userOrProfile.role)
  }
  
  // Aggiungi ruoli aggiuntivi se esistono e non sono già inclusi
  if (userOrProfile.roles && userOrProfile.roles.length > 0) {
    userOrProfile.roles.forEach(role => {
      if (!roles.includes(role)) {
        roles.push(role)
      }
    })
  }
  
  return roles
}

/**
 * Verifica se un utente è attivo
 */
export function isUserActive(userOrProfile: User | UserProfile | null): boolean {
  return userOrProfile?.stato === true
}

/**
 * Verifica se un utente può gestire una squadra (admin, dirigente, allenatore)
 */
export function canManageSquadra(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente', 'allenatore'])
}

/**
 * Verifica se un utente può gestire tesserati (admin, dirigente)
 */
export function canManageTesserati(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente'])
}

/**
 * Verifica se un utente può vedere presenze (tutti i ruoli autenticati)
 */
export function canViewPresenze(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'])
}

/**
 * Verifica se un utente può gestire presenze (admin, dirigente, allenatore)
 */
export function canManagePresenze(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente', 'allenatore'])
}

/**
 * Verifica se un utente può accedere alle funzioni economiche (solo admin)
 */
export function canAccessEconomia(userOrProfile: User | UserProfile | null): boolean {
  return hasRole(userOrProfile, 'admin')
}

/**
 * Verifica se un utente può gestire eventi (admin, dirigente, allenatore)
 */
export function canManageEventi(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente', 'allenatore'])
}

/**
 * Verifica se un utente può vedere eventi (tutti i ruoli autenticati)
 */
export function canViewEventi(userOrProfile: User | UserProfile | null): boolean {
  return hasAnyRole(userOrProfile, ['admin', 'dirigente', 'allenatore', 'tesserato', 'genitore'])
}