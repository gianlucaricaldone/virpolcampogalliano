# API_PATTERNS.md - Virpol Campogalliano

## Pattern di Query Supabase Comuni

### 🎯 Panoramica

Questo documento raccoglie i pattern di query più comuni utilizzati nel progetto, ottimizzati per performance e consistenza. Tutti gli esempi usano il client Supabase TypeScript.

## 🔐 Autenticazione e Profili Utente

### Pattern Base Autenticazione
```typescript
// useAuth hook - Pattern principale per autenticazione
const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()
        setProfile(profile)
      }
      setLoading(false)
    }
    getUser()
  }, [])

  return { user, profile, loading }
}
```

### Login e Registrazione
```typescript
// Login pattern
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}

// Registrazione con creazione profilo automatica (trigger DB)
const signUp = async (email: string, password: string, userData: any) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: userData // Metadata per il trigger
    }
  })
  if (error) throw error
  return data
}
```

## 👥 Gestione Tesserati

### Query Tesserati con Dati Stagionali
```typescript
// Pattern completo per tesserati con tutti i dati correlati
const getTesseratiConDatiStagionali = async (stagioneId: string) => {
  const { data, error } = await supabase
    .from('tesserati')
    .select(`
      *,
      tesserati_squadre_stagioni!inner(
        squadra:squadre(nome, id, categoria),
        ruolo_squadra,
        numero_maglia,
        stagione_id
      ),
      tesserati_dati_stagionali(
        stato_pagamento,
        note_pagamento,
        visita_sportiva,
        scadenza_certificato,
        certificato_medico
      )
    `)
    .eq('tesserati_squadre_stagioni.stagione_id', stagioneId)
    .eq('stato', true)
    .order('cognome', { ascending: true })
    .order('nome', { ascending: true })

  if (error) throw error
  return data
}
```

### Ricerca Tesserati per Nome/Cognome
```typescript
// Pattern ottimizzato per ricerca testuale
const searchTesserati = async (searchTerm: string, stagioneId: string) => {
  const { data, error } = await supabase
    .from('tesserati')
    .select(`
      *,
      tesserati_squadre_stagioni!inner(
        squadra:squadre(nome)
      )
    `)
    .eq('tesserati_squadre_stagioni.stagione_id', stagioneId)
    .eq('stato', true)
    .or(`nome.ilike.%${searchTerm}%,cognome.ilike.%${searchTerm}%`)
    .order('cognome')

  if (error) throw error
  return data
}
```

### Inserimento Tesserato con Dati Stagionali
```typescript
// Pattern transazionale per inserimento completo
const insertTesseratoCompleto = async (
  tesseratoData: any, 
  squadraId: string, 
  stagioneId: string
) => {
  // 1. Inserisci tesserato
  const { data: tesserato, error: tesseratoError } = await supabase
    .from('tesserati')
    .insert(tesseratoData)
    .select()
    .single()

  if (tesseratoError) throw tesseratoError

  // 2. Inserisci relazione squadra-stagione
  const { error: relazioneError } = await supabase
    .from('tesserati_squadre_stagioni')
    .insert({
      tesserato_id: tesserato.id,
      squadra_id: squadraId,
      stagione_id: stagioneId
    })

  if (relazioneError) throw relazioneError

  // 3. Inserisci dati stagionali
  const { error: datiError } = await supabase
    .from('tesserati_dati_stagionali')
    .insert({
      tesserato_id: tesserato.id,
      stagione_id: stagioneId,
      stato_pagamento: 'non_pagato',
      visita_sportiva: false
    })

  if (datiError) throw datiError

  return tesserato
}
```

## 🏆 Gestione Squadre

### Squadre con Statistiche
```typescript
// Pattern per squadre con conteggio tesserati
const getSquadreConStatistiche = async (stagioneId: string) => {
  const { data, error } = await supabase
    .from('squadre')
    .select(`
      *,
      tesserati_squadre_stagioni(count),
      allenatore:users!allenatore_id(nome, cognome),
      dirigente:users!dirigente_id(nome, cognome)
    `)
    .eq('stagione_id', stagioneId)
    .order('nome')

  if (error) throw error
  return data
}
```

