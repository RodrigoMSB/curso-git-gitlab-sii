/**
 * Laboratorios (SPEC 004).
 *
 * Los laboratorios son carpetas autocontenidas: un enunciado y un verificador
 * en Bash. Las pruebas corren el verificador tal como lo corre el participante
 * y no reimplementan sus criterios en TypeScript.
 *
 * El laboratorio se arma siguiendo el enunciado paso a paso. Un verificador
 * que nunca se vio fallar no prueba nada, asi que cada criterio se rompe por
 * separado y se exige el mensaje y el codigo de salida.
 *
 * La disposicion que se monta es la real: un clon del curso con el enunciado y
 * el verificador en labs/lab-01, y el trabajo del participante en una carpeta
 * hermana del clon, nunca dentro (seccion 17 de la arquitectura).
 *
 * Todo ocurre en carpetas temporales y con una configuracion global de
 * mentira: la configuracion de Git de quien corre las pruebas no se toca, y
 * los criterios que dependen de los alias no quedan a merced de lo que esa
 * maquina tenga puesto.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const LAB01 = fileURLToPath(new URL('../../labs/lab-01', import.meta.url));

interface Corrida {
  readonly codigo: number;
  readonly salida: string;
}

function carpetaTemporal(): string {
  return mkdtempSync(join(tmpdir(), 'laboratorios-'));
}

/**
 * Un entorno con configuracion global y de sistema propias. Sin esto, los
 * alias del taller que ya tenga la maquina harian pasar el criterio 5 aunque
 * el verificador estuviera roto.
 */
function entorno(configGlobal: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: configGlobal,
    GIT_CONFIG_SYSTEM: '/dev/null',
  };
}

function git(carpeta: string, configGlobal: string, ...argumentos: readonly string[]): string {
  return execFileSync('git', ['-C', carpeta, ...argumentos], {
    encoding: 'utf8',
    env: entorno(configGlobal),
  }).trim();
}

