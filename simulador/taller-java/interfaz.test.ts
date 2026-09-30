/**
 * Los dos motores hablan la misma interfaz (SPEC 028, punto 3.2, y
 * taller/INTERFAZ.md).
 *
 * Arranca el motor de Java y el de Python, cada uno en su propio taller-git
 * con el mismo contenido, y les manda la misma secuencia de peticiones: la
 * guardia, los errores de la API, y una serie de ordenes que pasa por todo lo
 * que el estado sabe decir, fusiones con conflicto, guardados, etiquetas,
 * huerfanas, la posicion desconectada, avisos, el limite de tiempo y preparar
 * desde la consola. Las fechas y la identidad de Git son fijas, asi que las
 * confirmaciones tienen los mismos identificadores en los dos. Despues de
 * reemplazar la carpeta de cada taller por <taller>, las respuestas tienen que
 * ser iguales, paso por paso.
 *
 *     npx vitest run --config vitest.taller-java.config.ts taller-java/interfaz.test.ts
 */

import { type ChildProcess, spawn } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO = resolve(__dirname, '..', '..');
const WINDOWS = process.platform === 'win32';
const TIEMPO_MAXIMO = 6;

type Motor = 'java' | 'python';

interface Arrancado {
  motor: Motor;
  raiz: string;
  proceso: ChildProcess;
  puerto: number;
  clave: string;
  registro: string;
  /** Lo que tardo en dejar su direccion, en milisegundos. */
  arranque: number;
}

interface Respuesta {
  estado: number;
  encabezados: Record<string, string | string[] | undefined>;
  cuerpo: string;
}

function comandoDe(motor: Motor, clon: string): [string, string[]] {
  if (motor === 'java') {
    const propio = join(REPO, 'taller', 'java', 'jre', WINDOWS ? 'windows-x64' : 'macos-aarch64', 'bin', WINDOWS ? 'java.exe' : 'java');
    const java = existsSync(propio) && (WINDOWS || process.arch === 'arm64') ? propio : 'java';
    return [java, ['-Dfile.encoding=UTF-8', '-Dstdout.encoding=UTF-8', '-Dstderr.encoding=UTF-8', '--enable-native-access=ALL-UNNAMED', '-jar', join(clon, 'taller', 'java', 'taller.jar')]];
  }
  return [WINDOWS ? 'python' : 'python3', [join(clon, 'taller', 'python', 'taller.py')]];
}

/** Un taller-git con su clon minimo: la pagina, los laboratorios y los dos motores. */
function armarTaller(base: string, motor: Motor): string {
  const raiz = join(base, motor, 'taller-git');
  const clon = join(raiz, 'curso');
  mkdirSync(join(clon, 'taller', 'java'), { recursive: true });
  mkdirSync(join(clon, 'taller', 'python'), { recursive: true });
  copyFileSync(join(REPO, 'SIMULADOR.html'), join(clon, 'SIMULADOR.html'));
  copyFileSync(join(REPO, 'taller', 'java', 'taller.jar'), join(clon, 'taller', 'java', 'taller.jar'));
  copyFileSync(join(REPO, 'taller', 'python', 'taller.py'), join(clon, 'taller', 'python', 'taller.py'));
  copyFileSync(join(REPO, 'taller', 'laboratorio.sh'), join(clon, 'taller', 'laboratorio.sh'));
  cpSync(join(REPO, 'taller', 'raiz'), join(clon, 'taller', 'raiz'), { recursive: true });
  cpSync(join(REPO, 'labs'), join(clon, 'labs'), { recursive: true });
  for (const envoltorio of ['preparar', 'verificar']) {
    copyFileSync(join(REPO, 'taller', 'raiz', envoltorio), join(raiz, envoltorio));
  }
  return realpathSync.native(raiz);
}

