# TROUBLESHOOTING.md - Virpol Campogalliano

## Risoluzione Problemi Comuni

### 🚨 Problemi di Build e Deployment

#### Build Failure su Vercel
**Sintomi:**
- Deploy Vercel fallisce
- Errori TypeScript in build
- Import non risolti

**Cause Comuni:**
1. Errori di compilazione TypeScript
2. Import paths errati
3. Variabili environment mancanti
4. Dipendenze mancanti

**Soluzioni:**
```bash
# 1. Verifica build locale
npm run type-check
npm run lint  
npm run build

# 2. Controlla tutti gli import
# Esempio di import corretto:
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

# 3. Verifica package.json dependencies
npm install

# 4. Controlla environment variables su Vercel
```

**Fix per errori TypeScript comuni:**
```typescript
// ❌ Errore: Property does not exist
const value = data.property // se data potrebbe essere null

// ✅ Soluzione: Optional chaining
const value = data?.property

// ❌ Errore: Argument of type 'unknown' is not assignable
catch (error) {
  console.log(error.message) // error è unknown
}

// ✅ Soluzione: Type guard
catch (error) {
  console.log(error instanceof Error ? error.message : 'Unknown error')
}
```

#### Build Success ma Runtime Error
**Sintomi:**
- Build passa ma app non funziona
- Pagina bianca
- Errore 500

**Debug Steps:**
1. Controlla console browser per errori JavaScript
2. Verifica Network tab per chiamate API fallite
3. Controlla Vercel logs per errori server-side

```bash
# Vercel CLI per vedere logs
npx vercel logs [deployment-url]
```

### 🔐 Problemi di Autenticazione

#### Error: "Supabase not configured"
**Causa:** File `.env.local` non configurato correttamente

**Soluzione:**
```bash
# Verifica che esista .env.local (NON .env.local.example)
ls -la .env.local

# Contenuto richiesto:
NEXT_PUBLIC_SUPABASE_URL=https://ctrsnztrfslewkpbfxei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_key]
SUPABASE_SERVICE_ROLE_KEY=[your_service_key]
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Dashboard Infinito "Caricamento..."
**Sintomi:**
- Pagina dashboard mostra sempre loading
- Console mostra errori `[useAuth]`

**Debug:**
```typescript
// Aggiungi logging in useAuth hook
console.log('[useAuth] User:', user)
console.log('[useAuth] Profile:', profile)
console.log('[useAuth] Loading:', loading)
```

**Cause e Soluzioni:**
1. **User autenticato ma profilo mancante:**
```sql
-- Verifica in Supabase SQL Editor
SELECT * FROM auth.users WHERE email = 'your-email@example.com';
SELECT * FROM public.users WHERE email = 'your-email@example.com';

-- Se auth.users esiste ma public.users no, crea profilo:
INSERT INTO public.users (id, email, role)
VALUES ('[auth-user-id]', 'your-email@example.com', 'tesserato');
```

2. **RLS Policy bloccante:**
```sql
-- Temporaneamente disabilita RLS per debug
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- Testa, poi riabilita
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

#### Login Redirect Loop
**Sintomi:**
- Dopo login, redirect continuo tra `/auth/login` e `/dashboard`

**Soluzione:**
```typescript
// Verifica useEffect in pages protette
useEffect(() => {
  if (!loading && !user) {
    router.push('/auth/login')
  }
}, [user, loading, router]) // Assicurati dipendenze corrette
```

#### Email di Reset Password con Localhost
**Problema:** Email contengono `localhost:3000` invece di URL produzione

**Soluzione:**
1. **Supabase Dashboard** → Authentication → Settings
2. **Site URL:** `https://virpolcampogalliano.vercel.app/`
3. **Redirect URLs:** Aggiungi entrambi:
   - `https://virpolcampogalliano.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`

### 🗄 Problemi Database

#### Error: "infinite recursion detected in policy"
**Causa:** RLS policy che referenzia se stessa

**Soluzione:** Semplificare policy
```sql
-- ❌ Policy problematica
CREATE POLICY "users_policy" ON users
FOR SELECT USING (
  id IN (SELECT id FROM users WHERE role = 'admin') -- Ricorsione!
);

-- ✅ Policy corretta
CREATE POLICY "users_policy" ON users
FOR SELECT USING (true); -- Permetti lettura a tutti
```