/** Corre el verificador como lo corre el participante y recoge todo. */
function verificar(carpetaDelLaboratorio: string, configGlobal: string): Corrida {
  try {
    const salida = execFileSync('bash', ['./verificar.sh'], {
      cwd: carpetaDelLaboratorio,
      encoding: 'utf8',
      env: entorno(configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { codigo: 0, salida };
  } catch (error) {
    const fallo = error as { status?: number; stdout?: string; stderr?: string };
    return { codigo: fallo.status ?? -1, salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}` };
  }
}

interface Laboratorio {
  /** La carpeta del laboratorio dentro del clon: <clon>/labs/lab-01. */
  readonly carpeta: string;
  /** El repositorio del participante, hermano del clon. */
  readonly recetario: string;
  /** La configuracion global de mentira que usa este laboratorio. */
  readonly configGlobal: string;
  /** La raiz del clon del curso. */
  readonly clon: string;
  /** El padre comun del clon y de la carpeta de trabajo. */
  readonly raiz: string;
}

/**
 * Monta un clon del curso de mentira con el laboratorio dentro. `comoRepositorio`
 * decide si ese clon es de verdad un repositorio Git, que es lo que ocurre en la
 * sala: el participante clona el curso, asi que hay un .git por encima.
 */
function montarClon(comoRepositorio: boolean): { raiz: string; clon: string; configGlobal: string } {
  const raiz = carpetaTemporal();
  const clon = join(raiz, 'curso-git-gitlab-sii');
  mkdirSync(join(clon, 'labs', 'lab-01'), { recursive: true });
  cpSync(join(LAB01, 'verificar.sh'), join(clon, 'labs', 'lab-01', 'verificar.sh'));
  execFileSync('chmod', ['+x', join(clon, 'labs', 'lab-01', 'verificar.sh')]);

  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '[user]\n\tname = Relator\n\temail = relator@institucion.cl\n');

  if (comoRepositorio) {
    const env = entorno(configGlobal);
    execFileSync('git', ['-C', clon, 'init', '-q'], { env });
    writeFileSync(join(clon, 'README.md'), 'el repositorio del curso\n');
    execFileSync('git', ['-C', clon, 'add', '-A'], { env });
    execFileSync('git', ['-C', clon, 'commit', '-q', '-m', 'el repositorio del curso'], { env });
  }
  return { raiz, clon, configGlobal };
}

/**
 * Hace el laboratorio 01 siguiendo el enunciado paso a paso: la configuracion,
 * las tres primeras confirmaciones, y la cuarta que deja fuera a proposito el
 * cambio de cocineros.md.
 *
 * `dentroDe` permite armarlo dentro de otro repositorio, que es la situacion
 * real del taller y la que descubrio el error del repositorio anidado.
 */
function armarLaboratorio(opciones: { conAlias?: boolean; clonDeVerdad?: boolean } = {}): Laboratorio {
  const { conAlias = true, clonDeVerdad = true } = opciones;
  const { raiz, clon, configGlobal } = montarClon(clonDeVerdad);
  const carpeta = join(clon, 'labs', 'lab-01');

  // Parte 1 · la configuracion, que el enunciado pide global.
  const alias = conAlias
    ? '[alias]\n\ts = status -s\n\tlg = log --oneline --graph --all --decorate\n'
    : '';
  writeFileSync(
    configGlobal,
    `[user]\n\tname = Participante Taller\n\temail = participante@institucion.cl\n${alias}`,
  );

  // Parte 2 · el repositorio nace, en la carpeta hermana del clon y no dentro.
  const trabajo = join(raiz, 'taller-git-trabajo', 'lab-01');
  mkdirSync(trabajo, { recursive: true });
  const recetario = join(trabajo, 'recetario');
  mkdirSync(recetario);
  git(recetario, configGlobal, 'init', '-q');

  const escribir = (ruta: string, contenido: string): void => {
    writeFileSync(join(recetario, ruta), contenido);
  };
  const confirmar = (mensaje: string): string => git(recetario, configGlobal, 'commit', '-q', '-m', mensaje);
  const preparar = (...rutas: readonly string[]): string =>
    git(recetario, configGlobal, 'add', ...rutas);

  // Parte 3 · las tres primeras confirmaciones.
  escribir('README.md', '# Recetario COMIDA CHILENA\n\nRecopilacion de platos, ingredientes y cocineros.\n');
  preparar('README.md');
  confirmar('se inicia el recetario');

  escribir('platos.md', '# Platos\n\n- pastel de choclo\n- empanadas de pino\n- cazuela\n- curanto\n');
  preparar('platos.md');
  confirmar('se agregan los platos chilenos');

  escribir('ingredientes.md', '# Ingredientes\n\n- choclo\n- carne de vacuno\n- cebolla\n- aji de color\n');
  escribir('cocineros.md', '# Cocineros\n\n- Juana Perez, especialidad pastel de choclo\n- Marco Diaz, especialidad empanadas\n');
  mkdirSync(join(recetario, 'recetas'));
  escribir('recetas/pastel-de-choclo.md', '# Pastel de choclo\n\nPreparacion del pino, molienda del choclo, horneado en greda.\n');
  escribir('recetas/empanadas.md', '# Empanadas de pino\n\nMasa, pino frio, huevo duro, aceituna, doblado y horno.\n');
  preparar('.');
  confirmar('se agregan ingredientes, cocineros y las primeras recetas');

  // Parte 4 · la confirmacion que no lleva todo. cocineros.md queda a medias
  // y fuera de la confirmacion a proposito: ese es el objetivo del ejercicio.
  const agregarLinea = (ruta: string, linea: string): void => {
    const antes = readFileSync(join(recetario, ruta), 'utf8');
    writeFileSync(join(recetario, ruta), `${antes}${linea}\n`);
  };
  agregarLinea('platos.md', '- sopaipillas');
  agregarLinea('ingredientes.md', '- zapallo');
  agregarLinea('cocineros.md', '- Pedro');
  preparar('platos.md', 'ingredientes.md');
  confirmar('se agregan sopaipillas y zapallo');

  return { carpeta, recetario, configGlobal, clon, raiz };
}

describe('CA1 · el laboratorio 01 esta armado', () => {
  it('tiene el enunciado y el verificador', () => {
    expect(statSync(join(LAB01, 'README.md')).isFile()).toBe(true);
    expect(statSync(join(LAB01, 'verificar.sh')).isFile()).toBe(true);
  });

  it('el verificador es ejecutable', () => {
    // El participante lo corre como ./verificar.sh, no como bash verificar.sh.
    expect(statSync(join(LAB01, 'verificar.sh')).mode & 0o111).not.toBe(0);
  });
});

describe('CA2 · el enunciado lleva el cambio de ruta autorizado y solo ese', () => {
  const enunciado = readFileSync(join(LAB01, 'README.md'), 'utf8');

  it('el repositorio se crea en la carpeta hermana del clon', () => {
    expect(enunciado).toContain(
      'cd ..\nmkdir -p taller-git-trabajo/lab-01\ncd taller-git-trabajo/lab-01\nmkdir recetario\ncd recetario\ngit init',
    );
  });

  it('ya no manda al participante a su directorio personal', () => {
    expect(enunciado).not.toMatch(/^cd ~$/m);
  });

  it('no manda a trabajar dentro del clon del curso', () => {
    // El error que la seccion 17 de la arquitectura prohibe heredar.
    expect(enunciado).not.toMatch(/^cd labs\/lab-01$/m);
  });

  it('conserva las cuatro confirmaciones y el archivo que queda fuera', () => {
    // Si alguien reescribe el enunciado, el verificador deja de corresponderle.
    expect(enunciado).toContain('se inicia el recetario');
    expect(enunciado).toContain('se agregan sopaipillas y zapallo');
    expect(enunciado).toContain('cocineros.md');
  });
});

describe('CA3 · el verificador aprueba el laboratorio bien hecho', () => {
  it('los cinco criterios pasan y el codigo de salida es cero', () => {
    const lab = armarLaboratorio();
    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('5 de 5 criterios aprobados');
    expect(corrida.salida).not.toContain('✗');
    expect(corrida.codigo).toBe(0);
  });
});

describe('CA4 · el verificador falla ante cada criterio roto por separado', () => {
  /** Rompe algo sobre un laboratorio recien armado y devuelve lo que dijo. */
  function romper(estropicio: (lab: Laboratorio) => void): Corrida {
    const lab = armarLaboratorio();
    estropicio(lab);
    return verificar(lab.carpeta, lab.configGlobal);
  }

  it('criterio 1 · no existe el repositorio', () => {
    const corrida = romper((lab) => {
      execFileSync('rm', ['-rf', lab.recetario]);
    });
    expect(corrida.salida).toContain('la carpeta recetario no existe');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 2 · el historial no tiene cuatro confirmaciones', () => {
    const corrida = romper((lab) => {
      git(lab.recetario, lab.configGlobal, 'commit', '-q', '--allow-empty', '-m', 'una de mas');
    });
    expect(corrida.salida).toContain('cantidad de confirmaciones');
    expect(corrida.salida).toContain('esperaba: 4');
    expect(corrida.salida).toContain('encontro: 5');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 3 · cocineros.md quedo sin cambios pendientes', () => {
    const corrida = romper((lab) => {
      git(lab.recetario, lab.configGlobal, 'checkout', '--', 'cocineros.md');
    });
    expect(corrida.salida).toContain('cocineros.md modificado y sin preparar');
    expect(corrida.salida).toContain('se confirmo o se deshizo');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 4 · algo quedo en el area de preparacion', () => {
    const corrida = romper((lab) => {
      writeFileSync(join(lab.recetario, 'notas.md'), 'borrador\n');
      git(lab.recetario, lab.configGlobal, 'add', 'notas.md');
    });
    expect(corrida.salida).toContain('area de preparacion vacia');
    expect(corrida.salida).toContain('preparado y sin confirmar: notas.md');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 5 · faltan los alias', () => {
    const lab = armarLaboratorio({ conAlias: false });
    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('los alias s y lg');
    expect(corrida.salida).toContain('falta configurar: s y lg');
    expect(corrida.codigo).not.toBe(0);
  });

  it('nombra cual de los dos alias falta cuando falta uno solo', () => {
    const lab = armarLaboratorio();
    git(lab.recetario, lab.configGlobal, 'config', '--global', '--unset', 'alias.lg');
    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('falta configurar: lg');
    expect(corrida.codigo).not.toBe(0);
  });
});

describe('el trabajo del participante vive fuera del clon del curso', () => {
  it('el recetario no queda en ninguna parte dentro del clon', () => {
    const lab = armarLaboratorio();
    expect(lab.recetario.startsWith(`${lab.clon}/`)).toBe(false);
    expect(lab.recetario).toContain('taller-git-trabajo');
  });

  it('el verificador lo encuentra ahi y aprueba, con el clon siendo un repositorio de verdad', () => {
    // La situacion de la sala: el participante clono el curso, hay un .git.
    const lab = armarLaboratorio({ clonDeVerdad: true });
    expect(git(lab.clon, lab.configGlobal, 'rev-parse', '--is-inside-work-tree')).toBe('true');
    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('5 de 5 criterios aprobados');
    expect(corrida.codigo).toBe(0);
  });

  it('el trabajo del participante no ensucia el estado del clon', () => {
    const lab = armarLaboratorio({ clonDeVerdad: true });
    verificar(lab.carpeta, lab.configGlobal);
    // Ni el recetario ni nada suyo asoma en el git status del curso.
    expect(git(lab.clon, lab.configGlobal, 'status', '--porcelain')).toBe('');
  });
});

describe('el repositorio anidado sigue vigilado, aunque ya no deberia ocurrir', () => {
  /**
   * Con el trabajo fuera del clon, esta situacion no deberia darse nunca. Se
   * vigila igual: si alguna vez el trabajo volviera a quedar bajo un
   * repositorio, Git subiria hasta el de mas arriba y el verificador mediria el
   * laboratorio contra una historia ajena. Los catorce laboratorios que vienen
   * heredan esta forma, y el error se veia aprobado.
   *
   * Para reproducirlo se convierte en repositorio el padre comun del clon y de
   * la carpeta de trabajo, que es el unico modo de que quede un .git por encima
   * del recetario.
   */
  function conRepositorioPorEncima(lab: Laboratorio): void {
    const env = entorno(lab.configGlobal);
    execFileSync('git', ['-C', lab.raiz, 'init', '-q'], { env });
    writeFileSync(join(lab.raiz, 'ajeno.md'), 'una historia que no es la del participante\n');
    execFileSync('git', ['-C', lab.raiz, 'add', 'ajeno.md'], { env });
    execFileSync('git', ['-C', lab.raiz, 'commit', '-q', '-m', 'historia ajena'], { env });
  }

  it('la carpeta creada sin git init falla, aunque haya un repositorio por encima', () => {
    const lab = armarLaboratorio();
    execFileSync('rm', ['-rf', lab.recetario]);
    mkdirSync(lab.recetario);
    conRepositorioPorEncima(lab);

    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('falta el git init');
    expect(corrida.salida).not.toContain('✓ existe el repositorio');
    expect(corrida.codigo).not.toBe(0);
  });

  it('los criterios no se miden contra la historia de ese repositorio', () => {
    const lab = armarLaboratorio();
    execFileSync('rm', ['-rf', lab.recetario]);
    mkdirSync(lab.recetario);
    conRepositorioPorEncima(lab);

    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('no se pudo comprobar, no hay repositorio');
    // La historia de arriba tiene una confirmacion: si se colara, el criterio
    // diria «encontro: 1» en vez de decir que no pudo comprobar.
    expect(corrida.salida).not.toContain('encontro: 1\n');
  });

  it('sin repositorio, los alias no se leen del config del clon', () => {
    // El criterio 5 mentia. El participante escribe los alias sin --global
    // parado en el clon, con lo que quedan en el config DEL CLON y no llegan a
    // su recetario. El verificador preguntaba parado en labs/lab-01, Git subia
    // hasta el clon, encontraba esos alias y daba el criterio por aprobado: el
    // participante no habia hecho el ejercicio y le decian que si.
    const lab = armarLaboratorio({ conAlias: false, clonDeVerdad: true });
    execFileSync('rm', ['-rf', lab.recetario]);
    git(lab.clon, lab.configGlobal, 'config', 'alias.s', 'status -s');
    git(lab.clon, lab.configGlobal, 'config', 'alias.lg', 'log --oneline');

    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('falta configurar: s y lg');
    expect(corrida.salida).not.toContain('✓ los alias');
    expect(corrida.codigo).not.toBe(0);
  });
});

describe('CA6 · el laboratorio no invoca nada de las semillas', () => {
  it('ni el enunciado ni el verificador llaman a semillas/', () => {
    for (const archivo of ['README.md', 'verificar.sh']) {
      const contenido = readFileSync(join(LAB01, archivo), 'utf8');
      expect(contenido).not.toContain('semillas/');
      expect(contenido).not.toContain('preparar.sh');
      expect(contenido).not.toContain('generar.sh');
      expect(contenido).not.toContain('comprobar.sh');
    }
  });
});

describe('el verificador no depende de donde se lo corra', () => {
  it('da el mismo resultado desde la carpeta del laboratorio y desde otra parte', () => {
    const lab = armarLaboratorio();
    const desdeElLaboratorio = verificar(lab.carpeta, lab.configGlobal);
    const desdeOtraParte = (() => {
      try {
        const salida = execFileSync('bash', [join(lab.carpeta, 'verificar.sh')], {
          cwd: tmpdir(),
          encoding: 'utf8',
          env: entorno(lab.configGlobal),
        });
        return { codigo: 0, salida };
      } catch (error) {
        const fallo = error as { status?: number; stdout?: string };
        return { codigo: fallo.status ?? -1, salida: fallo.stdout ?? '' };
      }
    })();
    expect(desdeOtraParte.salida).toBe(desdeElLaboratorio.salida);
    expect(desdeOtraParte.codigo).toBe(desdeElLaboratorio.codigo);
  });
});

// ---------------------------------------------------------------------------
// Laboratorio 02 (SPEC 005)
//
// Del 02 en adelante cada laboratorio arma su propio escenario con un script
// local. Las pruebas corren ese script tal como lo corre el participante y
// comprueban el escenario que produce, su determinismo y los dos modos del
// verificador.
// ---------------------------------------------------------------------------

const LAB02 = fileURLToPath(new URL('../../labs/lab-02', import.meta.url));

/** El mensaje mal escrito que planta la preparacion y que el participante corrige. */
const MENSAJE_MALO = 'se docuemnta la reseta del pastel de choclo';

interface Escenario {
  /** <clon>/labs/lab-02, desde donde se corren los dos scripts. */
  readonly carpeta: string;
  /** El repositorio del participante, hermano del clon. */
  readonly recetario: string;
  readonly configGlobal: string;
  readonly clon: string;
}

/** Monta un clon de mentira con el laboratorio 02 dentro, sin preparar nada. */
function montarLab02(): Escenario {
  const raiz = carpetaTemporal();
  const clon = join(raiz, 'curso-git-gitlab-sii');
  const carpeta = join(clon, 'labs', 'lab-02');
  mkdirSync(carpeta, { recursive: true });
  for (const archivo of ['preparar.sh', 'verificar.sh']) {
    cpSync(join(LAB02, archivo), join(carpeta, archivo));
    execFileSync('chmod', ['+x', join(carpeta, archivo)]);
  }

  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  writeFileSync(configGlobal, '[user]\n\tname = Otro Cualquiera\n\temail = otro@x.cl\n');

  // El clon es un repositorio de verdad, como en la sala.
  const env = entorno(configGlobal);
  execFileSync('git', ['-C', clon, 'init', '-q'], { env });
  writeFileSync(join(clon, 'README.md'), 'el repositorio del curso\n');
  execFileSync('git', ['-C', clon, 'add', '-A'], { env });
  execFileSync('git', ['-C', clon, 'commit', '-q', '-m', 'el curso'], { env });

  return { carpeta, recetario: join(raiz, 'taller-git-trabajo', 'lab-02', 'recetario'), configGlobal, clon };
}

function preparar(esc: Escenario, ...argumentos: readonly string[]): Corrida {
  try {
    const salida = execFileSync('bash', ['./preparar.sh', ...argumentos], {
      cwd: esc.carpeta,
      encoding: 'utf8',
      env: entorno(esc.configGlobal),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { codigo: 0, salida };
  } catch (error) {
    const fallo = error as { status?: number; stdout?: string; stderr?: string };
    return { codigo: fallo.status ?? -1, salida: `${fallo.stdout ?? ''}${fallo.stderr ?? ''}` };
  }
}

/** Arma el escenario y devuelve el laboratorio listo para trabajar. */
function conEscenario(): Escenario {
  const esc = montarLab02();
  const corrida = preparar(esc);
  expect(corrida.codigo).toBe(0);
  return esc;
}

/** Hace el laboratorio siguiendo la parte 3 del enunciado. */
function hacerElLaboratorio(esc: Escenario, opciones: { ordenLiteral?: boolean } = {}): void {
  const { ordenLiteral = false } = opciones;
  const g = (...argumentos: readonly string[]): string =>
    git(esc.recetario, esc.configGlobal, ...argumentos);

  // El orden literal del enunciado hace 3.1 antes de 3.3. Ver el informe del
  // SPEC 005: en ese orden el --amend se lleva puesto el archivo preparado.
  if (!ordenLiteral) g('restore', '--staged', 'cocineros.md');
  g('commit', '--amend', '-q', '-m', 'se corrige la receta del pastel de choclo');
  g('restore', 'ingredientes.md');
  if (ordenLiteral) g('restore', '--staged', 'cocineros.md');
  g('reset', '--soft', 'HEAD~1');
  g('commit', '-q', '-m', 'se documenta la receta del pastel de choclo');
}

describe('CA1 · el laboratorio 02 esta armado', () => {
  it('tiene el enunciado, la preparacion y el verificador', () => {
    for (const archivo of ['README.md', 'preparar.sh', 'verificar.sh']) {
      expect(statSync(join(LAB02, archivo)).isFile()).toBe(true);
    }
  });

  it('los dos scripts son ejecutables', () => {
    for (const archivo of ['preparar.sh', 'verificar.sh']) {
      expect(statSync(join(LAB02, archivo)).mode & 0o111).not.toBe(0);
    }
  });
});

describe('CA2 · la preparacion produce el escenario de la seccion 4', () => {
  it('cinco confirmaciones en main, en historia lineal', () => {
    const esc = conEscenario();
    expect(git(esc.recetario, esc.configGlobal, 'rev-list', '--count', 'HEAD')).toBe('5');
    expect(git(esc.recetario, esc.configGlobal, 'log', '--merges', '--format=%H')).toBe('');
    expect(git(esc.recetario, esc.configGlobal, 'branch', '--show-current')).toBe('main');
  });

  it('tres autores distintos, con Juana Perez entre ellos', () => {
    const esc = conEscenario();
    const autores = git(esc.recetario, esc.configGlobal, 'log', '--format=%an').split('\n');
    expect(new Set(autores).size).toBe(3);
    expect(autores).toContain('Juana Perez');
  });

  it('fechas repartidas en varios meses de 2024', () => {
    const esc = conEscenario();
    const meses = git(
      esc.recetario,
      esc.configGlobal,
      'log',
      '--format=%ad',
      '--date=format:%Y-%m',
    ).split('\n');
    expect(new Set(meses).size).toBeGreaterThanOrEqual(3);
    for (const mes of meses) expect(mes.startsWith('2024-')).toBe(true);
  });

  it('curanto entro en una confirmacion y sigue presente', () => {
    const esc = conEscenario();
    const conCuranto = git(esc.recetario, esc.configGlobal, 'log', '-S', 'curanto', '--format=%H');
    expect(conCuranto.split('\n').filter(Boolean).length).toBeGreaterThanOrEqual(1);
    expect(readFileSync(join(esc.recetario, 'platos.md'), 'utf8')).toContain('curanto');
  });

  it('la quinta confirmacion lleva el mensaje mal escrito', () => {
    const esc = conEscenario();
    expect(git(esc.recetario, esc.configGlobal, 'log', '-1', '--format=%s')).toBe(MENSAJE_MALO);
  });

  it('un archivo modificado sin preparar y otro preparado por error', () => {
    const esc = conEscenario();
    expect(git(esc.recetario, esc.configGlobal, 'diff', '--name-only')).toBe('ingredientes.md');
    expect(git(esc.recetario, esc.configGlobal, 'diff', '--cached', '--name-only')).toBe('cocineros.md');
  });

  it('estan los archivos del recetario y la carpeta recetas', () => {
    const esc = conEscenario();
    for (const archivo of ['README.md', 'platos.md', 'ingredientes.md', 'cocineros.md', 'recetas']) {
      expect(statSync(join(esc.recetario, archivo))).toBeTruthy();
    }
  });

  it('dos ejecuciones producen los mismos identificadores', () => {
    const esc = montarLab02();
    preparar(esc);
    const primera = git(esc.recetario, esc.configGlobal, 'log', '--format=%H');
    preparar(esc, '--forzar');
    const segunda = git(esc.recetario, esc.configGlobal, 'log', '--format=%H');
    expect(segunda).toBe(primera);
    expect(primera.split('\n').length).toBe(5);
  });

  it('dos maquinas distintas producen los mismos identificadores', () => {
    // Se monta el laboratorio dos veces, en carpetas temporales distintas y con
    // configuraciones globales distintas: si algo de la maquina se colara en la
    // historia, los identificadores dejarian de coincidir.
    const uno = montarLab02();
    const otro = montarLab02();
    writeFileSync(otro.configGlobal, '[user]\n\tname = Alguien Mas\n\temail = mas@y.cl\n');
    preparar(uno);
    preparar(otro);
    expect(git(otro.recetario, otro.configGlobal, 'log', '--format=%H')).toBe(
      git(uno.recetario, uno.configGlobal, 'log', '--format=%H'),
    );
  });
});

describe('CA3 · la preparacion no destruye el trabajo sin avisar', () => {
  it('avisa y se detiene si ya hay un escenario y no puede preguntar', () => {
    const esc = conEscenario();
    git(esc.recetario, esc.configGlobal, 'commit', '-q', '--allow-empty', '-m', 'trabajo del participante');

    const corrida = preparar(esc);
    expect(corrida.salida).toContain('ATENCION');
    expect(corrida.salida).toContain('BORRA COMPLETO');
    expect(corrida.codigo).not.toBe(0);
    // Y sobre todo: el trabajo sigue ahi.
    expect(git(esc.recetario, esc.configGlobal, 'log', '-1', '--format=%s')).toBe(
      'trabajo del participante',
    );
  });

  it('marca el borrado de forma visible cuando se fuerza', () => {
    const esc = conEscenario();
    git(esc.recetario, esc.configGlobal, 'commit', '-q', '--allow-empty', '-m', 'trabajo del participante');

    const corrida = preparar(esc, '--forzar');
    expect(corrida.salida).toContain('ATENCION');
    expect(corrida.salida).toContain('BORRANDO');
    expect(corrida.codigo).toBe(0);
    expect(git(esc.recetario, esc.configGlobal, 'log', '-1', '--format=%s')).toBe(MENSAJE_MALO);
  });

  it('rechaza una opcion que no conoce en vez de hacer algo raro', () => {
    const esc = montarLab02();
    const corrida = preparar(esc, '--borra-todo');
    expect(corrida.salida).toContain('opcion desconocida');
    expect(corrida.codigo).toBe(2);
  });

  it('la preparacion comprueba el escenario antes de entregarlo', () => {
    const esc = montarLab02();
    const corrida = preparar(esc);
    expect(corrida.salida).toContain('el escenario quedo correcto');
    expect(corrida.salida).toContain('Tu primera orden es');
    expect(corrida.salida).toContain('taller-git-trabajo/lab-02/recetario');
  });
});

describe('CA4 · el verificador rechaza el escenario sin trabajo hecho', () => {
  it('un laboratorio recien preparado no aprueba', () => {
    // El criterio mas importante del SPEC 005: en el estado inicial tambien hay
    // cinco confirmaciones, asi que contar no basta para distinguirlo.
    const esc = conEscenario();
    const corrida = verificar(esc.carpeta, esc.configGlobal);
    expect(corrida.codigo).not.toBe(0);
    expect(corrida.salida).toContain('no esta terminado');
    expect(corrida.salida).toContain('falta corregirla con --amend');
    expect(corrida.salida).toContain('preparado y sin confirmar: cocineros.md');
  });

  it('cuenta las cinco confirmaciones igual, que es justo lo que confunde', () => {
    const esc = conEscenario();
    const corrida = verificar(esc.carpeta, esc.configGlobal);
    expect(corrida.salida).toContain('✓ hay cinco confirmaciones en el historial');
  });
});

describe('CA5 · el verificador aprueba el laboratorio hecho y rechaza cada criterio roto', () => {
  it('aprueba cuando el laboratorio esta bien hecho', () => {
    const esc = conEscenario();
    hacerElLaboratorio(esc);
    const corrida = verificar(esc.carpeta, esc.configGlobal);
    expect(corrida.salida).toContain('6 de 6 criterios aprobados');
    expect(corrida.salida).not.toContain('✗');
    expect(corrida.codigo).toBe(0);
  });

  function romper(estropicio: (esc: Escenario) => void): Corrida {
    const esc = conEscenario();
    hacerElLaboratorio(esc);
    estropicio(esc);
    return verificar(esc.carpeta, esc.configGlobal);
  }

  it('criterio 1 · no existe el repositorio', () => {
    const corrida = romper((esc) => {
      execFileSync('rm', ['-rf', esc.recetario]);
    });
    expect(corrida.salida).toContain('falta preparar el laboratorio');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 2 · el historial no tiene cinco confirmaciones', () => {
    const corrida = romper((esc) => {
      git(esc.recetario, esc.configGlobal, 'commit', '-q', '--allow-empty', '-m', 'una de mas');
    });
    expect(corrida.salida).toContain('esperaba: 5');
    expect(corrida.salida).toContain('encontro: 6');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 3 · el mensaje mal escrito volvio a la historia', () => {
    const corrida = romper((esc) => {
      git(esc.recetario, esc.configGlobal, 'commit', '--amend', '-q', '-m', MENSAJE_MALO);
    });
    expect(corrida.salida).toContain('falta corregirla con --amend');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 4 · algo quedo en el area de preparacion', () => {
    const corrida = romper((esc) => {
      writeFileSync(join(esc.recetario, 'notas.md'), 'borrador\n');
      git(esc.recetario, esc.configGlobal, 'add', 'notas.md');
    });
    expect(corrida.salida).toContain('preparado y sin confirmar: notas.md');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 5 · cocineros.md dejo de estar modificado', () => {
    const corrida = romper((esc) => {
      git(esc.recetario, esc.configGlobal, 'restore', 'cocineros.md');
    });
    expect(corrida.salida).toContain('se confirmo o se descarto');
    expect(corrida.codigo).not.toBe(0);
  });

  it('criterio 6 · la busqueda de curanto no encuentra nada', () => {
    // curanto no se puede sacar sin reescribir la historia, asi que se arma una
    // historia paralela que nunca lo tuvo. Es lo que le queda a quien destruyo
    // el historial con un reset de mas, que es lo que el criterio vigila.
    const esc = conEscenario();
    execFileSync('rm', ['-rf', esc.recetario]);
    mkdirSync(esc.recetario, { recursive: true });
    const g = (...a: readonly string[]): string => git(esc.recetario, esc.configGlobal, ...a);
    g('init', '-q', '-b', 'main');
    const confirmar = (mensaje: string): void => {
      g('add', '-A');
      execFileSync('git', ['-C', esc.recetario, 'commit', '-q', '-m', mensaje], {
        env: {
          ...entorno(esc.configGlobal),
          GIT_AUTHOR_NAME: 'Juana Perez',
          GIT_AUTHOR_EMAIL: 'j@r.cl',
          GIT_COMMITTER_NAME: 'Juana Perez',
          GIT_COMMITTER_EMAIL: 'j@r.cl',
        },
      });
    };
    writeFileSync(join(esc.recetario, 'README.md'), '# Recetario\n');
    confirmar('se inicia el recetario');
    // platos.md sin curanto: es lo unico que cambia respecto del escenario real.
    writeFileSync(join(esc.recetario, 'platos.md'), '# Platos\n\n- cazuela\n');
    confirmar('se agregan los platos chilenos');
    writeFileSync(join(esc.recetario, 'ingredientes.md'), '# Ingredientes\n\n- choclo\n');
    confirmar('se agregan los ingredientes base');
    writeFileSync(join(esc.recetario, 'cocineros.md'), '# Cocineros\n\n- Juana Perez\n');
    confirmar('se suma la lista de cocineros');
    mkdirSync(join(esc.recetario, 'recetas'), { recursive: true });
    writeFileSync(join(esc.recetario, 'recetas', 'pastel-de-choclo.md'), '# Pastel\n');
    confirmar('se documenta la receta del pastel de choclo');
    writeFileSync(join(esc.recetario, 'cocineros.md'), '# Cocineros\n\n- Juana Perez\n- Sofia Rojas\n');

    const corrida = verificar(esc.carpeta, esc.configGlobal);
    expect(corrida.salida).toContain('se perdio la confirmacion que introdujo la palabra');
    expect(corrida.codigo).not.toBe(0);
  });
});

describe('el orden literal del enunciado no alcanza su propia comprobacion', () => {
  it('el --amend de 3.1 se lleva el archivo que 3.3 tenia que sacar', () => {
    // Hallazgo reportado al product owner (punto 5.4 del SPEC 005). El
    // enunciado hace 3.1 antes de 3.3, y --amend confirma lo que haya en el
    // area de preparacion, o sea el cambio de cocineros.md. Cuando el
    // participante llega a 3.3 no queda nada que sacar, y la comprobacion del
    // propio enunciado pide que cocineros.md aparezca modificado.
    //
    // El enunciado NO se toco: la decision es del product owner. Esta prueba
    // fija el hallazgo para que no se pierda ni cambie en silencio.
    const esc = conEscenario();
    hacerElLaboratorio(esc, { ordenLiteral: true });

    expect(git(esc.recetario, esc.configGlobal, 'status', '--porcelain')).toBe('');
    const corrida = verificar(esc.carpeta, esc.configGlobal);
    expect(corrida.salida).toContain('✗ cocineros.md modificado y sin preparar');
    expect(corrida.codigo).not.toBe(0);
  });

  it('haciendo 3.3 antes de 3.1, el mismo laboratorio aprueba', () => {
    const esc = conEscenario();
    hacerElLaboratorio(esc, { ordenLiteral: false });
    expect(verificar(esc.carpeta, esc.configGlobal).codigo).toBe(0);
  });
});

describe('CA6 · el enunciado difiere solo en los tres cambios autorizados', () => {
  const enunciado = readFileSync(join(LAB02, 'README.md'), 'utf8');

  it('la preparacion apunta al script del laboratorio', () => {
    expect(enunciado).toContain('labs/lab-02/preparar.sh\ncd ../taller-git-trabajo/lab-02/recetario');
  });

  it('la ruta de trabajo es la carpeta hermana', () => {
    expect(enunciado).toContain('taller-git-trabajo/lab-02/recetario');
    expect(enunciado).not.toContain('cd ~/recetario');
  });

  it('el rescate ya no manda preparar la semilla', () => {
    expect(enunciado).not.toContain('semillas/preparar.sh');
    expect(enunciado).not.toContain('prepara la semilla de nuevo');
  });

  it('el resto del enunciado sigue intacto', () => {
    // Las partes que el spec prohibe tocar.
    expect(enunciado).toContain('### 3.1 El mensaje mal escrito');
    expect(enunciado).toContain('git log -S "curanto" --oneline');
    expect(enunciado).toContain('## Lo que te llevas');
  });
});

describe('CA7 · el laboratorio 02 no invoca nada de las semillas', () => {
  it('ninguna linea ejecutable llama a semillas/', () => {
    for (const archivo of ['README.md', 'preparar.sh', 'verificar.sh']) {
      const lineas = readFileSync(join(LAB02, archivo), 'utf8')
        .split('\n')
        .filter((linea) => !linea.trim().startsWith('#'));
      expect(lineas.join('\n')).not.toContain('semillas/');
    }
  });
});