async function arrancar(base: string, motor: Motor, gitconfig: string): Promise<Arrancado> {
  const raiz = armarTaller(base, motor);
  const direccion = join(base, `${motor}.direccion`);
  const [programa, argumentos] = comandoDe(motor, join(raiz, 'curso'));
  const fecha = '2024-01-15T12:00:00+00:00';
  // Lo que traiga la maquina de quien corre la prueba no llega a Git.
  const heredado = { ...process.env };
  for (const v of ['GIT_EDITOR', 'GIT_ASKPASS', 'EDITOR', 'VISUAL', 'GIT_DIR', 'GIT_WORK_TREE', 'SSH_ASKPASS']) delete heredado[v];
  const desde = Date.now();
  const proceso = spawn(programa, argumentos, {
    cwd: raiz,
    env: {
      ...heredado,
      TALLER_SIN_NAVEGADOR: '1',
      TALLER_ARCHIVO_DIRECCION: direccion,
      TALLER_TIEMPO_MAXIMO: String(TIEMPO_MAXIMO),
      GIT_CONFIG_GLOBAL: gitconfig,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_DATE: fecha,
      GIT_COMMITTER_DATE: fecha,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let registro = '';
  proceso.stdout?.on('data', (d) => (registro += String(d)));
  proceso.stderr?.on('data', (d) => (registro += String(d)));
  for (let i = 0; i < 300 && !existsSync(direccion); i++) await new Promise((r) => setTimeout(r, 100));
  // Si no llega, beforeAll falla y vitest da las tres pruebas por saltadas:
  // el mensaje dice cuanto se espero, para distinguirlo de otra causa.
  if (!existsSync(direccion)) {
    throw new Error(`el motor de ${motor} no dejo su direccion en ${Date.now() - desde} ms:\n${registro}`);
  }
  const url = readFileSync(direccion, 'utf8').trim();
  const m = url.match(/^http:\/\/127\.0\.0\.1:(\d+)\/\?clave=([0-9a-f]+)$/);
  if (m === null) throw new Error(`direccion rara: ${url}`);
  return { motor, raiz, proceso, puerto: Number(m[1]), clave: m[2] ?? '', registro, arranque: Date.now() - desde };
}

function pedir(
  a: Arrancado,
  metodo: string,
  camino: string,
  opciones: { encabezados?: Record<string, string>; cuerpo?: string | Buffer; conClave?: boolean } = {},
): Promise<Respuesta> {
  const encabezados: Record<string, string> = { Host: `127.0.0.1:${a.puerto}`, ...(opciones.encabezados ?? {}) };
  if (opciones.conClave !== false) encabezados['X-Taller-Clave'] = a.clave;
  if (opciones.cuerpo !== undefined) encabezados['Content-Type'] = 'application/json; charset=utf-8';
  return new Promise((listo, fallo) => {
    const r = request(
      { host: '127.0.0.1', port: a.puerto, method: metodo, path: camino, headers: encabezados, setHost: false },
      (res) => {
        const partes: Buffer[] = [];
        res.on('data', (d: Buffer) => partes.push(d));
        res.on('end', () => listo({ estado: res.statusCode ?? 0, encabezados: res.headers, cuerpo: Buffer.concat(partes).toString('utf8') }));
      },
    );
    r.on('error', fallo);
    if (opciones.cuerpo !== undefined) r.write(opciones.cuerpo);
    r.end();
  });
}

/** Lo que tiene que ser igual: el taller de cada motor pasa a <taller>, y se quita lo que es de cada uno. */
function normalizar(a: Arrancado, r: Respuesta): unknown {
  const conBarras = a.raiz.replaceAll('\\', '/');
  const formas = [conBarras, conBarras.replace(/^([A-Za-z]):/, (_, u: string) => `/${u.toLowerCase()}`), a.raiz];
  let texto = r.cuerpo;
  for (const forma of formas) texto = texto.split(forma).join('<taller>');
  texto = texto.split(String(a.puerto)).join('<puerto>');
  const encabezados = {
    tipo: r.encabezados['content-type'],
    cache: r.encabezados['cache-control'],
    nosniff: r.encabezados['x-content-type-options'],
    referrer: r.encabezados['referrer-policy'],
    allow: r.encabezados['allow'],
    cors: Object.keys(r.encabezados).filter((k) => k.startsWith('access-control-')),
  };
  if (!texto.startsWith('{')) return { estado: r.estado, encabezados, largo: texto.length };
  const json = JSON.parse(texto) as Record<string, unknown>;
  if (typeof json.version === 'number') json.version = '<numero>';
  const sesion = json.sesion as Record<string, unknown> | undefined;
  if (sesion !== undefined) {
    // Cada motor dice cual es, y el usuario y el equipo son los del sistema.
    expect(sesion.motor).toBe(a.motor);
    delete sesion.motor;
    delete sesion.usuario;
    delete sesion.equipo;
  }
  if (typeof json.procesos === 'number') json.procesos = '<numero>';
  return { estado: r.estado, encabezados, json };
}

const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'interfaz-')));
const motores: Arrancado[] = [];
const transcripcion: Record<Motor, { paso: string; respuesta: unknown }[]> = { java: [], python: [] };

