/**
 * Utility functions and type helpers for form data handling
 * Manages conversion between form data (strings) and database types (string | null)
 */

// Type Helpers
// ============

/**
 * Converts database types with nullable fields to form types with required string fields
 * Useful for converting data fetched from database to form initial values
 */
export type DatabaseToForm<T> = {
  [K in keyof T]: T[K] extends string | null | undefined
    ? string
    : T[K] extends number | null | undefined
    ? string
    : T[K] extends boolean | null | undefined
    ? string
    : T[K] extends Date | null | undefined
    ? string
    : T[K]
}

/**
 * Converts form types with string fields to database types with nullable fields
 * Useful for converting form data before database operations
 */
export type FormToDatabase<T> = {
  [K in keyof T]: T[K] extends string
    ? string | null
    : T[K]
}

// Conversion Functions
// ===================

/**
 * Converts empty strings to null for database storage
 * @param value - The string value to convert
 * @returns null if empty string, otherwise the original value
 */
export function emptyStringToNull(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

/**
 * Converts null or undefined to empty string for form display
 * @param value - The nullable value to convert
 * @returns empty string if null/undefined, otherwise the original value
 */
export function nullToEmptyString(value: string | null | undefined): string {
  return value ?? ''
}

/**
 * Converts a number or null to string for form display
 * @param value - The number value to convert
 * @returns string representation of the number, or empty string if null/undefined
 */
export function numberToString(value: number | null | undefined): string {
  return value?.toString() ?? ''
}

/**
 * Converts a string to number or null for database storage
 * @param value - The string value to convert
 * @returns parsed number or null if empty/invalid
 */
export function stringToNumber(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return isNaN(parsed) ? null : parsed
}

/**
 * Converts a boolean or null to string for form display
 * @param value - The boolean value to convert
 * @returns 'true', 'false', or empty string
 */
export function booleanToString(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.toString()
}

/**
 * Converts a string to boolean or null for database storage
 * @param value - The string value to convert
 * @returns true, false, or null
 */
export function stringToBoolean(value: string): boolean | null {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === '') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  return null
}

/**
 * Converts a Date or null to string for form display (YYYY-MM-DD format)
 * @param value - The date value to convert
 * @returns ISO date string or empty string
 */
export function dateToString(value: Date | string | null | undefined): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return ''
  return date.toISOString().split('T')[0]
}

/**
 * Converts a string to Date or null for database storage
 * @param value - The string value to convert (expected format: YYYY-MM-DD)
 * @returns Date object or null
 */
export function stringToDate(value: string): Date | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const date = new Date(trimmed)
  return isNaN(date.getTime()) ? null : date
}

// Object Conversion Functions
// ==========================

/**
 * Converts an entire database object to form-compatible values
 * @param data - The database object to convert
 * @returns Object with all null/undefined values converted to empty strings
 */
export function databaseToFormValues<T extends Record<string, any>>(
  data: T
): DatabaseToForm<T> {
  const result: any = {}
  
  for (const key in data) {
    const value = data[key]
    
    if (value === null || value === undefined) {
      result[key] = ''
    } else {
      result[key] = String(value)
    }
  }
  
  return result as DatabaseToForm<T>
}

/**
 * Converts form values to database-compatible format
 * @param data - The form data to convert
 * @param schema - Optional schema to determine field types
 * @returns Object with empty strings converted to null
 */
export function formToDatabaseValues<T extends Record<string, any>>(
  data: T,
  schema?: Partial<Record<keyof T, 'string' | 'number' | 'boolean' | 'date'>>
): FormToDatabase<T> {
  const result: any = {}
  
  for (const key in data) {
    const value = data[key]
    const fieldType = schema?.[key]
    
    if (typeof value === 'string') {
      if (fieldType === 'number') {
        result[key] = stringToNumber(value)
      } else if (fieldType === 'boolean') {
        result[key] = stringToBoolean(value)
      } else if (fieldType === 'date') {
        result[key] = stringToDate(value)
      } else {
        result[key] = emptyStringToNull(value)
      }
    } else {
      result[key] = value
    }
  }
  
  return result as FormToDatabase<T>
}

// Type Guards
// ===========

/**
 * Type guard to check if a value is a non-empty string
 * @param value - The value to check
 * @returns true if value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/**
 * Type guard to check if a value is null or undefined
 * @param value - The value to check
 * @returns true if value is null or undefined
 */
