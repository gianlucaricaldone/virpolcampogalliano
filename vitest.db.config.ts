import { defineConfig } from 'vitest/config'
import path from 'node:path'

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
