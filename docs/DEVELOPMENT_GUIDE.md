# DEVELOPMENT_GUIDE.md - Virpol Campogalliano

## Guida Completa allo Sviluppo

### 🚀 Setup Iniziale del Progetto

#### Prerequisiti
- **Node.js** 18+ (raccomandato 20+)
- **npm** o **yarn**
- **Git**
- Account **Supabase** (per database)
- Account **Vercel** (per deployment)

#### Clone e Installazione
```bash
# Clone repository
git clone https://github.com/[username]/virpolcampogalliano.git
cd virpolcampogalliano

# Installa dipendenze
npm install

# Copia file environment
cp .env.local.example .env.local
```

#### Configurazione Environment
Crea `.env.local` con:
```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ctrsnztrfslewkpbfxei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your_anon_key]
SUPABASE_SERVICE_ROLE_KEY=[your_service_role_key]

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

⚠️ **IMPORTANTE**: Usa `.env.local` (non `.env.local.example`)

## 🏗 Architettura del Progetto

### Struttura Directory
```
virpolcampogalliano/
├── app/                    # Next.js 14 App Router
│   ├── (auth)/            # Route group protette
│   │   ├── dashboard/     # Dashboard principale
│   │   ├── tesserati/     # Gestione tesserati
│   │   ├── squadre/       # Gestione squadre
│   │   ├── presenze/      # Registro presenze
│   │   ├── partite/       # Gestione partite
│   │   ├── magazzino/     # Inventario materiale
│   │   └── tornei/        # Gestione tornei
│   ├── auth/              # Pagine autenticazione
│   ├── api/               # API routes (se necessarie)
│   ├── globals.css        # Stili globali Tailwind
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Homepage
├── components/            # Componenti React
│   ├── ui/               # Componenti base (shadcn/ui)
│   ├── layout/           # Layout components
│   │   ├── Header.tsx    # Non utilizzato
│   │   └── ModernHeader.tsx # Header principale
│   ├── auth/             # Componenti autenticazione
│   ├── dashboard/        # Componenti dashboard
│   └── forms/            # Form components
├── lib/                  # Utilities e configurazioni
│   ├── supabase/         # Client Supabase
│   │   ├── client.ts     # Client browser
│   │   └── server.ts     # Server component client
│   ├── utils.ts          # Utility functions
│   ├── types.ts          # Type definitions
│   └── form-utils.ts     # Form utilities
├── hooks/                # Custom React hooks
│   ├── useAuth.ts        # Hook autenticazione
│   ├── useStats.ts       # Hook statistiche
│   └── useRealtime.ts    # Hook real-time updates
├── supabase/            # Database migrations
│   └── migrations/      # File SQL migrazioni
├── docs/                # Documentazione
└── public/              # Asset statici
```

### Convenzioni di Naming
- **File**: PascalCase per componenti (`TesseratoForm.tsx`)
- **Cartelle**: kebab-case (`tesserati-squadre`)
- **Variabili**: camelCase (`tesseratoData`)
- **Costanti**: UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)

## 🛠 Workflow di Sviluppo

### Comandi Principali
```bash
# Sviluppo locale
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build (OBBLIGATORIO prima di ogni commit)
npm run build

# Start produzione locale
npm start
```

### ⚠️ Regola d'Oro: SEMPRE BUILD PRIMA DI COMMIT
```bash
# Workflow obbligatorio prima di ogni commit/push
npm run type-check  # Controlla errori TypeScript
npm run lint       # Controlla code style
npm run build      # DEVE passare senza errori

