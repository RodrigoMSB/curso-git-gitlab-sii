/**
 * Los scripts de cada laboratorio, corridos como los corre el participante
 * (SPEC 021).
 *
 * Por cada laboratorio: se monta un clon del curso (que es un repositorio de
 * verdad, como en la sala), se corre `preparar.sh`, se hace el laboratorio
 * siguiendo su enunciado orden por orden, y al final se corre `verificar.sh`.
 * Todo tiene que terminar bien. Es lo que en Windows fallaba: la verificacion
 * comparaba la ruta de Bash, `/c/Users/...`, con la de Git, `C:/Users/...`.
 *
 * Y la proteccion contra el anidamiento sigue funcionando: un recetario sin
 * `.git` propio dentro de otro repositorio se reclama.
 *
 * Lo corre GitHub Actions en Windows y en Mac, en cada cambio a `main`.
 *
 * Las ordenes salen del enunciado con el mismo soporte que usa el recorrido
 * del simulador. Se sigue hasta la seccion «Si algo salio mal», que es para
 * quien se perdio y deshace lo hecho.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { configuracionDelTaller } from '../cypress/soporte/enunciado';
import { aliasDelTaller, ordenesDe, ordenPara, resolverMarcadores } from '../cypress/soporte/ordenes';
import { type Corrida, carpetaTemporal, entorno, preparar, verificar } from './laboratorios-en-disco';

const LABS = fileURLToPath(new URL('../../labs', import.meta.url));
const TODOS = ['01', '02', '03', '04', '05', '06', '07', '08'];
const montados: string[] = [];

afterAll(() => {
  for (const raiz of montados) rmSync(raiz, { recursive: true, force: true });
});

function enunciado(numero: string): string {
  // En un clon de Windows el enunciado puede bajar con CRLF; se lee igual.
  return readFileSync(join(LABS, `lab-${numero}`, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
}

interface Montado {
  readonly raiz: string;
  readonly clon: string;
  readonly carpeta: string;
  readonly recetario: string;
  readonly configGlobal: string;
}

/** El clon del curso con el laboratorio dentro, y el clon es un repositorio de verdad. */
function montar(numero: string): Montado {
  const raiz = carpetaTemporal();
  montados.push(raiz);
  const clon = join(raiz, 'curso-git-gitlab-sii');
  const carpeta = join(clon, 'labs', `lab-${numero}`);
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    const origen = join(LABS, `lab-${numero}`, archivo);
    if (!existsSync(origen)) continue;
    cpSync(origen, join(carpeta, archivo));
    chmodSync(join(carpeta, archivo), 0o755);
  }
  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '');
  const env = entorno(configGlobal);
  // Desde el 02, el participante llega con lo que dejo puesto en el 01:
  // identidad y alias, sacados de ese enunciado. En Mac, Git inventa una
  // identidad con el nombre de la maquina y sin esto igual confirmaba; en
  // Windows no, y la prueba fallaba por algo que ningun participante vive.
  if (numero !== '01') {
    for (const [clave, valor] of configuracionDelTaller(enunciado('01'))) {
      execFileSync('git', ['config', '--global', clave, valor], { env, stdio: 'ignore' });
    }
  }
  const git = (...args: string[]): void => {
    execFileSync('git', ['-C', clon, '-c', 'user.name=Curso', '-c', 'user.email=curso@sii.cl', ...args], { env, stdio: 'ignore' });
  };
  git('init', '-q');
  writeFileSync(join(clon, 'README.md'), 'el repositorio del curso\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'el curso');
  return { raiz, clon, carpeta, recetario: join(raiz, 'taller-git-trabajo', `lab-${numero}`, 'recetario'), configGlobal };
}

/**
 * Lo que el enunciado pide hacer a mano y no es una orden: editar un archivo,
 * elegir acciones en el rebase interactivo, escribir un mensaje en el editor.
 * El soporte que extrae las ordenes no lo ve, asi que se declara aqui.
 *
 * Cada paso va anclado a la frase del enunciado que lo pide, y se hace justo
 * antes de la primera orden que viene despues de esa frase; el editor, en
 * cambio, se abre con la orden que la frase explica, la ultima antes de ella. Si la frase
 * desaparece del enunciado, la prueba falla: un paso a mano que ya no se pide
 * no puede seguir haciendose en silencio.
 */
interface PasoAMano {
  readonly ancla: string;
  /** Lo que se hace en la terminal, parado donde esta el participante. */
  readonly bash?: string;
  /** Escribir un archivo con el bloque de codigo que sigue a la frase. */
  readonly archivo?: string;
  /** Para la orden que la frase explica, la ultima antes de ella: que elige en la lista del rebase y que mensaje escribe. */
  readonly editor?: { readonly lista: string; readonly mensaje: string };
}

