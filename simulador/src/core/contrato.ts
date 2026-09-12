/**
 * El contrato del motor (SPEC 010).
 *
 * El simulador dejo de intentar ser un Git de proposito general. Lo que se
 * compromete a ejecutar es **el guion de los laboratorios**: las ordenes que
 * aparecen en los enunciados, incluidas las de las secciones de rescate.
 *
 * Con ese acotamiento, «completo» deja de ser una opinion y pasa a ser una
 * cifra que se cuenta. Este archivo es el unico lugar donde el contrato se
 * declara (puntos 2.4 y 6.4 del SPEC 010).
 *
 * ## La regla que gobierna todo
 *
 * **La pantalla nunca acepta una orden y la ignora.** Solo hay tres
 * respuestas posibles:
 *
 * 1. La ejecuta correctamente.
 * 2. Dice que no la implementa y que en la terminal si funciona: es un limite
 *    de la herramienta, no una falla del participante.
 * 3. Dice que la orden no existe, con el mismo texto que Git.
 *
 * Aceptar una orden, no hacer nada y devolver algo plausible es lo unico que
 * este contrato viene a eliminar. Era el caso de los filtros del historial y
 * del formato de salida, que el motor recibia y descartaba en silencio.
 *
 * ## Como se hace cumplir
 *
 * Dos listas, y el despachador las consulta antes de entregarle la orden a su
 * manejador:
 *
 * - `SIN_SOPORTE` enumera las formas que el motor declara no implementar, cada
 *   una con su motivo. Se responden con el mensaje de limite.
 * - `OPCIONES` enumera, por suborden, las opciones que el manejador entiende.
 *   Una opcion que no este ahi ni caiga en `SIN_SOPORTE` no se ejecuta a
 *   medias: se responde que no esta implementada. Esa es la garantia
 *   estructural de que nada se acepta y se ignora.
 *
 * El contrato se define **por forma y no por orden literal** (punto 2.2). Si
 * el guion usa `git log --since="2024-01-01"`, lo que queda comprometido es
 * `--since` con cualquier fecha, no esa fecha.
 */

/** Forma que el motor declara no implementar, con el motivo que se le muestra al participante. */
export interface FormaSinSoporte {
  readonly patron: RegExp;
  /** Que no hace, en una frase, sin jerga de implementacion. */
  readonly motivo: string;
}

/**
 * Lo que el motor no implementa y no va a implementar.
 *
 * Hasta el SPEC 011 casi todo lo de aqui caia por la misma razon de fondo: el
 * motor modelaba nodos y punteros, no contenido de archivos. **El SPEC 012
 * modelo el contenido y con eso se vacio media lista**: `git log -S`, `--stat`,
 * `git cat-file -p`, `cat` sobre un archivo del proyecto y el parche de
 * `git show` y de `git diff` pasaron a estar implementados.
 *
 * Lo que queda no es de contenido sino de alcance: el simulador es un
 * repositorio, no el disco del participante, y la carpeta oculta se mira en la
 * terminal a proposito.
 */
export const SIN_SOPORTE: readonly FormaSinSoporte[] = [
  // --- Preguntas sobre la instalacion, que aqui no hay ----------------------
  {
    patron: /^git --version\b/,
    motivo:
      'informar la version de Git. El simulador no es una instalacion de Git: es un modelo de como funciona. La version de la tuya sale en tu terminal',
  },
  // --- Fuera del repositorio ------------------------------------------------
  {
    patron: /[>]\s*(~|\/|\.\.)/,
    motivo:
      'escribir fuera del repositorio. El simulador solo modela el recetario: un archivo guardado en tu carpeta personal no tendria donde aparecer',
  },
  {
    // `git diff` si funciona; esta es la del sistema, que el laboratorio 06 usa
    // sobre un archivo guardado en la carpeta personal y con sustitucion de
    // procesos, dos cosas que el simulador no modela.
    patron: /^diff\b/,
    motivo:
      'comparar dos archivos del disco con la orden del sistema. El simulador modela el recetario, no tu carpeta personal ni la sustitucion de procesos del interprete. `git diff` si funciona',
  },
  // --- Moverse por el disco -------------------------------------------------
  {
    patron: /^cd(\s|$)/,
    motivo:
      'moverse por tus carpetas. El simulador es este repositorio, no tu disco: ya estas parado dentro del recetario y no hay a donde ir',
  },
  {
    // Crear carpetas dentro del repositorio si se puede; fuera de el, no.
    patron: /^mkdir\b.*\s(\.\.|~|\/|taller-git-trabajo)/,
    motivo:
      'crear carpetas fuera del repositorio. El simulador solo modela el recetario en el que estas parado',
  },
  // --- Modos de interaccion que la pantalla no tiene ------------------------
  {
    patron: /^git rebase\b.*(\s)(-i|--interactive)(\s|$)/,
    motivo:
      'el rebase interactivo. Abre un editor con la lista de confirmaciones y se eligen las acciones linea por linea: no es una orden que falte, es un modo de trabajo que esta pantalla no tiene. La parte 3 del laboratorio 07 se hace en tu terminal',
  },
  // --- La carpeta oculta (punto 3.3) ---------------------------------------
  {
    // `cat` y `wc` sobre un archivo del proyecto si funcionan desde el
    // SPEC 012. Lo que sigue fuera es mirar dentro de la carpeta oculta, y no
    // por no poder: por no querer (punto 6.1 del SPEC 012).
    patron: /^(cat|ls|wc)\b.*\s\.git(\/|\b)/,
    motivo:
      'mirar dentro de la carpeta .git. Ese tramo del laboratorio 02 se hace en la terminal a proposito: fabricar una carpeta oculta de mentira enseñaria lo contrario de lo que viene a enseñar',
  },
];