# Solo se tutto passa:
git add .
git commit -m "feat: your message"
git push
```

### Branch Strategy
- **`main`/`master`**: Branch produzione (protected)
- **`develop`**: Branch sviluppo principale
- **`feature/nome-feature`**: Branch per nuove funzionalità
- **`fix/descrizione-fix`**: Branch per bugfix

### Commit Message Conventions
```bash
# Formato: tipo(scope): descrizione
feat(tesserati): add bulk import functionality
fix(auth): resolve login redirect issue
docs(readme): update setup instructions
style(ui): improve responsive design
refactor(database): optimize queries performance
test(presenze): add unit tests for presence tracking
```

## 🎨 Sviluppo Frontend

### Stack Tecnologico
- **Next.js 14** con App Router
- **TypeScript** strict mode
- **Tailwind CSS** per styling
- **Lucide React** per icone
- **React Hook Form** per form
- **date-fns** per gestione date

### Componenti UI Base
Il progetto usa una selezione di componenti da **shadcn/ui**:
```bash
# Componenti installati
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
npx shadcn-ui@latest add table
```

### Pattern Componenti
```typescript
// Esempio pattern componente tipico
interface TesseratoCardProps {
  tesserato: Tesserato
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export const TesseratoCard: React.FC<TesseratoCardProps> = ({
  tesserato,
  onEdit,
  onDelete
}) => {
  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>{tesserato.nome} {tesserato.cognome}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Contenuto */}
      </CardContent>
      <CardFooter>
        {/* Azioni */}
      </CardFooter>
    </Card>
  )
}
```

### Gestione State
```typescript
// Pattern per state management locale
const [tesserati, setTesserati] = useState<Tesserato[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

// Pattern per caricamento dati
useEffect(() => {
  const loadTesserati = async () => {
    try {
      setLoading(true)
      const data = await getTesserati()
      setTesserati(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally {
      setLoading(false)
    }
  }
  loadTesserati()
}, [])
```

## 🗃 Sviluppo Backend/Database

### Client Supabase
```typescript
// lib/supabase/client.ts - Client browser
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

// lib/supabase/server.ts - Server components
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const createServerSupabaseClient = () => {
  return createServerComponentClient({ cookies })
}
```

### Pattern Query Database
```typescript
// Esempio query tipica
const getTesserati = async (stagioneId: string) => {
  const { data, error } = await supabase
    .from('tesserati')
    .select(`
      *,
      tesserati_dati_stagionali(
        stato_pagamento,
        visita_sportiva,
        scadenza_certificato
      )
    `)
    .eq('tesserati_dati_stagionali.stagione_id', stagioneId)
    .eq('stato', true)
    .order('cognome')

  if (error) {
    console.error('Query error:', error)
    throw new Error('Errore nel caricamento tesserati')
  }

  return data
}
```

### Gestione Errori Database
```typescript
// Pattern per gestione errori Supabase
const handleSupabaseError = (error: any) => {
  if (error.code === '23505') {
    return 'Elemento già esistente'
  }
  if (error.code === '23503') {
    return 'Violazione integrità referenziale'
  }
  return error.message || 'Errore database'
}
```

## 🔐 Autenticazione e Sicurezza

### Hook useAuth
```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        await loadProfile(session.user.id)
      }
      setLoading(false)
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  return { user, profile, loading }
}
```

### Protezione Route
```typescript
// Pattern per route protette
const ProtectedPage = () => {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return null
  }

  return <PageContent />
}
```

### Controllo Permessi
```typescript
// lib/permissions.ts
export const hasPermission = (
  userRole: string,
  action: string,
  resource: string
): boolean => {
  const permissions = {
    admin: ['*'],
    dirigente: ['read:*', 'write:tesserati', 'write:squadre'],
    allenatore: ['read:*', 'write:presenze'],
    tesserato: ['read:own'],
    genitore: ['read:children']
  }

  const userPermissions = permissions[userRole] || []
  return userPermissions.includes('*') || 
         userPermissions.includes(`${action}:${resource}`)
}
```

## 📱 Responsive Design

### Breakpoints Tailwind
```css
/* Breakpoints utilizzati */
sm: 640px   /* Smartphone landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop small */
xl: 1280px  /* Desktop large */
2xl: 1536px /* Desktop extra large */
```

### Pattern Responsive
```typescript
// Esempio component responsive
const ResponsiveTable = () => {
  return (
    <div className="overflow-x-auto">
      {/* Desktop: Table normale */}
      <table className="hidden md:table w-full">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Squadra</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {/* Righe tabella */}
        </tbody>
      </table>

      {/* Mobile: Cards */}
      <div className="md:hidden space-y-4">
        {items.map(item => (
          <Card key={item.id} className="p-4">
            {/* Layout mobile */}
          </Card>
        ))}
      </div>
    </div>
  )
}
```

## 🧪 Testing e Qualità del Codice

### TypeScript Best Practices

#### Gestione Null/Undefined
```typescript
// ❌ Evita
const handleData = (data: string | null | undefined) => {
  // TypeScript error possibile
}

// ✅ Usa nullish coalescing
const handleData = (data: string | null | undefined) => {
  const safeData = data ?? ''
  // Ora safeData è sempre string
}
```

#### Type Guards
```typescript
// Pattern per type narrowing
const isValidTesserato = (data: any): data is Tesserato => {
  return data && 
         typeof data.nome === 'string' && 
         typeof data.cognome === 'string'
}

