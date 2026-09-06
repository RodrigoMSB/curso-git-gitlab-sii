import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// El resultado de la construccion debe ser un unico archivo HTML que se abra
// con doble clic desde el sistema de archivos, sin servidor y sin red (R1, R2).
export default defineConfig({
  base: './',
  plugins: [react(), tailwind(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts', 'src/escenarios/**/*.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 90,
        statements: 90,
        branches: 80,
        functions: 90,
      },
    },
  },
});
