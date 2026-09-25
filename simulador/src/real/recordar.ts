/**
 * La ultima carpeta conectada, guardada en el navegador para que al recargar
 * no haya que buscarla de nuevo (SPEC 024, 4).
 *
 * El manejador de la carpeta se guarda en IndexedDB, que es el unico
 * almacenamiento que lo acepta. Lo que no se guarda es el permiso: al volver,
 * el navegador exige un clic del alumno para devolverlo.
 *
 * Si el almacenamiento no esta, esta bloqueado o falla, nada de esto lanza:
 * la pagina funciona igual y solo pide elegir la carpeta de nuevo (4.2).
 *
 * ## La ventana de incognito
 *
 * En un perfil de incognito, Chrome y Edge **se cierran enteros** al leer de
 * IndexedDB un manejador de carpeta guardado (visto en las pruebas, con
 * carpetas de la OPFS, con y sin ventana; con un perfil normal no pasa, y con
 * una carpeta elegida en el dialogo no se pudo probar, porque el dialogo no se
 * automatiza). No hay como atraparlo desde la pagina, y no hay forma fiable de
 * saber si la ventana es de incognito.
 *
 * Por eso el manejador **no se lee al cargar**: al cargar se lee solo el
 * nombre, que es un texto y no tiene ese problema, y el manejador se lee
 * cuando el alumno aprieta «reconectar». Una recarga nunca puede tumbar el
 * navegador. Ademas, antes de leer el manejador se deja una marca en
 * `localStorage` y se quita al terminar: si al volver la marca sigue ahi, la
 * lectura anterior no termino, y no se repite.
 */

import type { Carpeta } from './navegador';

const BASE = 'simulador-git-sii';
const TABLA = 'carpetas';
const CLAVE = 'ultima';
/** El nombre de la carpeta, aparte: se lee al cargar sin tocar el manejador. */
const NOMBRE = 'nombre';
/** Un almacenamiento que no contesta no puede dejar la pagina esperando. */
const PLAZO_MS = 2000;

function conPlazo<T>(promesa: Promise<T>, siVence: T): Promise<T> {
  return Promise.race([promesa, new Promise<T>((resolver) => setTimeout(() => resolver(siVence), PLAZO_MS))]);
}

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    try {
      const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
      if (idb === undefined || idb === null) {
        resolver(null);
        return;
      }
      const pedido = idb.open(BASE, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABLA);
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

async function operar<T>(modo: IDBTransactionMode, hacer: (tabla: IDBObjectStore) => IDBRequest, siFalla: T): Promise<T> {
  const trabajo = (async (): Promise<T> => {
    const base = await abrir();
    if (base === null) return siFalla;
    try {
      return await new Promise<T>((resolver) => {
        const pedido = hacer(base.transaction(TABLA, modo).objectStore(TABLA));
        pedido.onsuccess = () => resolver((pedido.result as T) ?? siFalla);
        pedido.onerror = () => resolver(siFalla);
      });
    } catch {
      return siFalla;
    } finally {
      base.close();
    }
  })();
  return conPlazo(trabajo.catch(() => siFalla), siFalla);
}

/** Guarda la carpeta. Devuelve si quedo guardada. */
export async function recordarCarpeta(carpeta: Carpeta): Promise<boolean> {
  const guardada = (await operar<unknown>('readwrite', (tabla) => tabla.put(carpeta, CLAVE), false)) !== false;
  if (!guardada) return false;
  return (await operar<unknown>('readwrite', (tabla) => tabla.put(carpeta.name, NOMBRE), false)) !== false;
}

/** El nombre de la carpeta guardada, para ofrecer reconectarla, sin leer el manejador. */
export async function nombreRecordado(): Promise<string | null> {
  const nombre = await operar<unknown>('readonly', (tabla) => tabla.get(NOMBRE), null);
  return typeof nombre === 'string' && nombre !== '' ? nombre : null;
}

async function olvidar(): Promise<void> {
  await operar<unknown>('readwrite', (tabla) => tabla.delete(CLAVE), null);
  await operar<unknown>('readwrite', (tabla) => tabla.delete(NOMBRE), null);
}

const LEYENDO = 'simulador-git-sii:leyendo-carpeta';

function marca(accion: 'poner' | 'quitar' | 'mirar'): boolean {
  try {
    const almacen = globalThis.localStorage;
    if (accion === 'mirar') return almacen.getItem(LEYENDO) !== null;
    if (accion === 'poner') almacen.setItem(LEYENDO, String(Date.now()));
    else almacen.removeItem(LEYENDO);
    return true;
  } catch {
    return false;
  }
}

/**
 * La carpeta guardada, o null si no hay, o si el almacenamiento no esta. Se
 * llama solo desde el boton «reconectar» (ver arriba).
 */
export async function carpetaRecordada(): Promise<Carpeta | null> {
  if (marca('mirar')) {
    // La lectura anterior no termino. No se repite.
    await olvidar();
    marca('quitar');
    return null;
  }
  marca('poner');
  const guardada = await operar<unknown>('readonly', (tabla) => tabla.get(CLAVE), null);
  marca('quitar');
  if (guardada === null || typeof guardada !== 'object') return null;
  const carpeta = guardada as Partial<Carpeta>;
  return carpeta.kind === 'directory' && typeof carpeta.name === 'string' ? (carpeta as Carpeta) : null;
}
