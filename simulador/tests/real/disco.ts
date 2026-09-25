/**
 * El repositorio real, leido desde el disco con Node, para las pruebas.
 *
 * Es el mismo contrato que usa el navegador con la carpeta que elige el
 * alumno: leer, listar y el tamaño y la fecha de cada archivo. Solo lectura.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Adaptador } from '../../src/real/adaptador';

export function adaptadorDeDisco(raiz: string): Adaptador {
  return {
    async leer(ruta) {
      try {
        return new Uint8Array(readFileSync(join(raiz, ...ruta)));
      } catch {
        return null;
      }
    },
    async listar(ruta) {
      try {
        return readdirSync(join(raiz, ...ruta), { withFileTypes: true }).map((entrada) => ({
          nombre: entrada.name,
          esDirectorio: entrada.isDirectory(),
        }));
      } catch {
        return null;
      }
    },
    async datos(ruta) {
      try {
        const datos = statSync(join(raiz, ...ruta));
        return datos.isFile() ? { tamano: datos.size, modificado: datos.mtimeMs } : null;
      } catch {
        return null;
      }
    },
    async listarConDatos(ruta) {
      try {
        return readdirSync(join(raiz, ...ruta), { withFileTypes: true }).map((entrada) => {
          let datos = null;
          if (entrada.isFile()) {
            try {
              const stat = statSync(join(raiz, ...ruta, entrada.name));
              datos = { tamano: stat.size, modificado: stat.mtimeMs };
            } catch {
              datos = null;
            }
          }
          return { nombre: entrada.name, esDirectorio: entrada.isDirectory(), datos };
        });
      } catch {
        return null;
      }
    },
    async acceso() {
      return existsSync(raiz) ? 'ok' : 'no-existe';
    },
  };
}
