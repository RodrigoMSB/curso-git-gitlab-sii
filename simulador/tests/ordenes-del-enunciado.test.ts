/**
 * Extraccion de las ordenes desde el enunciado (seccion 2 del SPEC 008).
 *
 * Las pruebas de punta a punta ejecutan lo que el enunciado dice, y no una
 * lista escrita aparte. Lo que se comprueba aqui es que la extraccion y la
 * clasificacion hagan lo que prometen, sin necesidad de levantar el navegador.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ORDENES_GIT } from '../src/core';
import { ejecutar } from '../src/core/motor';
import { AGRUPABLES, EQUIVALENTES, INEXISTENTES, OPCIONES, OPCIONES_INTERPRETE, SIN_SOPORTE } from '../src/core/contrato';
import { CodigoPorFuncion, sinComentarios } from './codigo-por-funcion';
import { ALIAS_DEL_TALLER, escenarioPorId } from '../src/escenarios';
import {
  bloquesDe,
  motivoDeclarado,
  aliasDelTaller,
  configuracionDelTaller,
  ordenesDe,
  ordenesEnProsa,
  resolverMarcadores,
  resumen,
  type OrdenDelEnunciado,
  ELECCIONES,
} from '../cypress/soporte/ordenes';

const MOTOR = fileURLToPath(new URL('../src/core', import.meta.url));

/** El motor partido en declaraciones, para leer que alcanza cada manejador. */
const codigo = new CodigoPorFuncion(MOTOR);
const MANEJADORES = {
  git: codigo.tabla('ordenes/registro.ts', 'ORDENES_GIT'),
  interprete: codigo.tabla('ordenes/registro.ts', 'ORDENES_INTERPRETE'),
};
const TODOS_LOS_MANEJADORES = new Set([...MANEJADORES.git.values(), ...MANEJADORES.interprete.values()]);

/** Lo que no se recorre: el contrato, que declara, y el manejador de otra orden. */
const excluidas = (declaracion: { readonly archivo: string }): boolean =>
  declaracion.archivo === 'contrato.ts' || TODOS_LOS_MANEJADORES.has(declaracion as never);

function manejadorDe(lado: 'git' | 'interprete', nombre: string) {
  const manejador = MANEJADORES[lado].get(nombre);
  if (manejador === undefined) throw new Error(`${lado} ${nombre} no tiene manejador`);
  return manejador;
}

type Tabla = Readonly<Record<string, readonly string[]>>;

/**
 * Las opciones declaradas que el manejador de su orden no lee y que no estan
 * declaradas como equivalentes, escritas como `git show --oneline`.
 *
 * Recibe las tablas para que la prueba se pueda ver fallar con una opcion
 * agregada a proposito, sin tocar el contrato.
 */
function opcionesSinLector(
  tablas: { readonly git?: Tabla; readonly interprete?: Tabla } = { git: OPCIONES, interprete: OPCIONES_INTERPRETE },
): string[] {
  const faltan: string[] = [];
  for (const lado of ['git', 'interprete'] as const) {
    for (const [nombre, opciones] of Object.entries(tablas[lado] ?? {})) {
      // Una orden sin manejador, como `cd`, nunca llega a ejecutarse: el
      // contrato la responde antes, con su forma declarada.
      if (!MANEJADORES[lado].has(nombre)) continue;
      const texto = codigo.alcanzable(manejadorDe(lado, nombre), excluidas);
      const como = lado === 'git' ? `git ${nombre}` : nombre;
      for (const opcion of opciones) {
        if (opcion === '--' || Object.hasOwn(EQUIVALENTES, `${como} ${opcion}`)) continue;
        // Las cortas de una orden agrupable se leen por su letra, con
        // `letrasCortas`: `wc -w` se consulta como `has('w')`.
        const porLetra =
          lado === 'interprete' && AGRUPABLES.has(nombre) && /^-[a-zA-Z]$/.test(opcion)
            ? texto.includes(`has('${opcion.slice(1)}')`)
            : false;
        if (!texto.includes(`'${opcion}'`) && !porLetra) faltan.push(`${como} ${opcion}`);
      }
    }
  }
  return faltan;
}

const LABS = fileURLToPath(new URL('../../labs', import.meta.url));
const enunciado = (numero: string): string =>
  readFileSync(`${LABS}/lab-${numero}/README.md`, 'utf8');

/**
 * Los alias del taller, sacados del enunciado del laboratorio 01.
 *
 * No se escriben aqui: es donde el participante los configura, y es la unica
 * fuente desde el SPEC 011.
 */
const ALIAS = aliasDelTaller(enunciado('01'));

