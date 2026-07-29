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
};

export default nextConfig;
