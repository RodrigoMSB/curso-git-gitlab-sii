/**
 * Las ordenes salen del enunciado (seccion 2 del SPEC 008).
 *
 * No hay una lista escrita aparte, a proposito: una lista aparte se
 * desincroniza del enunciado la primera vez que alguien corrige un paso, y a
 * partir de ahi la prueba valida un laboratorio que ya no existe.
 *
 * Este modulo lee el `README.md` del laboratorio, saca sus bloques de ordenes
 * en orden y clasifica cada linea. La clasificacion decide que se ejecuta en
 * cada lado, y esta pensada para que nada se salte en silencio.
 */

import { ORDENES_GIT, ORDENES_INTERPRETE } from '../../src/core';
import { declaracionPorId } from '../../src/escenarios';

/** Que hacer con una linea del enunciado. */
export type Clase =
  /** Se ejecuta en los dos lados y se comparan los estados. */
  | 'comparada'
  /** Se ejecuta solo en Git real: el simulador no la soporta. */
  | 'solo-git'
  /** No se ejecuta en ninguno de los dos lados. */
  | 'omitida';

export interface OrdenDelEnunciado {
  readonly texto: string;
  readonly clase: Clase;
  /** Por que no se compara. Vacio cuando si se compara. */
  readonly motivo: string;
  /** Numero de linea del enunciado, para que un fallo se pueda ubicar. */
  readonly linea: number;
}

/**
 * Que una orden corte el recorrido comparado **no se decide con una lista**.
 *
 * Se decide mirando lo que hizo: si una orden que el motor no implementa
 * cambia el estado del repositorio real, desde ahi el simulador se queda atras
 * y comparar deja de decir nada. Si no lo cambia, como `git lg` sobre un alias
 * que no existe o un `cat` de la carpeta oculta, el recorrido sigue.
 *
 * La comprobacion vive en `cypress/e2e/laboratorios.cy.ts`, que es donde se
 * tiene el estado antes y despues.
 */

/**
 * Ordenes que el motor del simulador no implementa.
 *
 * Es el unico lugar donde se declaran (punto 6.2). Cada una lleva su motivo, y
 * la prueba informa cuantas se saltaron: un laboratorio donde se salta la mitad
 * de las ordenes no esta probado y hay que saberlo.
 *
 * Se siguen ejecutando en Git real, para que el repositorio no se desalinee de
 * ahi en adelante.
 */
export const SIN_SOPORTE: readonly { readonly patron: RegExp; readonly motivo: string }[] = [
  {
    patron: /^cd\b/,
    motivo: 'el simulador trabaja siempre sobre el repositorio del escenario; no hay donde moverse',
  },
  {
    patron: /^(cat|ls)\s+\.git\b/,
    motivo: 'el simulador no modela el contenido de la carpeta oculta; la parte 4 del laboratorio 02 la mira en el disco',
  },
  {
    patron: /^git config\b.*--list/,
    motivo: 'el motor no lista la configuracion completa',
  },
  {
    patron: /^git log\b.*\s-S(\s|$)/,
    motivo:
      'el motor no implementa la busqueda por contenido: no versiona contenido que buscar',
  },
  {
    patron: /^git log\b.*\s--\s/,
    motivo: 'el motor no implementa el filtrado del historial por archivo',
  },
  {
    patron: /^git log\b.*--(author|since|until)=/,
    motivo:
      'el motor acepta el filtro y lo ignora: muestra la historia entera (seccion 28 de docs/arquitectura.md)',
  },
  {
    patron: /^git log\b.*--format=/,
    motivo: 'el motor acepta el formato y lo ignora: muestra siempre la forma larga',
  },
  {
    patron: /^git (log|show)\b.*--stat\b/,
    motivo: 'el motor no produce el resumen de lineas cambiadas',
  },
  {
    patron: /^git log\b.*\s[^\s]+\.\.[^\s]+/,
    motivo: 'el motor no implementa el rango «a..b» del historial',
  },
  {
    patron: /^git switch\b.*(--detach|HEAD[~^])/,
    motivo:
      'el motor no resuelve referencias relativas en git switch, aunque si en git checkout (seccion 28 de docs/arquitectura.md)',
  },
  {
    patron: /^git\b.*[^>]>[^>]/,
    motivo: 'el interprete del simulador solo redirige la salida de echo, no la de Git',
  },
  {
    patron: /^git commit\b.*\s-c\s/,
    motivo: 'el motor no implementa reutilizar el mensaje de otra confirmacion con -c',
  },
];

/**
 * Si el motor conoce el verbo de la orden.
 *
 * Se le pregunta al propio motor en vez de mantener una lista a mano: asi el
 * dia que el motor aprenda una orden nueva, la prueba la recoge sola y deja de
 * saltarla. Lo que queda en `SIN_SOPORTE` son los casos donde el verbo si
 * existe pero esa forma concreta no.
 */
function verboConocido(texto: string): boolean {
  const piezas = texto.split(/\s+/);
  const primera = piezas[0] ?? '';
  if (primera !== 'git') return Object.hasOwn(ORDENES_INTERPRETE, primera);
  const sub = piezas[1] ?? '';
  return Object.hasOwn(ORDENES_GIT, sub);
}

