# 🏠 Immagini Necessarie per Homepage

## 📸 **Immagini Prioritarie da Aggiungere**

### 1. **hero-background.jpg** ⭐ PRIORITÀ ALTA
- **Dimensioni**: 1920x1080px (Full HD)
- **Formato**: JPG (ottimizzato, max 500KB)
- **Contenuto**: Foto panoramica del campo principale di Virpol Campogalliano
- **Note**: Sarà usata come sfondo della sezione hero con overlay scuro

### 2. **virpol-logo.png** ⭐ PRIORITÀ ALTA  
- **Dimensioni**: 200x200px o superiore
- **Formato**: PNG (con trasparenza)
- **Contenuto**: Logo ufficiale Virpol Campogalliano
- **Note**: Sostituirà le iniziali "VC" nel cerchio hero

### 3. **campo-principale.jpg** 🔥 IMPORTANTE
- **Dimensioni**: 800x600px
- **Formato**: JPG
- **Contenuto**: Vista del campo da bordo campo o tribune
- **Note**: Per sezione "Chi Siamo" o galleria

### 4. **squadra-2024.jpg** 🔥 IMPORTANTE
- **Dimensioni**: 1200x800px
- **Formato**: JPG
- **Contenuto**: Foto di squadra stagione corrente 2024
- **Note**: Per sezione squadre o about

### 5. **about-bg.jpg** 📷 OPZIONALE
- **Dimensioni**: 1920x600px 
- **Formato**: JPG
- **Contenuto**: Sfondo per sezione "Chi Siamo"
- **Note**: Può essere interno spogliatoi, tribune, o campo

## 🎯 **Come Aggiungere le Immagini**

1. **Rinomina** i file esattamente come indicato sopra
2. **Inserisci** in `/public/images/home/`
3. **Ottimizza** le dimensioni (usa tools come TinyPNG)
4. **Aggiorna** il codice decommentando le sezioni Image

## 📱 **Immagini per Sezioni Specifiche**

### Hero Section
```
/images/home/hero-background.jpg  → Sfondo parallax
/images/home/virpol-logo.png      → Logo nel cerchio
```

### Chi Siamo
```
/images/home/about-bg.jpg         → Sfondo sezione
/images/home/campo-principale.jpg → Immagine campo
```

### Squadre Preview
```
/images/home/squadra-2024.jpg     → Foto squadra principale
```

## 🔄 **Stato Attuale**

- ✅ Struttura cartelle creata
- ✅ Codice usa immagini Unsplash temporanee
- ⏳ Immagini da aggiungere
- ⏳ Codice da aggiornare dopo upload

## 📝 **Note Tecniche**

- Le immagini sono configurate con **fallback** a Unsplash
- Il sito funziona anche **senza immagini locali**
- **Next.js Image** component ottimizza automaticamente
- **Lazy loading** attivo per performance

## 🚀 **Dopo l'Upload**

Aggiorna il backgroundImage in app/page.tsx:

```tsx
// Cambia da:
backgroundImage="https://images.unsplash.com/photo-..."

// A:
backgroundImage="/images/home/hero-background.jpg"
```