import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  /**
   * Gedeckelt am 2026-09-04. Ohne Angabe nimmt Playwright die halbe CPU-Zahl —
   * auf dieser Maschine 16 — und fährt damit 24 Tests über drei Engines gegen
   * **einen** Next-Dev-Server. Gemessen: 5 bis 6 rot, reproduzierbar, und zwar
   * an drei verschiedenen Stellen: das Bild braucht länger als die 5 Sekunden
   * aus AC-15, die erste Frage länger als die 3 Sekunden aus AC-2, und der
   * Mail-Ablauf von PROJ-1 wird instabil. Mit mehr Geduld (20 s) blieben 4 rot.
   *
   * Das ist Kontention im Messaufbau, kein Produktfehler: Bei 4 Workern läuft
   * die Suite wiederholt 24/24, und derselbe Flake trat auch schon **vor** den
   * Fixes vom 2026-09-04 auf (gegen `4709193` gemessen: ebenfalls 5 von 24 rot).
   * Ein Gate, das je nach Maschinenauslastung rot wird, misst die Maschine und
   * nicht die App.
   */
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Added at /e2e-tests: the scaffolded config had Chromium and WebKit only,
    // so Firefox had never run in any check of this project — the gap every QA
    // report listed as unverified.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