/**
 * Opciones que cada suborden entiende.
 *
 * La clave es el nombre de la suborden de Git, o el de la orden del interprete
 * cuando no lleva `git` delante. Lo que no aparezca aqui se responde como no
 * implementado en vez de ejecutarse a medias.
 *
 * Hay opciones que estan en la lista y no cambian nada porque **el motor ya se
 * comporta asi**: `--decorate` en `git log` es el ejemplo, porque el simulador
 * siempre decora, igual que Git cuando escribe a un terminal. Aceptarlas no es
 * ignorarlas: es coincidir. Van anotadas donde ocurre.
 */
export const OPCIONES: Readonly<Record<string, readonly string[]>> = {
  init: ['-b', '--initial-branch', '-q', '--quiet'],
  config: ['--global', '--local', '--list', '-l', '--get', '--unset'],
  // `--source` salio: `git restore --source=<ref> <archivo>` restaura desde
  // otra confirmacion y el motor restauraba desde la actual, en silencio.
  status: ['-s', '--short', '--long'],
  add: ['-A', '--all', '-a', '-f', '--force'],
  restore: ['--staged', '--cached', '--worktree'],
  // Vale para `git rm` y para el `rm` del interprete: comparten opciones.
  rm: ['--cached', '-r', '-f', '--force', '-q', '--quiet'],
  mv: ['-f', '--force', '-v', '--verbose'],
  // `--allow-empty` salio: el motor responde «nothing to commit» y Git crea la
  // confirmacion vacia. Es la diferencia que la seccion 28 dejo anotada.
  commit: ['-m', '--message', '-a', '--all', '--amend', '--no-edit', '-c', '-C', '-q', '--quiet'],
  // `--decorate` y `--date-order`: el motor ya se comporta asi siempre.
  log: [
    '--oneline', '--graph', '--all', '--decorate', '--no-decorate', '--date-order',
    '-n', '--max-count', '--author', '--since', '--after', '--until', '--before',
    '--format', '--pretty', '--date', '--', '-S', '--stat', '-p', '--patch',
  ],
  show: ['--oneline', '--format', '--pretty', '--no-patch', '-s', '--stat', '-p', '--patch'],
  diff: ['--staged', '--cached', '--stat'],
  branch: ['-a', '--all', '-d', '--delete', '-D', '-m', '--move', '-v', '--verbose', '-q', '--quiet'],
  switch: ['-c', '--create', '-C', '--force-create', '--detach', '-q', '--quiet'],
  checkout: ['-b', '-B', '--detach', '-q', '--quiet', '--'],
  merge: ['--abort', '--continue', '--no-ff', '--ff-only', '-m', '--message', '--no-edit'],
  tag: ['-a', '--annotate', '-m', '--message', '-d', '--delete', '-l', '--list', '-n'],
  reset: ['--soft', '--mixed', '--hard'],
  // La reversion del motor nunca choca, asi que no hay nada que continuar ni
  // que abortar; `-n` aplicaba y confirmaba igual, que es lo contrario de lo
  // que pide.
  revert: ['--no-edit'],
  // `-u` salio: guardar tambien lo que no esta en seguimiento pide mover del
  // directorio a la pila archivos que la entrada no sabe llevar.
  stash: ['-m', '--message', '--stat', '--index', '-p', '--patch'],
  reflog: ['--all', '-n'],
  // `--continue` salio con `-i`: el rebase del motor no se detiene nunca, de
  // modo que no hay nada que continuar.
  rebase: ['--abort'],
  remote: ['-v', '--verbose'],
  'rev-parse': ['--short', '--abbrev-ref', '--is-inside-work-tree', '--git-dir'],
  'merge-base': [],
  'cat-file': ['-t', '-p', '-s'],
  'ls-files': ['--cached', '-c', '--others', '-o'],
  ls: ['-a', '--all', '-l', '-R'],
  mkdir: ['-p'],
  wc: ['-c', '-l', '-w'],
  grep: ['-n', '-r', '-R'],
  cd: [],
  pwd: [],
  cat: [],
  echo: [],
  clear: [],
};

