/**
 * Cadena de objetos internos de una confirmacion.
 *
 * Git guarda cada confirmacion como un objeto que apunta a un arbol, y el
 * arbol a un elemento por cada archivo.
 *
 * **Desde el SPEC 012 los identificadores se derivan del contenido**, como en
 * Git, y no del nombre del archivo. La diferencia se ve en el panel y es una
 * de las cosas que el taller viene a enseñar: dos archivos con el mismo texto
 * comparten elemento, y cambiar una linea cambia el elemento, el arbol y la
 * confirmacion entera. Con identificadores derivados del nombre, todo eso
 * quedaba quieto y el panel contaba algo falso sobre como funciona Git.
 *
 * La huella no es la de Git y no tiene por que serlo (SPEC 007): es la misma
 * FNV que genera los identificadores de confirmacion, y la misma que escribe
 * la linea `index` de `git diff`, de modo que las dos salidas coinciden.
 *
 * Alimenta el panel de estructuras internas de la zona D del SPEC 002 y la
 * respuesta de `git cat-file -p`.
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

  // Los archivos del arbol, en el orden en que Git los guarda. Se enumera el
  // arbol entero y no solo lo que la confirmacion toco: un arbol es una foto
  // completa, y mostrar solo lo cambiado enseñaria que es un parche.
  const rutas = Object.keys(confirmacion.arbol).sort();

  const elementos = rutas.map((nombre) => ({
    tipo: 'elemento' as const,
    id: huella(`blob:${confirmacion.arbol[nombre] ?? ''}`),
    nombre,
    campos: [{ clave: 'ruta', valor: nombre }],
  }));

  // El arbol se identifica por lo que contiene: sus rutas y los elementos a
  // los que apuntan. Dos confirmaciones que dejan el proyecto igual comparten
  // arbol, igual que en Git.
  const idArbol = huella(
    `tree:${elementos.map((elemento) => `${elemento.nombre}:${elemento.id}`).join(',')}`,
  );

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
