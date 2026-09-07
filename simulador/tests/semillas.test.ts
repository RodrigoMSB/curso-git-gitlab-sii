/**
 * Semillas de los laboratorios (SPEC 003).
 *
 * Los verificadores corren aqui ademas de correr al preparar (punto 6.3): un
 * cambio en la biblioteca comun que rompa una semilla tiene que aparecer al
 * probar, y no en la sala de clases.
 *
 * Las semillas son repositorios Git de verdad y se manejan con scripts de
 * Bash, de modo que estas pruebas los ejecutan tal como los ejecuta el
 * relator. No hay una segunda implementacion de la logica en TypeScript.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SEMILLAS = fileURLToPath(new URL('../../semillas', import.meta.url));

/** Los laboratorios que llevan semilla, segun el cuadro de la seccion 7. */
const LABORATORIOS = ['02', '03', '04', '05', '06', '07', '08', '09', '10', '13'] as const;

/** Los paquetes que deben existir: el 09 lleva dos. */
const PAQUETES = [
  'lab-02.bundle',
  'lab-03.bundle',
  'lab-04.bundle',
  'lab-05.bundle',
  'lab-06.bundle',
  'lab-07.bundle',
  'lab-08.bundle',
  'lab-09-recetario.bundle',
  'lab-09-condimentos.bundle',
  'lab-10.bundle',
  'lab-13.bundle',
];

const MINUTO = 60_000;

interface Corrida {
  readonly exito: boolean;
  readonly salida: string;
}