/**
 * Opciones que el motor reconoce **sin tener que hacer nada**, porque el
 * comportamiento que piden ya es el que tiene siempre.
 *
 * La distincion importa. Aceptar `--decorate` y decorar igual no es ignorarla:
 * es coincidir con Git, que decora por omision cuando escribe a un terminal.
 * Aceptar `--author` y no filtrar si lo era.
 *
 * Cada una lleva escrito por que no necesita codigo, y una prueba exige que
 * toda opcion declarada en `OPCIONES` o aparezca en el motor o este aqui. Esa
 * es la garantia mecanica del punto 1: ninguna opcion se acepta y se descarta.
 */
export const EQUIVALENTES: Readonly<Record<string, string>> = {
  '--decorate': 'el simulador decora siempre, igual que Git contra un terminal',
  '--no-decorate': 'no se puede apagar la decoracion: el grafo la necesita para explicarse',
  '--date-order': 'la historia ya se recorre por fecha, de la mas reciente a la mas antigua',
  '--long': 'es la forma larga de git status, que es la de por omision',
  '--worktree': 'es el ambito por omision de git restore',
  '--quiet': 'el simulador no tiene ruido que callar',
  '-q': 'el simulador no tiene ruido que callar',
  '--verbose': 'la salida ya es la detallada',
  '-v': 'en git remote si se lee; en git branch y git mv la salida ya es la detallada',
  '--force': 'en git add pasa por encima del archivo de exclusiones, que si se lee; en git rm y git mv no hay proteccion del sistema de archivos que forzar',
  '--no-edit': 'el simulador no abre editor: acepta el mensaje propuesto',
  '--initial-branch': 'la rama inicial es main, que es lo unico que el taller usa',
  '-b': 'en git init nombra la rama inicial, que ya es main',
  '--local': 'es el ambito por omision de git config, el que se usa sin --global',
  '--get': 'es la forma explicita de consultar, que es lo que git config hace sin ella',
  '--mixed': 'es el modo por omision de git reset',
  '-p': 'en git show y git diff el parche es la forma por omision; en git stash show si se lee',
  '--patch': 'lo mismo que -p',
};

/**
 * La forma no soportada que corresponde a esta orden, si alguna.
 *
 * `linea` viene ya con los alias expandidos: lo que se declara son formas de
 * ordenes de verdad, no de los atajos que el participante escribe.
 */
export function formaSinSoporte(linea: string): FormaSinSoporte | undefined {
  return SIN_SOPORTE.find((forma) => forma.patron.test(linea));
}

/**
 * Ordenes cuyos argumentos son texto y nunca opciones.
 *
 * `echo` es la unica: todo lo que va detras es lo que se escribe en el
 * archivo. Sin esta lista, `echo "- lomo saltado" >> platos.md` respondia que
 * el simulador no implementa la opcion «- lomo saltado», porque el argumento
 * empieza con guion. Lo destapo el SPEC 012, al hacer que el arnes escribiera
 * el contenido de verdad de los enunciados: la mitad de las lineas de una
 * lista del recetario empieza con guion.
 */
const SIN_OPCIONES: ReadonlySet<string> = new Set(['echo']);

/**
 * Opciones de la orden que el motor no reconoce.
 *
 * Devuelve la lista para poder nombrarlas en el mensaje: decir «no implementa
 * --graph» sirve, decir «esa orden no se puede» no (punto 6.2).
 *
 * `--opcion=valor` se compara por el nombre, que es como Git las trata. Un
 * `--` suelto marca el fin de las opciones: lo que va detras son rutas.
 */
export function opcionesNoReconocidas(
  nombre: string,
  argumentos: readonly string[],
): readonly string[] {
  const reconocidas = OPCIONES[nombre];
  if (reconocidas === undefined) return [];
  if (SIN_OPCIONES.has(nombre)) return [];

  const fuera: string[] = [];
  for (const argumento of argumentos) {
    if (argumento === '--') break;
    if (!argumento.startsWith('-') || argumento === '-') continue;
    // Una opcion nunca lleva espacios: lo que los lleva es el valor de una
    // opcion, como el mensaje de `git commit -m "- se quita la cazuela"`.
    if (/\s/.test(argumento)) continue;
    const clave = argumento.split('=')[0] ?? argumento;
    if (reconocidas.includes(clave)) continue;
    // `-3` es la forma corta de `-n 3`, y Git la acepta en log y en show.
    if (/^-\d+$/.test(clave) && reconocidas.includes('-n')) continue;
    // Las opciones cortas agrupadas, como `-am`, se miran letra por letra.
    if (/^-[a-zA-Z]{2,}$/.test(clave)) {
      const sueltas = [...clave.slice(1)].map((letra) => `-${letra}`);
      if (sueltas.every((suelta) => reconocidas.includes(suelta))) continue;
    }
    fuera.push(clave);
  }
  return fuera;
}