const A_MANO: Readonly<Record<string, readonly PasoAMano[]>> = {
  '01': [
    {
      ancla: 'Y agrega una línea al final de `cocineros.md`',
      bash: "printf '%s\\n' '- sopaipillas' >> platos.md && printf '%s\\n' '- zapallo' >> ingredientes.md && printf '%s\\n' '- Pedro' >> cocineros.md",
    },
  ],
  '05': [
    {
      ancla: 'Abre `platos.md` en tu editor y déjalo con las dos versiones combinadas',
      bash: "sed -i.bak -e '/^<<<<<<< /d' -e '/^=======$/d' -e '/^>>>>>>> /d' platos.md && rm -f platos.md.bak",
    },
  ],
  '07': [
    {
      ancla: 'Cambia la primera línea a `reword`',
      editor: { lista: "sed -i.bak '1s/^pick/reword/' \"$1\"", mensaje: 'agrega la receta del curry massaman' },
    },
    {
      // En el editor del squash queda solo el mensaje del reword, como pide el enunciado.
      ancla: 'Ahora deja la primera y la última con `pick`',
      editor: {
        lista: "n=$(grep -c '^pick' \"$1\"); sed -i.bak \"2,$((n - 1))s/^pick/squash/\" \"$1\"",
        mensaje: 'agrega la receta del curry massaman',
      },
    },
  ],
  '08': [
    { ancla: 'Crea el archivo `.git/hooks/commit-msg` con este contenido.', archivo: '.git/hooks/commit-msg' },
    { ancla: 'Y dale permiso de ejecución', bash: 'chmod +x .git/hooks/commit-msg' },
  ],
};

/** El primer bloque de codigo que sigue a una linea del enunciado. */
function bloqueDespuesDe(lineas: readonly string[], desde: number): string {
  const abre = lineas.findIndex((linea, i) => i > desde && linea.startsWith('```'));
  const cierra = lineas.findIndex((linea, i) => i > abre && linea.startsWith('```'));
  return lineas.slice(abre + 1, cierra).join('\n');
}

/**
 * Hace el laboratorio desde la raiz del clon, que es donde el enunciado deja
 * parado al participante. La carpeta actual se conserva de una orden a la
 * siguiente, como en una terminal.
 */
