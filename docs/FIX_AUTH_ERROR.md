# Fix per l'errore "Database error saving new user"

## Problema
Quando un utente con email già esistente nella tabella `public.users` tenta di fare login tramite OTP (One-Time Password), riceve l'errore "Database error saving new user".

## Causa
Il problema è causato da conflitti tra multipli trigger che gestiscono la creazione di profili utente:

1. **Migration 001** crea un trigger `on_auth_user_created` basilare
2. **Migration 003** ricrea lo stesso trigger con logica diversa
3. **Migration 008** aggiunge un altro trigger `on_auth_user_created_link_profile`

Questi trigger entrano in conflitto quando:
- Un utente è stato creato manualmente nella tabella `public.users` (es. da admin)
- Lo stesso utente prova a fare login per la prima volta
- Il sistema tenta di creare un nuovo profilo ma fallisce perché l'email esiste già

## Soluzione

### 1. Applica le nuove migration

```bash
# Nella dashboard di Supabase, vai su SQL Editor ed esegui in ordine:

# Migration 018 - Risolve i conflitti tra trigger
supabase/migrations/018_fix_auth_trigger_conflicts.sql

# Migration 019 - Pulisce eventuali duplicati
supabase/migrations/019_cleanup_duplicate_users.sql
```

### 2. Verifica lo stato del database

Esegui lo script di debug per verificare la situazione:

```sql
-- In Supabase SQL Editor, esegui:
scripts/debug-auth-issue.sql
```

### 3. Come funziona la nuova logica

Il nuovo trigger unificato `handle_auth_user_created()`:

1. **Verifica se esiste già un profilo** con la stessa email
2. **Se esiste e non ha mai fatto login** (`has_logged_in = false`):
   - Aggiorna l'ID del profilo per collegarlo all'account auth
   - Imposta `has_logged_in = true`
3. **Se non esiste**, crea un nuovo profilo
4. **Gestisce le eccezioni** in caso di race condition

### 4. Test della soluzione

1. Prova a fare login con un'email esistente
2. Verifica che non ci siano più errori
3. Controlla che l'utente possa accedere al dashboard

### 5. Prevenzione futura

- La migration 019 aggiunge un constraint UNIQUE sull'email
- Questo previene la creazione di profili duplicati
- Gli admin possono ancora creare utenti manualmente, che verranno collegati automaticamente al primo login

## Troubleshooting

Se il problema persiste:

1. **Verifica i log di Supabase**:
   - Dashboard → Logs → Filter by "auth"
   - Cerca errori specifici del trigger

2. **Controlla profili duplicati**:
   ```sql
   SELECT email, COUNT(*) 
   FROM public.users 
   GROUP BY email 
   HAVING COUNT(*) > 1;
   ```

3. **Forza il collegamento manuale**:
   ```sql
   -- Per un utente specifico
   UPDATE public.users 
   SET id = (SELECT id FROM auth.users WHERE email = 'user@example.com')
   WHERE email = 'user@example.com' 
   AND has_logged_in = false;
   ```

## Note importanti

- Non eliminare manualmente record da `auth.users` senza eliminare anche il profilo corrispondente
- Il campo `has_logged_in` aiuta a distinguere tra profili creati manualmente e quelli che hanno effettivamente fatto login
- Le migration sono idempotenti e possono essere rieseguite in sicurezza