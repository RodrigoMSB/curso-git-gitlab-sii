import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const SALIDA = fileURLToPath(new URL('./dist/index.html', import.meta.url));

/** Sintaxis que solo funciona dentro de un script de tipo modulo. */
const SINTAXIS_DE_MODULO = /\bimport\s*[({'"]|\bimport\s+[a-zA-Z*{]|\bexport\s|import\.meta/;

/**
 * Cierre de la construccion: deja el resultado listo para abrirse con doble
 * clic y comprueba que cumple las restricciones R1 y R2 del SPEC 001.
 *
 * Hace dos cosas.
 *
 * Primero convierte el script incrustado de `type="module"` en un script
 * clasico y lo baja al final del cuerpo. El paquete sale en una sola pieza y
 * sin sintaxis de modulos, de modo que la conversion es segura y evita depender
 * de como cada navegador trata los modulos servidos desde el sistema de
 * archivos. El traslado es necesario porque un script clasico se ejecuta apenas
 * el analizador lo encuentra, y en la cabecera correria antes de que exista el
 * elemento donde se monta la aplicacion.
 *
 * Segundo, revisa que en el documento no quede ninguna referencia a un recurso
 * externo. Si queda alguna, la construccion falla en vez de entregar un archivo
 * que se veria bien en el equipo de desarrollo y fallaria en la sala de clases.
 */
function archivoUnicoVerificado(): Plugin {
  return {
    name: 'archivo-unico-verificado',
    enforce: 'post',
    closeBundle() {
      const html = readFileSync(SALIDA, 'utf8');

      const guiones = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
      for (const [, atributos = '', cuerpo = ''] of guiones) {
        if (atributos.includes('src=')) {
          throw new Error(
            'El documento conserva un script externo: el resultado no es autocontenido.',
          );
        }
        if (atributos.includes('type="module"') && SINTAXIS_DE_MODULO.test(cuerpo)) {
          throw new Error(
            'El paquete conserva sintaxis de modulos y no puede pasar a script clasico.',
          );
        }
      }

      // El armazon es el documento sin el codigo: ahi es donde importa que no
      // quede ninguna referencia a la red ni a archivos vecinos.
      const armazon = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      const referencias = [...armazon.matchAll(/\b(?:src|href)="([^"]*)"/g)]
        .map(([, direccion = '']) => direccion)
        .filter((direccion) => !direccion.startsWith('data:'));
      if (referencias.length > 0) {
        throw new Error(
          `El documento apunta a recursos externos: ${referencias.join(', ')}.`,
        );
      }

      const modulos: string[] = [];
      const sinModulos = html.replace(
        /<script type="module"[^>]*>([\s\S]*?)<\/script>/g,
        (_coincidencia, cuerpo: string) => {
          modulos.push(cuerpo);
          return '';
        },
      );
      if (modulos.length === 0) {
        throw new Error('El documento no incrusta ningun script: la aplicacion no arrancaria.');
      }

      const clasicos = modulos.map((cuerpo) => `<script>${cuerpo}</script>`).join('\n');
      // El reemplazo va como funcion a proposito: el codigo del paquete tiene
      // secuencias con signo de dolar que una cadena de reemplazo interpretaria.
      const final = sinModulos.replace('</body>', () => `${clasicos}\n  </body>`);
      if (final === sinModulos) {
        throw new Error('El documento no tiene cierre de cuerpo donde ubicar el script.');
      }

      writeFileSync(SALIDA, final, 'utf8');
    },
  };
}

// El resultado de la construccion debe ser un unico archivo HTML que se abra
// con doble clic desde el sistema de archivos, sin servidor y sin red (R1, R2).
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwind(),
    viteSingleFile({ removeViteModuleLoader: true }),
    archivoUnicoVerificado(),
  ],
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
