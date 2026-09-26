/**
 * Las ordenes de cada laboratorio, sacadas de su README como las saca el
 * arnes de Cypress, para escribirlas en la consola del modo taller (SPEC 026,
 * 5.1).
 *
 * El arnes deja fuera tres cosas que el alumno si hace, y aqui se agregan en
 * su linea del enunciado:
 *
 * - `labs/lab-NN/preparar.sh`, que el arnes no reconoce como orden.
 * - Las ediciones en prosa que no empiezan con «Crea»: «Dentro, `ruta`»,
 *   «Y `ruta`», «Agrega una linea al final de `ruta`». Cada linea del bloque
 *   pasa a ser un `echo`, como hace el arnes con «Crea `ruta`».
 *
 * La seccion de rescate trae ordenes con marcadores que dependen del estado de
 * quien se perdio; las que el arnes no sabe resolver se saltan y se anotan.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aliasDelTaller } from '../../cypress/soporte/enunciado';
import { type OrdenDelEnunciado, ordenesDe, resolverMarcadores } from '../../cypress/soporte/ordenes';
import { CLON_REAL } from './instalacion';

export const LABORATORIOS = ['01', '02', '03', '04', '05', '06', '07', '08'];

export function enunciado(numero: string): string {
  return readFileSync(join(CLON_REAL, 'labs', `lab-${numero}`, 'README.md'), 'utf8');
}

export interface Paso {
  readonly linea: number;
  readonly texto: string;
  readonly orden: OrdenDelEnunciado | null;
  /** De donde salio: del arnes, o agregado aqui. */
  readonly origen: 'arnes' | 'preparar' | 'prosa';
}

function edicionesEnProsa(texto: string, yaLeidas: ReadonlySet<number>): Paso[] {
  const lineas = texto.split('\n');
  const salida: Paso[] = [];
  for (let k = 0; k < lineas.length; k += 1) {
    if (lineas[k]?.trim() !== '```') continue;
    let fin = k + 1;
    while (fin < lineas.length && lineas[fin]?.trim() !== '```') fin += 1;
    let prosa = k - 1;
    while (prosa >= 0 && lineas[prosa]?.trim() === '') prosa -= 1;
    const frase = lineas[prosa] ?? '';
    const ruta = frase.match(/`([\w./-]+\.\w+)`/)?.[1];
    const agrega = /agrega una l[ií]nea al final de/i.test(frase);
    const crea = /^(Dentro, |Y )`[\w./-]+`\.?$/.test(frase.trim());
    if (ruta !== undefined && (agrega || crea) && !yaLeidas.has(k + 1)) {
      lineas.slice(k + 1, fin).forEach((contenido, i) => {
        const redireccion = agrega || i > 0 ? '>>' : '>';
        const escapado = contenido.replace(/(["\\$`])/g, '\\$1');
        salida.push({ linea: k + 1, texto: `echo "${escapado}" ${redireccion} ${ruta}`, orden: null, origen: 'prosa' });
      });
    }
    k = fin;
  }
  return salida;
}

export function guion(numero: string): { pasos: readonly Paso[]; saltadas: readonly string[] } {
  const texto = enunciado(numero);
  const alias = aliasDelTaller(enunciado('01'));
  const todas = resolverMarcadores(ordenesDe(texto, alias), numero, alias);
  const rescate = texto.split('\n').findIndex((linea) => /^##\s+Si algo sali/.test(linea));
  const pasos: Paso[] = [];
  const saltadas: string[] = [];
  for (const orden of todas) {
    if (orden.clase === 'omitida') {
      saltadas.push(`linea ${orden.linea} «${orden.texto}»: ${rescate >= 0 && orden.linea > rescate ? 'seccion de rescate, ' : ''}${orden.motivo}`);
      continue;
    }
    pasos.push({ linea: orden.linea, texto: orden.texto, orden, origen: 'arnes' });
  }
  const preparar = texto.split('\n').findIndex((l) => l.trim() === `labs/lab-${numero}/preparar.sh`);
  if (preparar >= 0 && !pasos.some((p) => p.texto.endsWith('preparar.sh'))) {
    pasos.push({ linea: preparar + 1, texto: `labs/lab-${numero}/preparar.sh`, orden: null, origen: 'preparar' });
  }
  pasos.push(...edicionesEnProsa(texto, new Set(pasos.map((p) => p.linea))));
  return { pasos: pasos.sort((a, b) => a.linea - b.linea), saltadas };
}
