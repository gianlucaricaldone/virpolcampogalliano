'use client'

import React, { useState } from 'react'
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, Font, Image } from '@react-pdf/renderer'
import { Database } from '@/types/database'

// Usa font di sistema per evitare errori di caricamento
// Font.register rimosso - useremo i font di default di react-pdf

type Partita = Database['public']['Tables']['partite']['Row'] & {
  squadre?: { nome: string }
  categorie_avversari?: {
    nome_categoria: string
    avversari: {
      nome_societa: string
      citta?: string
    }
  }
}

// Stili per il PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    textAlign: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 700,
    color: '#1e40af', // Blu Virpol
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
  },
  mainContent: {
    marginBottom: 30,
  },
  matchTitle: {
    fontSize: 28,
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: 40,
    color: '#0f172a',
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  teamBox: {
    flex: 1,
    padding: 20,
    textAlign: 'center',
  },
  vsBox: {
    width: 60,
    textAlign: 'center',
  },
  teamName: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 5,
    color: '#1e40af', // Blu Virpol
  },
  teamCategory: {
    fontSize: 16,
    color: '#64748b',
  },
  vsText: {
    fontSize: 32,
    fontWeight: 700,
    color: '#fbbf24', // Giallo Virpol
  },
  detailsContainer: {
    backgroundColor: '#f8fafc',
    padding: 30,
    borderRadius: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 700,
    width: 120,
    color: '#475569',
  },
  detailValue: {
    fontSize: 14,
    flex: 1,
    color: '#0f172a',
  },
  competitionBadge: {
    backgroundColor: '#1e40af', // Blu Virpol
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  competitionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  organizationName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e40af', // Blu Virpol
    textAlign: 'center',
    marginBottom: 5,
  },
  notesContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fef3c7',
    borderRadius: 8,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 5,
    color: '#92400e',
  },
  notesText: {
    fontSize: 12,
    color: '#451a03',
  },
})

// Componente per il documento PDF
const LocandinaPDF = ({ partita }: { partita: Partita }) => {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getCompetitionColor = (tipo: string) => {
    switch (tipo) {
      case 'campionato':
        return '#1e40af' // Blu Virpol
      case 'coppa':
        return '#fbbf24' // Giallo Virpol
      case 'torneo':
        return '#1e40af' // Blu Virpol
      case 'amichevole':
        return '#fbbf24' // Giallo Virpol
      default:
        return '#6b7280'
    }
  }

  const getCompetitionName = (tipo: string) => {
    switch (tipo) {
      case 'campionato':
        return 'CAMPIONATO'
      case 'coppa':
        return 'COPPA'
      case 'torneo':
        return 'TORNEO'
      case 'amichevole':
        return 'AMICHEVOLE'
      default:
        return tipo.toUpperCase()
    }
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>VIRPOL CAMPOGALLIANO</Text>
          <Text style={styles.subtitle}>Società Sportiva Dilettantistica</Text>
        </View>

        {/* Tipo di competizione */}
        <View style={{ alignItems: 'center', marginBottom: 30 }}>
          <View style={[styles.competitionBadge, { backgroundColor: getCompetitionColor(partita.tipo_competizione) }]}>
            <Text style={styles.competitionText}>{getCompetitionName(partita.tipo_competizione)}</Text>
          </View>
        </View>

        {/* Teams */}
        <View style={styles.teamsContainer}>
          <View style={styles.teamBox}>
            <Text style={styles.teamName}>{partita.squadre?.nome || 'N/D'}</Text>
            <Text style={styles.teamCategory}>Virpol Campogalliano</Text>
          </View>
          
          <View style={styles.vsBox}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          
          <View style={styles.teamBox}>
            <Text style={styles.teamName}>
              {partita.categorie_avversari?.avversari?.nome_societa || partita.avversario || 'N/D'}
            </Text>
            <Text style={styles.teamCategory}>
              {partita.categorie_avversari?.nome_categoria || ''}
            </Text>
          </View>
        </View>

        {/* Dettagli partita */}
        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>DATA:</Text>
            <Text style={styles.detailValue}>{formatDate(partita.data)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ORA:</Text>
            <Text style={styles.detailValue}>{partita.ora}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CAMPO:</Text>
            <Text style={styles.detailValue}>{partita.campo}</Text>
          </View>

          {partita.categorie_avversari?.avversari?.citta && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>CITTÀ:</Text>
              <Text style={styles.detailValue}>{partita.categorie_avversari.avversari.citta}</Text>
            </View>
          )}
        </View>

        {/* Note */}
        {partita.note && (
          <View style={styles.notesContainer}>
            <Text style={styles.notesTitle}>Note:</Text>
            <Text style={styles.notesText}>{partita.note}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.organizationName}>VIRPOL CAMPOGALLIANO A.S.D.</Text>
          <Text style={styles.footerText}>
            Via dello Sport, 5 - 41011 Campogalliano (MO)
          </Text>
          <Text style={styles.footerText}>
            Tel: 059 526900 - info@virpolcampogalliano.it
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// Componente per il pulsante di download
interface LocandinaPartitaProps {
  partita: Partita
  buttonText?: React.ReactNode
  buttonClassName?: string
}

export default function LocandinaPartita({ partita, buttonText = "Stampa locandina", buttonClassName = "" }: LocandinaPartitaProps) {
  const [showPDF, setShowPDF] = useState(false)
  
  const fileName = `locandina_${partita.squadre?.nome || 'partita'}_${partita.data}.pdf`
    .replace(/\s+/g, '_')
    .toLowerCase()

  // Verifica che i dati essenziali siano presenti
  if (!partita.data || !partita.ora || !partita.campo) {
    return (
      <button 
        className={buttonClassName}
        disabled
        style={{ opacity: 0.5, cursor: 'not-allowed' }}
      >
        {buttonText}
      </button>
    )
  }

  if (!showPDF) {
    return (
      <button 
        className={buttonClassName}
        onClick={() => setShowPDF(true)}
        style={{ textDecoration: 'none' }}
      >
        {buttonText}
      </button>
    )
  }

  return (
    <PDFDownloadLink
      document={<LocandinaPDF partita={partita} />}
      fileName={fileName}
      className={buttonClassName}
      style={{ textDecoration: 'none' }}
    >
      {({ blob, url, loading, error }) => {
        if (error) {
          console.error('Errore generazione PDF:', error)
          setShowPDF(false) // Reset per permettere nuovo tentativo
          return (
            <button 
              className={buttonClassName}
              onClick={() => setShowPDF(true)}
              style={{ color: 'red' }}
            >
              Riprova PDF
            </button>
          )
        }
        return loading ? 'Generazione PDF...' : buttonText
      }}
    </PDFDownloadLink>
  )
}