### Tesserati per Squadra
```typescript
// Pattern ottimizzato per roster squadra
const getTesseratiSquadra = async (squadraId: string, stagioneId: string) => {
  const { data, error } = await supabase
    .from('tesserati_squadre_stagioni')
    .select(`
      *,
      tesserato:tesserati(
        id, nome, cognome, data_nascita, telefono, email
      ),
      tesserati_dati_stagionali!inner(
        stato_pagamento,
        visita_sportiva,
        scadenza_certificato
      )
    `)
    .eq('squadra_id', squadraId)
    .eq('stagione_id', stagioneId)
    .eq('tesserati_dati_stagionali.stagione_id', stagioneId)
    .order('numero_maglia', { nullsFirst: false })

  if (error) throw error
  return data
}
```

## 📅 Gestione Presenze

### Presenze per Data e Squadra
```typescript
// Pattern per registro presenze
const getPresenzeGiorno = async (
  squadraId: string, 
  data: string, 
  stagioneId: string
) => {
  const { data: presenze, error } = await supabase
    .from('presenze')
    .select(`
      *,
      tesserato:tesserati(id, nome, cognome)
    `)
    .eq('squadra_id', squadraId)
    .eq('data', data)
    .eq('stagione_id', stagioneId)
    .eq('tipo', 'allenamento')
    .order('tesserati.cognome')

  if (error) throw error
  return presenze
}
```

### Inserimento Presenze Multiple
```typescript
// Pattern per batch insert presenze
const insertPresenzeMultiple = async (
  presenze: Array<{
    tesserato_id: string
    data: string
    squadra_id: string
    stagione_id: string
    presente: boolean
    tipo: string
  }>
) => {
  const { data, error } = await supabase
    .from('presenze')
    .insert(presenze)
    .select()

  if (error) throw error
  return data
}
```

### Statistiche Presenze per Tesserato
```typescript
// Pattern per statistiche individuali
const getStatistichePresenze = async (
  tesseratoId: string, 
  stagioneId: string
) => {
  const { data, error } = await supabase
    .from('presenze')
    .select('presente')
    .eq('tesserato_id', tesseratoId)
    .eq('stagione_id', stagioneId)
    .eq('tipo', 'allenamento')

  if (error) throw error

  const totaleAllenamenti = data.length
  const presenzeEffettive = data.filter(p => p.presente).length
  const percentuale = totaleAllenamenti > 0 
    ? Math.round((presenzeEffettive / totaleAllenamenti) * 100) 
    : 0

  return {
    totaleAllenamenti,
    presenzeEffettive,
    percentuale
  }
}
```

## ⚽ Gestione Partite e Convocazioni

### Partite con Convocazioni
```typescript
// Pattern per partite con lista convocati
const getPartiteConConvocazioni = async (
  squadraId: string, 
  stagioneId: string
) => {
  const { data, error } = await supabase
    .from('partite')
    .select(`
      *,
      convocazioni(
        id,
        stato,
        tesserato:tesserati(id, nome, cognome)
      )
    `)
    .eq('squadra_id', squadraId)
    .eq('stagione_id', stagioneId)
    .order('data', { ascending: false })

  if (error) throw error
  return data
}
```

### Inserimento Convocazioni Multiple
```typescript
// Pattern per convocazioni batch
const insertConvocazioniPartita = async (
  partitaId: string,
  tesseratiIds: string[],
  stagioneId: string
) => {
  const convocazioni = tesseratiIds.map(tesseratoId => ({
    partita_id: partitaId,
    tesserato_id: tesseratoId,
    stagione_id: stagioneId,
    stato: 'convocato'
  }))

  const { data, error } = await supabase
    .from('convocazioni')
    .insert(convocazioni)
    .select()

  if (error) throw error
  return data
}
```

## 📦 Gestione Magazzino

### Inventario con Giacenze
```typescript
// Pattern per inventario completo
const getInventarioCompleto = async (stagioneId: string) => {
  const { data, error } = await supabase
    .from('magazzino')
    .select(`
      *,
      assegnazioni_materiale!inner(
        id,
        squadra:squadre(nome),
        quantita,
        quantita_restituita,
        stato,
        data_assegnazione
      )
    `)
    .eq('stagione_id', stagioneId)
    .eq('assegnazioni_materiale.stato', 'attiva')
    .order('tipo_materiale')
    .order('nome_articolo')

  if (error) throw error
  return data
}
```

