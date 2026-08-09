import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    // Dipendenza di tutti i test: se il bersaglio non è il database locale la
    // suite non parte. Vedi e2e/guardia-ambiente.setup.ts.
    { name: 'guardia', testMatch: /guardia-ambiente\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['guardia'],
      testIgnore: /guardia-ambiente\.setup\.ts/,
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
