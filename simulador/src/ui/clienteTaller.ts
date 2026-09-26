/**
 * Lo que la pagina le pide al programa local del modo taller (SPEC 026).
 *
 * La clave viaja en un encabezado y no en la direccion. El programa rechaza con
 * 403 toda peticion sin ella, y con eso distingue a la pagina que abrio de
 * cualquier otra pagina abierta en el mismo navegador.
 */

import type { DocumentoTaller, RespuestaOrden } from '../vista';

export type Conexion = 'bien' | 'caida' | 'otra-clave';

export class TallerCaido extends Error {
  readonly conexion: Conexion;

  constructor(conexion: Conexion) {
    super(conexion);
    this.conexion = conexion;
  }
}

async function pedir(clave: string, camino: string, init: RequestInit = {}): Promise<Response> {
  let respuesta: Response;
  try {
    respuesta = await fetch(camino, {
      ...init,
      cache: 'no-store',
      headers: { ...(init.headers ?? {}), 'X-Taller-Clave': clave },
    });
  } catch {
    throw new TallerCaido('caida');
  }
  // Un 403 es el programa que se volvio a abrir: tiene otra clave, y esta
  // pestaña ya no puede hablarle.
  if (respuesta.status === 403) throw new TallerCaido('otra-clave');
  return respuesta;
}

/** El estado, o `null` si no cambio desde la version que ya se tiene. */
export async function pedirEstado(clave: string, desde: number): Promise<DocumentoTaller | null> {
  const respuesta = await pedir(clave, `/api/estado?desde=${desde}`);
  if (respuesta.status === 204) return null;
  if (!respuesta.ok) throw new TallerCaido('caida');
  return (await respuesta.json()) as DocumentoTaller;
}

export async function mandarOrden(clave: string, orden: string): Promise<RespuestaOrden> {
  const respuesta = await pedir(clave, '/api/orden', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orden }),
  });
  if (respuesta.status === 409) {
    const cuerpo = (await respuesta.json()) as { avisos: readonly string[] };
    return { codigo: -1, salida: '', error: '', agotado: false, avisos: cuerpo.avisos };
  }
  if (!respuesta.ok) throw new TallerCaido('caida');
  return (await respuesta.json()) as RespuestaOrden;
}