/** Lineas que no son ordenes ejecutables en ningun lado. */
const NO_EJECUTABLES: readonly { readonly patron: RegExp; readonly motivo: string }[] = [
  {
    patron: /<[^>]+>/,
    motivo: 'lleva un marcador de posicion que el participante reemplaza a mano',
  },
  {
    patron: /^(labs\/lab-\d+\/preparar\.sh|\.\/preparar\.sh|\.\/verificar\.sh)/,
    motivo: 'la preparacion la corre el arnes antes de empezar',
  },
];

/** Bloques que no son ordenes, sino contenido de archivos que el enunciado muestra. */
function pareceOrden(linea: string): boolean {
  const primera = linea.split(/\s+/)[0] ?? '';
  return /^(git|ls|cat|pwd|echo|cd|mkdir|wc|labs|\.\/)/.test(primera);
}

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

/** Clasifica cada linea de orden del enunciado, en el orden en que aparece. */
export function ordenesDe(enunciado: string): readonly OrdenDelEnunciado[] {
  const ordenes: OrdenDelEnunciado[] = [];

  for (const bloque of bloquesDe(enunciado)) {
    bloque.contenido.split('\n').forEach((cruda, desplazamiento) => {
      const texto = cruda.trim();
      const linea = bloque.linea + desplazamiento;
      if (texto === '' || !pareceOrden(texto)) return;

      const noEjecutable = NO_EJECUTABLES.find((regla) => regla.patron.test(texto));
      if (noEjecutable !== undefined) {
        ordenes.push({
          texto,
          clase: 'omitida',
          motivo: noEjecutable.motivo,
          linea
        });
        return;
      }

      const sinSoporte = SIN_SOPORTE.find((regla) => regla.patron.test(texto));
      if (sinSoporte !== undefined) {
        ordenes.push({
          texto,
          clase: 'solo-git',
          motivo: sinSoporte.motivo,
          linea
        });
        return;
      }

      if (!verboConocido(texto)) {
        const verbo = texto.startsWith('git ') ? texto.split(/\s+/).slice(0, 2).join(' ') : texto.split(/\s+/)[0];
        ordenes.push({
          texto,
          clase: 'solo-git',
          motivo: `el motor no implementa «${verbo}»`,
          linea
        });
        return;
      }

      ordenes.push({ texto, clase: 'comparada', motivo: '', linea });
    });
  }
  return ordenes;
}

/** Resumen para el informe del punto 6.3. */
export function resumen(ordenes: readonly OrdenDelEnunciado[]): {
  readonly total: number;
  readonly comparadas: number;
  readonly soloGit: number;
  readonly omitidas: number;
} {
  return {
    total: ordenes.length,
    comparadas: ordenes.filter((orden) => orden.clase === 'comparada').length,
    soloGit: ordenes.filter((orden) => orden.clase === 'solo-git').length,
    omitidas: ordenes.filter((orden) => orden.clase === 'omitida').length,
  };
}

/**
 * Resuelve los marcadores de posicion que el enunciado deja a proposito.
 *
 * El enunciado escribe `git restore <archivo>` para que el participante mire
 * su `git status` y decida cual es. La prueba no puede decidir eso, pero
 * tampoco conviene saltarse los dos pasos centrales del laboratorio 02.
 *
 * El valor **no se escribe a mano**: sale de la declaracion del escenario, que
 * ya es la unica fuente de la forma del laboratorio (SPEC 007). Si el escenario
 * cambia de archivo, esto cambia con el.
 *
 * Los marcadores que nombran un identificador de confirmacion se quedan sin
 * resolver: los identificadores del simulador y los de Git no coinciden por
 * diseño, asi que no hay un unico valor que sirva en los dos lados. Todos ellos
 * son ordenes de solo mirar, de modo que no desalinean nada.
 */
export function resolverMarcadores(
  ordenes: readonly OrdenDelEnunciado[],
  numeroDeLaboratorio: string,
): readonly OrdenDelEnunciado[] {
  const declaracion = declaracionPorId(`lab-${numeroDeLaboratorio}`);
  if (declaracion === undefined) return ordenes;

  const conEstado = (estado: string): string | undefined =>
    declaracion.archivos.find((archivo) => archivo.estado === estado)?.nombre;

  const sustituciones: readonly { readonly patron: RegExp; readonly valor: string | undefined }[] = [
    { patron: /^git restore --staged <archivo>$/, valor: conEstado('preparado') },
    { patron: /^git restore <archivo>$/, valor: conEstado('modificado') },
  ];

  return ordenes.map((orden) => {
    if (orden.clase !== 'omitida') return orden;
    const sustitucion = sustituciones.find((candidata) => candidata.patron.test(orden.texto));
    if (sustitucion === undefined || sustitucion.valor === undefined) return orden;
    return {
      ...orden,
      texto: orden.texto.replace('<archivo>', sustitucion.valor),
      clase: 'comparada' as const,
      motivo: '',
    };
  });
}
