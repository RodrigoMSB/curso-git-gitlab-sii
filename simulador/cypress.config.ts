/**
 * Pruebas de punta a punta: el simulador contra Git de verdad (SPEC 008).
 *
 * Cypress y este servidor son herramientas de desarrollo. El participante no
 * los necesita nunca y la regla del SPEC 006 sigue intacta: el repositorio del
 * curso se clona y funciona sin instalar nada.
 *
 * Lo que se prueba es **el artefacto construido y versionado**, `SIMULADOR.html`
 * de la raiz del clon, no el codigo en modo de desarrollo (restriccion R1). El
 * servidor solo lo sirve; el archivo es el mismo que el participante abre con
 * doble clic.
 */

import { execFileSync } from 'node:child_process';
import { createReadStream, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'cypress';

const SIMULADOR = fileURLToPath(new URL('.', import.meta.url));
const CLON = fileURLToPath(new URL('..', import.meta.url));
const PUERTO = 5733;

const TIPOS: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.md': 'text/plain; charset=utf-8',
};

/** Sirve el clon tal cual, para que la prueba abra el artefacto de verdad. */
function levantarServidor(): void {
  createServer((peticion, respuesta) => {
    const pedido = decodeURIComponent((peticion.url ?? '/').split('?')[0]?.split('#')[0] ?? '/');
    const relativa = normalize(pedido).replace(/^(\.\.[/\\])+/, '');
    const ruta = join(CLON, relativa === '/' ? 'SIMULADOR.html' : relativa);

    if (!ruta.startsWith(CLON) || !existsSync(ruta) || !statSync(ruta).isFile()) {
      respuesta.writeHead(404).end('no está');
      return;
    }
    respuesta.writeHead(200, { 'content-type': TIPOS[extname(ruta)] ?? 'application/octet-stream' });
    createReadStream(ruta).pipe(respuesta);
  }).listen(PUERTO);
}

interface Laboratorio {
  readonly raiz: string;
  readonly recetario: string;
  readonly configGlobal: string;
}

/** Los repositorios de las pruebas viven en una carpeta temporal (R3). */
const montados: string[] = [];

/** Lo que cada laboratorio dejo comparado, para el informe del punto 6.3. */
const cobertura: Record<string, unknown>[] = [];

/**
 * Monta un clon de mentira con el laboratorio dentro y corre su `preparar.sh`,
 * que es como el participante llega a su punto de partida.
 *
 * La configuracion global de la maquina no se toca (R4): se usa un archivo
 * aparte por laboratorio.
 */
function prepararLaboratorio(numero: string): Laboratorio {
  const raiz = mkdtempSync(join(tmpdir(), 'punta-a-punta-'));
  montados.push(raiz);

  const clon = join(raiz, 'curso-git-gitlab-sii');
  const carpeta = join(clon, 'labs', `lab-${numero}`);
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    cpSync(join(CLON, 'labs', `lab-${numero}`, archivo), join(carpeta, archivo));
    execFileSync('chmod', ['+x', join(carpeta, archivo)]);
  }

  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  // La misma configuracion que el participante deja puesta en el laboratorio
  // 01: identidad y los dos alias. Sin los alias, `git lg` fallaria en Git y
  // funcionaria en el simulador, que es justo la diferencia que estas pruebas
  // existen para detectar.
  writeFileSync(
    configGlobal,
    '[user]\n\tname = Participante del taller\n\temail = participante@sii.cl\n' +
      '[alias]\n\ts = status -s\n\tlg = log --oneline --graph --all --decorate\n',
  );

  execFileSync('bash', ['./preparar.sh', '--forzar'], {
    cwd: carpeta,
    env: entorno(configGlobal),
    stdio: 'ignore',
  });

  return {
    raiz,
    recetario: join(raiz, 'taller-git-trabajo', `lab-${numero}`, 'recetario'),
    configGlobal,
  };
}

