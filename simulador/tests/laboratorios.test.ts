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
  /** La carpeta que contiene el enunciado y el verificador. */
  readonly carpeta: string;
  /** El repositorio del participante. */
  readonly recetario: string;
  /** La configuracion global de mentira que usa este laboratorio. */
  readonly configGlobal: string;
}

/**
 * Hace el laboratorio 01 siguiendo el enunciado paso a paso: la configuracion,
 * las tres primeras confirmaciones, y la cuarta que deja fuera a proposito el
 * cambio de cocineros.md.
 *
 * `dentroDe` permite armarlo dentro de otro repositorio, que es la situacion
 * real del taller y la que descubrio el error del repositorio anidado.
 */
function armarLaboratorio(opciones: { conAlias?: boolean; dentroDe?: string } = {}): Laboratorio {
  const { conAlias = true, dentroDe } = opciones;
  const raiz = dentroDe ?? carpetaTemporal();
  const carpeta = join(raiz, 'lab-01');
  mkdirSync(carpeta, { recursive: true });
  cpSync(join(LAB01, 'verificar.sh'), join(carpeta, 'verificar.sh'));
  execFileSync('chmod', ['+x', join(carpeta, 'verificar.sh')]);

  // Parte 1 · la configuracion, que el enunciado pide global.
  const configGlobal = join(raiz, 'gitconfig-de-mentira');
  const alias = conAlias
    ? '[alias]\n\ts = status -s\n\tlg = log --oneline --graph --all --decorate\n'
    : '';
  writeFileSync(
    configGlobal,
    `[user]\n\tname = Participante Taller\n\temail = participante@institucion.cl\n${alias}`,
  );

  // Parte 2 · el repositorio nace.
  const recetario = join(carpeta, 'recetario');
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

  return { carpeta, recetario, configGlobal };
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

  it('el repositorio se crea dentro de la carpeta del laboratorio', () => {
    expect(enunciado).toContain('cd labs/lab-01\nmkdir recetario\ncd recetario\ngit init');
  });

  it('ya no manda al participante a su directorio personal', () => {
    expect(enunciado).not.toMatch(/^cd ~$/m);
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

describe('el repositorio anidado no puede hacer pasar un laboratorio por hecho', () => {
  /**
   * La regresion que motivo esta suite. El laboratorio vive dentro del
   * repositorio del curso, y Git, cuando no encuentra un .git propio, sigue
   * subiendo hasta dar con el de mas arriba. Preguntar si Git responde daba el
   * criterio por bueno y medía el laboratorio contra la historia del curso.
   */
  function cursoDeMentira(): string {
    const raiz = carpetaTemporal();
    const config = join(raiz, 'gitconfig-de-mentira');
    writeFileSync(config, '[user]\n\tname = Relator\n\temail = relator@institucion.cl\n');
    execFileSync('git', ['-C', raiz, 'init', '-q'], { env: entorno(config) });
    writeFileSync(join(raiz, 'README.md'), 'el repositorio del curso\n');
    execFileSync('git', ['-C', raiz, 'add', '-A'], { env: entorno(config) });
    execFileSync('git', ['-C', raiz, 'commit', '-q', '-m', 'el repositorio del curso'], {
      env: entorno(config),
    });
    return raiz;
  }

  it('la carpeta creada sin git init falla, aunque haya un repositorio mas arriba', () => {
    const curso = cursoDeMentira();
    const lab = armarLaboratorio({ dentroDe: curso });
    // El participante borra el repositorio y deja solo la carpeta: el caso de
    // quien hizo el mkdir y se olvido del git init.
    execFileSync('rm', ['-rf', lab.recetario]);
    mkdirSync(lab.recetario);

    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('falta el git init');
    expect(corrida.salida).not.toContain('✓ existe el repositorio');
    expect(corrida.codigo).not.toBe(0);
  });

  it('los criterios del repositorio no se miden contra la historia del curso', () => {
    const curso = cursoDeMentira();
    const lab = armarLaboratorio({ dentroDe: curso });
    execFileSync('rm', ['-rf', lab.recetario]);
    mkdirSync(lab.recetario);

    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('no se pudo comprobar, no hay repositorio');
    // La historia del curso tiene una confirmacion: si se colara, el criterio
    // diria «encontro: 1» en vez de decir que no pudo comprobar.
    expect(corrida.salida).not.toContain('encontro: 1\n');
  });

  it('el laboratorio bien hecho sigue aprobando dentro del repositorio del curso', () => {
    const curso = cursoDeMentira();
    const lab = armarLaboratorio({ dentroDe: curso });
    const corrida = verificar(lab.carpeta, lab.configGlobal);
    expect(corrida.salida).toContain('5 de 5 criterios aprobados');
    expect(corrida.codigo).toBe(0);
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