describe('los bloques salen del enunciado, en orden', () => {
  it('toma solo lo que va entre cercas', () => {
    const bloques = bloquesDe('texto\n```\nuno\n```\nmas texto\n```\ndos\n```\n');
    expect(bloques.map((bloque) => bloque.contenido)).toEqual(['uno', 'dos']);
  });

  it('anota la linea de cada bloque, para poder ubicar un fallo', () => {
    const bloques = bloquesDe('a\nb\n```\nuno\n```\n');
    expect(bloques[0]?.linea).toBe(4);
  });

  it('deja fuera lo que no es una orden', () => {
    // Los enunciados muestran el contenido de los archivos en bloques iguales.
    const ordenes = ordenesDe('```\n# Platos\n\n- cazuela\n- curanto\n```\n', ALIAS);
    expect(ordenes).toEqual([]);
  });
});

describe('la clasificacion no salta nada en silencio', () => {
  it('cada orden saltada lleva su motivo', () => {
    for (const numero of ['01', '02', '03']) {
      for (const orden of ordenesDe(enunciado(numero), ALIAS)) {
        if (orden.clase === 'comparada') continue;
        expect(orden.motivo, `${numero}: ${orden.texto}`).to.not.equal('');
      }
    }
  });

  it('lo que lleva un marcador de posicion no se ejecuta a ciegas', () => {
    const ordenes = ordenesDe('```\ngit show <identificador>\n```\n', ALIAS);
    expect(ordenes[0]?.clase).toBe('omitida');
    expect(ordenes[0]?.motivo).toContain('marcador de posicion');
  });

  it('lo que el motor no conoce se marca para correrse solo en Git', () => {
    // El verbo se consulta contra la tabla de ordenes del propio motor: el dia
    // que aprenda una orden nueva, la prueba la recoge sola.
    const ordenes = ordenesDe('```\ngit bisect start\ngit status\n```\n', ALIAS);
    expect(ordenes[0]?.clase).toBe('declarada');
    expect(ordenes[0]?.motivo).toContain('git bisect');
    expect(ordenes[1]?.clase).toBe('comparada');
  });

  it('mirar dentro de la carpeta oculta se corre solo en Git', () => {
    const ordenes = ordenesDe('```\ncat .git/HEAD\n```\n', ALIAS);
    expect(ordenes[0]?.clase).toBe('declarada');
    expect(ordenes[0]?.motivo).toContain('carpeta oculta');
  });
});

describe('los marcadores que si se pueden resolver salen del escenario', () => {
  it('el archivo a descartar y el archivo a sacar de la preparacion', () => {
    // No se escriben a mano: se leen de la declaracion del escenario, que es
    // la unica fuente de la forma del laboratorio (SPEC 007).
    const ordenes = resolverMarcadores(ordenesDe(enunciado('02'), ALIAS), '02', ALIAS);
    const textos = ordenes.map((orden) => orden.texto);
    expect(textos).toContain('git restore ingredientes.md');
    expect(textos).toContain('git restore --staged cocineros.md');
    expect(textos).not.toContain('git restore <archivo>');
  });

  it('resolverlos convierte dos pasos centrales en comparados', () => {
    const antes = resumen(ordenesDe(enunciado('02'), ALIAS));
    const despues = resumen(resolverMarcadores(ordenesDe(enunciado('02'), ALIAS), '02', ALIAS));
    expect(despues.comparadas).toBe(antes.comparadas + 2);
    expect(despues.omitidas).toBe(antes.omitidas - 2);
  });

  it('los que nombran un identificador se quedan sin resolver', () => {
    // Los identificadores del simulador y los de Git no coinciden por diseño:
    // no hay un unico valor que sirva en los dos lados.
    const ordenes = resolverMarcadores(ordenesDe(enunciado('03'), ALIAS), '03', ALIAS);
    expect(ordenes.filter((orden) => orden.texto.includes('<')).length).toBeGreaterThan(0);
  });
});