### Movimenti Magazzino con Audit
```typescript
// Pattern per storico movimenti
const getMovimentiMagazzino = async (
  materialeId: string,
  limit: number = 50
) => {
  const { data, error } = await supabase
    .from('movimenti_magazzino')
    .select(`
      *,
      utente:users(nome, cognome),
      squadra:squadre(nome)
    `)
    .eq('materiale_id', materialeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}
```

### Assegnazione Materiale Atomica
```typescript
// Pattern per assegnazione con movimento automatico
const assegnaMateriale = async (
  materialeId: string,
  squadraId: string,
  quantita: number,
  utenteId: string,
  stagioneId: string
) => {
  // Usa stored procedure per operazione atomica
  const { data, error } = await supabase
    .rpc('assegna_materiale_squadra', {
      p_materiale_id: materialeId,
      p_squadra_id: squadraId,
      p_quantita: quantita,
      p_utente_id: utenteId,
      p_stagione_id: stagioneId
    })

  if (error) throw error
  return data
}
```

## 🏅 Gestione Tornei

### Tornei con Iscrizioni
```typescript
// Pattern per tornei con partecipanti
const getTorneiConIscrizioni = async (stagioneId: string) => {
  const { data, error } = await supabase
    .from('tornei')
    .select(`
      *,
      iscrizioni_torneo(
        id,
        confermata,
        squadra:squadre(id, nome, categoria)
      )
    `)
    .eq('stagione_id', stagioneId)
    .eq('attivo', true)
    .order('data_inizio', { ascending: false })

  if (error) throw error
  return data
}
```

### Iscrizione Torneo con Validazione
```typescript
// Pattern per iscrizione con controlli
const iscriviSquadraTorneo = async (
  torneoId: string,
  squadraId: string,
  documenti?: any
) => {
  // 1. Controlla posti disponibili
  const { data: torneo } = await supabase
    .from('tornei')
    .select('numero_squadre_max, numero_squadre_iscritte, iscrizioni_aperte')
    .eq('id', torneoId)
    .single()

  if (!torneo?.iscrizioni_aperte) {
    throw new Error('Iscrizioni chiuse')
  }

  if (torneo.numero_squadre_max && 
      torneo.numero_squadre_iscritte >= torneo.numero_squadre_max) {
    throw new Error('Torneo al completo')
  }

  // 2. Inserisci iscrizione
  const { data, error } = await supabase
    .from('iscrizioni_torneo')
    .insert({
      torneo_id: torneoId,
      squadra_id: squadraId,
      data_iscrizione: new Date().toISOString().split('T')[0],
      documenti
    })
    .select()

  if (error) throw error

  // 3. Aggiorna contatore (trigger automatico)
  return data
}
```

## 📊 Query per Dashboard e Statistiche

### Statistiche Generali Dashboard
```typescript
// Pattern per overview dashboard
const getDashboardStats = async (stagioneId: string) => {
  const [squadre, tesserati, presenze, partite] = await Promise.all([
    // Squadre attive
    supabase
      .from('squadre')
      .select('id', { count: 'exact' })
      .eq('stagione_id', stagioneId),
    
    // Tesserati attivi
    supabase
      .from('tesserati_squadre_stagioni')
      .select('tesserato_id', { count: 'exact' })
      .eq('stagione_id', stagioneId),
    
    // Presenze ultima settimana
    supabase
      .from('presenze')
      .select('id', { count: 'exact' })
      .eq('stagione_id', stagioneId)
      .eq('presente', true)
      .gte('data', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    
    // Partite prossime
    supabase
      .from('partite')
      .select('id', { count: 'exact' })
      .eq('stagione_id', stagioneId)
      .gte('data', new Date().toISOString().split('T')[0])
      .lte('data', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  ])

  return {
    squadre: squadre.count || 0,
    tesserati: tesserati.count || 0,
    presenzeSettimana: presenze.count || 0,
    partiteProssime: partite.count || 0
  }
}
```