function hacerElLaboratorio(numero: string, lab: Montado): { problemas: readonly string[]; registro: string } {
  const alias = aliasDelTaller(enunciado('01'));
  const ordenes = resolverMarcadores(ordenesDe(enunciado(numero), alias), numero, alias);
  const rescate = enunciado(numero)
    .split('\n')
    .findIndex((linea) => /^##\s+Si algo sali/.test(linea));
  const donde = join(lab.raiz, 'carpeta-actual');
  let actual = lab.clon;
  const salidas = new Map<string, string>();
  const problemas: string[] = [];
  const registro: string[] = [];
  const lineas = enunciado(numero).split('\n');
  const pendientes = (A_MANO[numero] ?? []).map((paso) => {
    const linea = lineas.findIndex((l) => l.includes(paso.ancla));
    if (linea < 0) problemas.push(`el enunciado ya no dice «${paso.ancla}»`);
    return { ...paso, linea: linea + 1 };
  });
  const barras = (ruta: string): string => ruta.replace(/\\/g, '/');
  const correr = (texto: string, extra: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> => {
    const guion = [`cd "${actual}" || exit 99`, texto, 'estado=$?', `pwd > "${barras(donde)}"`, 'exit $estado'].join('\n');
    const corrida = spawnSync('bash', ['-c', guion], {
      encoding: 'utf8',
      // El editor acepta el mensaje propuesto, como quien guarda y cierra.
      env: { ...entorno(lab.configGlobal), GIT_EDITOR: 'true', ...extra },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
    if (corrida.status === 99) problemas.push(`no se pudo volver a ${actual}`);
    if (existsSync(donde)) actual = readFileSync(donde, 'utf8').trim();
    return corrida;
  };
  for (const orden of ordenes) {
    if (rescate >= 0 && orden.linea > rescate) break;
    let extra: NodeJS.ProcessEnv = {};
    // El editor se abre con la orden que la frase explica, que es la ultima antes de ella.
    const siguiente = ordenes.find((o) => o.linea > orden.linea);
    for (const paso of pendientes.filter(
      (p) =>
        p.linea > 0 &&
        (p.editor === undefined ? p.linea < orden.linea : orden.linea < p.linea && (siguiente === undefined || siguiente.linea > p.linea)),
    )) {
      pendientes.splice(pendientes.indexOf(paso), 1);
      if (paso.bash !== undefined) correr(paso.bash);
      if (paso.archivo !== undefined) correr(`printf '%s\\n' "$CONTENIDO" > ${paso.archivo}`, { CONTENIDO: bloqueDespuesDe(lineas, paso.linea - 1) });
      if (paso.editor !== undefined) {
        const lista = join(lab.raiz, `lista-${paso.linea}.sh`);
        const mensaje = join(lab.raiz, `mensaje-${paso.linea}.sh`);
        writeFileSync(lista, `${paso.editor.lista}\n`);
        writeFileSync(mensaje, `printf '%s\\n' '${paso.editor.mensaje}' > "$1"\n`);
        extra = { GIT_SEQUENCE_EDITOR: `bash "${barras(lista)}"`, GIT_EDITOR: `bash "${barras(mensaje)}"` };
      }
    }
    if (orden.clase === 'omitida') {
      problemas.push(`linea ${orden.linea} «${orden.texto}» se saltaria: ${orden.motivo}`);
      continue;
    }
    const eleccion = orden.eleccion;
    const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
    const texto = ordenPara(orden, identificador);
    const corrida = correr(texto, extra);
    const salida = `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
    salidas.set(orden.texto, salida);
    registro.push(`${orden.linea} [${corrida.status}] ${texto}${corrida.status === 0 ? '' : ` → ${salida.trim().split('\n').slice(0, 3).join(' / ')}`}`);
  }
  for (const paso of pendientes) problemas.push(`el paso a mano «${paso.ancla}» no llego a hacerse`);
  return { problemas, registro: registro.join('\n') };
}

function dice(corrida: Corrida): string {
  return `codigo ${corrida.codigo}:\n${corrida.salida}`;
}

/**
 * Criterios del verificador que fallan aunque el enunciado se siga al pie de
 * la letra. Se anotan exactos para que la prueba siga midiendo todo lo demas,
 * y para que avise el dia que se corrijan. Hoy no hay ninguno: el del 07 se
 * corrigio en el SPEC 023.
 */
const FALLAN_SIGUIENDO_EL_ENUNCIADO: Readonly<Record<string, readonly string[]>> = {
};

function criteriosFallidos(salida: string): string[] {
  return salida
    .split('\n')
    .filter((linea) => linea.includes('✗'))
    .map((linea) => linea.replace(/^\s*✗\s*/, '').trim());
}

describe('cada laboratorio, preparado, hecho y verificado como lo hace el participante', () => {
  // Un laboratorio son decenas de procesos de Git y Bash; en Windows cada uno cuesta mas.
  it.each(TODOS)('laboratorio %s', { timeout: 300_000 }, (numero) => {
    const lab = montar(numero);
    if (existsSync(join(lab.carpeta, 'preparar.sh'))) {
      const preparado = preparar({ ...lab }, '--forzar');
      expect(preparado.codigo, dice(preparado)).toBe(0);
      expect(preparado.salida).toMatch(/✓ existe el repositorio/);
    }
    const hecho = hacerElLaboratorio(numero, lab);
    expect(hecho.problemas).toEqual([]);
    const verificado = verificar(lab.carpeta, lab.configGlobal);
    expect(verificado.salida).toMatch(/✓ existe el repositorio/);
    const conocidos = FALLAN_SIGUIENDO_EL_ENUNCIADO[numero] ?? [];
    // Si reclama, se ve cada orden del recorrido con su codigo de salida.
    expect(criteriosFallidos(verificado.salida), `${dice(verificado)}\n--- el recorrido ---\n${hecho.registro}`).toEqual(conocidos);
    expect(verificado.codigo, dice(verificado)).toBe(conocidos.length === 0 ? 0 : 1);
  });
});

describe('la proteccion contra el anidamiento sigue funcionando', () => {
  it.each(TODOS.filter((n) => n !== '01'))(
    'laboratorio %s: un recetario sin .git propio dentro de otro repositorio se reclama',
    { timeout: 120_000 },
    (numero) => {
      const lab = montar(numero);
      expect(preparar({ ...lab }, '--forzar').codigo).toBe(0);
      // El recetario pierde su repositorio y queda dentro de uno de mas arriba:
      // Git subiria hasta ese y los criterios se medirian contra otra historia.
      rmSync(join(lab.recetario, '.git'), { recursive: true, force: true });
      execFileSync('git', ['init', '-q', lab.raiz], { env: entorno(lab.configGlobal) });
      const verificado = verificar(lab.carpeta, lab.configGlobal);
      expect(verificado.codigo, dice(verificado)).not.toBe(0);
      expect(verificado.salida).toMatch(/✗ existe el repositorio/);
      expect(verificado.salida).toMatch(/no es un repositorio/);
    },
  );

  it('laboratorio 01: olvidar el git init dentro de la carpeta del clon se reclama', { timeout: 120_000 }, () => {
    const lab = montar('01');
    // El recetario existe, sin `git init`, y su carpeta de trabajo queda dentro del repositorio de mas arriba.
    mkdirSync(lab.recetario, { recursive: true });
    writeFileSync(join(lab.recetario, 'README.md'), 'hola\n');
    execFileSync('git', ['init', '-q', lab.raiz], { env: entorno(lab.configGlobal) });
    const verificado = verificar(lab.carpeta, lab.configGlobal);
    expect(verificado.codigo, dice(verificado)).not.toBe(0);
    expect(verificado.salida).toMatch(/✗ existe el repositorio/);
    expect(verificado.salida).toMatch(/falta el git init/);
  });
});
