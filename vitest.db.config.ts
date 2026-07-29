import { loadEnvFile } from 'node:process'
import { defineConfig } from 'vitest/config'
import path from 'node:path'

try { loadEnvFile('.env.local') } catch { /* in CI le variabili arrivano dall'ambiente */ }

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // I test condividono un'unica istanza Postgres: niente parallelismo fra file.
    fileParallelism: false,
    testTimeout: 20_000,
  },
  resolve: { alias: { '@': path.resolve(__dirname) } },
})
