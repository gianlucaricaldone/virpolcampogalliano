import { describe, expect, it } from 'vitest'
import { passwordIniziale } from '@/lib/domain/password'

describe('passwordIniziale', () => {
  it('usa il nome in minuscolo col suffisso della società', () => {
    expect(passwordIniziale('Marco')).toBe('marco_VIRPOL_1234')
  })

  it('toglie gli accenti invece di lasciarli passare', () => {
    // Una password con una lettera accentata si detta a voce male e si digita
    // peggio da una tastiera che non ce l'ha.
    expect(passwordIniziale('Niccolò')).toBe('niccolo_VIRPOL_1234')
    expect(passwordIniziale('Renée')).toBe('renee_VIRPOL_1234')
  })

  it('toglie spazi e apostrofi dai nomi composti', () => {
    expect(passwordIniziale('Maria Grazia')).toBe('mariagrazia_VIRPOL_1234')
    expect(passwordIniziale("D'Angelo")).toBe('dangelo_VIRPOL_1234')
  })

  it('non produce una password che comincia col suffisso quando il nome sparisce', () => {
    // '...' non lascia nessun carattere utile: senza il ripiego uscirebbe
    // '_VIRPOL_1234', cioè la stessa password per ogni nome impronunciabile.
    expect(passwordIniziale('...')).toBe('utente_VIRPOL_1234')
    expect(passwordIniziale('')).toBe('utente_VIRPOL_1234')
  })
})
