import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Unit- und Integrationstests liegen neben ihrer Quelldatei unter src/.
    // `tests/` gehört Playwright: dessen Specs importieren `test` und `expect`
    // aus @playwright/test und laufen unter Vitest nicht. Ohne diese Abgrenzung
    // sammelt Vitest sie über sein Standardmuster `**/*.spec.ts` mit ein und
    // `npm test` meldet fehlgeschlagene Dateien, obwohl kein Test defekt ist.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // A fresh scaffold ships no tests yet — `npm test` must not fail before
    // /build and /qa have written the first ones.
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` throws on import unless the bundler resolves the
      // "react-server" condition, which Vitest does not set. Point it at the
      // package's own empty module — the same file Next resolves on the server
      // — so server modules can be unit tested. This does not weaken the
      // guard: the real check happens in `next build` (PROJ-2, design.md).
      'server-only': resolve(__dirname, './node_modules/server-only/empty.js'),
    },
  },
})
