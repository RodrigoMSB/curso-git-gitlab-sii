/**
 * Renombrados que Git deduce comparando contenido (SPEC 022).
 *
 * El `mv` del simulador anota de donde viene el archivo, y con eso `git status`
 * dice `renamed:`. Pero Git no sabe de `mv`: compara lo que se quito con lo que
 * se agrego, y si el contenido es el mismo, lo llama renombrado. Pasa cuando el
 * archivo se movio de otra manera, o en un repositorio real que el simulador
 * no vio moverse.
 *
 * Solo se cubre el contenido identico. Git tambien empareja archivos que se
 * parecen en mas de la mitad, midiendo el parecido con su propia heuristica;
 * esa parte no se modela.
 */

import { textoDeTrabajo, textoEnCabeza } from './contenido';
import type { EstadoRepositorio } from './tipos';

/**
 * Empareja cada baja preparada con un archivo nuevo preparado de contenido
 * identico, y los deja como un renombrado. Si hay varios candidatos, se
 * prefiere el que conserva el nombre suelto, como Git.
 */
export function emparejarRenombrados(estado: EstadoRepositorio): EstadoRepositorio {
  const nuevos = estado.archivos.filter(
    (archivo) =>
      archivo.estado === 'preparado' && archivo.renombradoDe === undefined && textoEnCabeza(estado, archivo.nombre) === null,
  );
  if (nuevos.length === 0 || estado.borrados.length === 0) return estado;

  const libres = [...estado.borrados];
  const pares = new Map<string, string>();
  for (const nuevo of nuevos) {
    const texto = textoDeTrabajo(estado, nuevo.nombre);
    const candidatos = libres.filter((baja) => textoEnCabeza(estado, baja) === texto);
    if (candidatos.length === 0) continue;
    const suelto = (ruta: string): string => ruta.slice(ruta.lastIndexOf('/') + 1);
    const elegido = candidatos.find((baja) => suelto(baja) === suelto(nuevo.nombre)) ?? candidatos[0];
    if (elegido === undefined) continue;
    pares.set(nuevo.nombre, elegido);
    libres.splice(libres.indexOf(elegido), 1);
  }
  if (pares.size === 0) return estado;

  return {
    ...estado,
    archivos: estado.archivos.map((archivo) => {
      const origen = pares.get(archivo.nombre);
      return origen === undefined ? archivo : { ...archivo, renombradoDe: origen };
    }),
    borrados: libres,
  };
}

/**
 * Como nombra Git un renombrado en el resumen de una confirmacion: lo comun al
 * comienzo y al final va una sola vez, y lo que cambia entre llaves.
 * `recetas/a.md` a `recetas/b.md` es `recetas/{a.md => b.md}`.
 */
export function rotuloDeRenombrado(antes: string, despues: string): string {
  let inicio = 0;
  for (let i = 0; i < Math.min(antes.length, despues.length) && antes[i] === despues[i]; i += 1) {
    if (antes[i] === '/') inicio = i + 1;
  }
  let fin = 0;
  for (
    let i = 1;
    i <= Math.min(antes.length, despues.length) - inicio && antes[antes.length - i] === despues[despues.length - i];
    i += 1
  ) {
    if (antes[antes.length - i] === '/') fin = i;
  }
  if (inicio === 0 && fin === 0) return `${antes} => ${despues}`;
  const prefijo = antes.slice(0, inicio);
  const sufijo = fin === 0 ? '' : antes.slice(antes.length - fin);
  const medioAntes = antes.slice(inicio, antes.length - fin);
  const medioDespues = despues.slice(inicio, despues.length - fin);
  return `${prefijo}{${medioAntes} => ${medioDespues}}${sufijo}`;
}
