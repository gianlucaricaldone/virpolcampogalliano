# Virpol Campogalliano - Sistema Gestionale

Sistema gestionale completo per la società sportiva Virpol Campogalliano, sviluppato con Next.js 14, Supabase e Tailwind CSS.

## 🚀 Tecnologie Utilizzate

- **Next.js 14+** con App Router e Server Components
- **TypeScript** per type safety
- **Tailwind CSS** + shadcn/ui per UI components
- **Supabase** per autenticazione e database PostgreSQL
- **React Hook Form** + Zod per validazione form
- **Tanstack Query** per data fetching
- **Vercel** per hosting

## 📋 Funzionalità Principali

### Area Pubblica
- Homepage con informazioni società
- Pagine squadre con roster
- Calendario partite e risultati
- Sezione tornei con iscrizioni online

### Area Autenticata (Dashboard)
- **Admin**: Gestione completa del sistema
- **Dirigenti**: Gestione tesserati e pagamenti
- **Allenatori**: Presenze, convocazioni e partite
- **Tesserati/Genitori**: Visualizzazione dati personali

### Moduli Specializzati
- Sistema presenze digitale
- Gestione calendario campi
- Magazzino con QR code
- Area economica (solo admin)
- Modulo tornei esterni

## 🏗️ Architettura

```
/app
├── (public)/           # Pagine pubbliche
├── auth/              # Autenticazione
├── dashboard/         # Area autenticata
└── admin/            # Area amministrativa

/components
├── ui/               # Componenti base (shadcn)
├── forms/            # Form components
└── tables/           # Tabelle dati

/lib
├── supabase/         # Client Supabase
└── utils.ts          # Utility functions

/types
└── database.ts       # Tipi TypeScript per database

/hooks
└── useAuth.ts        # Hook autenticazione
```

## 🗄️ Schema Database

### Tabelle Principali
- `users` - Utenti con ruoli (admin, dirigente, allenatore, tesserato, genitore)
- `squadre` - Squadre della società
- `tesserati` - Anagrafica atleti con documenti
- `presenze` - Registro presenze allenamenti/partite
- `partite` - Calendario partite e risultati
- `magazzino` - Inventario materiale sportivo
- `eventi_economici` - Gestione economia (solo admin)

### Row Level Security (RLS)
Implementate policy di sicurezza per:
- Accesso dati basato su ruolo utente
- Protezione area economica (solo admin)
- Visibilità dati squadra per allenatori

## 🛠️ Setup Sviluppo

1. **Clona il repository**
```bash
git clone [repository-url]
cd virpol-campogalliano
```

2. **Installa dipendenze**
```bash
npm install
```

3. **Configura Supabase**
```bash
cp .env.local.example .env.local
# Aggiungi le tue chiavi Supabase
```

4. **Esegui migrazioni database**
```sql
-- Esegui i file in supabase/migrations/ sul tuo progetto Supabase
```

5. **Avvia server di sviluppo**
```bash
npm run dev
```

## 📱 PWA Features

- Installabile su dispositivi mobili
- Offline per consultazione dati
- Scanner QR integrato per magazzino
- Push notifications per convocazioni

## 🔐 Gestione Ruoli

### Admin
- Accesso completo al sistema
- Gestione utenti e permessi
- Vista economica eventi
- Report e statistiche globali

### Dirigente
- Gestione anagrafica tesserati
- Monitoraggio pagamenti
- Alert scadenze documenti
- Vista parziale magazzino

### Allenatore
- Registro presenze squadra
- Convocazioni partite
- Prenotazione campi
- Vista materiale assegnato

### Tesserato/Genitore
- Visualizzazione presenze
- Calendario partite
- Documenti personali
- Stato pagamenti

## 🚀 Deploy

Il progetto è configurato per deploy automatico su Vercel:

1. **Collega repository a Vercel**
2. **Configura variabili ambiente**
3. **Deploy automatico su push**

## 📊 Performance

- Image optimization con next/image
- Lazy loading componenti
- Database indexes ottimizzati
- Caching aggressive con Tanstack Query

## 🔧 Comandi Utili

```bash
# Sviluppo
npm run dev

# Build produzione
npm run build

# Lint e type check
npm run lint
npm run type-check

# Start produzione
npm start
```

## 📄 Licenza

© 2024 Virpol Campogalliano - Tutti i diritti riservati

## 🎨 Design e UI Ultra-Moderni

### 🌟 Homepage di Nuova Generazione
- **Hero Section Parallax** a schermo intero con effetto profondità
- **Navigazione Sticky Trasparente** che diventa opaca allo scroll
- **Animazioni Fluide** con Intersection Observer per fade-in sequenziali
- **Contatori Animati** che si attivano quando entrano in vista
- **Effetti Hover 3D** su card con rotazioni e ombre dinamiche
- **Glassmorphism** e backdrop blur per effetti moderni
- **Scroll Smooth** con indicatori animati

### 🎯 Sistema di Animazioni Avanzato
- **AnimatedSection Component** con detection viewport
- **Parallax Backgrounds** per sezioni immersive  
- **Micro-interazioni** su tutti gli elementi interattivi
- **Loading States** e transizioni fluide
- **Hover Effects** con transform e scale dinamici
- **Gradient Animations** per testi e sfondi

### 🚀 Componenti Interattivi
- **Modern Header** con logo animato e menu responsive
- **Counter Animations** con easing personalizzato
- **Card System** con hover lift e glow effects
- **Button Variants** con gradienti e shadow effects
- **Back to Top** button che appare dinamicamente

### 🎨 Schema Colori Sportivo
- **Verde Campo**: Primario per natura sportiva
- **Blu Royal**: Accenti per professionalità  
- **Gradienti Dinamici**: Verde-Blu per modernità
- **Bianco/Grigio**: Base pulita e leggibile
- **Effetti Glow**: Per evidenziare elementi chiave

### 📱 Design Responsive Avanzato
- **Mobile-First Approach** ottimizzato per tutti i dispositivi
- **Breakpoints Fluidi** per transizioni perfette
- **Touch-Friendly** con gesture e swipe support
- **Performance Optimized** con lazy loading e animations

---

**Stato Sviluppo:**
- ✅ Setup progetto Next.js 14 + TypeScript + Tailwind
- ✅ Schema database Supabase completo con RLS
- ✅ Sistema autenticazione e gestione ruoli avanzato
- ✅ **Homepage Ultra-Moderna** con parallax e animazioni
- ✅ **Navigation Sticky Trasparente** con effetti scroll
- ✅ **Sistema Animazioni** con Intersection Observer
- ✅ **Contatori Animati** e micro-interazioni
- ✅ **Card Hover 3D** e effetti glassmorphism
- ✅ **Design Responsive Avanzato** mobile-first
- ✅ **Componenti Riutilizzabili** modulari e configurabili
- ✅ Pagine pubbliche complete e ottimizzate
- ✅ Performance optimize con lazy loading
- 🔄 Dashboard per ruolo utente
- ⏳ Moduli specializzati (presenze, magazzino)  
- ⏳ PWA e ottimizzazioni avanzate

🎨 **Design Moderno Implementato:**
- Hero section parallax full-screen
- Navigazione dinamica con backdrop blur
- Animazioni fluide con easing personalizzato
- Schema colori sportivo (verde campo + blu royal)
- Effetti hover 3D e micro-interazioni
- Layout responsive con breakpoints ottimizzati
- Performance ottimizzate per Core Web Vitals