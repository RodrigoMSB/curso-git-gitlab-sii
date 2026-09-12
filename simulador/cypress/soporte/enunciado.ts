/**
 * Lectura del enunciado de un laboratorio, sin tocar el motor.
 *
 * Vive aparte de `ordenes.ts` porque lo usan los dos lados: el arnes, dentro
 * del navegador, y la configuracion de Cypress, dentro de Node. Esta ultima no
 * puede arrastrar el motor entero solo para leer un archivo de texto.
 */

/** Saca los bloques cercados del enunciado, en orden, con su numero de linea. */
export function bloquesDe(enunciado: string): readonly { linea: number; contenido: string }[] {
  const bloques: { linea: number; contenido: string }[] = [];
  const lineas = enunciado.split('\n');
  let dentro = false;
  let inicio = 0;
  let acumulado: string[] = [];

  lineas.forEach((linea, indice) => {
    if (linea.trimEnd() === '```') {
      if (dentro) {
        bloques.push({ linea: inicio + 1, contenido: acumulado.join('\n') });
        acumulado = [];
      } else {
        inicio = indice + 1;
      }
      dentro = !dentro;
      return;
    }
    if (dentro) acumulado.push(linea);
  });
  return bloques;
}

/** Configuracion que un enunciado deja puesta con `git config --global`. */
export type Configuracion = readonly (readonly [clave: string, valor: string])[];

/**
 * La configuracion que el laboratorio 01 deja puesta, sacada de su enunciado.
 *
 * Es la unica fuente. El arnes la escribia a mano y el simulador la declara en
 * `src/escenarios`; las tres tienen que decir lo mismo, y una prueba lo exige.
 * Mientras el arnes tuviera su copia, el laboratorio 01 podia dejar de
 * configurar los alias sin que ningun recorrido se enterara.
 */
export function configuracionDelTaller(enunciadoDelPrimero: string): Configuracion {
  const puesta: [string, string][] = [];
  for (const bloque of bloquesDe(enunciadoDelPrimero)) {
    for (const cruda of bloque.contenido.split('\n')) {
      const encontrada = cruda
        .trim()
        .match(/^git config --global ([\w.-]+) "([^"]*)"$/);
      const clave = encontrada?.[1];
      const valor = encontrada?.[2];
      if (clave === undefined || valor === undefined) continue;
      puesta.push([clave, valor]);
    }
  }
  return puesta;
}

/** Los alias de esa configuracion, por nombre. */
export function aliasDelTaller(enunciadoDelPrimero: string): Readonly<Record<string, string>> {
  const tabla: Record<string, string> = {};
  for (const [clave, valor] of configuracionDelTaller(enunciadoDelPrimero)) {
    if (clave.startsWith('alias.')) tabla[clave.slice('alias.'.length)] = valor;
  }
  return tabla;
}

/**
 * Tramos que el enunciado manda hacer en la terminal y no en el simulador.
 *
 * El laboratorio 03 tenia dos, por las exclusiones que el motor no sabia leer.
 * El SPEC 012 los devolvio a la pantalla y le queda uno solo, el
 * `cat .git/info/exclude` de su punto 3.3, que sigue fuera por la razon de
 * siempre: la carpeta oculta se mira en la terminal a proposito.
 *
 * Se leen del enunciado y no de una lista aparte, por la misma razon de
 * siempre. El marcador es la frase «en tu terminal» en negrita, y el tramo
 * llega hasta el titulo siguiente del mismo nivel o mas alto.
 */
export function tramosDeTerminal(enunciado: string): readonly (readonly [number, number])[] {
  const lineas = enunciado.split('\n');
  const tramos: [number, number][] = [];

  lineas.forEach((linea, indice) => {
    if (!/\*\*[^*]*en tu terminal[^*]*\*\*/.test(linea)) return;
    const nivel = nivelDelTituloAnterior(lineas, indice);
    let fin = lineas.length;
    for (let siguiente = indice + 1; siguiente < lineas.length; siguiente += 1) {
      const titulo = (lineas[siguiente] ?? '').match(/^(#+)\s/);
      if (titulo !== null && (titulo[1] ?? '').length <= nivel) {
        fin = siguiente;
        break;
      }
    }
    tramos.push([indice, fin]);
  });
  return tramos;
}

function nivelDelTituloAnterior(lineas: readonly string[], desde: number): number {
  for (let indice = desde; indice >= 0; indice -= 1) {
    const titulo = (lineas[indice] ?? '').match(/^(#+)\s/);
    if (titulo !== null) return (titulo[1] ?? '').length;
  }
  return 2;
}

/** Si una linea del enunciado cae dentro de un tramo de terminal. */
export function enTerminal(
  tramos: readonly (readonly [number, number])[],
  linea: number,
): boolean {
  return tramos.some(([desde, hasta]) => linea - 1 >= desde && linea - 1 < hasta);
}
