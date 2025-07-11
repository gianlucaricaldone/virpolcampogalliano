/**
 * Global constants for the Virpol Campogalliano application
 */

// Default Organization ID for Virpol Campogalliano
export const DEFAULT_ORGANIZATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

// Cache durations
export const CACHE_DURATIONS = {
  USER_PROFILE: 30 * 60 * 1000, // 30 minutes
  SQUADRE: 5 * 60 * 1000,       // 5 minutes
  DASHBOARD_STATS: 2 * 60 * 1000, // 2 minutes
  TESSERATI: 3 * 60 * 1000,     // 3 minutes
} as const

// User roles
export const USER_ROLES = {
  ADMIN: 'admin',
  DIRIGENTE: 'dirigente', 
  ALLENATORE: 'allenatore',
  VICE_ALLENATORE: 'vice_allenatore',
  TESSERATO: 'tesserato',
  GENITORE: 'genitore',
} as const

// Attendance types
export const ATTENDANCE_TYPES = {
  ALLENAMENTO: 'allenamento',
  PARTITA: 'partita',
  TORNEO: 'torneo',
  EVENTO: 'evento',
} as const

// Statistics periods
export const STATISTICS_PERIODS = {
  SETTIMANALE: 'settimanale',
  MENSILE: 'mensile',
} as const