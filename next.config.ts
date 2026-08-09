import type { NextConfig } from "next";
import path from "node:path";
import { leggiEnv } from "./lib/env";

// Le variabili NEXT_PUBLIC_* vengono inlineate nel bundle già in fase di
// build: una build con una variabile mancante è già rotta prima ancora che
// il server parta, quindi la validazione avviene qui, non solo a runtime.
leggiEnv(process.env);

const nextConfig: NextConfig = {
  // Fissa la radice del workspace su questo progetto: un package-lock.json
  // presente nella home directory dell'utente altrimenti confonde l'inferenza
  // automatica di Next.js.
  outputFileTracingRoot: path.join(__dirname),

  // Due `next dev` sullo stesso checkout condividono `.next` e si sovrascrivono
  // le compilazioni a vicenda: il browser riceve la mappa dei moduli di una e
  // il chunk di pagina dell'altra, e il runtime muore con "Cannot read
  // properties of undefined (reading 'call')". Con una cartella per processo
  // (vedi lo script `dev:produzione`) convivono. Inerte se la variabile manca.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