async function paso(nombre: string, hacer: (a: Arrancado) => Promise<Respuesta>): Promise<void> {
  for (const a of motores) {
    const r = await hacer(a);
    transcripcion[a.motor].push({ paso: nombre, respuesta: normalizar(a, r) });
  }
}

const orden = (texto: string) => (a: Arrancado) =>
  pedir(a, 'POST', '/api/orden', { cuerpo: JSON.stringify({ orden: texto }) });
const estado = (a: Arrancado) => pedir(a, 'GET', '/api/estado?desde=0');

/** Las ordenes, en el orden en que se mandan. Cada una va seguida de la lectura del estado. */
const ORDENES = [
  'pwd; ls -a',
  'mkdir -p "lab-01/recetario ñandú" && cd "lab-01/recetario ñandú" && git init -q -b main && pwd',
  'git status',
  'printf "uno\\n" > platos.md && mkdir -p recetas && printf "a\\n" > recetas/pastel.md && git add platos.md',
  'git commit -qm "se inicia el recetario, con ñ" && git add . && git commit -qm "la primera receta"',
  'git switch -qc postres && printf "dos\\n" >> platos.md && git commit -qam "postres"',
  'git switch -q main && printf "tres\\n" >> platos.md && git commit -qam "principales"',
  'git merge postres',
  'git status --short; echo resuelto > platos.md && git add platos.md && git commit -qm "fusion resuelta"',
  'git tag -a v1.0 -m "primera version" && git tag liviana HEAD~1 && git tag arbol HEAD^{tree}',
  'printf "wip\\n" >> platos.md && printf "nuevo\\n" > recetas/nueva.md && git stash push -qm "a medias" && git stash list',
  'git mv recetas/pastel.md recetas/pastel-de-choclo.md && printf "x\\n" >> recetas/pastel-de-choclo.md && printf "y\\n" > suelto.md',
  'git add -A && git commit -qm "renombre" && git reset -q --hard HEAD~1',
  'git switch -q --detach HEAD~2 && git log --oneline -n 3',
  'git switch -q main && git remote add origin ../remoto.git && git init -q --bare ../remoto.git && git push -q origin main 2>&1',
  'git switch -qc otra && printf "r\\n" > r.md && git add r.md && git commit -qm r && git switch -q main && printf "s\\n" > r.md && git add r.md && git commit -qm s && git rebase otra',
  'git rebase --abort && git status --short --branch',
  'cd .git && pwd',
  'cd ../../.. && cd .. && pwd',
  'cd ..; pwd',
  'echo "sin cerrar',
  'no-existe-esta-orden',
  'echo a la salida; echo al error >&2; exit 3',
  'git add -p',
  `sleep ${TIEMPO_MAXIMO + 4}`,
  'builtin cd ..',
  'cd lab-01 && git init -q desnudo.git --bare && cd desnudo.git && pwd',
  'cd',
  'preparar 02',
  'preparar 02',
  'git log --oneline -n 2; pwd',
  'git -c core.editor=editor-que-no-existe commit --allow-empty',
];

