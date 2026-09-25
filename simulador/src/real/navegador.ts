/**
 * El repositorio del alumno, leido desde el navegador (SPEC 020, 1.3 y 2.1, y
 * SPEC 024, 1.4 y 4).
 *
 * La carpeta se pide con `showDirectoryPicker` en **modo lectura**: el
 * navegador ni siquiera ofrece escribir, y este adaptador no tiene como. Es el
 * mismo contrato que usan las pruebas con el disco.
 */

import type { Acceso, Adaptador, DatosArchivo, EntradaConDatos, EntradaDirectorio } from './adaptador';

type Permiso = 'granted' | 'denied' | 'prompt';

/** Lo que la pagina usa de la API de acceso a archivos, sin depender de que el navegador la declare. */
export interface Carpeta {
  readonly kind: 'directory';
  readonly name: string;
  getDirectoryHandle(nombre: string): Promise<Carpeta>;
  getFileHandle(nombre: string): Promise<{ getFile(): Promise<File> }>;
  values(): AsyncIterable<{
    readonly kind: 'file' | 'directory';
    readonly name: string;
    getFile?(): Promise<File>;
  }>;
  queryPermission?(opciones: { mode: 'read' }): Promise<Permiso>;
  requestPermission?(opciones: { mode: 'read' }): Promise<Permiso>;
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
  /** El manejador, para guardarlo y ofrecer reconectar al recargar (SPEC 024, 4.1). */
  readonly carpeta: Carpeta;
}

/** Pide la carpeta al alumno. Devuelve null si cancela el dialogo. */
export async function elegirCarpeta(): Promise<CarpetaElegida | null> {
  const elegir = selector();
  if (elegir === null) throw new Error('este navegador no permite abrir una carpeta');
  try {
    const carpeta = await elegir({ mode: 'read', id: 'repositorio-del-taller' });
    return { nombre: carpeta.name, adaptador: adaptadorDeCarpeta(carpeta), carpeta };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

/**
 * Vuelve a abrir una carpeta guardada. El navegador exige que el permiso se
 * pida con un clic del alumno, asi que esto se llama desde el boton. Devuelve
 * null si el alumno no lo concede.
 */
export async function reabrirCarpeta(carpeta: Carpeta): Promise<CarpetaElegida | null> {
  const permiso =
    carpeta.requestPermission === undefined ? 'granted' : await carpeta.requestPermission({ mode: 'read' });
  if (permiso !== 'granted') return null;
  return { nombre: carpeta.name, adaptador: adaptadorDeCarpeta(carpeta), carpeta };
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
      try {
        for await (const entrada of carpeta.values()) {
          entradas.push({ nombre: entrada.name, esDirectorio: entrada.kind === 'directory' });
        }
      } catch {
        // La carpeta desaparecio mientras se listaba.
        return null;
      }
      return entradas;
    },
    async datos(ruta): Promise<DatosArchivo | null> {
      const archivo = await archivoEn(raiz, ruta);
      return archivo === null ? null : { tamano: archivo.size, modificado: archivo.lastModified };
    },
    async listarConDatos(ruta): Promise<readonly EntradaConDatos[] | null> {
      const carpeta = await carpetaEn(raiz, ruta);
      if (carpeta === null) return null;
      const manejadores: { kind: 'file' | 'directory'; name: string; getFile?(): Promise<File> }[] = [];
      try {
        for await (const entrada of carpeta.values()) manejadores.push(entrada);
      } catch {
        return null;
      }
      return Promise.all(
        manejadores.map(async (entrada) => {
          let datos: DatosArchivo | null = null;
          if (entrada.kind === 'file' && entrada.getFile !== undefined) {
            try {
              const archivo = await entrada.getFile();
              datos = { tamano: archivo.size, modificado: archivo.lastModified };
            } catch {
              datos = null;
            }
          }
          return { nombre: entrada.name, esDirectorio: entrada.kind === 'directory', datos };
        }),
      );
    },
    async acceso(): Promise<Acceso> {
      try {
        if (raiz.queryPermission !== undefined && (await raiz.queryPermission({ mode: 'read' })) !== 'granted') {
          return 'sin-permiso';
        }
        for await (const _ of raiz.values()) break;
        return 'ok';
      } catch (error) {
        const nombre = error instanceof DOMException ? error.name : '';
        return nombre === 'NotAllowedError' || nombre === 'SecurityError' ? 'sin-permiso' : 'no-existe';
      }
    },
  };
}
