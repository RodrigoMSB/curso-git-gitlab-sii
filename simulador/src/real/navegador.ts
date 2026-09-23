/**
 * El repositorio del alumno, leido desde el navegador (SPEC 020, 1.3 y 2.1).
 *
 * La carpeta se pide con `showDirectoryPicker` en **modo lectura**: el
 * navegador ni siquiera ofrece escribir, y este adaptador no tiene como. Es el
 * mismo contrato que usan las pruebas con el disco.
 */

import type { Adaptador, DatosArchivo, EntradaDirectorio } from './adaptador';

/** Lo que la pagina usa de la API de acceso a archivos, sin depender de que el navegador la declare. */
interface Carpeta {
  readonly kind: 'directory';
  readonly name: string;
  getDirectoryHandle(nombre: string): Promise<Carpeta>;
  getFileHandle(nombre: string): Promise<{ getFile(): Promise<File> }>;
  values(): AsyncIterable<{ readonly kind: 'file' | 'directory'; readonly name: string }>;
}

type ElegirCarpeta = (opciones: { mode: 'read'; id?: string }) => Promise<Carpeta>;

function selector(): ElegirCarpeta | null {
  const candidato = (globalThis as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  return typeof candidato === 'function' ? (candidato as ElegirCarpeta).bind(globalThis) : null;
}

/** Si este navegador deja abrir una carpeta. Firefox y Safari no. */
export function puedeAbrirCarpetas(): boolean {
  return selector() !== null;
}

export interface CarpetaElegida {
  readonly nombre: string;
  readonly adaptador: Adaptador;
}

/** Pide la carpeta al alumno. Devuelve null si cancela el dialogo. */
export async function elegirCarpeta(): Promise<CarpetaElegida | null> {
  const elegir = selector();
  if (elegir === null) throw new Error('este navegador no permite abrir una carpeta');
  try {
    const carpeta = await elegir({ mode: 'read', id: 'repositorio-del-taller' });
    return { nombre: carpeta.name, adaptador: adaptadorDeCarpeta(carpeta) };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

async function carpetaEn(raiz: Carpeta, partes: readonly string[]): Promise<Carpeta | null> {
  let actual = raiz;
  for (const parte of partes) {
    try {
      actual = await actual.getDirectoryHandle(parte);
    } catch {
      return null;
    }
  }
  return actual;
}

async function archivoEn(raiz: Carpeta, ruta: readonly string[]): Promise<File | null> {
  const nombre = ruta.at(-1);
  if (nombre === undefined) return null;
  const carpeta = await carpetaEn(raiz, ruta.slice(0, -1));
  if (carpeta === null) return null;
  try {
    return await (await carpeta.getFileHandle(nombre)).getFile();
  } catch {
    return null;
  }
}

export function adaptadorDeCarpeta(raiz: Carpeta): Adaptador {
  return {
    async leer(ruta) {
      const archivo = await archivoEn(raiz, ruta);
      return archivo === null ? null : new Uint8Array(await archivo.arrayBuffer());
    },
    async listar(ruta): Promise<readonly EntradaDirectorio[] | null> {
      const carpeta = await carpetaEn(raiz, ruta);
      if (carpeta === null) return null;
      const entradas: EntradaDirectorio[] = [];
      for await (const entrada of carpeta.values()) {
        entradas.push({ nombre: entrada.name, esDirectorio: entrada.kind === 'directory' });
      }
      return entradas;
    },
    async datos(ruta): Promise<DatosArchivo | null> {
      const archivo = await archivoEn(raiz, ruta);
      return archivo === null ? null : { tamano: archivo.size, modificado: archivo.lastModified };
    },
  };
}
