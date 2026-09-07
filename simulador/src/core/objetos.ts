/**
 * Cadena de objetos internos de una confirmacion.
 *
 * Git guarda cada confirmacion como un objeto que apunta a un arbol, y el
 * arbol a un elemento por cada archivo. El simulador no versiona contenido
 * (restriccion R4), de modo que reproduce la forma de esa cadena sin inventar
 * contenido: los identificadores se derivan de forma determinista de lo que el
 * modelo si conoce, que son los nombres de archivo y el identificador de la
 * confirmacion.
 *
 * Alimenta el panel de estructuras internas de la zona D del SPEC 002.
 */

import { confirmacionPorId } from './estado';
import { huella } from './identificadores';
import type { EstadoRepositorio } from './tipos';

export type TipoObjeto = 'confirmacion' | 'arbol' | 'elemento';

export interface CampoObjeto {
  readonly clave: string;
  readonly valor: string;
}

export interface ObjetoSimulado {
  readonly tipo: TipoObjeto;
  readonly id: string;
  readonly nombre: string;
  readonly campos: readonly CampoObjeto[];
}

export interface CadenaDeObjetos {
  readonly confirmacion: ObjetoSimulado;
  readonly arbol: ObjetoSimulado;
  readonly elementos: readonly ObjetoSimulado[];
}

/**
 * Devuelve la confirmacion, su arbol y sus elementos, o `null` si el
 * identificador no corresponde a ninguna confirmacion del modelo.
 */
export function cadenaDeObjetos(
  estado: EstadoRepositorio,
  id: string,
): CadenaDeObjetos | null {
  const confirmacion = confirmacionPorId(estado, id);
  if (confirmacion === undefined) return null;

  const idArbol = huella(`tree:${confirmacion.id}:${confirmacion.archivos.join(',')}`);

  const elementos = confirmacion.archivos.map((nombre) => ({
    tipo: 'elemento' as const,
    id: huella(`blob:${confirmacion.id}:${nombre}`),
    nombre,
    campos: [{ clave: 'ruta', valor: nombre }],
  }));

  return {
    confirmacion: {
      tipo: 'confirmacion',
      id: confirmacion.id,
      nombre: confirmacion.mensaje,
      campos: [
        { clave: 'tree', valor: idArbol },
        ...confirmacion.padres.map((padre) => ({ clave: 'parent', valor: padre })),
        { clave: 'author', valor: `${confirmacion.autor} <${confirmacion.correo}>` },
        { clave: 'date', valor: confirmacion.fecha },
      ],
    },
    arbol: {
      tipo: 'arbol',
      id: idArbol,
      nombre: `árbol de ${confirmacion.id}`,
      campos: elementos.map((elemento) => ({
        clave: elemento.nombre,
        valor: elemento.id,
      })),
    },
    elementos,
  };
}