// Utilizzo
if (isValidTesserato(userData)) {
  // TypeScript sa che userData è Tesserato
  console.log(userData.nome)
}
```

#### Gestione Form Data
```typescript
// Pattern per form data type-safe
interface TesseratoFormData {
  nome: string
  cognome: string
  email: string | null
  telefono: string | null
}

const handleSubmit = (formData: TesseratoFormData) => {
  // Conversione per database
  const dbData = {
    nome: formData.nome,
    cognome: formData.cognome,
    email: formData.email || null,
    telefono: formData.telefono || null
  }
  
  // Salva nel database
  saveTesserato(dbData)
}
```

### Linting Configuration
```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "no-unused-vars": "error",
    "prefer-const": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

## 🚀 Deployment

### Vercel Deployment
Il progetto è configurato per auto-deploy su Vercel:

1. **Push su main** → Deploy automatico produzione
2. **Push su branch** → Deploy preview
3. **Pull Request** → Deploy preview con commento

### Environment Variables Vercel
Configura su Vercel Dashboard:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://ctrsnztrfslewkpbfxei.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon_key]
SUPABASE_SERVICE_ROLE_KEY=[service_role_key]
NEXT_PUBLIC_APP_URL=https://virpolcampogalliano.vercel.app/
```

### Build Optimization
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['ctrsnztrfslewkpbfxei.supabase.co'],
  },
  typescript: {
    // Non ignorare errori TypeScript in build
    ignoreBuildErrors: false,
  },
  eslint: {
    // Non ignorare errori ESLint in build
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig
```

## 🐛 Debugging

### Logging Patterns
```typescript
// Pattern per logging strutturato
const DEBUG_PREFIX = '[TesseratiPage]'

const loadTesserati = async () => {
  console.log(`${DEBUG_PREFIX} Loading tesserati...`)
  try {
    const data = await getTesserati()
    console.log(`${DEBUG_PREFIX} Loaded ${data.length} tesserati`)
    return data
  } catch (error) {
    console.error(`${DEBUG_PREFIX} Error loading tesserati:`, error)
    throw error
  }
}
```

### Debug Supabase Queries
```typescript
// Abilita debug query
const { data, error } = await supabase
  .from('tesserati')
  .select('*')
  .eq('stato', true)
  
console.log('Supabase query result:', { data, error })
```

### Browser DevTools
- **Network Tab**: Verifica chiamate API Supabase
- **Console**: Controlla errori JavaScript
- **Application**: Verifica localStorage/sessionStorage
- **Sources**: Debug con breakpoints

## 📋 Checklist Sviluppo

### Prima di ogni Feature
- [ ] Analizzare requisiti
- [ ] Progettare database changes (se necessari)
- [ ] Creare/aggiornare tipi TypeScript
- [ ] Implementare componenti UI
- [ ] Implementare logica business
- [ ] Testare manualmente
- [ ] Verificare responsive design
- [ ] Controllare performance

### Prima di ogni Commit
- [ ] `npm run type-check` senza errori
- [ ] `npm run lint` senza errori
- [ ] `npm run build` con successo
- [ ] Test manuale funzionalità
- [ ] Commit message descrittivo

### Prima di ogni Release
- [ ] Aggiornare documentazione
- [ ] Verificare migrations database
- [ ] Test completo in staging
- [ ] Backup database produzione
- [ ] Deploy graduale
- [ ] Monitoraggio post-deploy

## 🔧 Tools e Extensions Raccomandati

### VS Code Extensions
- **ES7+ React/Redux/React-Native snippets**
- **TypeScript Importer**
- **Tailwind CSS IntelliSense**
- **Auto Rename Tag**
- **Bracket Pair Colorizer**
- **GitLens**
- **Thunder Client** (per test API)

### Configurazione VS Code
```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  }
}
```

### Package.json Scripts Utili
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "pre-commit": "npm run type-check && npm run lint && npm run build"
  }
}
```

## 🏆 Best Practices Riassunto

1. **Sempre type-safe**: Usa TypeScript in modalità strict
2. **Build prima di commit**: Zero errori in build
3. **Nomenclatura consistente**: Segui convenzioni progetto
4. **Gestione errori**: Sempre catch e handle errori
5. **Performance**: Ottimizza query e componenti
6. **Sicurezza**: Valida input e usa RLS
7. **Responsive**: Design mobile-first
8. **Documentazione**: Mantieni docs aggiornati
9. **Testing**: Testa manualmente ogni feature
10. **Monitoring**: Monitora performance e errori