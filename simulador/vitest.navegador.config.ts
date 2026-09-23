import { defineConfig } from 'vitest/config';

/**
 * La prueba del modo real en un navegador de verdad (SPEC 020, CA3 y CA5).
 *
 * Va aparte de `npm test` porque necesita Playwright y un Chrome o Edge
 * instalado: `npx vitest run -c vitest.navegador.config.ts`, con `CANAL` en
 * `chrome` o `msedge`. La corre GitHub Actions en Windows y en Mac.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/navegador/**/*.navegador.ts'],
    testTimeout: 1_800_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
