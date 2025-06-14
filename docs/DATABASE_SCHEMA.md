# DATABASE_SCHEMA.md - Virpol Campogalliano

## Schema Database Completo

### 🗄 Panoramica Architettura

Il database PostgreSQL su Supabase gestisce l'intero ecosistema di una società sportiva attraverso **21 tabelle principali** con **Row Level Security** completo e **indici ottimizzati** per performance.

## 📊 Tabelle Principali

### 1. SISTEMA UTENTI E AUTENTICAZIONE

#### `users` - Profili Utente
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE,
  role text DEFAULT 'tesserato',
  roles text[] DEFAULT '{}',
  squadra_id uuid[],
  nome text,
  cognome text,
  telefono text,
  has_logged_in boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Ruoli disponibili:**
- `admin` - Accesso completo
- `dirigente` - Gestione squadre e tesserati
- `allenatore` - Gestione squadre assegnate
- `vice_allenatore` - Supporto allenatore
- `tesserato` - Accesso limitato
- `genitore` - Accesso dati figli

#### `tesserati` - Anagrafica Atleti
```sql
CREATE TABLE tesserati (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  cognome text NOT NULL,
  data_nascita date,
  codice_fiscale text UNIQUE,
  codice_cartellino text,
  email text,
  telefono text,
  indirizzo text,
  citta text,
  cap text,
  documento_identita text,
  stato boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 2. SISTEMA STAGIONI SPORTIVE

#### `stagioni_sportive` - Gestione Stagioni
```sql
CREATE TABLE stagioni_sportive (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text UNIQUE NOT NULL,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  attiva boolean DEFAULT false,
  archiviata boolean DEFAULT false,
  descrizione text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_date_logic CHECK (data_fine > data_inizio)
);
```

**Constraint unico stagione attiva:**
```sql
CREATE UNIQUE INDEX idx_stagioni_sportive_single_active 
ON stagioni_sportive(attiva) WHERE (attiva = true);
```

#### `tesserati_dati_stagionali` - Dati per Stagione
```sql
CREATE TABLE tesserati_dati_stagionali (
  tesserato_id uuid REFERENCES tesserati(id) ON DELETE CASCADE,
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  stato_pagamento text DEFAULT 'non_pagato',
  note_pagamento text,
  visita_sportiva boolean DEFAULT false,
  scadenza_certificato date,
  certificato_medico text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tesserato_id, stagione_id),
  CONSTRAINT check_stato_pagamento 
    CHECK (stato_pagamento IN ('pagato', 'non_pagato', 'parziale', 'in_sospeso'))
);
```

### 3. SQUADRE E RELAZIONI

#### `squadre` - Team Sportivi
```sql
CREATE TABLE squadre (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  categoria text NOT NULL,
  annata integer,
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  foto_squadra text,
  allenatore text,
  vice_allenatore_1 text,
  vice_allenatore_2 text,
  dirigente text,
  allenatore_id uuid REFERENCES users(id),
  vice_allenatore_1_id uuid REFERENCES users(id),
  vice_allenatore_2_id uuid REFERENCES users(id),
  dirigente_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `tesserati_squadre_stagioni` - Relazione Many-to-Many
```sql
CREATE TABLE tesserati_squadre_stagioni (
  tesserato_id uuid REFERENCES tesserati(id) ON DELETE CASCADE,
  squadra_id uuid REFERENCES squadre(id) ON DELETE CASCADE,
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  ruolo_squadra text,
  numero_maglia integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (tesserato_id, squadra_id, stagione_id),
  UNIQUE (squadra_id, stagione_id, numero_maglia)
);
```

### 4. PRESENZE E PARTITE

#### `presenze` - Registro Presenze
```sql
CREATE TABLE presenze (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tesserato_id uuid REFERENCES tesserati(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL DEFAULT 'allenamento',
  presente boolean DEFAULT false,
  squadra_id uuid REFERENCES squadre(id),
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipo_presenza 
    CHECK (tipo IN ('allenamento', 'partita', 'torneo', 'evento'))
);
```

#### `partite` - Gestione Match
```sql
CREATE TABLE partite (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  squadra_id uuid REFERENCES squadre(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora time,
  campo text,
  avversario text,
  risultato text,
  tipo_competizione text,
  categoria_avversario_id uuid REFERENCES categorie_avversari(id),
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `convocazioni` - Convocazioni Partite
```sql
CREATE TABLE convocazioni (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  partita_id uuid REFERENCES partite(id) ON DELETE CASCADE,
  tesserato_id uuid REFERENCES tesserati(id) ON DELETE CASCADE,
  stato text DEFAULT 'convocato',
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (partita_id, tesserato_id)
);
```

### 5. SISTEMA MAGAZZINO

#### `magazzino` - Inventario Materiale
```sql
CREATE TABLE magazzino (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo_materiale text NOT NULL,
  nome_articolo text NOT NULL,
  quantita integer NOT NULL DEFAULT 0,
  quantita_iniziale integer NOT NULL DEFAULT 0,
  quantita_minima integer DEFAULT 0,
  categoria text,
  taglia text,
  colore text,
  stato text DEFAULT 'disponibile',
  ubicazione text,
  codice_tracking text UNIQUE,
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `movimenti_magazzino` - Cronologia Movimenti
```sql
CREATE TABLE movimenti_magazzino (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  materiale_id uuid REFERENCES magazzino(id) ON DELETE CASCADE,
  tipo_movimento text NOT NULL,
  quantita integer NOT NULL,
  quantita_prima integer NOT NULL,
  quantita_dopo integer NOT NULL,
  causale text,
  squadra_id uuid REFERENCES squadre(id),
  utente_id uuid REFERENCES users(id),
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipo_movimento 
    CHECK (tipo_movimento IN ('carico', 'scarico', 'assegnazione', 'restituzione', 'rettifica', 'inventario_iniziale'))
);
```

#### `assegnazioni_materiale` - Assegnazioni Squadre
```sql
CREATE TABLE assegnazioni_materiale (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  materiale_id uuid REFERENCES magazzino(id) ON DELETE CASCADE,
  squadra_id uuid REFERENCES squadre(id) ON DELETE CASCADE,
  data_assegnazione date NOT NULL,
  data_restituzione date,
  quantita integer NOT NULL,
  quantita_restituita integer DEFAULT 0,
  stato text DEFAULT 'attiva',
  condizione_restituzione text,
  utente_id uuid REFERENCES users(id),
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_stato_assegnazione 
    CHECK (stato IN ('attiva', 'restituita', 'parziale'))
);
```

### 6. SISTEMA TORNEI

#### `tornei` - Gestione Tornei
```sql
CREATE TABLE tornei (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  data_inizio date,
  data_fine date,
  stato text DEFAULT 'pianificato',
  regolamento jsonb,
  costo_iscrizione decimal(10,2),
  attivo boolean DEFAULT true,
  iscrizioni_aperte boolean DEFAULT true,
  numero_squadre_max integer,
  numero_squadre_iscritte integer DEFAULT 0,
  stagione_id uuid REFERENCES stagioni_sportive(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `iscrizioni_torneo` - Iscrizioni Tornei
```sql
CREATE TABLE iscrizioni_torneo (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  torneo_id uuid REFERENCES tornei(id) ON DELETE CASCADE,
  squadra_id uuid REFERENCES squadre(id) ON DELETE CASCADE,
  data_iscrizione date NOT NULL,
  confermata boolean DEFAULT false,
  documenti jsonb,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (torneo_id, squadra_id)
);
```

### 7. SISTEMA EVENTI

#### `eventi` - Eventi Sociali
```sql
CREATE TABLE eventi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  descrizione text,
  data_evento date NOT NULL,
  luogo text,
  costo_persona decimal(10,2),
  max_partecipanti integer,
  tipologia text DEFAULT 'altro',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipologia_evento 
    CHECK (tipologia IN ('cena', 'altro'))
);
```

#### `prenotazioni_eventi` - Prenotazioni Eventi
```sql
CREATE TABLE prenotazioni_eventi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_id uuid REFERENCES eventi(id) ON DELETE CASCADE,
  nome_partecipante text NOT NULL,
  email text,
  telefono text,
  note text,
  confermato boolean DEFAULT false,
  presente boolean DEFAULT false,
  no_maiale boolean DEFAULT false,
  vegetariano_vegano boolean DEFAULT false,
  celiaco boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 8. SISTEMA ECONOMICO

#### `eventi_economici` - Eventi Finanziari
```sql
CREATE TABLE eventi_economici (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  descrizione text,
  data_evento date NOT NULL,
  tipo text NOT NULL,
  categoria text,
  importo_previsto decimal(10,2),
  stato text DEFAULT 'pianificato',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipo_evento_economico 
    CHECK (tipo IN ('entrata', 'uscita'))
);
```

#### `movimenti_economici` - Movimenti Finanziari
```sql
CREATE TABLE movimenti_economici (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  evento_economico_id uuid REFERENCES eventi_economici(id) ON DELETE CASCADE,
  data_movimento date NOT NULL,
  importo decimal(10,2) NOT NULL,
  tipo text NOT NULL,
  descrizione text,
  categoria text,
  metodo_pagamento text,
  riferimento text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipo_movimento_economico 
    CHECK (tipo IN ('entrata', 'uscita'))
);
```

### 9. TABELLE SUPPLEMENTARI

#### `campi` - Strutture Sportive
```sql
CREATE TABLE campi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  tipo text,
  indirizzo text,
  note text,
  attivo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `calendario_campi` - Prenotazioni Campi
```sql
CREATE TABLE calendario_campi (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  campo_id uuid REFERENCES campi(id) ON DELETE CASCADE,
  data date NOT NULL,
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  squadra_id uuid REFERENCES squadre(id),
  tipo_evento text DEFAULT 'allenamento',
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `avversari` - Anagrafica Avversari
```sql
CREATE TABLE avversari (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  nome_societa text,
  citta text,
  provincia text,
  telefono text,
  email text,
  sito_web text,
  contatto_email text,
  contatto_telefono text,
  categoria_id uuid REFERENCES categorie_avversari(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `categorie_avversari` - Categorie Avversari
```sql
CREATE TABLE categorie_avversari (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome text NOT NULL,
  nome_categoria text,
  descrizione text,
  responsabile_nome text,
  responsabile_telefono text,
  responsabile_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

#### `parametri_sistema` - Configurazione Sistema
```sql
CREATE TABLE parametri_sistema (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  chiave text UNIQUE NOT NULL,
  valore text,
  descrizione text,
  tipo text DEFAULT 'string',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT check_tipo_parametro 
    CHECK (tipo IN ('string', 'number', 'boolean', 'json'))
);
```

## 🔐 Row Level Security (RLS)

### Politiche Generali

**Lettura Universale per Tabelle Base:**
```sql
CREATE POLICY "Everyone can view [table]" ON [table]
FOR SELECT USING (true);
```

**Scrittura Ristretta Admin/Dirigenti:**
```sql
CREATE POLICY "[table] insert for admin_dirigente" ON [table]
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'dirigente')
  )
);
```

### Politiche Specifiche per Ruolo

**Allenatori - Solo Squadre Assegnate:**
```sql
CREATE POLICY "Allenatori can manage their teams" ON presenze
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN tesserati t ON t.id = presenze.tesserato_id
    WHERE u.id = auth.uid() 
    AND u.role = 'allenatore'
    AND u.squadra_id @> array[t.squadra_id]
  )
);
```

**Tesserati - Solo Propri Dati:**
```sql
CREATE POLICY "Tesserati can view own data" ON tesserati
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND email = tesserati.email
  )
);
```

## 📈 Indici e Ottimizzazioni

### Indici Foreign Key
```sql
-- Performance lookup base
CREATE INDEX idx_presenze_tesserato_id ON presenze(tesserato_id);
CREATE INDEX idx_presenze_squadra_id ON presenze(squadra_id);
CREATE INDEX idx_partite_squadra_id ON partite(squadra_id);
CREATE INDEX idx_convocazioni_partita_id ON convocazioni(partita_id);
```

### Indici Compositi per Query Complesse
```sql
-- Lookup tesserati per stagione
CREATE INDEX idx_tesserati_squadre_stagioni_lookup 
ON tesserati_squadre_stagioni(tesserato_id, stagione_id, squadra_id);

-- Performance presenze per data
CREATE INDEX idx_presenze_tesserato_data ON presenze(tesserato_id, data);

-- Lookup dati stagionali
CREATE INDEX idx_tesserati_dati_stagionali_tesserato_stagione 
ON tesserati_dati_stagionali(tesserato_id, stagione_id);
```

### Indici per Ricerche Testuali
```sql
-- Ricerca tesserati per nome/cognome
CREATE INDEX idx_tesserati_cognome_nome ON tesserati(cognome, nome);
CREATE INDEX idx_tesserati_search_cognome ON tesserati USING btree(lower(cognome));
CREATE INDEX idx_tesserati_search_nome ON tesserati USING btree(lower(nome));
```

### Indici Specializzati

**Array e JSONB (GIN):**
```sql
CREATE INDEX idx_users_squadra_id_gin ON users USING GIN(squadra_id);
CREATE INDEX idx_users_ruoli_gin ON users USING GIN(ruoli);
CREATE INDEX idx_tornei_regolamento_gin ON tornei USING GIN(regolamento);
```

**Partial Indexes per Filtri Comuni:**
```sql
CREATE INDEX idx_tesserati_attivi ON tesserati(id) WHERE stato = true;
CREATE INDEX idx_tesserati_dati_stagionali_non_pagato 
ON tesserati_dati_stagionali(tesserato_id) WHERE stato_pagamento = 'non_pagato';
CREATE INDEX idx_tesserati_dati_stagionali_scadenza 
ON tesserati_dati_stagionali(scadenza_certificato) WHERE scadenza_certificato IS NOT NULL;
```

## 🔧 Funzioni e Trigger

### Trigger Automatici
```sql
-- Update timestamp automatico
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON [table]
FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();

-- Creazione profilo utente automatica
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

### Stored Procedures Magazzino
```sql
-- Registrazione movimento atomica
CREATE FUNCTION registra_movimento_magazzino(
  p_materiale_id uuid,
  p_tipo_movimento text,
  p_quantita integer,
  p_causale text DEFAULT NULL
) RETURNS void;

-- Gestione assegnazioni
CREATE FUNCTION gestisci_assegnazione_materiale()
RETURNS trigger;
```

### Utility Functions
```sql
-- Ottiene stagione corrente
CREATE FUNCTION current_season_id() RETURNS uuid;

-- Gestione timestamp
CREATE FUNCTION handle_updated_at() RETURNS trigger;

-- Gestione nuovo utente
CREATE FUNCTION handle_new_user() RETURNS trigger;
```

## 📋 Views Materializzate

### Magazzino Dettagliato
```sql
CREATE MATERIALIZED VIEW v_magazzino_dettaglio AS
SELECT 
  m.*,
  COALESCE(SUM(am.quantita - am.quantita_restituita), 0) as quantita_assegnata,
  m.quantita - COALESCE(SUM(am.quantita - am.quantita_restituita), 0) as quantita_disponibile
FROM magazzino m
LEFT JOIN assegnazioni_materiale am ON m.id = am.materiale_id 
  AND am.stato = 'attiva'
GROUP BY m.id;
```

### Statistiche Presenze
```sql
CREATE VIEW statistiche_presenze AS
SELECT 
  p.tesserato_id,
  p.squadra_id,
  p.stagione_id,
  COUNT(*) as totale_allenamenti,
  COUNT(*) FILTER (WHERE p.presente = true) as presenze_effettive,
  ROUND(
    COUNT(*) FILTER (WHERE p.presente = true) * 100.0 / COUNT(*), 2
  ) as percentuale_presenza
FROM presenze p
WHERE p.tipo = 'allenamento'
GROUP BY p.tesserato_id, p.squadra_id, p.stagione_id;
```

## 🎯 Best Practices per Query

### Pattern Ottimizzati

**1. Tesserati con Dati Stagionali:**
```sql
SELECT t.*, tds.*, tss.squadra_id, s.nome as squadra_nome
FROM tesserati t
JOIN tesserati_dati_stagionali tds ON t.id = tds.tesserato_id
JOIN tesserati_squadre_stagioni tss ON t.id = tss.tesserato_id 
  AND tds.stagione_id = tss.stagione_id
JOIN squadre s ON tss.squadra_id = s.id
WHERE tds.stagione_id = $1;
```

**2. Presenze per Squadra/Periodo:**
```sql
SELECT p.*, t.nome, t.cognome
FROM presenze p
JOIN tesserati t ON p.tesserato_id = t.id
WHERE p.squadra_id = $1 
  AND p.data BETWEEN $2 AND $3
  AND p.stagione_id = $4
ORDER BY p.data DESC, t.cognome, t.nome;
```

**3. Statistiche Dashboard:**
```sql
-- Usa partial indexes
SELECT COUNT(*) FROM tesserati WHERE stato = true;
SELECT COUNT(*) FROM squadre WHERE stagione_id = current_season_id();
```

## ⚠️ Considerazioni Performance

### Query da Evitare
- Scan completi su tabelle grandi senza WHERE
- N+1 queries su relazioni
- Array operations senza indici GIN
- LIKE '%pattern%' su colonne non indicizzate

### Monitoraggio
- Usa `EXPLAIN ANALYZE` per query complesse
- Monitora `pg_stat_statements` per slow queries
- Verifica utilizzo indici con `pg_stat_user_indexes`

### Scaling Futuro
- Considera partitioning per `presenze` per anno
- Materialized views refresh per statistiche
- Archival strategy per stagioni concluse