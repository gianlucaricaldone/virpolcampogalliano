# CLAUDE.md - Virpol Campogalliano Project Context

## Project Overview
Sistema gestionale completo per la società sportiva Virpol Campogalliano, costruito con Next.js 14, TypeScript, Supabase e Tailwind CSS.

## Key Information

### Environment Setup
- **Database**: Supabase (https://ctrsnztrfslewkpbfxei.supabase.co)
- **Environment Variables**: Stored in `.env.local` (not `.env.local.example`)
- **Required env vars**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Database Schema
- Main tables: `users`, `squadre`, `tesserati`, `presenze`, `partite`, `convocazioni`, `campi`, `calendario_campi`, `tornei`, `iscrizioni_torneo`, `magazzino`, `assegnazioni_materiale`, `eventi_economici`, `movimenti_economici`
- User roles: `admin`, `dirigente`, `allenatore`, `tesserato`, `genitore`
- RLS policies are enabled on all tables

### Known Issues & Solutions

1. **Supabase Configuration Error**
   - Error: `{message: 'Supabase not configured'}`
   - Solution: Ensure `.env.local` file exists (not `.env.local.example`)

2. **RLS Recursion Error**
   - Error: `infinite recursion detected in policy for relation "users"`
   - Solution: Simplified policy in `002_rls_policies.sql` to avoid recursion

3. **Auth User Profile Creation**
   - Issue: Auth users created without corresponding profile in `users` table
   - Solution: Created trigger in `003_auth_trigger.sql` to auto-create profiles

4. **Dashboard Loading Issues**
   - Symptom: Infinite "Caricamento..." on dashboard
   - Debugging: Check console for `[useAuth]` prefixed logs
   - Common cause: Missing user profile in `users` table

5. **Hydration Errors**
   - Error: "Hydration failed because the initial UI does not match"
   - Solution: Ensure consistent loading states between server and client

### UI Components
- **Header**: Using `ModernHeader` component (not the basic `Header`)
- **Navigation**: Desktop uses hover dropdowns, mobile uses click-to-expand
- **Styling**: Gradient effects (green-600 to blue-600), modern design

### Development Commands
```bash
# Start development server
npm run dev

# Run type checking
npm run typecheck

# Run linting
npm run lint
```

### Testing Credentials
- Default role for new users: `tesserato`
- To make admin: `UPDATE public.users SET role = 'admin' WHERE email = 'your-email@example.com';`

### API Endpoints
- Supabase REST API: `https://ctrsnztrfslewkpbfxei.supabase.co/rest/v1/`
- Example query: `/tesserati?select=id&stato=eq.true` (note: boolean values, not strings)

### Current Status
- Authentication system: Working with Supabase Auth
- Dashboard: Requires authenticated user with profile in `users` table
- RLS policies: Fixed recursion issue, all tables protected
- UI: Modern responsive design with animations

### Debug Tips
1. Always check browser console for errors
2. Look for `[useAuth]` prefixed logs when debugging auth issues
3. Verify user exists in both `auth.users` and `public.users` tables
4. Check Network tab for failed Supabase requests
5. Ensure environment variables are loaded (not undefined)

### Recent Changes
- Simplified Supabase client to remove mock system
- Added detailed logging to useAuth hook
- Fixed RLS policies to prevent recursion
- Added auth trigger for automatic profile creation
- Updated navigation with Tornei submenu

## TypeScript Best Practices per Build Vercel

### Errori Comuni e Soluzioni

1. **Errore: `Argument of type 'string | null | undefined' is not assignable to parameter of type 'string | null'`**
   - **Causa**: Le funzioni accettano `string | null` ma ricevono `string | null | undefined`
   - **Soluzione**: Usa il nullish coalescing operator `??` invece di optional chaining quando passi parametri
   ```typescript
   // ❌ Sbagliato
   isCertificateExpiring(tesserato.dati_stagionali?.scadenza_certificato)
   
   // ✅ Corretto
   isCertificateExpiring(tesserato.dati_stagionali?.scadenza_certificato ?? null)
   ```

2. **Gestione Form Data**
   - **Regola**: Inizializza i campi opzionali con `null` invece di stringa vuota
   - **Usa type safety per form data**:
   ```typescript
   interface FormData {
     telefono: string | null
     email: string | null
   }
   
   // Inizializzazione corretta
   const [formData, setFormData] = useState<FormData>({
     telefono: tesserato?.telefono ?? null,
     email: tesserato?.email ?? null
   })
   ```

3. **Conversione Stringhe Vuote**
   - **Crea utility functions dedicate**:
   ```typescript
   const toNullableString = (value: string): string | null => 
     value.trim() === '' ? null : value
   
   const toNullableNumber = (value: string): number | null => {
     const num = Number(value)
     return isNaN(num) ? null : num
   }
   ```

4. **Evita Type Casting con `as any`**
   - **Definisci tipi union espliciti**:
   ```typescript
   type UserRole = 'admin' | 'dirigente' | 'allenatore' | 'vice_allenatore' | 'tesserato' | 'genitore'
   
   // Type guard
   const isValidRole = (role: string): role is UserRole => {
     const validRoles: UserRole[] = ['admin', 'dirigente', 'allenatore', 'vice_allenatore', 'tesserato', 'genitore']
     return validRoles.includes(role as UserRole)
   }
   ```

5. **Gestione Errori**
   - **Non usare `catch (error: any)`**:
   ```typescript
   // ✅ Corretto
   catch (error) {
     console.error(error instanceof Error ? error.message : 'Unknown error')
   }
   ```

6. **Optional Properties nei Tipi Database**
   - **Sii esplicito con undefined vs null**:
   ```typescript
   interface DatiStagionali {
     scadenza_certificato: string | null  // NON string | null | undefined
   }
   ```

### Regole da Seguire

1. **Prima di ogni build**:
   ```bash
   npm run typecheck
   npm run lint
   ```

2. **Quando usi optional chaining (`?.`)**:
   - Se il risultato deve essere passato a una funzione, usa `?? null`
   - Non lasciare mai che `undefined` si propaghi implicitamente

3. **Per i form**:
   - Definisci sempre tipi espliciti per FormData
   - Usa `null` per campi vuoti, non stringhe vuote
   - Crea funzioni di conversione riutilizzabili

4. **Per le funzioni di validazione**:
   - Usa type predicates per type narrowing
   - Gestisci esplicitamente null e undefined

5. **Per Supabase queries**:
   - I campi nullable del database devono essere tipizzati come `T | null`, non `T | null | undefined`

### Utility Functions per Form

Usa sempre le utility functions in `lib/form-utils.ts` per gestire conversioni tra form e database:

```typescript
import { databaseToFormValues, formToDatabaseValues, validateFormData } from '@/lib/form-utils'

// Conversione da database a form
const formData = databaseToFormValues(dbData)

// Validazione e conversione per salvataggio
const validation = validateFormData(formData, schema)
if (validation.success) {
  await saveToDatabase(validation.data)
}
```

### Pattern Corretti per SetStateAction

Quando usi `setState` con mapping di array, assicurati che i tipi corrispondano:

```typescript
// ❌ Sbagliato - tipo database ha campi nullable ma interfaccia form no
interface FormItem {
  nome: string
}
setState(dbItems.map(item => ({ nome: item.nome }))) // Error se item.nome è string | null

// ✅ Corretto - gestisci i nullable
interface FormItem {
  nome: string | null
}
// oppure
setState(dbItems.map(item => ({ nome: item.nome ?? '' })))
```