/** Corre una orden y devuelve si salio bien junto con todo lo que escribio. */
function correr(orden: string, argumentos: readonly string[], carpeta?: string): Corrida {
  try {
    const salida = execFileSync(orden, [...argumentos], {
      cwd: carpeta ?? SEMILLAS,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exito: true, salida };
  } catch (error) {
    const fallo = error as { stdout?: string; stderr?: string; message?: string };
    return {
      exito: false,
      salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}${fallo.message ?? ''}`,
    };
  }
}

function git(carpeta: string, ...argumentos: readonly string[]): string {
  return execFileSync('git', ['-C', carpeta, ...argumentos], { encoding: 'utf8' }).trim();
}

function carpetaTemporal(): string {
  return mkdtempSync(join(tmpdir(), 'semillas-'));
}

/** Prepara todas las semillas una sola vez y las reparte entre las pruebas. */
let raiz = '';
const preparadas = new Map<string, string>();

beforeAll(() => {
  raiz = carpetaTemporal();
  for (const lab of LABORATORIOS) {
    const destino = join(raiz, `lab-${lab}`);
    const corrida = correr('bash', [join(SEMILLAS, 'preparar.sh'), lab, destino]);
    if (!corrida.exito) throw new Error(`no se pudo preparar el laboratorio ${lab}:\n${corrida.salida}`);
    preparadas.set(lab, destino);
  }
}, 2 * MINUTO);

afterAll(() => {
  if (raiz !== '') rmSync(raiz, { recursive: true, force: true });
});

/** Copia una semilla ya preparada para poder maltratarla sin contaminar. */
function copiaDe(lab: string): string {
  const origen = preparadas.get(lab);
  if (origen === undefined) throw new Error(`el laboratorio ${lab} no quedo preparado`);
  const destino = join(carpetaTemporal(), `lab-${lab}`);
  cpSync(origen, destino, { recursive: true });
  return destino;
}

function verificar(lab: string, repositorio: string): Corrida {
  return correr('bash', [join(SEMILLAS, 'verificadores', `lab-${lab}.sh`), repositorio]);
}

describe('CA5 · los verificadores corren en la suite y pasan', () => {
  it.each(LABORATORIOS)('la semilla del laboratorio %s queda como el enunciado supone', (lab) => {
    const resultado = verificar(lab, preparadas.get(lab) ?? '');
    expect(resultado.salida).toContain(`semilla lab-${lab} verificada`);
    expect(resultado.exito).toBe(true);
  });
});

describe('CA4 · cada verificador falla cuando se altera lo que comprueba', () => {
  // Una confirmacion de mas cambia la cantidad y la lista de mensajes, que es
  // lo primero que mira cualquiera de los diez.
  it.each(LABORATORIOS)('el laboratorio %s reclama ante una confirmacion agregada a mano', (lab) => {
    const copia = copiaDe(lab);
    git(copia, 'commit', '--allow-empty', '-q', '-m', 'confirmacion agregada a mano');

    const resultado = verificar(lab, copia);
    expect(resultado.exito).toBe(false);
    expect(resultado.salida).toContain('esperaba:');
    expect(resultado.salida).toContain('encontro:');
    rmSync(copia, { recursive: true, force: true });
  });

  it('el laboratorio 02 reclama si alguien saca del area de preparacion el archivo puesto por error', () => {
    const copia = copiaDe('02');
    git(copia, 'restore', '--staged', 'notas.tmp');

    const resultado = verificar('02', copia);
    expect(resultado.exito).toBe(false);
    expect(resultado.salida).toContain('estado del directorio de trabajo');
    rmSync(copia, { recursive: true, force: true });
  });

  it('el laboratorio 06 reclama si main avanza y la fusion por avance rapido deja de serlo', () => {
    const copia = copiaDe('06');
    git(copia, 'merge', '-q', '--ff-only', 'mexicana');

    const resultado = verificar('06', copia);
    expect(resultado.exito).toBe(false);
    rmSync(copia, { recursive: true, force: true });
  });

  it('el laboratorio 13 reclama si alguien corrige el error de formato plantado', () => {
    const copia = copiaDe('13');
    const platos = join(copia, 'platos.md');
    writeFileSync(
      platos,
      readFileSync(platos, 'utf8').replace('| Cazuela de vacuno | 10 | 75 minutos |', '| Cazuela de vacuno | 10 |'),
    );

    const resultado = verificar('13', copia);
    expect(resultado.exito).toBe(false);
    expect(resultado.salida).toContain('platos.md');
    rmSync(copia, { recursive: true, force: true });
  });
});

/**
 * Ninguna semilla debe dejar ramas locales que su verificador no declare.
 *
 * Sale de un hallazgo concreto: un paquete creado con `--all HEAD` deja al
 * clonarse una referencia `refs/remotes/origin` a secas, ademas de las ramas.
 * Recorrer las ramas de seguimiento por su nombre abreviado la tomaba por una
 * rama y creaba una rama local llamada «origin» en las diez semillas. Se
 * corrigio filtrando por el nombre completo de la referencia, y esta prueba
 * existe para que no vuelva a aparecer por otro camino.
 */
describe('las ramas locales son exactamente las declaradas', () => {
  /** Lo que el verificador de la semilla afirma con `v_ramas`. */
  function ramasDeclaradas(lab: string): string {
    const verificador = readFileSync(join(SEMILLAS, 'verificadores', `lab-${lab}.sh`), 'utf8');
    const declaracion = /^v_ramas '([^']*)'/m.exec(verificador);
    if (declaracion?.[1] === undefined) {
      throw new Error(`el verificador del laboratorio ${lab} no declara sus ramas con v_ramas`);
    }
    return declaracion[1];
  }

  it.each(LABORATORIOS)('el laboratorio %s no trae ninguna rama de mas', (lab) => {
    const repositorio = preparadas.get(lab) ?? '';
    const ramas = git(repositorio, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')
      .split('\n')
      .filter((rama) => rama !== '')
      .sort();

    expect(ramas.join(' ')).toBe(ramasDeclaradas(lab));
  });

  it.each(LABORATORIOS)('el laboratorio %s no deja rastros de la clonacion', (lab) => {
    const repositorio = preparadas.get(lab) ?? '';
    const ramas = git(repositorio, 'for-each-ref', '--format=%(refname:short)', 'refs/heads')
      .split('\n')
      .filter((rama) => rama !== '');

    // La rama fantasma se llamaba «origin»; una rama con barra seria una de
    // seguimiento convertida en local por el mismo descuido.
    expect(ramas).not.toContain('origin');
    for (const rama of ramas) expect(rama).not.toContain('/');

    // Salvo el laboratorio 09, donde el remoto es la materia del ejercicio, no
    // debe quedar ninguna referencia de seguimiento despues de preparar.
    const seguimiento = git(repositorio, 'for-each-ref', '--format=%(refname)', 'refs/remotes');
    if (lab === '09') {
      expect(seguimiento).toContain('refs/remotes/origin/main');
    } else {
      expect(seguimiento).toBe('');
    }
  });
});

describe('CA1 · los generadores son deterministas', () => {
  it.each(LABORATORIOS)(
    'dos ejecuciones del generador %s producen los mismos identificadores',
    (lab) => {
      const carpeta = carpetaTemporal();
      const generador = join(SEMILLAS, 'generadores', `lab-${lab}.sh`);

      const identificadores = ['a', 'b'].map((vuelta) => {
        const trabajo = join(carpeta, `${vuelta}-${lab}`);
        const corrida = correr('bash', [generador, trabajo, join(carpeta, `${vuelta}-${lab}.bundle`)]);
        expect(corrida.exito, corrida.salida).toBe(true);
        // El laboratorio 09 arma dos repositorios; se mira el del recetario.
        const repositorio = lab === '09' ? join(trabajo, 'recetario') : trabajo;
        return git(repositorio, 'log', '--all', '--format=%H');
      });

      expect(identificadores[0]).toBe(identificadores[1]);
      expect(identificadores[0]).not.toBe('');
      rmSync(carpeta, { recursive: true, force: true });
    },
    MINUTO,
  );
});

describe('CA2 · las huellas anotadas en la arquitectura son las de hoy', () => {
  it(
    'la comprobacion de determinismo devuelve las huellas que el documento declara',
    () => {
      const documento = readFileSync(
        fileURLToPath(new URL('../../docs/arquitectura.md', import.meta.url)),
        'utf8',
      );
      const anotadas = new Map(
        [...documento.matchAll(/\| (lab-\d\d) \| `([0-9a-f]{40})` \|/g)].map(
          ([, semilla = '', huella = '']) => [semilla, huella],
        ),
      );
      expect(anotadas.size).toBe(LABORATORIOS.length);

      const corrida = correr('bash', [join(SEMILLAS, 'comprobar.sh'), '--determinismo']);
      expect(corrida.exito, corrida.salida).toBe(true);

      for (const [semilla, huella] of anotadas) {
        expect(corrida.salida, `la huella de ${semilla} cambio`).toContain(`ok ${semilla}  ${huella}`);
      }
    },
    2 * MINUTO,
  );
});

describe('CA6 · los paquetes estan sincronizados con sus generadores', () => {
  it('la comprobacion pasa sobre el repositorio tal como esta', () => {
    const resultado = correr('bash', [join(SEMILLAS, 'comprobar.sh')]);
    expect(resultado.salida).toContain('todo al dia');
    expect(resultado.exito).toBe(true);
  });

  it('la comprobacion reclama cuando un generador cambia y el paquete no se rehace', () => {
    const copia = join(carpetaTemporal(), 'semillas');
    cpSync(SEMILLAS, copia, { recursive: true });

    const generador = join(copia, 'generadores', 'lab-06.sh');
    writeFileSync(generador, `${readFileSync(generador, 'utf8')}\n# cambio que nadie regenero\n`);

    const resultado = correr('bash', [join(copia, 'comprobar.sh')]);
    expect(resultado.exito).toBe(false);
    expect(resultado.salida).toContain('el generador cambio y el paquete no se regenero');
    rmSync(copia, { recursive: true, force: true });
  });

  it('estan los once paquetes que declara el cuadro de la seccion 7', () => {
    const enDisco = readdirSync(join(SEMILLAS, 'paquetes')).filter((nombre) => nombre.endsWith('.bundle'));
    expect(enDisco.sort()).toEqual([...PAQUETES].sort());
  });
});