describe('7.5 · ninguna orden del guion se acepta y se ignora', () => {
  // La garantia central del SPEC 010. Para cada orden del guion, el motor
  // tiene que hacer una de tres cosas: ejecutarla entera, decir que no la
  // implementa, o decir que la orden no existe. La cuarta, aceptarla y
  // descartarla en silencio, es la que este spec viene a eliminar.
  // El 07 entro con la seccion 59: armado desde la 56 y con escenario, se
  // habia quedado fuera de esta lista y sus ordenes no las miraba nadie.
  const LABORATORIOS = ['01', '02', '03', '04', '05', '06', '07'];

  function guionDe(numero: string): readonly OrdenDelEnunciado[] {
    const texto = enunciado(numero);
    return [...resolverMarcadores(ordenesDe(texto, ALIAS), numero, ALIAS), ...ordenesEnProsa(texto, ALIAS)];
  }

  it('cada orden del guion cae en una de las tres respuestas, con motivo escrito', () => {
    for (const numero of LABORATORIOS) {
      for (const orden of guionDe(numero)) {
        if (orden.clase === 'comparada') {
          expect(orden.motivo, `lab-${numero}: ${orden.texto}`).toBe('');
          continue;
        }
        expect(orden.motivo, `lab-${numero}: ${orden.texto}`).not.toBe('');
      }
    }
  });

  it('lo declarado como no soportado el motor lo dice, y no lo ejecuta', () => {
    for (const numero of LABORATORIOS) {
      const estado = escenarioPorId(`lab-${numero}`);
      for (const orden of guionDe(numero)) {
        if (orden.clase !== 'declarada') continue;
        const resultado = ejecutar(estado, orden.texto);
        const dicho = resultado.salida.some((linea) => linea.tipo === 'limite');
        const inexistente = resultado.salida.some(
          (linea) =>
            linea.texto.includes('is not a git command') ||
            linea.texto.includes('command not found'),
        );
        expect(dicho || inexistente, `lab-${numero}: ${orden.texto}`).toBe(true);
        expect(resultado.estado, `lab-${numero}: ${orden.texto}`).toBe(estado);
      }
    }
  });

  it('toda opcion que el contrato reconoce la lee el manejador de su orden, o esta declarada como equivalente', () => {
    // Una opcion listada como reconocida que su manejador no consulta es,
    // literalmente, una opcion aceptada y descartada.
    //
    // **Se lee el codigo por funcion, no por archivo** (seccion 59). La
    // version anterior buscaba la opcion en todo `src/core` junto, y
    // `git checkout --detach` pasaba porque `'--detach'` aparecia en la
    // funcion de `git switch`. Ahora cada opcion se busca en lo que el
    // manejador de **su** orden alcanza: su cuerpo y lo que nombra, sin
    // entrar en `contrato.ts`, que declara y no ejecuta, ni en el manejador
    // de otra orden. Los comentarios se quitan antes, porque citar una opcion
    // no es leerla.
    const faltan = opcionesSinLector();
    expect(faltan, faltan.join('\n')).toEqual([]);
  });

  it('la prueba anterior ve fallar lo que tiene que ver fallar', () => {
    // Las tres formas del agujero, armadas a proposito. Una prueba que nunca
    // se vio fallar no prueba nada.
    //
    // 1. La opcion leida en otro subcomando del mismo archivo: `--detach`
    //    esta en `git switch` y en `git checkout`; `--oneline` esta en
    //    `git log` y no en `git show`.
    expect(opcionesSinLector({ git: { show: ['--oneline'] } })).toEqual(['git show --oneline']);
    // 2. La opcion citada solo en un comentario. Hoy el motor no tiene
    //    ninguna asi, de modo que se comprueba el filtro directamente.
    const citada = sinComentarios("// lee '--all'\n/* y '-q' */\nconst x = 'a // b';");
    expect(citada).not.toContain("'--all'");
    expect(citada).not.toContain("'-q'");
    expect(citada).toContain("'a // b'");
    // 3. La equivalencia de una orden que eximia a otra: `-q` estaba
    //    declarada con un motivo de `git init` y valia para `git commit`.
    expect(opcionesSinLector({ git: { commit: ['-q'] } })).toEqual(['git commit -q']);
    // Y el nombre repetido en los dos lados: `rm --cached` lo lee `git rm`,
    // no el `rm` del interprete.
    expect(opcionesSinLector({ interprete: { rm: ['--cached'] } })).toEqual(['rm --cached']);
  });

  it('las opciones agrupables se leen por su letra', () => {
    // El contrato acepta `-rn` letra por letra solo en `AGRUPABLES`. Si el
    // manejador leyera `-r` como palabra entera, `-rn` pasaria el contrato y
    // llegaria sin `-r` a la vista: aceptada y descartada otra vez.
    for (const nombre of AGRUPABLES) {
      const texto = codigo.alcanzable(manejadorDe('interprete', nombre), excluidas);
      for (const opcion of OPCIONES_INTERPRETE[nombre] ?? []) {
        if (!/^-[a-zA-Z]$/.test(opcion)) continue;
        expect(texto.includes(`has('${opcion.slice(1)}')`), `${nombre} ${opcion}`).toBe(true);
      }
    }
  });

  it('en Git una opcion agrupada no pasa el contrato', () => {
    const estado = escenarioPorId('lab-02');
    // `git commit` es la excepcion, con `AGRUPABLES_GIT`; `git rm` no lo es.
    const resultado = ejecutar(estado, 'git rm -rf recetas');
    expect(resultado.salida.some((linea) => linea.tipo === 'limite')).toBe(true);
    expect(resultado.estado).toBe(estado);
  });

  it('una opcion que no existe no esta a la vez entre las aceptadas', () => {
    // Si estuviera en las dos, la respuesta dependeria del orden en que el
    // despachador las mira, y eso no se decide por accidente (SPEC 015).
    // `git add -a` es la excepcion escrita: la acepta el contrato para que su
    // manejador responda el error.
    for (const clave of Object.keys(INEXISTENTES)) {
      const partes = clave.split(' ');
      const opcion = partes.at(-1) ?? '';
      const esGit = partes[0] === 'git';
      const nombre = esGit ? (partes[1] ?? '') : (partes[0] ?? '');
      const tabla = esGit ? OPCIONES : OPCIONES_INTERPRETE;
      expect(tabla[nombre]?.includes(opcion) ?? false, clave).toBe(false);
    }
  });

  it('cada equivalencia nombra una opcion que el contrato declara', () => {
    // Una equivalencia que sobrevive a su opcion es una excusa esperando que
    // alguien la vuelva a poner.
    const declaradas = new Set(
      Object.entries(OPCIONES).flatMap(([verbo, opciones]) =>
        opciones.map((opcion) => `git ${verbo} ${opcion}`),
      ),
    );
    for (const clave of Object.keys(EQUIVALENTES)) expect(declaradas.has(clave), clave).toBe(true);
  });

  it('ninguna orden del guion queda fuera por una opcion', () => {
    // La prueba de abajo mira solo las comparadas, y la clasificacion sale
    // del mismo contrato: una opcion que se saca de la tabla vuelve
    // «declarada» la orden del guion que la usa, y la prueba sigue en verde
    // mirando una orden menos. Asi `git reflog -10` del laboratorio 06 se
    // salio del recorrido en la seccion 59 sin que nada lo dijera.
    //
    // Lo unico que puede dejar fuera una orden del guion es una forma de
    // `SIN_SOPORTE`, que lleva su motivo escrito. Una opcion, nunca.
    const motivosDeForma = new Set(SIN_SOPORTE.map((forma) => forma.motivo));
    for (const numero of LABORATORIOS) {
      for (const orden of guionDe(numero)) {
        const motivo = motivoDeclarado(orden.texto, ALIAS);
        if (motivo === null) continue;
        expect(motivosDeForma.has(motivo), `lab-${numero}: ${orden.texto} · ${motivo}`).toBe(true);
      }
    }
  });

  it('el guion no usa ninguna opcion que el contrato no nombre', () => {
    // Al reves que la anterior: lo que el enunciado escribe tiene que estar
    // decidido, sea implementado o declarado. Nada a medio camino.
    for (const numero of LABORATORIOS) {
      for (const orden of guionDe(numero)) {
        if (orden.clase !== 'comparada') continue;
        expect(motivoDeclarado(orden.texto, ALIAS), `lab-${numero}: ${orden.texto}`).toBeNull();
      }
    }
  });
});

