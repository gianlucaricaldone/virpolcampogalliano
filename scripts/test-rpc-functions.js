#!/usr/bin/env node

/**
 * Script per testare le RPC functions ottimizzate
 * Eseguire con: node scripts/test-rpc-functions.js
 */

const { createClient } = require('@supabase/supabase-js')

// Configurazione Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Errore: Variabili ambiente Supabase non trovate')
  console.log('Assicurati che .env.local contenga:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testRPCFunctions() {
  console.log('🧪 Test RPC Functions Ottimizzate\n')

  // Test 1: Dashboard Stats Dinamiche
  console.log('1️⃣ Testing get_dashboard_stats_dynamic...')
  try {
    const { data, error } = await supabase.rpc('get_dashboard_stats_dynamic', {
      stagione_id_param: null
    })
    
    if (error) {
      console.log('⚠️  RPC non disponibile (normale in ambiente locale):', error.message)
    } else {
      console.log('✅ Dashboard stats:', data)
    }
  } catch (err) {
    console.log('⚠️  RPC non eseguita (normale se migration non applicata):', err.message)
  }

  // Test 2: Recent Activities
  console.log('\n2️⃣ Testing get_recent_activities...')
  try {
    const { data, error } = await supabase.rpc('get_recent_activities', {
      activity_limit: 5
    })
    
    if (error) {
      console.log('⚠️  RPC non disponibile:', error.message)
    } else {
      console.log('✅ Recent activities:', data?.length || 0, 'risultati')
      if (data?.length > 0) {
        console.log('   Primo risultato:', data[0])
      }
    }
  } catch (err) {
    console.log('⚠️  RPC non eseguita:', err.message)
  }

  // Test 3: Statistiche Presenze
  console.log('\n3️⃣ Testing get_statistiche_presenze...')
  try {
    const { data, error } = await supabase.rpc('get_statistiche_presenze', {
      squadra_id_param: null,
      periodo_param: 'settimanale'
    })
    
    if (error) {
      console.log('⚠️  RPC non disponibile:', error.message)
    } else {
      console.log('✅ Statistiche presenze:', data?.length || 0, 'risultati')
    }
  } catch (err) {
    console.log('⚠️  RPC non eseguita:', err.message)
  }

  // Test 4: Connessione database base
  console.log('\n4️⃣ Testing basic database connection...')
  try {
    const { data, error } = await supabase
      .from('tesserati')
      .select('id', { count: 'exact', head: true })
    
    if (error) {
      console.log('❌ Errore connessione database:', error.message)
    } else {
      console.log('✅ Database connesso. Tesserati totali:', data || 0)
    }
  } catch (err) {
    console.log('❌ Errore connessione:', err.message)
  }

  console.log('\n📋 Riassunto:')
  console.log('• Le RPC functions sono definite in: supabase/migrations/031_optimization_rpc_functions_fixed.sql')
  console.log('• Per attivarle: eseguire la migration su Supabase')
  console.log('• Fallback: Il codice usa query separate se le RPC non sono disponibili')
}

// Carica variabili ambiente se necessario
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config({ path: '.env.local' })
  } catch (e) {
    // dotenv non disponibile, usa variabili ambiente di sistema
  }
}

testRPCFunctions().then(() => {
  console.log('\n✅ Test completato')
}).catch(err => {
  console.error('\n❌ Errore durante i test:', err)
  process.exit(1)
})