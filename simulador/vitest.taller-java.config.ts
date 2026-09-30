/**
 * El recorrido del modo taller (SPEC 026), aparte de la suite del simulador:
 * arranca el programa local, un navegador de verdad y los ocho laboratorios, y
 * tarda lo que tarda. Se corre con
 *
 *     npx vitest run --config vitest.taller-java.config.ts
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['taller-java/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 60 * 60_000,
    hookTimeout: 5 * 60_000,
  },
});
