/**
 * Las ordenes que la consola del taller reconoce, en un solo lugar (SPEC 027,
 * punto 3.1).
 *
 * Son las que escriben los enunciados, las de uso comun en bash y las propias
 * de la consola. Sirven para una sola cosa: notar cuando en una linea hay dos
 * ordenes escritas una detras de la otra, sin nada que las separe.
 */

/** Las de los enunciados y las de uso comun en bash. */
export const ORDENES_DE_BASH = [
  'git',
  'cd',
  'ls',
  'cat',
  'echo',
  'printf',
  'mkdir',
  'rm',
  'rmdir',
  'mv',
  'cp',
  'touch',
  'pwd',
  'grep',
  'wc',
  'diff',
  'comm',
  'cut',
  'head',
  'tail',
  'sort',
  'chmod',
  'code',
] as const;

/** Las propias de la consola del taller, que no son de bash. */
export const ORDENES_PROPIAS = ['preparar', 'verificar', 'ayuda', 'clear'] as const;

export const ORDENES_CONOCIDAS: readonly string[] = [...ORDENES_DE_BASH, ...ORDENES_PROPIAS];

interface Palabra {
  readonly texto: string;
  readonly citada: boolean;
}

/**
 * Las palabras de la linea, como las separa bash: una palabra entre comillas es
 * una sola aunque tenga espacios. Devuelve null si la linea tiene algo que
 * separa ordenes, o sustituciones y subcapas, que ya no son dos ordenes pegadas.
 */
function palabras(linea: string): readonly Palabra[] | null {
  const resultado: Palabra[] = [];
  let actual = '';
  let citada = false;
  let comilla: string | null = null;
  const cerrar = (): void => {
    if (actual !== '' || citada) resultado.push({ texto: actual, citada });
    actual = '';
    citada = false;
  };
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i] ?? '';
    if (comilla !== null) {
      if (c === comilla) comilla = null;
      else actual += c;
      continue;
    }
    if (c === '"' || c === "'") {
      comilla = c;
      citada = true;
      continue;
    }
    if (c === '\\') {
      actual += linea[++i] ?? '';
      continue;
    }
    if (';&|\n()`'.includes(c) || (c === '$' && linea[i + 1] === '(')) return null;
    if (/\s/.test(c)) {
      cerrar();
      continue;
    }
    actual += c;
  }
  cerrar();
  return resultado;
}

/**
 * Si la linea parece dos ordenes escritas sin separar, las ordenes que se ven
 * en ella; si no, null.
 *
 * `mkdir -p lab-01/recetario cd lab-01/recetario` crea tres carpetas, una de
 * ellas llamada `cd`, y bash no dice nada. Aqui se nota que despues de
 * `mkdir` aparece `cd` suelto. La primera palabra tiene que ser una orden
 * conocida, y la segunda palabra de `git` no cuenta, porque `git diff` y
 * `git mv` son una sola orden.
 */
export function ordenesPegadas(linea: string): readonly string[] | null {
  const lista = palabras(linea.trim());
  if (lista === null || lista.length < 2) return null;
  const primera = lista[0];
  if (primera === undefined || primera.citada || !ORDENES_CONOCIDAS.includes(primera.texto)) return null;
  // Tras git, la suborden no cuenta, y en las que tienen subordenes propias,
  // como `git stash clear`, tampoco la siguiente.
  const sub = lista[1]?.texto ?? '';
  const desde = primera.texto !== 'git' ? 1 : CON_SUBORDENES.includes(sub) ? 3 : 2;
  const otras = lista.slice(desde).filter((p) => !p.citada && ORDENES_CONOCIDAS.includes(p.texto));
  if (otras.length === 0) return null;
  return [primera.texto, ...otras.map((p) => p.texto)];
}

/** Ordenes de git que llevan una suborden propia: `git stash clear`, `git remote add`. */
const CON_SUBORDENES: readonly string[] = ['stash', 'remote', 'worktree', 'submodule', 'bisect', 'notes', 'sparse-checkout', 'maintenance'];

/** Si la orden es propia de la consola del taller, y no de bash. */
export function esOrdenPropia(linea: string): boolean {
  const primera = linea.trim().split(/\s+/)[0] ?? '';
  return (ORDENES_PROPIAS as readonly string[]).includes(primera);
}

/** Lo que dice `ayuda`, una linea por orden propia (punto 4.5). */
export const AYUDA: readonly string[] = [
  'Además de Git y bash, la consola del taller entiende estas órdenes.',
  '  preparar 02            arma el laboratorio 02 y deja la consola en su carpeta',
  '  preparar 02 --forzar   lo arma de nuevo, y borra lo que hiciste en él',
  '  verificar 02           comprueba si el laboratorio 02 quedó hecho',
  '  clear                  limpia la consola',
  '  ayuda                  muestra esta lista',
  'Sin número, preparar y verificar usan el laboratorio donde está la consola.',
];
