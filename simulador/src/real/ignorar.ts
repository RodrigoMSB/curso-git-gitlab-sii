/**
 * Las exclusiones de un repositorio real (SPEC 020, 2.4).
 *
 * El motor del simulador cubre a proposito solo la sintaxis que usa el guion
 * (`src/core/exclusiones.ts`). Un repositorio real puede traer cualquier cosa,
 * asi que aqui va la sintaxis entera de `gitignore`: negaciones, `**`, `?`,
 * clases de caracteres, escapes, un `.gitignore` por carpeta y
 * `.git/info/exclude`, con la precedencia de Git: gana el archivo mas hondo, y
 * dentro de un archivo la ultima regla que coincide.
 *
 * No se lee `core.excludesFile`: vive fuera del repositorio, en la carpeta del
 * usuario, y la pagina solo ve la carpeta que el alumno eligio.
 */

interface Regla {
  readonly expresion: RegExp;
  readonly negada: boolean;
  readonly soloCarpetas: boolean;
  /** Sin barra en el medio: se mide contra el nombre suelto, en cualquier nivel. */
  readonly porNombre: boolean;
}

export interface GrupoDeReglas {
  /** La carpeta del `.gitignore`, relativa a la raiz, sin barra final ('' en la raiz). */
  readonly base: string;
  readonly reglas: readonly Regla[];
}

const CLASES: Readonly<Record<string, string>> = {
  alnum: 'a-zA-Z0-9',
  alpha: 'a-zA-Z',
  blank: ' \\t',
  cntrl: '\\x00-\\x1f\\x7f',
  digit: '0-9',
  graph: '\\x21-\\x7e',
  lower: 'a-z',
  print: '\\x20-\\x7e',
  punct: '!-\\/:-@\\[-`{-~',
  space: ' \\t\\n\\r\\f\\v',
  upper: 'A-Z',
  xdigit: '0-9A-Fa-f',
};

function escaparLiteral(c: string): string {
  return c.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
}

/** Traduce un patron de `wildmatch` con WM_PATHNAME a una expresion regular. */
export function traducir(patron: string): string {
  let salida = '';
  let i = 0;
  while (i < patron.length) {
    const c = patron[i] ?? '';
    if (c === '\\') {
      salida += escaparLiteral(patron[i + 1] ?? '');
      i += 2;
    } else if (c === '*') {
      let fin = i;
      while (patron[fin] === '*') fin += 1;
      const doble = fin - i >= 2;
      const antesBarra = i === 0 || patron[i - 1] === '/';
      const despuesBarra = fin === patron.length || patron[fin] === '/';
      if (doble && antesBarra && despuesBarra) {
        if (fin === patron.length) {
          // `algo/**`: todo lo que hay dentro.
          salida += '.*';
          i = fin;
        } else {
          // `**/` al comienzo o `/**/` en el medio: cero o mas carpetas.
          salida += '(?:.*/)?';
          i = fin + 1;
        }
      } else {
        salida += '[^/]*';
        i = fin;
      }
    } else if (c === '?') {
      salida += '[^/]';
      i += 1;
    } else if (c === '[') {
      let j = i + 1;
      let clase = '';
      if (patron[j] === '!' || patron[j] === '^') {
        clase += '^';
        j += 1;
      }
      let primero = true;
      let cerrada = false;
      while (j < patron.length) {
        const d = patron[j] ?? '';
        if (d === ']' && !primero) {
          cerrada = true;
          break;
        }
        primero = false;
        if (d === '[' && patron[j + 1] === ':') {
          const cierre = patron.indexOf(':]', j + 2);
          const nombre = cierre < 0 ? '' : patron.slice(j + 2, cierre);
          const rango = CLASES[nombre];
          if (rango !== undefined) {
            clase += rango;
            j = cierre + 2;
            continue;
          }
        }
        if (d === '\\') {
          clase += escaparLiteral(patron[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (patron[j + 1] === '-' && patron[j + 2] !== undefined && patron[j + 2] !== ']') {
          clase += `${escaparLiteral(d)}-${escaparLiteral(patron[j + 2] ?? '')}`;
          j += 3;
          continue;
        }
        clase += escaparLiteral(d);
        j += 1;
      }
      if (!cerrada) {
        // Un corchete sin cerrar no es una clase: Git no lo hace coincidir con nada.
        return '(?!)';
      }
      // Una clase nunca coincide con la barra.
      salida += clase.startsWith('^') ? `[${clase}/]` : `(?!/)[${clase}]`;
      i = j + 1;
    } else {
      salida += escaparLiteral(c);
      i += 1;
    }
  }
  return salida;
}

/** Quita los espacios finales que no esten escapados. */
function sinEspaciosFinales(linea: string): string {
  let fin = linea.length;
  while (fin > 0 && linea[fin - 1] === ' ') {
    let barras = 0;
    for (let k = fin - 2; k >= 0 && linea[k] === '\\'; k -= 1) barras += 1;
    if (barras % 2 === 1) break;
    fin -= 1;
  }
  return linea.slice(0, fin);
}

export function leerReglas(texto: string, base: string, ignorarMayusculas: boolean): GrupoDeReglas {
  const reglas: Regla[] = [];
  for (const cruda of texto.split(/\r?\n/)) {
    let linea = sinEspaciosFinales(cruda);
    if (linea === '' || linea.startsWith('#')) continue;
    let negada = false;
    if (linea.startsWith('!')) {
      negada = true;
      linea = linea.slice(1);
    }
    let soloCarpetas = false;
    if (linea.endsWith('/') && !linea.endsWith('\\/')) {
      soloCarpetas = true;
      linea = linea.slice(0, -1);
    }
    if (linea === '') continue;
    const porNombre = !linea.includes('/');
    if (linea.startsWith('/')) linea = linea.slice(1);
    reglas.push({
      expresion: new RegExp(`^${traducir(linea)}$`, ignorarMayusculas ? 'i' : ''),
      negada,
      soloCarpetas,
      porNombre,
    });
  }
  return { base, reglas };
}

/**
 * Si la ruta queda excluida por los grupos, del de mas precedencia al de menos.
 * Devuelve null si ninguna regla habla de ella.
 */
export function excluida(grupos: readonly GrupoDeReglas[], ruta: string, esCarpeta: boolean): boolean | null {
  const nombre = ruta.slice(ruta.lastIndexOf('/') + 1);
  for (const grupo of grupos) {
    if (grupo.base !== '' && !ruta.startsWith(`${grupo.base}/`)) continue;
    const relativa = grupo.base === '' ? ruta : ruta.slice(grupo.base.length + 1);
    for (let k = grupo.reglas.length - 1; k >= 0; k -= 1) {
      const regla = grupo.reglas[k];
      if (regla === undefined || (regla.soloCarpetas && !esCarpeta)) continue;
      if (regla.expresion.test(regla.porNombre ? nombre : relativa)) return !regla.negada;
    }
  }
  return null;
}