describe('CA7 · la semilla del laboratorio 06 produce las dos fusiones', () => {
  it('mexicana se fusiona por avance rapido, sin confirmacion de union', () => {
    const copia = copiaDe('06');
    const antes = git(copia, 'rev-parse', 'mexicana');

    const fusion = correr('git', ['merge', '--ff-only', 'mexicana'], copia);
    expect(fusion.exito, fusion.salida).toBe(true);
    expect(git(copia, 'rev-parse', 'HEAD')).toBe(antes);
    expect(git(copia, 'rev-list', '--merges', '--count', 'HEAD')).toBe('0');
    rmSync(copia, { recursive: true, force: true });
  });

  it('peruana choca sobre la misma linea de platos.md', () => {
    const copia = copiaDe('06');

    const fusion = correr('git', ['merge', 'peruana'], copia);
    expect(fusion.exito).toBe(false);
    expect(git(copia, 'status', '--porcelain')).toContain('UU platos.md');
    expect(readFileSync(join(copia, 'platos.md'), 'utf8')).toContain('<<<<<<<');
    rmSync(copia, { recursive: true, force: true });
  });
});

describe('CA8 · la semilla del laboratorio 04 trae los archivos en la historia', () => {
  it.each(['credenciales.txt', 'notas.tmp', 'respaldo.bak'])(
    '%s esta confirmado, no solo en el directorio de trabajo',
    (archivo) => {
      const repositorio = preparadas.get('04') ?? '';
      expect(git(repositorio, 'log', '--format=%H', '--', archivo)).not.toBe('');
      expect(git(repositorio, 'ls-files', archivo)).toBe(archivo);
    },
  );

  it('no hay archivo de exclusiones: escribirlo es el ejercicio', () => {
    expect(git(preparadas.get('04') ?? '', 'ls-files', '.gitignore')).toBe('');
  });
});