describe('lo que queda declarado, y por que', () => {
  it('ninguna orden de los guiones queda omitida: los marcadores se resuelven por lado', () => {
    // Hasta aqui los pasos donde el participante copia un identificador se
    // omitian, con el argumento de que eran de solo mirar. `git branch
    // peruana <identificador>` crea una rama, y sin ella el recorrido del
    // laboratorio 04 seguia mal en los dos lados por igual. Ahora cada uno
    // lleva su eleccion, y ninguna orden se salta.
    const omitidas: string[] = [];
    const usadas = new Set<string>();
    for (const numero of ['01', '02', '03', '04', '05', '06']) {
      const ordenes = resolverMarcadores(ordenesDe(enunciado(numero), ALIAS), numero, ALIAS);
      ordenes.forEach((orden, indice) => {
        if (orden.clase === 'omitida') omitidas.push(`${numero}: ${orden.texto}`);
        if (orden.eleccion === undefined) return;
        usadas.add(`${numero} ${orden.texto}`);
        // La orden de la que se copia tiene que haber corrido antes en el
        // mismo guion: si no, el recorrido no tiene de donde sacarlo.
        const antes = ordenes.slice(0, indice).map((previa) => previa.texto);
        expect(antes, `${numero}: ${orden.texto} copia de «${orden.eleccion.de}»`).toContain(orden.eleccion.de);
      });
    }
    expect(omitidas).toEqual([]);
    // Y ninguna eleccion escrita sobra: una que no se usa es una copia
    // esperando quedar vieja.
    expect([...usadas].sort()).toEqual(Object.keys(ELECCIONES).sort());
  });

  it('cada eleccion lee lo que el enunciado dice, en salidas con la forma de las dos', () => {
    const lista = 'f8fa947 (HEAD -> main) quinta\n9600dc5 cuarta\n88700ff tercera';
    expect(ELECCIONES['04 git branch peruana <identificador>']?.elegir(lista)).toBe('9600dc5');
    expect(ELECCIONES['04 git switch --detach <identificador>']?.elegir(lista)).toBe('88700ff');
    expect(ELECCIONES['03 git show <identificador-de-la-confirmacion-que-la-agrego>']?.elegir(lista)).toBe('88700ff');
    expect(
      ELECCIONES['04 git branch rescate <identificador>']?.elegir(
        'Warning: you are leaving 1 commit behind\n\n git branch <new-branch-name> 57027cd\n',
      ),
    ).toBe('57027cd');
    expect(
      ELECCIONES['06 git reset --hard <identificador>']?.elegir(
        'aaaaaaa HEAD@{0}: reset: moving to HEAD~1\nbbbbbbb HEAD@{1}: commit: se pierde',
      ),
    ).toBe('bbbbbbb');
    // Sin lo que buscan, no inventan: devuelven nada y el recorrido falla.
    expect(ELECCIONES['04 git branch rescate <identificador>']?.elegir('Switched to branch main')).toBeNull();
  });

  it('lo demas que se declara es por contenido, por la carpeta oculta o por el disco', () => {
    const familias = new Set<string>();
    for (const numero of ['01', '02', '03', '04', '05', '06']) {
      const texto = enunciado(numero);
      for (const orden of [...resolverMarcadores(ordenesDe(texto, ALIAS), numero, ALIAS), ...ordenesEnProsa(texto, ALIAS)]) {
        if (orden.clase !== 'declarada') continue;
        familias.add(orden.motivo);
      }
    }
    // Cada motivo distinto es una decision tomada y escrita en el contrato.
    for (const motivo of familias) expect(motivo.length).toBeGreaterThan(10);
    expect(familias.size).toBeLessThanOrEqual(10);
  });
});

