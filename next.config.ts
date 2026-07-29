import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Fissa la radice del workspace su questo progetto: un package-lock.json
  // presente nella home directory dell'utente altrimenti confonde l'inferenza
  // automatica di Next.js.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