describe('la interfaz de los dos motores', () => {
  beforeAll(async () => {
    const gitconfig = join(base, 'gitconfig');
    writeFileSync(
      gitconfig,
      '[user]\n\tname = Juana Pérez\n\temail = juana@recetario.cl\n[init]\n\tdefaultBranch = main\n[core]\n\tautocrlf = false\n',
    );
    motores.push(await arrancar(base, 'java', gitconfig));
    motores.push(await arrancar(base, 'python', gitconfig));
  }, 120_000);

  afterAll(async () => {
    // Se espera a que cada motor salga: en Windows la carpeta de un proceso
    // vivo no se puede borrar.
    await Promise.all(
      motores.map(
        (a) =>
          new Promise<void>((listo) => {
            if (a.proceso.exitCode !== null) return listo();
            a.proceso.once('exit', () => listo());
            if (WINDOWS && a.proceso.pid !== undefined) {
              spawn('taskkill', ['/T', '/F', '/PID', String(a.proceso.pid)], { stdio: 'ignore' });
            } else {
              a.proceso.kill();
            }
            setTimeout(listo, 10_000);
          }),
      ),
    );
    try {
      rmSync(base, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch (e) {
      // Una carpeta temporal que queda no invalida lo que se comparo.
      console.warn(`no se pudo borrar ${base}: ${String(e)}`);
    }
  }, 60_000);

  it('la direccion y la clave', () => {
    for (const a of motores) {
      console.log(`motor ${a.motor}: direccion en ${a.arranque} ms`);
      expect(a.clave, a.motor).toMatch(/^[0-9a-f]{32}$/);
      expect(a.registro, a.motor).toContain(`Dirección: http://127.0.0.1:${a.puerto}/?clave=${a.clave}`);
    }
  });

  it('responden lo mismo, paso por paso', async () => {
    // La guardia.
    await paso('estado sin clave', (a) => pedir(a, 'GET', '/api/estado', { conClave: false }));
    await paso('clave equivocada', (a) => pedir(a, 'GET', '/api/estado', { encabezados: { 'X-Taller-Clave': '0'.repeat(32) }, conClave: false }));
    await paso('Host localhost', (a) => pedir(a, 'GET', '/api/estado', { encabezados: { Host: `localhost:${a.puerto}` } }));
    await paso('Host sin puerto', (a) => pedir(a, 'GET', '/api/estado', { encabezados: { Host: '127.0.0.1' } }));
    await paso('Origin ajeno', (a) => pedir(a, 'GET', '/api/estado', { encabezados: { Origin: 'http://evil.example' } }));
    await paso('Origin propio', (a) => pedir(a, 'GET', '/api/estado', { encabezados: { Origin: `http://127.0.0.1:${a.puerto}` } }));
    await paso('camino desconocido', (a) => pedir(a, 'GET', '/api/estado/'));
    await paso('otro camino', (a) => pedir(a, 'GET', '/SIMULADOR.html'));
    await paso('la clave de la pagina en la API', (a) => pedir(a, 'GET', `/api/estado?clave=${a.clave}`, { conClave: false }));
    await paso('la pagina sin clave', (a) => pedir(a, 'GET', '/', { conClave: true }));
    await paso('la pagina', (a) => pedir(a, 'GET', `/?clave=${a.clave}`, { conClave: false }));
    await paso('POST al estado', (a) => pedir(a, 'POST', '/api/estado', { cuerpo: '{}' }));
    await paso('GET a la orden', (a) => pedir(a, 'GET', '/api/orden'));
    await paso('OPTIONS a la orden', (a) => pedir(a, 'OPTIONS', '/api/orden', { encabezados: { Origin: `http://127.0.0.1:${a.puerto}` } }));

    // El estado fuera de un repositorio, y el 204.
    await paso('estado inicial', estado);
    await paso('sin cambios', async (a) => {
      const v = (JSON.parse((await estado(a)).cuerpo) as { version: number }).version;
      return pedir(a, 'GET', `/api/estado?desde=${v}`);
    });
    await paso('diagnostico', (a) => pedir(a, 'GET', '/api/diagnostico'));

    // Los errores de la orden.
    await paso('orden sin cuerpo', (a) => pedir(a, 'POST', '/api/orden', { cuerpo: '' }));
    await paso('orden vacia', (a) => pedir(a, 'POST', '/api/orden', { cuerpo: '{"orden":"   "}' }));
    await paso('orden que no es texto', (a) => pedir(a, 'POST', '/api/orden', { cuerpo: '{"orden":3}' }));
    await paso('cuerpo que no es JSON', (a) => pedir(a, 'POST', '/api/orden', { cuerpo: 'git status' }));
    await paso('cuerpo muy grande', (a) => pedir(a, 'POST', '/api/orden', { cuerpo: JSON.stringify({ orden: `echo ${'x'.repeat(70_000)}` }) }));

    // Mientras corre una orden, la siguiente recibe 409.
    await paso('ocupado', async (a) => {
      const primera = orden('sleep 2')(a);
      await new Promise((r) => setTimeout(r, 500));
      const segunda = await orden('git status')(a);
      await primera;
      return segunda;
    });

    for (const texto of ORDENES) {
      await paso(texto, orden(texto));
      await paso(`estado despues de: ${texto}`, estado);
    }
  }, 600_000);

  it('las dos transcripciones son iguales', () => {
    const java = transcripcion.java;
    const python = transcripcion.python;
    if (process.env.TALLER_TRANSCRIPCIONES !== undefined) {
      writeFileSync(process.env.TALLER_TRANSCRIPCIONES, JSON.stringify({ java, python }, null, 1));
    }
    const distintos = java.filter((j, i) => !isDeepStrictEqual(j, python[i])).map((j) => j.paso);
    expect(distintos, 'pasos en que los motores responden distinto').toEqual([]);
    expect(python.length).toBe(java.length);
    expect(java.length).toBeGreaterThan(80);
    for (let i = 0; i < java.length; i++) {
      expect(python[i], `paso ${i}: ${java[i]?.paso}`).toEqual(java[i]);
    }
  });
});
