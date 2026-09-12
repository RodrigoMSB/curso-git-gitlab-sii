/**
 * Analisis de la linea que escribe el participante.
 *
 * Separa la linea en palabras respetando comillas simples y dobles, y aisla
 * los operadores de redireccion para que `echo texto >> archivo` funcione
 * igual con espacios o sin ellos.
 */

export interface OrdenAnalizada {
  readonly programa: string;
  readonly argumentos: readonly string[];
  readonly cruda: string;
}

const OPERADORES = ['>>', '>'] as const;

/** Divide la linea en palabras y operadores. */
export function tokenizar(linea: string): readonly string[] {
  const piezas: string[] = [];
  let actual = '';
  let hayPieza = false;
  let comilla: '"' | "'" | null = null;

  const cerrarPieza = (): void => {
    if (hayPieza) {
      piezas.push(actual);
      actual = '';
      hayPieza = false;
    }
  };

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i] ?? '';

    if (comilla !== null) {
      if (caracter === comilla) comilla = null;
      else {
        actual += caracter;
        hayPieza = true;
      }
      continue;
    }

    if (caracter === '"' || caracter === "'") {
      comilla = caracter;
      hayPieza = true;
      continue;
    }

    if (caracter === ' ' || caracter === '\t') {
      cerrarPieza();
      continue;
    }

    if (caracter === '>') {
      cerrarPieza();
      const doble = linea[i + 1] === '>';
      piezas.push(doble ? '>>' : '>');
      if (doble) i += 1;
      continue;
    }

    actual += caracter;
    hayPieza = true;
  }

  cerrarPieza();
  return piezas;
}

/** Devuelve la orden analizada, o `null` si la linea esta en blanco. */
export function analizar(linea: string): OrdenAnalizada | null {
  const piezas = tokenizar(linea);
  const programa = piezas[0];
  if (programa === undefined) return null;
  return { programa, argumentos: piezas.slice(1), cruda: linea.trim() };
}

// --- Utilidades sobre los argumentos ----------------------------------------

export function esOperador(pieza: string): boolean {
  return (OPERADORES as readonly string[]).includes(pieza);
}

/** Indica si alguna de las opciones dadas aparece entre los argumentos. */
export function tieneOpcion(
  argumentos: readonly string[],
  ...nombres: readonly string[]
): boolean {
  return argumentos.some((argumento) => nombres.includes(argumento));
}

/**
 * Las letras de las opciones cortas, incluidas las que vienen agrupadas.
 *
 * `grep -rn` es una sola palabra y son dos opciones. `tieneOpcion` compara
 * palabras enteras y no las separa, que esta bien para las de Git —donde
 * agrupar no es costumbre— y no para las del interprete, donde el enunciado
 * las escribe pegadas.
 */
export function letrasCortas(argumentos: readonly string[]): ReadonlySet<string> {
  const letras = new Set<string>();
  for (const argumento of argumentos) {
    if (!/^-[a-zA-Z]+$/.test(argumento)) continue;
    for (const letra of argumento.slice(1)) letras.add(letra);
  }
  return letras;
}

/** Valor que sigue a una opcion, o `null` si la opcion no aparece o va sin valor. */
export function valorDeOpcion(
  argumentos: readonly string[],
  ...nombres: readonly string[]
): string | null {
  for (let i = 0; i < argumentos.length; i += 1) {
    const argumento = argumentos[i];
    if (argumento === undefined || !nombres.includes(argumento)) continue;
    return argumentos[i + 1] ?? null;
  }
  return null;
}

/**
 * Valor de una opcion escrita como `--nombre valor` o como `--nombre=valor`.
 *
 * Git acepta las dos formas y los enunciados usan las dos, asi que leerlas por
 * separado es como se cuela un filtro sin aplicar.
 */
export function valorDeOpcionPegado(
  argumentos: readonly string[],
  ...nombres: readonly string[]
): string | null {
  for (const argumento of argumentos) {
    const corte = argumento.indexOf('=');
    if (corte < 0) continue;
    if (nombres.includes(argumento.slice(0, corte))) return argumento.slice(corte + 1);
  }
  return valorDeOpcion(argumentos, ...nombres);
}

/**
 * Argumentos que no son opciones ni valores de opcion.
 *
 * `conValor` enumera las opciones que consumen la palabra siguiente, para que
 * el mensaje de `-m` no se confunda con un nombre de rama.
 */
export function posicionales(
  argumentos: readonly string[],
  conValor: readonly string[] = [],
): readonly string[] {
  const resultado: string[] = [];
  for (let i = 0; i < argumentos.length; i += 1) {
    const argumento = argumentos[i];
    if (argumento === undefined) continue;
    if (conValor.includes(argumento)) {
      i += 1;
      continue;
    }
    if (argumento.startsWith('-') && argumento !== '-') continue;
    resultado.push(argumento);
  }
  return resultado;
}

/** Opciones desconocidas, para poder reproducir el reclamo de Git. */
export function opcionesFuera(
  argumentos: readonly string[],
  conocidas: readonly string[],
): readonly string[] {
  return argumentos.filter(
    (argumento) =>
      argumento.startsWith('-') && argumento !== '-' && !conocidas.includes(argumento),
  );
}
