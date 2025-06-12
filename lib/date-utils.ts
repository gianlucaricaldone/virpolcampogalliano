/**
 * Utilities per la gestione delle date
 */

/**
 * Verifica se un certificato sta per scadere
 */
export function isCertificateExpiring(scadenza: string | null, days = 30): boolean {
  if (!scadenza) return false
  
  const today = new Date()
  const expiry = new Date(scadenza)
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
  
  return daysUntilExpiry <= days && daysUntilExpiry > 0
}

/**
 * Verifica se un certificato è scaduto
 */
export function isCertificateExpired(scadenza: string | null): boolean {
  if (!scadenza) return false
  return new Date(scadenza) < new Date()
}

/**
 * Calcola i giorni rimanenti fino alla scadenza
 */
export function getDaysUntilExpiry(scadenza: string | null): number | null {
  if (!scadenza) return null
  
  const today = new Date()
  const expiry = new Date(scadenza)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 3600 * 24))
}

/**
 * Formatta una data in formato italiano
 */
export function formatDateIT(dateString: string | null): string {
  if (!dateString) return 'N/A'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

/**
 * Formatta una data con ora in formato italiano
 */
export function formatDateTimeIT(dateString: string | null): string {
  if (!dateString) return 'N/A'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Formatta il tempo trascorso (es. "2 ore fa")
 */
export function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const past = new Date(timestamp)
  const diffInMs = now.getTime() - past.getTime()
  
  const diffInMins = Math.floor(diffInMs / (1000 * 60))
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60))
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
  const diffInWeeks = Math.floor(diffInDays / 7)
  const diffInMonths = Math.floor(diffInDays / 30)

  if (diffInMins < 1) return 'Adesso'
  if (diffInMins < 60) return `${diffInMins} minuti fa`
  if (diffInHours < 24) return `${diffInHours} ore fa`
  if (diffInDays < 7) return `${diffInDays} giorni fa`
  if (diffInWeeks < 4) return `${diffInWeeks} settimane fa`
  if (diffInMonths < 12) return `${diffInMonths} mesi fa`
  
  const diffInYears = Math.floor(diffInDays / 365)
  return `${diffInYears} anni fa`
}

/**
 * Verifica se una data è nel futuro
 */
export function isFutureDate(dateString: string): boolean {
  return new Date(dateString) > new Date()
}

/**
 * Verifica se una data è nel passato
 */
export function isPastDate(dateString: string): boolean {
  return new Date(dateString) < new Date()
}

/**
 * Verifica se una data è oggi
 */
export function isToday(dateString: string): boolean {
  const date = new Date(dateString)
  const today = new Date()
  
  return date.getDate() === today.getDate() &&
         date.getMonth() === today.getMonth() &&
         date.getFullYear() === today.getFullYear()
}

/**
 * Calcola l'età da una data di nascita
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  
  return age
}

/**
 * Genera le opzioni per un select degli anni (da anno corrente a N anni fa)
 */
export function getYearOptions(yearsBack = 10): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear()
  const years = []
  
  for (let i = 0; i <= yearsBack; i++) {
    const year = currentYear - i
    years.push({
      value: year.toString(),
      label: year.toString()
    })
  }
  
  return years
}

/**
 * Converte una data in formato ISO per input datetime-local
 */
export function toDateTimeLocalString(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 16)
}

/**
 * Verifica se due date sono lo stesso giorno
 */
export function isSameDay(date1: string | Date, date2: string | Date): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2
  
  return d1.getDate() === d2.getDate() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getFullYear() === d2.getFullYear()
}