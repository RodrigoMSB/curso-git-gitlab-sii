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
 * Opciones que cada suborden de Git entiende.
 *
 * La clave es el nombre de la suborden. Lo que no aparezca aqui se responde
 * como no implementado en vez de ejecutarse a medias.
 *
 * Hay opciones que estan en la lista y no cambian nada porque **el motor ya se
 * comporta asi**: `--decorate` en `git log` es el ejemplo, porque el simulador
 * siempre decora, igual que Git cuando escribe a un terminal. Aceptarlas no es
 * ignorarlas: es coincidir. Cada una esta en `EQUIVALENTES`, con su motivo.
 *
 * La seccion 59 de docs/arquitectura.md saco de aqui y de la tabla del
 * interprete cuarenta y una opciones que el manejador de su orden no leia,
 * cuando la prueba del contrato paso a leer el codigo por subcomando. Entre
 * ellas `-q` en todas partes, declarada equivalente porque «no hay ruido que
 * callar» cuando `git commit` si lo hace; `-a` de `git commit`, que confirmaba
 * solo lo preparado; y `git tag -l` y `git reflog -n`, que no devolvian nada.
 */
export const OPCIONES: Readonly<Record<string, readonly string[]>> = {
  init: ['-b', '--initial-branch'],
  config: ['--global', '--local', '--list', '-l', '--get', '--unset'],
  status: ['-s', '--short', '--long'],
  add: ['-A', '--all', '-a', '-f', '--force'],
  // `--source` salio: `git restore --source=<ref> <archivo>` restaura desde
  // otra confirmacion y el motor restauraba desde la actual, en silencio.
  restore: ['--staged', '--cached', '--worktree'],
  rm: ['--cached', '-r', '-f', '--force'],
  mv: [],
  // `--allow-empty` salio: el motor responde «nothing to commit» y Git crea la
  // confirmacion vacia. Es la diferencia que la seccion 28 dejo anotada.
  commit: ['-m', '--message', '--amend', '--no-edit', '-c', '-C'],
  log: [
    '--oneline', '--graph', '--all', '--decorate', '--no-decorate', '--date-order',
    '-n', '--max-count', '--author', '--since', '--after', '--until', '--before',
    '--format', '--pretty', '--date', '--', '-S', '--stat', '-p', '--patch',
  ],
  show: ['--format', '--pretty', '--no-patch', '-s', '--stat', '-p', '--patch'],
  diff: ['--staged', '--cached', '--stat'],
  branch: ['-d', '--delete', '-D', '-m', '--move'],
  switch: ['-c', '--create', '-C', '--force-create', '--detach'],
  checkout: ['-b', '-B', '--detach', '--'],
  merge: ['--abort', '--continue', '--no-ff', '--ff-only', '-m', '--no-edit'],
  tag: ['-a', '--annotate', '-m', '--message', '-d', '--delete'],
  reset: ['--soft', '--mixed', '--hard'],
  // La reversion del motor nunca choca, asi que no hay nada que continuar ni
  // que abortar; `-n` aplicaba y confirmaba igual, que es lo contrario de lo
  // que pide.
  revert: ['--no-edit'],
  // `-u` salio: guardar tambien lo que no esta en seguimiento pide mover del
  // directorio a la pila archivos que la entrada no sabe llevar.
  stash: ['-m', '--message', '--stat', '--index', '-p', '--patch'],
  reflog: [],
  // `--continue` salio con `-i`: el rebase del motor no se detiene nunca, de
  // modo que no hay nada que continuar. `--abort` se queda porque el
  // laboratorio 07 lo nombra, y responde lo mismo que Git sin rebase en curso.
  rebase: ['--abort'],
  remote: ['-v', '--verbose'],
  'rev-parse': ['--short', '--abbrev-ref', '--is-inside-work-tree', '--git-dir'],
  'merge-base': [],
  'cat-file': ['-t', '-p'],
  'ls-files': ['--cached', '-c', '--others', '-o'],
};