### Query per Report Avanzati
```typescript
// Pattern per report presenze per squadra
const getReportPresenzeSquadra = async (
  squadraId: string,
  stagioneId: string,
  dataInizio: string,
  dataFine: string
) => {
  const { data, error } = await supabase
    .from('presenze')
    .select(`
      data,
      presente,
      tesserato:tesserati(nome, cognome)
    `)
    .eq('squadra_id', squadraId)
    .eq('stagione_id', stagioneId)
    .eq('tipo', 'allenamento')
    .gte('data', dataInizio)
    .lte('data', dataFine)
    .order('data')
    .order('tesserati.cognome')

  if (error) throw error

  // Raggruppa per tesserato
  const report = data.reduce((acc, presenza) => {
    const key = `${presenza.tesserato.cognome}, ${presenza.tesserato.nome}`
    if (!acc[key]) {
      acc[key] = { totale: 0, presenze: 0 }
    }
    acc[key].totale++
    if (presenza.presente) acc[key].presenze++
    return acc
  }, {} as Record<string, { totale: number, presenze: number }>)

  return Object.entries(report).map(([nome, stats]) => ({
    nome,
    ...stats,
    percentuale: Math.round((stats.presenze / stats.totale) * 100)
  }))
}
```

## 🛡 Pattern di Sicurezza RLS

### Controllo Permessi per Ruolo
```typescript
// Pattern per controllo permessi lato client
const checkPermission = async (action: string, resource: string) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('users')
    .select('role, roles')
    .eq('id', user.id)
    .single()

  if (!profile) return false

  // Logica permessi basata su ruolo
  const permissions = {
    admin: ['*'],
    dirigente: ['read:*', 'write:tesserati', 'write:squadre'],
    allenatore: ['read:*', 'write:presenze', 'write:convocazioni'],
    tesserato: ['read:own'],
    genitore: ['read:children']
  }

  return permissions[profile.role]?.includes(action) || 
         permissions[profile.role]?.includes('*')
}
```

### Query con Filtro RLS Esplicito
```typescript
// Pattern per query con controllo esplicito
const getDataForCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Non autenticato')

  const { data: profile } = await supabase
    .from('users')
    .select('role, squadra_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Profilo non trovato')

  let query = supabase.from('tesserati').select('*')

  // Filtro basato su ruolo
  if (profile.role === 'allenatore') {
    query = query.in('squadra_id', profile.squadra_id || [])
  } else if (profile.role === 'tesserato') {
    query = query.eq('email', user.email)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}
```

## 🔄 Pattern per Real-time Updates

### Subscription per Aggiornamenti Live
```typescript
// Pattern per aggiornamenti real-time
const useRealtimePresenze = (squadraId: string, data: string) => {
  const [presenze, setPresenze] = useState([])

  useEffect(() => {
    const subscription = supabase
      .channel('presenze_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'presenze',
          filter: `squadra_id=eq.${squadraId} and data=eq.${data}`
        }, 
        (payload) => {
          // Aggiorna state basato su payload
          handleRealtimeUpdate(payload)
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [squadraId, data])

  return presenze
}
```

## 🎯 Best Practices

### 1. Sempre Gestire Errori
```typescript
const safeQuery = async () => {
  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
    
    if (error) {
      console.error('Supabase error:', error)
      throw new Error('Errore nel caricamento dati')
    }
    
    return data
  } catch (error) {
    console.error('Query failed:', error)
    throw error
  }
}
```

### 2. Usa Type Safety
```typescript
// Definisci tipi espliciti
interface TesseratoCompleto {
  id: string
  nome: string
  cognome: string
  tesserati_dati_stagionali: {
    stato_pagamento: 'pagato' | 'non_pagato' | 'parziale' | 'in_sospeso'
    visita_sportiva: boolean
  }[]
}

const getTesserati = async (): Promise<TesseratoCompleto[]> => {
  const { data, error } = await supabase
    .from('tesserati')
    .select(`
      id, nome, cognome,
      tesserati_dati_stagionali(stato_pagamento, visita_sportiva)
    `)

  if (error) throw error
  return data as TesseratoCompleto[]
}
```

### 3. Ottimizza le Query
```typescript
// ❌ Evita N+1 queries
const badPattern = async () => {
  const tesserati = await getTesserati()
  for (const tesserato of tesserati) {
    const presenze = await getPresenzeByTesserato(tesserato.id) // N+1!
  }
}

// ✅ Usa JOIN o select nested
const goodPattern = async () => {
  const { data } = await supabase
    .from('tesserati')
    .select(`
      *,
      presenze(*)
    `)
  return data
}
```

### 4. Cache Query Pesanti
```typescript
// Pattern con cache SWR
const useTesseratiWithCache = (stagioneId: string) => {
  return useSWR(
    ['tesserati', stagioneId],
    () => getTesseratiConDatiStagionali(stagioneId),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000 // 1 minuto
    }
  )
}
```