/**
 * La configuracion del taller tiene una sola fuente (SPEC 011, punto 2 del
 * encargo posterior).
 *
 * El arnes de punta a punta escribia la identidad y los dos alias a mano, o sea
 * hacia por el participante lo que el participante tiene que hacer en el
 * laboratorio 01. Con esa copia puesta, el laboratorio 01 podia dejar de
 * configurar `git lg` y los cinco recorridos seguian en verde mientras el
 * participante se topaba con `git: 'lg' is not a git command`.
 */
describe('la configuracion del taller sale del enunciado del laboratorio 01', () => {
  it('el enunciado deja puesta una identidad, sin la cual Git no confirma', () => {
    const puesta = new Map(configuracionDelTaller(enunciado('01')));

    expect(puesta.get('user.name'), 'user.name').toBeTypeOf('string');
    expect(puesta.get('user.email'), 'user.email').toBeTypeOf('string');
  });

  it('los alias que declara el simulador son los que configura el enunciado', () => {
    // Si esta prueba falla, las dos fuentes se separaron: o el enunciado dejo
    // de configurar un alias que el simulador cree puesto, o al reves.
    expect(aliasDelTaller(enunciado('01'))).toEqual({ ...ALIAS_DEL_TALLER });
  });

  it('todo alias que algun enunciado usa lo configura el laboratorio 01', () => {
    const configurados = Object.keys(ALIAS);

    for (const numero of ['01', '02', '03', '04', '05', '06']) {
      for (const orden of ordenesDe(enunciado(numero), ALIAS)) {
        const piezas = orden.texto.split(/\s+/);
        if (piezas[0] !== 'git') continue;
        const sub = piezas[1] ?? '';
        // `git --version` no nombra una suborden, nombra una opcion de Git.
        if (sub.startsWith('-')) continue;
        // Un verbo que el motor no conoce y que tampoco esta configurado como
        // alias solo puede ser un alias que nadie dejo puesto.
        if (Object.hasOwn(ORDENES_GIT, sub) || configurados.includes(sub)) continue;
        expect.fail(
          `lab-${numero} usa «git ${sub}», que ni es una orden de Git ni un alias que el laboratorio 01 configure`,
        );
      }
    }
  });
});