describe('CA9 · cada semilla tiene su descripcion', () => {
  it.each(LABORATORIOS)('el laboratorio %s trae su archivo para el relator', (lab) => {
    const descripcion = readFileSync(join(SEMILLAS, 'descripciones', `lab-${lab}.md`), 'utf8');
    expect(descripcion).toContain('Que esta plantado a proposito');
    expect(descripcion).toContain('## Que deja');
    expect(descripcion).toContain('## Por que');
  });
});

describe('CA3 · preparar una semilla es cosa de un momento', () => {
  it('el laboratorio 06 queda listo en menos de cinco segundos', () => {
    const destino = join(carpetaTemporal(), 'recetario');
    const partida = Date.now();
    const corrida = correr('bash', [join(SEMILLAS, 'preparar.sh'), '06', destino]);
    const demora = Date.now() - partida;

    expect(corrida.exito, corrida.salida).toBe(true);
    expect(demora).toBeLessThan(5000);
    rmSync(destino, { recursive: true, force: true });
  }, MINUTO);
});

describe('CA10 · el peso de las semillas', () => {
  const pesoDe = (carpeta: string): number =>
    readdirSync(carpeta, { withFileTypes: true }).reduce((total, entrada) => {
      const ruta = join(carpeta, entrada.name);
      return total + (entrada.isDirectory() ? pesoDe(ruta) : statSync(ruta).size);
    }, 0);

  it('el arbol completo se mantiene muy por debajo de los veinte megabytes', () => {
    const megabytes = pesoDe(SEMILLAS) / (1024 * 1024);
    expect(megabytes).toBeLessThan(20);
  });

  it('el README de las semillas documenta el peso, como pide el criterio', () => {
    const readme = readFileSync(join(SEMILLAS, 'README.md'), 'utf8');
    expect(readme).toMatch(/peso/i);
    expect(readme).toMatch(/kilobyte|KB|megabyte|MB/);
  });
});

describe('4.4 · las fechas son verosimiles', () => {
  it.each(LABORATORIOS)(
    'la historia del laboratorio %s ocurre en dias habiles y en horario de trabajo',
    (lab) => {
      const repositorio = preparadas.get(lab) ?? '';
      const fechas = git(repositorio, 'log', '--all', '--format=%ad', '--date=format:%u %H')
        .split('\n')
        .filter((linea) => linea !== '');

      expect(fechas.length).toBeGreaterThan(0);
      for (const fecha of fechas) {
        const [dia = '', hora = ''] = fecha.split(' ');
        expect(Number(dia), `dia de la semana en ${fecha}`).toBeLessThanOrEqual(5);
        expect(Number(hora), `hora en ${fecha}`).toBeGreaterThanOrEqual(8);
        expect(Number(hora), `hora en ${fecha}`).toBeLessThanOrEqual(18);
      }
    },
  );

  it('el laboratorio 02 reparte la historia entre varios dias y varios autores', () => {
    const repositorio = preparadas.get('02') ?? '';
    const dias = new Set(git(repositorio, 'log', '--format=%ad', '--date=format:%Y-%m-%d').split('\n'));
    const autores = new Set(git(repositorio, 'log', '--format=%an').split('\n'));

    expect(dias.size).toBe(5);
    expect(autores.size).toBe(3);
  });
});
