# Troubleshooting Autenticazione Mobile

## Problema
L'autenticazione funziona su desktop ma su mobile restituisce `otp_expired` e riporta al login.

## Cause Possibili

### 1. **Configurazione Supabase**
- **Site URL** non configurato correttamente
- **Redirect URLs** mancanti per mobile
- **Timeout OTP** troppo corto per mobile

### 2. **Problemi di Rete Mobile**
- Connessioni mobili più lente
- Proxy carrier che modificano headers
- Cache aggressive sui dispositivi mobili

### 3. **Problemi di Timing**
- L'utente apre l'email dopo che l'OTP è scaduto
- Differenze di fuso orario
- Clock del dispositivo non sincronizzato

## Soluzioni Implementate

### 1. **Miglioramento Callback Auth**
```typescript
// app/auth/callback/route.ts
- Logging dettagliato di tutti i parametri
- Gestione esplicita degli errori OTP
- Fallback per diversi tipi di errore
```

### 2. **Miglioramento Login**
```typescript
// app/auth/login/page.tsx
- Gestione errori più dettagliata
- Messaggio chiaro per OTP scaduto
- shouldCreateUser: false per sicurezza
```

### 3. **Middleware Robusto**
```typescript
// middleware.ts
- Logging per debug
- Redirect automatici più intelligenti
- Prevenzione loop di redirect
```

## Configurazione Supabase Richiesta

### Dashboard Supabase → Authentication → Settings

1. **Site URL**:
   ```
   https://virpolcampogalliano.vercel.app
   ```

2. **Redirect URLs**:
   ```
   https://virpolcampogalliano.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```

3. **Disable signup**: ✅ Enabled (solo admin può creare utenti)

4. **Email Auth Settings**:
   - **OTP expiry**: 3600 secondi (1 ora)
   - **Rate limit**: 60 richieste/ora per IP

## Test Mobile

### Per Testare su Mobile:
1. Aprire la pagina login su mobile
2. Inserire email esistente nel sistema
3. Controllare i log in Vercel/browser console
4. Verificare che l'email arrivi entro 2-3 minuti
5. Cliccare il link dall'app email nativa (non browser)

### Debug Steps:
1. **Controllare Network Tab**: Verificare che le richieste non vengano bloccate
2. **Controllare Console Logs**: Cercare messaggi [Auth Callback] e [Middleware]
3. **Testare Email App**: Aprire link da Gmail/Apple Mail invece che browser
4. **Verificare Orario**: Assicurarsi che il dispositivo abbia orario corretto

## Workaround se il Problema Persiste

### Opzione 1: Password Auth (Backup)
Aggiungere autenticazione con password come fallback:
```typescript
// In aggiunta al magic link, permettere anche password
await supabase.auth.signInWithPassword({
  email,
  password
})
```

### Opzione 2: App Mobile Dedicata
Considerare un'app mobile nativa per miglior controllo dell'auth flow.

### Opzione 3: Increase OTP Timeout
Nelle impostazioni Supabase, aumentare il timeout OTP a 2-3 ore per utenti mobile.

## Monitoring

### Log da Monitorare:
```bash
# Vercel Logs
[Auth Callback] URL: ...
[Auth Callback] Error code: otp_expired
[Middleware] No session for dashboard

# Browser Console
[Login] Attempting login for: user@example.com
[Login] Redirect URL: https://virpolcampogalliano.vercel.app/auth/callback
```

### Metriche da Tracciare:
- Successo login Desktop vs Mobile
- Tempo tra invio email e click link
- Errori per tipo di dispositivo
- Retry rate per OTP scaduto

## Contatti per Supporto
Se il problema persiste, controllare:
1. Configurazione DNS e SSL
2. Headers HTTP su mobile vs desktop
3. User-Agent blocking in Supabase
4. Rate limiting per IP mobile/carrier