/**
 * Opciones de las ordenes del interprete.
 *
 * Van aparte de las de Git porque dos nombres se repiten: `rm` y `mv` existen
 * en los dos lados y no aceptan lo mismo. Con una sola tabla, `rm --cached`
 * del interprete, que en bash no existe, pasaba por la opcion de `git rm`.
 */
export const OPCIONES_INTERPRETE: Readonly<Record<string, readonly string[]>> = {
  ls: ['-a', '--all', '-R'],
  mkdir: ['-p'],
  mv: [],
  rm: [],
  wc: ['-c', '-l', '-w'],
  grep: ['-n', '-r', '-R'],
  cd: [],
  pwd: [],
  cat: [],
  echo: [],
  clear: [],
};

/**
 * Ordenes del interprete que aceptan opciones cortas agrupadas, como `-rn`.
 *
 * Son las que las leen letra por letra, con `letrasCortas`. En el resto, y en
 * todas las de Git, una opcion agrupada se responde como no implementada: sus
 * manejadores comparan palabras enteras, y `git commit -am` se aceptaba y
 * llegaba al manejador sin `-a` ni `-m` a la vista.
 */
export const AGRUPABLES: ReadonlySet<string> = new Set(['ls', 'grep', 'wc']);

/**
 * Opciones que el motor reconoce **sin tener que hacer nada**, porque el
 * comportamiento que piden ya es el que tiene siempre.
 *
 * La distincion importa. Aceptar `--decorate` y decorar igual no es ignorarla:
 * es coincidir con Git, que decora por omision cuando escribe a un terminal.
 * Aceptar `--author` y no filtrar si lo era.
 *
 * **La clave es la orden y la opcion juntas.** Hasta la seccion 59 la clave
 * era la opcion sola, y el motivo de una orden eximia a todas: `-q` valia
 * para `git init` y con eso tambien para `git commit`, que si imprime algo
 * que callar.
 *
 * Cada una lleva escrito por que no necesita codigo, y una prueba exige que
 * toda opcion declarada o la lea el manejador de su orden o este aqui. Esa es
 * la garantia mecanica del punto 1: ninguna opcion se acepta y se descarta.
 */
export const EQUIVALENTES: Readonly<Record<string, string>> = {
  'git init -b': 'nombra la rama inicial, que ya es main',
  'git init --initial-branch': 'lo mismo que -b',
  'git config --local': 'es el ambito por omision de git config, el que se usa sin --global',
  'git config --get': 'es la forma explicita de consultar, que es lo que git config hace sin ella',
  'git status --long': 'es la forma larga de git status, que es la de por omision',
  'git restore --worktree': 'es el ambito por omision de git restore',
  'git commit --no-edit': 'el simulador no abre editor: acepta el mensaje propuesto',
  'git log --decorate': 'el simulador decora siempre, igual que Git contra un terminal',
  'git log --no-decorate': 'no se puede apagar la decoracion: el grafo la necesita para explicarse',
  'git log --date-order': 'la historia ya se recorre por fecha, de la mas reciente a la mas antigua',
  'git show -p': 'el parche es la forma por omision de git show',
  'git show --patch': 'lo mismo que -p',
  'git reset --mixed': 'es el modo por omision de git reset',
  'git revert --no-edit': 'el simulador no abre editor: acepta el mensaje propuesto',
  'git rev-parse --short': 'los identificadores del simulador ya son cortos: no hay forma larga que acortar',
  'git ls-files --cached': 'es el modo por omision de git ls-files',
  'git ls-files -c': 'lo mismo que --cached',
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
  lado: 'git' | 'interprete',
): readonly string[] {
  const reconocidas = (lado === 'git' ? OPCIONES : OPCIONES_INTERPRETE)[nombre];
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
    // Las opciones cortas agrupadas, como `-rn`, se miran letra por letra en
    // las ordenes que las leen asi, y solo en esas.
    if (lado === 'interprete' && AGRUPABLES.has(nombre) && /^-[a-zA-Z]{2,}$/.test(clave)) {
      const sueltas = [...clave.slice(1)].map((letra) => `-${letra}`);
      if (sueltas.every((suelta) => reconocidas.includes(suelta))) continue;
    }
    fuera.push(clave);
  }
  return fuera;
}
