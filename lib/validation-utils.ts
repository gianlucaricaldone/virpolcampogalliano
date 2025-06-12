/**
 * Utilities per la validazione dei dati
 */

/**
 * Valida un codice fiscale italiano
 */
export function isValidCodiceFiscale(cf: string): boolean {
  if (!cf || cf.length !== 16) return false
  
  const cfRegex = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/
  return cfRegex.test(cf.toUpperCase())
}

/**
 * Valida un numero di telefono italiano
 */
export function isValidTelefono(phone: string): boolean {
  if (!phone) return false
  
  // Rimuovi spazi, trattini e parentesi
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
  
  // Verifica che sia un numero italiano valido
  const phoneRegex = /^(\+39|0039|39)?[0-9]{6,10}$/
  return phoneRegex.test(cleanPhone)
}

/**
 * Valida un indirizzo email
 */
export function isValidEmail(email: string): boolean {
  if (!email) return false
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Valida una data di nascita (deve essere nel passato e realistica)
 */
export function isValidBirthDate(birthDate: string): boolean {
  if (!birthDate) return false
  
  const birth = new Date(birthDate)
  const today = new Date()
  const hundredYearsAgo = new Date()
  hundredYearsAgo.setFullYear(today.getFullYear() - 100)
  
  // La data deve essere nel passato ma non più di 100 anni fa
  return birth < today && birth > hundredYearsAgo
}

/**
 * Valida un codice cartellino (formato personalizzabile)
 */
export function isValidCodiceCartellino(codice: string): boolean {
  if (!codice) return false
  
  // Formato: lettere e numeri, lunghezza tra 4 e 10 caratteri
  const codicereex = /^[A-Z0-9]{4,10}$/
  return codicereex.test(codice.toUpperCase())
}

/**
 * Valida un CAP italiano
 */
export function isValidCAP(cap: string): boolean {
  if (!cap) return false
  
  const capRegex = /^[0-9]{5}$/
  return capRegex.test(cap)
}

/**
 * Valida che una stringa non sia vuota o solo spazi
 */
export function isNotEmpty(value: string): boolean {
  return !!(value && value.trim().length > 0)
}

/**
 * Valida che una stringa abbia una lunghezza minima
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return !!(value && value.trim().length >= minLength)
}

/**
 * Valida che una stringa abbia una lunghezza massima
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return !value || value.trim().length <= maxLength
}

/**
 * Valida che un numero sia in un range specifico
 */
export function isNumberInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max
}

/**
 * Valida che una data sia nel futuro
 */
export function isFutureDate(dateString: string): boolean {
  if (!dateString) return false
  return new Date(dateString) > new Date()
}

/**
 * Valida che una data sia nel passato
 */
export function isPastDate(dateString: string): boolean {
  if (!dateString) return false
  return new Date(dateString) < new Date()
}

/**
 * Pulisce e formatta un codice fiscale
 */
export function formatCodiceFiscale(cf: string): string {
  return cf.replace(/[^A-Z0-9]/gi, '').toUpperCase()
}

/**
 * Pulisce e formatta un numero di telefono
 */
export function formatTelefono(phone: string): string {
  // Rimuovi caratteri non numerici eccetto il +
  let clean = phone.replace(/[^\d+]/g, '')
  
  // Se inizia con +39, mantienilo
  if (clean.startsWith('+39')) {
    return clean
  }
  
  // Se inizia con 39, aggiungi il +
  if (clean.startsWith('39') && clean.length > 10) {
    return '+' + clean
  }
  
  // Se è un numero italiano senza prefisso, mantienilo così
  return clean
}

/**
 * Pulisce e formatta un CAP
 */
export function formatCAP(cap: string): string {
  return cap.replace(/\D/g, '').slice(0, 5)
}

/**
 * Oggetto con tutte le validazioni per i form
 */
export const FormValidators = {
  required: (value: any) => !!value || 'Campo obbligatorio',
  email: (value: string) => !value || isValidEmail(value) || 'Email non valida',
  telefono: (value: string) => !value || isValidTelefono(value) || 'Telefono non valido',
  codiceFiscale: (value: string) => !value || isValidCodiceFiscale(value) || 'Codice fiscale non valido',
  cap: (value: string) => !value || isValidCAP(value) || 'CAP non valido',
  minLength: (min: number) => (value: string) => 
    !value || value.length >= min || `Minimo ${min} caratteri`,
  maxLength: (max: number) => (value: string) => 
    !value || value.length <= max || `Massimo ${max} caratteri`,
  birthDate: (value: string) => !value || isValidBirthDate(value) || 'Data di nascita non valida',
  futureDate: (value: string) => !value || isFutureDate(value) || 'La data deve essere nel futuro',
  pastDate: (value: string) => !value || isPastDate(value) || 'La data deve essere nel passato',
}