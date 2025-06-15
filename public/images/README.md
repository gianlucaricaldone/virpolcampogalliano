# 📸 Gestione Immagini - Virpol Campogalliano

## 📁 Struttura Directory

```
/public/images/
├── home/           # Immagini per la homepage
├── players/        # Foto giocatori e staff
├── gallery/        # Galleria eventi e partite
├── icons/          # Icone e loghi vettoriali
├── teams/          # Foto squadre e formazioni
└── tournaments/    # Immagini tornei e competizioni
```

## 🏠 **Home Page Images**

### Cartella: `/public/images/home/`

**Immagini principali da aggiungere:**

- `hero-background.jpg` - Immagine hero principale (1920x1080px)
- `virpol-logo.png` - Logo principale Virpol (trasparente)
- `campo-principale.jpg` - Foto del campo principale
- `squadra-2024.jpg` - Foto di squadra stagione corrente
- `about-bg.jpg` - Sfondo sezione "Chi Siamo"

**Utilizzo nel codice:**
```tsx
import Image from 'next/image'

<Image 
  src="/images/home/hero-background.jpg" 
  alt="Campo Virpol Campogalliano"
  width={1920}
  height={1080}
  priority
/>
```

## 👥 **Players Images**

### Cartella: `/public/images/players/`

**Convenzione nomi:**
- `{cognome-nome}.jpg` (es: `rossi-mario.jpg`)
- `staff-{ruolo}-{cognome}.jpg` (es: `staff-allenatore-bianchi.jpg`)

## 🖼️ **Gallery Images**

### Cartella: `/public/images/gallery/`

**Organizzazione:**
- `partita-{data}-{avversario}.jpg`
- `evento-{nome}-{data}.jpg`
- `allenamento-{data}.jpg`

## 🏆 **Teams & Tournaments**

### Cartella: `/public/images/teams/`
- Foto formazioni per categoria
- `{categoria}-{anno}.jpg`

### Cartella: `/public/images/tournaments/`
- Loghi tornei
- Foto premiazioni
- Classifiche e risultati

## 🎨 **Icons & Logos**

### Cartella: `/public/images/icons/`

**File da aggiungere:**
- `logo-virpol.svg` - Logo vettoriale
- `favicon.ico` - Favicon del sito
- `trophy.svg` - Icona trofeo
- `ball.svg` - Icona pallone
- `calendar.svg` - Icona calendario

## 📐 **Linee Guida Tecniche**

### **Formati Consigliati:**
- **JPEG**: Foto e immagini fotografiche
- **PNG**: Loghi con trasparenza
- **SVG**: Icone e grafiche vettoriali
- **WebP**: Alternativa moderna (ottimizzazione)

### **Dimensioni Suggerite:**
- **Hero Images**: 1920x1080px
- **Foto Giocatori**: 400x400px (quadrate)
- **Galleria**: 800x600px
- **Loghi**: 200x200px (PNG trasparente)

### **Ottimizzazione:**
- Comprimi le immagini prima dell'upload
- Usa Next.js Image component per lazy loading
- WebP per browser moderni

## 🔗 **Esempi di Utilizzo**

```tsx
// Hero Image
<Image 
  src="/images/home/hero-background.jpg"
  alt="Campo Virpol"
  fill
  className="object-cover"
  priority
/>

// Logo
<Image 
  src="/images/home/virpol-logo.png"
  alt="Logo Virpol Campogalliano"
  width={200}
  height={100}
/>

// Foto Giocatore
<Image 
  src="/images/players/rossi-mario.jpg"
  alt="Mario Rossi"
  width={400}
  height={400}
  className="rounded-full"
/>

// Icona SVG
<Image 
  src="/images/icons/trophy.svg"
  alt="Trofeo"
  width={24}
  height={24}
/>
```

## 📱 **Responsive Images**

```tsx
// Per immagini responsive
<Image 
  src="/images/home/hero-background.jpg"
  alt="Hero"
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  fill
/>
```

## 🚀 **Prossimi Passi**

1. Aggiungi le immagini nelle rispettive cartelle
2. Aggiorna la homepage per usare le nuove immagini
3. Implementa lazy loading per performance
4. Configura ottimizzazione automatica