function entorno(configGlobal: string): NodeJS.ProcessEnv {
  return { ...process.env, GIT_CONFIG_GLOBAL: configGlobal, GIT_CONFIG_SYSTEM: '/dev/null' };
}

/**
 * Corre una orden del enunciado contra el repositorio de verdad.
 *
 * Devuelve tambien si fallo. Una orden que en la terminal funciona y en el
 * simulador no, o al reves, le enseña al participante algo distinto aunque el
 * estado quede igual: es justo lo que se le escapaba a la comparacion cuando
 * solo miraba el estado.
 */
function ejecutarEnGit({
  lab,
  orden,
  medirCambio = false,
}: {
  lab: Laboratorio;
  orden: string;
  medirCambio?: boolean;
}): {
  salida: string;
  fallo: boolean;
  /** Si la orden movio el estado del repositorio. Solo se mide cuando hace falta. */
  cambio: boolean;
} {
  // El antes y el despues se toman aqui, en la misma tarea, para no gastar tres
  // viajes al navegador. Y solo se toman para las ordenes que el simulador no
  // ejecuta, que son las unicas que pueden desalinear los dos lados: leer el
  // estado cuesta una decena de invocaciones a Git y hay cientos de ordenes.
  const antes = medirCambio ? JSON.stringify(estadoDeGit(lab)) : '';
  let salida: string;
  try {
    salida = execFileSync('bash', ['-c', orden], {
      cwd: lab.recetario,
      encoding: 'utf8',
      env: entorno(lab.configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const fallo = error as { stdout?: string; stderr?: string };
    salida = `${fallo.stdout ?? ''}${fallo.stderr ?? ''}`;
  }
  const despues = medirCambio ? JSON.stringify(estadoDeGit(lab)) : '';
  return { salida, fallo: rechazada(salida), cambio: medirCambio && despues !== antes };
}

/**
 * Si Git rechazo la orden, mirando lo que imprime y no su codigo de salida.
 *
 * Tiene que ser el mismo criterio que se aplica del lado del simulador, que es
 * lo que el participante lee. El codigo de salida no sirve para comparar: Git
 * termina en uno cuando `git commit` no encuentra nada que confirmar, y ahi no
 * rechazo nada, solo informo que no habia trabajo.
 */
function rechazada(salida: string): boolean {
  return salida.split('\n').some((linea) => /^(fatal|error):/.test(linea));
}

export interface EstadoComparable {
  /** Mensajes de la historia alcanzable, del mas reciente al mas antiguo. */
  readonly historia: readonly string[];
  /** `rama -> mensaje de la confirmacion a la que apunta`, ordenado. */
  readonly ramas: readonly string[];
  /** Mensaje de la confirmacion donde esta parado el puntero, o la rama. */
  readonly posicion: string;
  /** `etiqueta -> mensaje`, ordenado. */
  readonly etiquetas: readonly string[];
  /** `archivo:estado`, ordenado. */
  readonly archivos: readonly string[];
  /** Entradas del guardado temporal, de la mas reciente a la mas antigua. */
  readonly guardados: readonly string[];
}

/** Lee de Git el mismo conjunto de datos que la pantalla muestra. */
function estadoDeGit(lab: Laboratorio): EstadoComparable {
  /**
   * `crudo` conserva los espacios del comienzo de cada linea. Hace falta para
   * `git status --porcelain`, donde la primera columna es un espacio cuando el
   * cambio no esta preparado: recortarla convierte « M archivo» en «M archivo»
   * y con eso el estado se lee al reves y el nombre pierde su primera letra.
   */
  const git = (opciones: { crudo?: boolean }, ...argumentos: readonly string[]): string => {
    try {
      const salida = execFileSync('git', ['-C', lab.recetario, ...argumentos], {
        encoding: 'utf8',
        env: entorno(lab.configGlobal),
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return opciones.crudo === true ? salida.replace(/\n+$/, '') : salida.trim();
    } catch {
      return '';
    }
  };
  const lineas = (salida: string): readonly string[] => (salida === '' ? [] : salida.split('\n'));

  // Ramas y etiquetas con el mensaje de su confirmacion, en una sola llamada.
  // El estado se lee despues de cada orden y hay cientos: cada proceso de Git
  // que se ahorra aqui se ahorra centenares de veces.
  const referencias = lineas(
    git({}, 'for-each-ref', '--format=%(refname)\t%(contents:subject)', 'refs/heads', 'refs/tags'),
  ).map((linea) => linea.split('\t'));

  const nombrar = (prefijo: string): readonly string[] =>
    referencias
      .filter(([ref = '']) => ref.startsWith(prefijo))
      .map(([ref = '', asunto = '']) => `${ref.slice(prefijo.length)} -> ${asunto}`)
      .sort();

  const ramas = nombrar('refs/heads/');
  const etiquetas = nombrar('refs/tags/');

  const ramaActual = git({}, 'branch', '--show-current');
  const posicion =
    ramaActual === ''
      ? `desconectado -> ${git({}, 'log', '-1', '--format=%s')}`
      : `${ramaActual} -> ${git({}, 'log', '-1', '--format=%s')}`;

  const seguidos = lineas(git({}, 'ls-files'));
  const sucios = new Map<string, string>();
  for (const linea of lineas(git({ crudo: true }, 'status', '--porcelain'))) {
    sucios.set(linea.slice(3), estadoDeCodigo(linea.slice(0, 2)));
  }
  const archivos = [...new Set([...seguidos, ...sucios.keys()])]
    .map((nombre) => `${nombre}:${sucios.get(nombre) ?? 'limpio'}`)
    .sort();

  const guardados = lineas(git({}, 'stash', 'list', '--format=%gs'));

  return {
    historia: lineas(git({}, 'log', '--format=%s')),
    ramas,
    posicion,
    etiquetas,
    archivos,
    guardados,
  };
}

/** Traduce los codigos de dos columnas al vocabulario del simulador. */
function estadoDeCodigo(codigo: string): string {
  if (codigo === '??') return 'sin-seguimiento';
  if (codigo === 'UU' || codigo === 'AA' || codigo === 'DD') return 'en-conflicto';
  const indice = codigo[0] ?? ' ';
  const trabajo = codigo[1] ?? ' ';
  if (indice !== ' ' && indice !== '?') return 'preparado';
  if (trabajo !== ' ') return 'modificado';
  return 'limpio';
}

export default defineConfig({
  e2e: {
    baseUrl: `http://localhost:${PUERTO}`,
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/soporte/e2e.ts',
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: false,
    viewportWidth: 1600,
    viewportHeight: 1000,
    setupNodeEvents(on) {
      levantarServidor();

      on('task', {
        prepararLaboratorio: (numero: string) => prepararLaboratorio(numero),
        ejecutarEnGit: (datos: { lab: Laboratorio; orden: string; medirCambio?: boolean }) =>
          ejecutarEnGit(datos),
        estadoDeGit: (lab: Laboratorio) => estadoDeGit(lab),
        leerEnunciado: (numero: string) =>
          execFileSync('cat', [join(CLON, 'labs', `lab-${numero}`, 'README.md')], {
            encoding: 'utf8',
          }),
        // La cobertura de cada laboratorio, tal como salio de la corrida.
        anotarCobertura: (dato: Record<string, unknown>) => {
          cobertura.push(dato);
          return null;
        },
        limpiar: () => {
          // Nada queda fuera de la carpeta temporal (R3).
          for (const raiz of montados.splice(0)) rmSync(raiz, { recursive: true, force: true });
          if (cobertura.length > 0) {
            console.log('\n  cobertura del recorrido comparado');
            console.table(cobertura);
          }
          return null;
        },
      });
    },
  },
});