#### Query Timeout o Performance Lente
**Sintomi:**
- Query che impiegano > 5 secondi
- Timeout errors

**Debug:**
```sql
-- Analizza query lente in Supabase SQL Editor
EXPLAIN ANALYZE 
SELECT t.*, tds.*, s.nome as squadra_nome
FROM tesserati t
JOIN tesserati_dati_stagionali tds ON t.id = tds.tesserato_id
JOIN tesserati_squadre_stagioni tss ON t.id = tss.tesserato_id
JOIN squadre s ON tss.squadra_id = s.id
WHERE tds.stagione_id = '[stagione-id]';
```

**Soluzioni:**
1. **Aggiungi indici mancanti:**
```sql
-- Se vedi Seq Scan in EXPLAIN
CREATE INDEX idx_missing ON table_name(column_name);
```

2. **Ottimizza query con LIMIT:**
```typescript
// Evita query senza limite
const { data } = await supabase
  .from('tesserati')
  .select('*')
  .limit(100) // Aggiungi sempre limit ragionevole
```

#### Constraint Violation Errors
**Error Code 23505:** Unique violation
```typescript
// Gestisci duplicati
try {
  await supabase.from('tesserati').insert(data)
} catch (error) {
  if (error.code === '23505') {
    throw new Error('Tesserato già esistente')
  }
  throw error
}
```

**Error Code 23503:** Foreign key violation
```typescript
// Verifica esistenza relazioni prima di insert
const { data: squadra } = await supabase
  .from('squadre')
  .select('id')
  .eq('id', squadraId)
  .single()

if (!squadra) {
  throw new Error('Squadra non trovata')
}
```

### 📱 Problemi UI e UX

#### Hydration Mismatch Errors
**Sintomi:**
- "Hydration failed because the initial UI does not match"
- Contenuto diverso tra server e client

**Cause e Soluzioni:**
1. **Date/Time rendering diverso:**
```typescript
// ❌ Problematico
const now = new Date().toLocaleString() // Diverso server/client

// ✅ Soluzione: useEffect per client-only
const [currentTime, setCurrentTime] = useState('')
useEffect(() => {
  setCurrentTime(new Date().toLocaleString())
}, [])
```

2. **Random data o ID:**
```typescript
// ❌ Math.random() lato server diverso da client
const id = Math.random()

// ✅ useId hook o useState
const [id, setId] = useState('')
useEffect(() => {
  setId(Math.random().toString())
}, [])
```

#### Responsive Layout Issues
**Problemi comuni:**
- Tabelle che overflow su mobile
- Testo tagliato
- Button troppo piccoli su touch

**Soluzioni:**
```typescript
// Pattern responsive table
<div className="overflow-x-auto">
  <table className="min-w-full">
    {/* Desktop table */}
  </table>
</div>

// Pattern card su mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => (
    <Card key={item.id} className="p-4">
      {/* Card content */}
    </Card>
  ))}
</div>
```

#### Form Validation Issues
**Problemi:**
- Submit form senza validazione
- Error messages non chiari

**Soluzioni:**
```typescript
// Pattern form robusto
const form = useForm<FormData>({
  defaultValues: {
    nome: tesserato?.nome ?? '',
    email: tesserato?.email ?? null
  }
})

const onSubmit = async (data: FormData) => {
  try {
    // Converti per database
    const dbData = {
      nome: data.nome,
      email: data.email?.trim() || null
    }
    
    await saveTesserato(dbData)
    toast.success('Tesserato salvato')
  } catch (error) {
    console.error('Save error:', error)
    toast.error(error instanceof Error ? error.message : 'Errore salvataggio')
  }
}
```

### 🎯 Problemi Specifici del Dominio

#### Scadenze Certificati Non Calcolate
**Problema:** Funzione `isCertificateExpiring` non funziona

**Debug:**
```typescript
// Verifica formato date
console.log('Scadenza certificato:', tesserato.scadenza_certificato)
console.log('Tipo:', typeof tesserato.scadenza_certificato)

// Assicurati formato ISO date
const scadenza = new Date(tesserato.scadenza_certificato)
console.log('Data valida:', !isNaN(scadenza.getTime()))
```

