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
  writeFileSync(configGlobal, '[user]\n\tname = Participante del taller\n\temail = participante@sii.cl\n');

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

/** Corre una orden del enunciado contra el repositorio de verdad. */
function ejecutarEnGit({ lab, orden }: { lab: Laboratorio; orden: string }): { salida: string } {
  try {
    const salida = execFileSync('bash', ['-c', orden], {
      cwd: lab.recetario,
      encoding: 'utf8',
      env: entorno(lab.configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { salida };
  } catch (error) {
    // Una orden que falla tambien es un resultado: el simulador tiene que
    // fallar igual y dejar el estado igual.
    const fallo = error as { stdout?: string; stderr?: string };
    return { salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}` };
  }
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

  const ramas = lineas(git({}, 'for-each-ref', '--format=%(refname:short)', 'refs/heads'))
    .map((rama) => `${rama} -> ${git({}, 'log', '-1', '--format=%s', rama)}`)
    .sort();
  const etiquetas = lineas(git({}, 'tag'))
    .map((etiqueta) => `${etiqueta} -> ${git({}, 'log', '-1', '--format=%s', etiqueta)}`)
    .sort();

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
        ejecutarEnGit: (datos: { lab: Laboratorio; orden: string }) => ejecutarEnGit(datos),
        estadoDeGit: (lab: Laboratorio) => estadoDeGit(lab),
        leerEnunciado: (numero: string) =>
          execFileSync('cat', [join(CLON, 'labs', `lab-${numero}`, 'README.md')], {
            encoding: 'utf8',
          }),
        limpiar: () => {
          // Nada queda fuera de la carpeta temporal (R3).
          for (const raiz of montados.splice(0)) rmSync(raiz, { recursive: true, force: true });
          return null;
        },
      });
    },
  },
});