export function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

/**
 * Type guard to check if a string can be parsed as a number
 * @param value - The string value to check
 * @returns true if value can be parsed as a number
 */
export function isNumericString(value: string): boolean {
  return !isNaN(Number(value)) && value.trim() !== ''
}

/**
 * Type guard to check if a string is a valid date
 * @param value - The string value to check
 * @returns true if value can be parsed as a valid date
 */
export function isDateString(value: string): boolean {
  const date = new Date(value)
  return !isNaN(date.getTime())
}

// Validation Helpers
// ==================

/**
 * Validates and converts form data based on a schema
 * @param data - The form data to validate
 * @param schema - Schema defining field types and requirements
 * @returns Validated and converted data or validation errors
 */
export function validateFormData<T extends Record<string, any>>(
  data: T,
  schema: {
    [K in keyof T]: {
      type: 'string' | 'number' | 'boolean' | 'date'
      required?: boolean
      min?: number
      max?: number
      pattern?: RegExp
    }
  }
): { success: true; data: FormToDatabase<T> } | { success: false; errors: Partial<Record<keyof T, string>> } {
  const errors: Partial<Record<keyof T, string>> = {}
  const result: any = {}
  
  for (const key in schema) {
    const value = data[key]
    const fieldSchema = schema[key]
    
    // Check required fields
    if (fieldSchema.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      errors[key] = 'Campo obbligatorio'
      continue
    }
    
    // Skip validation for empty non-required fields
    if (!fieldSchema.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
      result[key] = null
      continue
    }
    
    // Type-specific validation
    switch (fieldSchema.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors[key] = 'Valore non valido'
        } else {
          if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
            errors[key] = 'Formato non valido'
          } else {
            result[key] = emptyStringToNull(value)
          }
        }
        break
        
      case 'number':
        const numValue = typeof value === 'string' ? stringToNumber(value) : value
        if (numValue === null || typeof numValue !== 'number') {
          errors[key] = 'Deve essere un numero'
        } else {
          if (fieldSchema.min !== undefined && numValue < fieldSchema.min) {
            errors[key] = `Valore minimo: ${fieldSchema.min}`
          } else if (fieldSchema.max !== undefined && numValue > fieldSchema.max) {
            errors[key] = `Valore massimo: ${fieldSchema.max}`
          } else {
            result[key] = numValue
          }
        }
        break
        
      case 'boolean':
        const boolValue = typeof value === 'string' ? stringToBoolean(value) : value
        if (boolValue === null || typeof boolValue !== 'boolean') {
          errors[key] = 'Valore non valido'
        } else {
          result[key] = boolValue
        }
        break
        
      case 'date':
        const dateValue = typeof value === 'string' ? stringToDate(value) : value
        if (dateValue === null || !(dateValue instanceof Date)) {
          errors[key] = 'Data non valida'
        } else {
          result[key] = dateValue
        }
        break
    }
  }
  
  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }
  
  return { success: true, data: result as FormToDatabase<T> }
}

// React Hook Form Helpers
// ======================

/**
 * Creates default form values from a database object
 * Useful for react-hook-form defaultValues
 * @param data - The database object
 * @param defaults - Default values for fields not in data
 * @returns Form-compatible default values
 */
export function createFormDefaults<T extends Record<string, any>>(
  data: Partial<T> | null | undefined,
  defaults: DatabaseToForm<T>
): DatabaseToForm<T> {
  if (!data) return defaults
  
  const converted = databaseToFormValues(data as T)
  return { ...defaults, ...converted }
}

/**
 * Transforms form submission data for database operations
 * @param formData - The raw form data
 * @param fieldsToOmit - Fields to exclude from the result
 * @returns Cleaned data ready for database
 */
export function prepareFormSubmission<T extends Record<string, any>>(
  formData: T,
  fieldsToOmit: (keyof T)[] = []
): Partial<FormToDatabase<T>> {
  const result: any = {}
  
  for (const key in formData) {
    if (fieldsToOmit.includes(key)) continue
    
    const value = formData[key]
    if (typeof value === 'string') {
      result[key] = emptyStringToNull(value)
    } else {
      result[key] = value
    }
  }
  
  return result
}