**Soluzione:**
```typescript
const isCertificateExpiring = (scadenza: string | null): boolean => {
  if (!scadenza) return false
  
  const scadenzaDate = new Date(scadenza)
  if (isNaN(scadenzaDate.getTime())) return false
  
  const today = new Date()
  const diffTime = scadenzaDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return diffDays <= 30 && diffDays >= 0
}
```

#### Presenze Non Salvate Correttamente
**Problema:** Checkbox presenze non persistono

**Debug:**
```typescript
// Verifica payload prima di save
console.log('Saving presenze:', presenzeData)

// Verifica response
const { data, error } = await supabase
  .from('presenze')
  .upsert(presenzeData, {
    onConflict: 'tesserato_id,data,squadra_id'
  })
  .select()

console.log('Upsert result:', { data, error })
```

#### Statistiche Dashboard Errate
**Problema:** Conteggi non corrispondono

**Debug queries:**
```sql
-- Verifica manualmente in Supabase
SELECT COUNT(*) as total_tesserati 
FROM tesserati 
WHERE stato = true;

SELECT COUNT(*) as tesserati_stagione
FROM tesserati_squadre_stagioni 
WHERE stagione_id = '[current-season-id]';
```

### 🔧 Debug Tools e Utilities

#### Console Logging Structure
```typescript
// Pattern logging consistente
const DEBUG_PREFIX = '[ComponentName]'

console.log(`${DEBUG_PREFIX} Action started`, { params })
console.warn(`${DEBUG_PREFIX} Warning:`, warningMessage)
console.error(`${DEBUG_PREFIX} Error:`, error)
```

#### Supabase Query Debugging
```typescript
// Abilita debug query
const supabaseWithDebug = supabase
  .from('tesserati')
  .select('*')

console.log('Query URL:', supabaseWithDebug.url)

const { data, error } = await supabaseWithDebug

console.log('Query result:', { data, error, count: data?.length })
```

#### Network Debugging
**Chrome DevTools:**
1. **Network Tab** → Filter "Fetch/XHR"
2. Cerca chiamate a `supabase.co`
3. Verifica Headers, Payload, Response
4. Controlla status codes (200, 400, 500)

#### Local Storage Debug
```typescript
// Verifica Supabase session
const session = localStorage.getItem('sb-[project-ref]-auth-token')
console.log('Stored session:', session ? 'Present' : 'Missing')

// Clear session se problemi
localStorage.removeItem('sb-[project-ref]-auth-token')
```

### 📞 Quando Chiedere Aiuto

#### Informazioni da Fornire
1. **Errore esatto** (screenshot console)
2. **Passi per riprodurre** il problema
3. **Environment** (dev/prod, browser, device)
4. **Codice relevante** che causa l'errore
5. **Log completi** (non solo la riga dell'errore)

#### Risorse Utili
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **Tailwind Docs:** https://tailwindcss.com/docs
- **TypeScript Handbook:** https://typescriptlang.org/docs

#### Self-Debug Checklist
Prova sempre in questo ordine:
- [ ] Console errors nel browser
- [ ] Network tab per API failures
- [ ] Supabase logs per database errors
- [ ] Vercel logs per deployment issues
- [ ] Ricrea il problema in ambiente pulito
- [ ] Verifica environment variables
- [ ] Testa query direttamente in Supabase SQL Editor

### 🏥 Recovery Procedures

#### Reset Database State
```sql
-- Solo in ambiente di sviluppo!
-- Resetta dati stagionali
DELETE FROM tesserati_dati_stagionali WHERE stagione_id = '[current-season]';

-- Resetta presenze
DELETE FROM presenze WHERE stagione_id = '[current-season]';

-- Ricostruisci dati base
INSERT INTO tesserati_dati_stagionali (tesserato_id, stagione_id, stato_pagamento)
SELECT t.id, '[current-season]', 'non_pagato'
FROM tesserati t
WHERE t.stato = true;
```

#### Reset User Session
```typescript
// Force logout e clean start
const forceLogout = async () => {
  await supabase.auth.signOut()
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = '/auth/login'
}
```

#### Rollback Deployment
```bash
# Vercel CLI rollback
npx vercel rollback [deployment-url]

# O redeploy commit precedente
git reset --hard HEAD~1
git push --force-with-lease
```

Ricorda: **Sempre backup dei dati prima di operazioni di recovery!**