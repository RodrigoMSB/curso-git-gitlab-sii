/**
 * Cobertura de las ordenes de Git enumeradas en la seccion 7 del SPEC 001,
 * con las opciones que ese cuadro exige.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import type { EstadoRepositorio } from '../src/core/tipos';
import {
  archivoPorNombre,
  estadoVacio,
  etiquetaPorNombre,
  idActual,
  ramaActual,
  ramaPorNombre,
  sinSeguimientoAgrupado,
  valorConfig,
} from '../src/core/estado';
import { escenarioPorId } from '../src/escenarios';
import {
  correr,
  correrHasta,
  repoConRamaDesdeMain,
  repoConRamas,
  repoLineal,
  repoVacio,
  texto,
} from './ayudas';

/**
 * Agrega al escenario los archivos que sobran, sin seguimiento. Varias ordenes
 * necesitan algo que preparar que todavia no este seguido.
 */
const conEstorbos = (estado: EstadoRepositorio): EstadoRepositorio =>
  correr(
    estado,
    'echo "x" >> notas.tmp',
    'echo "x" >> respaldo.bak',
    'echo "x" >> credenciales.txt',
  );

describe('git init', () => {
  it('crea el repositorio y lo informa', () => {
    const resultado = ejecutar(estadoVacio(), 'git init');
    expect(resultado.estado.iniciado).toBe(true);
    expect(texto(resultado)).toContain('Initialized empty Git repository');
  });

  it('avisa cuando el repositorio ya existia', () => {
    const resultado = correrHasta(estadoVacio(), 'git init', 'git init');
    expect(texto(resultado)).toContain('Reinitialized existing Git repository');
  });

  it('las ordenes que necesitan repositorio reclaman si no lo hay', () => {
    const resultado = ejecutar(estadoVacio(), 'git status');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('not a git repository');
  });
});

describe('git config', () => {
  it('guarda user.name y user.email en el ambito local', () => {
    const estado = correr(
      estadoVacio(),
      'git init',
      'git config user.name "Rodrigo Silva"',
      'git config user.email rodrigo@sii.cl',
    );
    expect(valorConfig(estado, 'user.name')).toBe('Rodrigo Silva');
    expect(valorConfig(estado, 'user.email')).toBe('rodrigo@sii.cl');
  });

  it('guarda en el ambito global con --global y lo devuelve al consultarlo', () => {
    const estado = correr(estadoVacio(), 'git init', 'git config --global user.name "Global"');
    expect(estado.config.global['user.name']).toBe('Global');
    expect(texto(ejecutar(estado, 'git config user.name'))).toBe('Global');
  });

  it('la configuracion local tiene precedencia sobre la global', () => {
    const estado = correr(
      estadoVacio(),
      'git init',
      'git config --global user.name "Global"',
      'git config user.name "Local"',
    );
    expect(valorConfig(estado, 'user.name')).toBe('Local');
  });

  it('falla al consultar una clave que no existe y al invocarse sin argumentos', () => {
    const estado = correr(estadoVacio(), 'git init');
    expect(ejecutar(estado, 'git config user.name').error).toBe(true);
    expect(texto(ejecutar(estado, 'git config'))).toContain('usage: git config');
  });

  it('lista lo configurado con --list', () => {
    const estado = correr(estadoVacio(), 'git init', 'git config user.name "Rodrigo"');
    expect(texto(ejecutar(estado, 'git config --list'))).toContain('user.name=Rodrigo');
    expect(texto(ejecutar(estado, 'git config --global --list'))).toBe('');
  });

  it('el autor configurado queda registrado en la confirmacion', () => {
    const estado = correr(
      repoVacio(),
      'git config user.name "Rodrigo Silva"',
      'git config user.email rodrigo@sii.cl',
      'git add README.md',
      'git commit -m "Primera confirmacion"',
    );
    expect(estado.confirmaciones[0]?.autor).toBe('Rodrigo Silva');
    expect(estado.confirmaciones[0]?.correo).toBe('rodrigo@sii.cl');
  });
});

describe('alias', () => {
  /** Los dos alias que el laboratorio 01 hace configurar, tal cual los escribe. */
  function conAlias(estado: EstadoRepositorio): EstadoRepositorio {
    return correr(
      estado,
      'git config --global alias.s "status -s"',
      'git config --global alias.lg "log --oneline --graph --all --decorate"',
    );
  }

  it('git lg hace lo mismo que la orden larga que abrevia', () => {
    const estado = conAlias(repoLineal());
    const porElAlias = texto(ejecutar(estado, 'git lg'));
    const porLaOrdenLarga = texto(ejecutar(estado, 'git log --oneline --graph --all --decorate'));
    expect(porElAlias).toBe(porLaOrdenLarga);
    expect(porElAlias).toContain('*');
  });

  it('git s hace lo mismo que git status -s', () => {
    const estado = conAlias(repoLineal());
    expect(texto(ejecutar(estado, 'git s'))).toBe(texto(ejecutar(estado, 'git status -s')));
  });

  it('sin el alias configurado, reclama como Git y no inventa nada', () => {
    // Es el laboratorio 01 antes de su punto 1.3: el alias todavia no existe.
    const resultado = ejecutar(escenarioPorId('lab-01'), 'git lg');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain("git: 'lg' is not a git command");
  });

  it('el alias recibe los argumentos que se le agregan detras', () => {
    const estado = correr(repoLineal(), 'git config --global alias.h "log --oneline"');
    const resultado = ejecutar(estado, 'git h -1');
    expect(resultado.error).toBe(false);
    expect(texto(resultado)).toBe(texto(ejecutar(estado, 'git log --oneline -1')));
  });

  it('la configuracion local manda sobre la global, como en Git', () => {
    const estado = correr(
      conAlias(repoLineal()),
      'git config alias.lg "log --oneline"',
    );
    const resultado = ejecutar(estado, 'git lg');
    expect(resultado.error).toBe(false);
    expect(texto(resultado)).toBe(texto(ejecutar(estado, 'git log --oneline')));
  });

  it('un alias no puede tapar una orden de Git', () => {
    // Git resuelve primero sus propias ordenes. Si el alias ganara, escribir
    // `git status` en el simulador haria otra cosa que en la terminal.
    const estado = correr(repoLineal(), 'git config --global alias.status "log --oneline"');
    expect(texto(ejecutar(estado, 'git status'))).toContain('On branch main');
  });

  it('un alias que apunta a otro se sigue hasta el final', () => {
    const estado = correr(
      repoLineal(),
      'git config --global alias.uno "log --oneline"',
      'git config --global alias.dos "uno"',
    );
    expect(texto(ejecutar(estado, 'git dos'))).toBe(texto(ejecutar(estado, 'git log --oneline')));
  });

  it('un alias circular se corta y lo dice, en vez de colgarse', () => {
    const estado = correr(
      repoLineal(),
      'git config --global alias.ida "vuelta"',
      'git config --global alias.vuelta "ida"',
    );
    const resultado = ejecutar(estado, 'git ida');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('alias loop detected');
  });

  it('un alias de interprete, el que empieza con signo de admiracion, no se expande', () => {
    // Git se los pasa al interprete de mandatos. El simulador no tiene uno, y
    // fingir que lo ejecuta seria peor que decir que no conoce la orden.
    const estado = correr(repoLineal(), 'git config --global alias.ya "!echo hola"');
    expect(ejecutar(estado, 'git ya').error).toBe(true);
  });

  it('los escenarios del 02 en adelante ya traen los alias puestos', () => {
    // El participante los configura en el laboratorio 01 y son globales, asi
    // que del 02 en adelante los tiene. Si el escenario no los trajera, la
    // primera orden de varios enunciados fallaria en el simulador y no en la
    // terminal.
    for (const id of ['lab-02', 'lab-03', 'lab-04', 'lab-05', 'lab-06', 'lab-07', 'lab-09']) {
      expect(ejecutar(escenarioPorId(id), 'git lg').error, id).toBe(false);
    }
  });
});

/**
 * Al cambiar de posicion, Git reemplaza el directorio de trabajo por el arbol
 * del destino. El simulador arrastraba la lista de archivos entera, de modo que
 * en la rama abierta tres confirmaciones atras seguian figurando archivos que
 * ahi todavia no existian. Lo destaparon las capturas del SPEC 011.
 */
describe('el directorio de trabajo sigue al arbol', () => {
  it('al abrir una rama atras desaparece lo que ahi no existia', () => {
    const antes = escenarioPorId('lab-04');
    expect(antes.archivos.map((archivo) => archivo.nombre)).toContain(
      'recetas/pastel-de-choclo.md',
    );

    const despues = correr(antes, 'git switch -c mexicana HEAD~3');

    expect(despues.archivos.map((archivo) => archivo.nombre)).not.toContain(
      'recetas/pastel-de-choclo.md',
    );
    expect(texto(ejecutar(despues, 'ls'))).not.toContain('recetas/');
  });

  it('al volver reaparece', () => {
    const estado = correr(
      escenarioPorId('lab-04'),
      'git switch -c mexicana HEAD~3',
      'git switch main',
    );
    expect(estado.archivos.map((archivo) => archivo.nombre)).toContain(
      'recetas/pastel-de-choclo.md',
    );
  });

  it('reset --hard se lleva lo que la confirmacion deshecha habia estrenado', () => {
    const estado = correr(
      repoLineal(),
      'echo "x" > nuevo.md',
      'git add nuevo.md',
      'git commit -m "se agrega algo"',
      'git reset --hard HEAD~1',
    );

    expect(archivoPorNombre(estado, 'nuevo.md')).toBeUndefined();
    expect(texto(ejecutar(estado, 'ls'))).not.toContain('nuevo.md');
  });

  it('el trabajo pendiente viaja con el participante', () => {
    const estado = correr(
      escenarioPorId('lab-04'),
      'echo "x" > pendiente.md',
      'git switch -c mexicana HEAD~3',
    );
    expect(archivoPorNombre(estado, 'pendiente.md')?.estado).toBe('sin-seguimiento');
  });
});

describe('git status', () => {
  it('en la forma larga distingue preparados, modificados y sin seguimiento', () => {
    const estado = correr(conEstorbos(repoConRamaDesdeMain()), 'git add notas.tmp', 'echo "x" >> platos.md');
    const salida = texto(ejecutar(estado, 'git status'));

    expect(salida).toContain('On branch main');
    expect(salida).toContain('Changes to be committed:');
    expect(salida).toContain('new file:');
    expect(salida).toContain('Changes not staged for commit:');
    expect(salida).toContain('modified:');
    expect(salida).toContain('Untracked files:');
  });

  /**
   * Git no abre una carpeta cuyo contenido esta entero sin seguir: muestra la
   * carpeta. El simulador listaba cada archivo, que es otra cosa de la que el
   * participante va a ver en su terminal. Lo destaparon las capturas del
   * SPEC 011, sobre el laboratorio 04.
   */
  it('agrupa por carpeta lo que esta entero sin seguimiento, como Git', () => {
    // `borradores/` no existe en el escenario, asi que queda entera sin seguir.
    const estado = correr(
      repoLineal(),
      'mkdir -p borradores',
      'echo "x" > borradores/tacos.md',
    );

    expect(texto(ejecutar(estado, 'git status'))).toContain('\tborradores/');
    expect(texto(ejecutar(estado, 'git status'))).not.toContain('borradores/tacos.md');
    expect(texto(ejecutar(estado, 'git status -s'))).toContain('?? borradores/');
    expect(sinSeguimientoAgrupado(estado)).toEqual(['borradores/']);
  });

  it('no agrupa la carpeta que ya tiene algo versionado adentro', () => {
    // `recetas/` ya trae recetas versionadas: ahi Git nombra el archivo nuevo.
    const estado = correr(repoLineal(), 'echo "x" > recetas/tacos.md');

    expect(sinSeguimientoAgrupado(estado)).toEqual(['recetas/tacos.md']);
    expect(texto(ejecutar(estado, 'git status -s'))).toContain('?? recetas/tacos.md');
  });

  it('anuncia que no hay confirmaciones en un repositorio recien creado', () => {
    const salida = texto(ejecutar(repoVacio(), 'git status'));
    expect(salida).toContain('No commits yet');
    expect(salida).toContain('nothing added to commit but untracked files present');
  });

  it('informa el arbol limpio cuando no hay nada pendiente', () => {
    const estado = correr(
      repoLineal(),
      'git restore ingredientes.md',
      'git restore --staged cocineros.md',
      'git restore cocineros.md',
    );
    expect(texto(ejecutar(estado, 'git status'))).toContain('nothing to commit, working tree clean');
  });

  it('informa cuando hay cambios sin preparar y nada preparado', () => {
    const limpio = correr(repoLineal(), 'git restore --staged cocineros.md');
    const salida = texto(ejecutar(limpio, 'git status'));
    expect(salida).toContain('no changes added to commit');
  });

  it('con -s usa los codigos de dos columnas', () => {
    const estado = correr(conEstorbos(repoConRamaDesdeMain()), 'git add notas.tmp');
    const salida = texto(ejecutar(estado, 'git status -s'));

    expect(salida).toContain('A  notas.tmp');
    expect(salida).toContain('?? respaldo.bak');
  });

  it('marca con UU los archivos en conflicto', () => {
    const estado = correr(repoConRamas(), 'git merge andina');
    expect(texto(ejecutar(estado, 'git status -s'))).toContain('UU platos.md');
    expect(texto(ejecutar(estado, 'git status'))).toContain('Unmerged paths:');
  });

  it('describe la posicion desconectada', () => {
    const estado = correr(repoLineal(), 'git checkout HEAD~1');
    expect(texto(ejecutar(estado, 'git status'))).toContain('HEAD detached at');
  });
});

describe('git add y git restore', () => {
  it('prepara un archivo puntual', () => {
    const estado = correr(repoLineal(), 'git add ingredientes.md');
    expect(archivoPorNombre(estado, 'ingredientes.md')?.estado).toBe('preparado');
  });

  it('prepara todo con . y con -A', () => {
    const conPunto = correr(conEstorbos(repoConRamaDesdeMain()), 'git add .');
    const conTodo = correr(conEstorbos(repoConRamaDesdeMain()), 'git add -A');
    for (const estado of [conPunto, conTodo]) {
      expect(archivoPorNombre(estado, 'notas.tmp')?.estado).toBe('preparado');
      expect(archivoPorNombre(estado, 'credenciales.txt')?.estado).toBe('preparado');
    }
  });

  it('prepara el contenido de una carpeta', () => {
    const estado = correr(repoVacio(), 'git add recetas');
    expect(archivoPorNombre(estado, 'recetas/empanadas.md')?.estado).toBe('preparado');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('sin-seguimiento');
  });

  it('reclama ante una ruta que no existe y ante la invocacion sin argumentos', () => {
    const estado = repoConRamaDesdeMain();
    expect(texto(ejecutar(estado, 'git add inexistente.md'))).toContain('did not match any files');
    expect(texto(ejecutar(estado, 'git add'))).toContain('Nothing specified, nothing added.');
  });

  it('git restore --staged devuelve el archivo al estado anterior segun estuviera seguido', () => {
    const seguido = correr(repoLineal(), 'git add ingredientes.md', 'git restore --staged ingredientes.md');
    expect(archivoPorNombre(seguido, 'ingredientes.md')?.estado).toBe('modificado');

    const nuevo = correr(conEstorbos(repoConRamaDesdeMain()), 'git add notas.tmp', 'git restore --staged notas.tmp');
    expect(archivoPorNombre(nuevo, 'notas.tmp')?.estado).toBe('sin-seguimiento');
  });

  it('git restore descarta los cambios del directorio de trabajo', () => {
    const estado = correr(repoLineal(), 'git restore ingredientes.md');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('limpio');
  });

  it('git restore reclama sin rutas o con una ruta desconocida', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git restore'))).toContain('you must specify path');
    expect(texto(ejecutar(estado, 'git restore fantasma.md'))).toContain('did not match');
  });
});

describe('git commit', () => {
  it('crea la primera confirmacion sin padres', () => {
    const resultado = correrHasta(
      repoVacio(),
      'git add README.md',
      'git commit -m "Agrega el README"',
    );
    const confirmacion = resultado.estado.confirmaciones[0];

    expect(resultado.estado.confirmaciones).toHaveLength(1);
    expect(confirmacion?.padres).toEqual([]);
    expect(confirmacion?.id).toHaveLength(7);
    expect(confirmacion?.id).toMatch(/^[0-9a-f]{7}$/);
    expect(texto(resultado)).toContain('(root-commit)');
    expect(ramaPorNombre(resultado.estado, 'main')?.id).toBe(confirmacion?.id);
    expect(archivoPorNombre(resultado.estado, 'README.md')?.estado).toBe('limpio');
  });

  it('no confirma si no hay nada preparado', () => {
    // El escenario trae algo preparado: hay que sacarlo para que no quede nada.
    const sinPreparar = correr(repoLineal(), 'git restore --staged cocineros.md');
    const resultado = ejecutar(sinPreparar, 'git commit -m "Sin nada"');
    expect(resultado.estado.confirmaciones).toHaveLength(5);
    expect(texto(resultado)).toContain('no changes added to commit');
  });

  it('reclama si falta el mensaje', () => {
    const estado = correr(repoLineal(), 'git add platos.md');
    expect(texto(ejecutar(estado, 'git commit'))).toContain('empty commit message');
  });

  it('--amend reemplaza la ultima confirmacion por una nueva y deja huerfana la anterior', () => {
    const partida = repoLineal();
    const anterior = idActual(partida) ?? '';
    const despues = ejecutar(partida, 'git commit --amend -m "Agrega la lista de cocineros"').estado;
    const nueva = idActual(despues) ?? '';

    expect(nueva).not.toBe(anterior);
    expect(despues.confirmaciones).toHaveLength(partida.confirmaciones.length + 1);
    expect(despues.confirmaciones.find((c) => c.id === anterior)).toBeDefined();
    expect(despues.confirmaciones.find((c) => c.id === nueva)?.mensaje).toBe(
      'Agrega la lista de cocineros',
    );
  });

  it('--amend incorpora lo que estuviera preparado y conserva el mensaje si no se da otro', () => {
    const partida = correr(repoLineal(), 'git add ingredientes.md');
    const despues = ejecutar(partida, 'git commit --amend').estado;
    const nueva = despues.confirmaciones.at(-1);

    expect(nueva?.mensaje).toBe('se docuemnta la reseta del pastel de choclo');
    expect(nueva?.archivos).toContain('ingredientes.md');
    expect(nueva?.archivos).toContain('recetas/pastel-de-choclo.md');
  });

  it('--amend reclama cuando no hay nada que enmendar', () => {
    expect(texto(ejecutar(repoVacio(), 'git commit --amend'))).toContain(
      'nothing to amend',
    );
  });

  it('confirma sobre una posicion desconectada sin mover ninguna rama', () => {
    const partida = correr(repoLineal(), 'git checkout HEAD~1');
    const puntaMain = ramaPorNombre(partida, 'main')?.id;
    const resultado = correrHasta(
      partida,
      'echo "x" >> ingredientes.md',
      'git add ingredientes.md',
      'git commit -m "Confirmacion suelta"',
    );

    expect(texto(resultado)).toContain('detached HEAD');
    expect(ramaPorNombre(resultado.estado, 'main')?.id).toBe(puntaMain);
    expect(resultado.estado.puntero.tipo).toBe('confirmacion');
  });
});

describe('git log', () => {
  it('muestra la historia completa en forma larga', () => {
    const salida = texto(ejecutar(repoLineal(), 'git log'));
    expect(salida).toContain('commit ');
    // La historia del laboratorio 02 la firman tres personas distintas.
    expect(salida).toContain('Author: Juana Perez <juana.perez@recetario.cl>');
    expect(salida).toContain('se inicia el recetario');
  });

  it('--oneline resume cada confirmacion en una linea y decora la posicion', () => {
    const salida = texto(ejecutar(repoLineal(), 'git log --oneline'));
    expect(salida.split('\n')).toHaveLength(5);
    expect(salida).toContain('(HEAD -> main)');
  });

  it('-n y -3 limitan la cantidad', () => {
    expect(texto(ejecutar(repoLineal(), 'git log --oneline -n 2')).split('\n')).toHaveLength(2);
    expect(texto(ejecutar(repoLineal(), 'git log --oneline -3')).split('\n')).toHaveLength(3);
  });

  it('--all incluye las ramas que no estan en la posicion actual', () => {
    const soloMain = texto(ejecutar(repoConRamaDesdeMain(), 'git log --oneline'));
    const todas = texto(ejecutar(repoConRamaDesdeMain(), 'git log --oneline --all'));

    expect(soloMain).not.toContain('arreglos');
    expect(todas).toContain('arreglos');
  });

  it('--graph marca las confirmaciones y abre la union', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git merge tailandesa');
    const salida = texto(ejecutar(estado, 'git log --oneline --graph'));

    expect(salida).toContain('* ');
    expect(salida).toContain('|\\');
  });

  it('la forma larga de una union muestra la linea Merge', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git merge tailandesa');
    expect(texto(ejecutar(estado, 'git log'))).toContain('Merge: ');
  });

  it('acepta una referencia explicita y reclama si no existe', () => {
    const estado = repoConRamaDesdeMain();
    expect(texto(ejecutar(estado, 'git log --oneline tailandesa'))).toContain('arreglos');
    expect(ejecutar(estado, 'git log fantasma').error).toBe(true);
  });

  it('reclama cuando la rama todavia no tiene confirmaciones', () => {
    expect(texto(ejecutar(repoVacio(), 'git log'))).toContain('does not have any commits yet');
  });

  it('muestra las etiquetas entre las decoraciones', () => {
    const estado = correr(repoLineal(), 'git tag v1.0');
    expect(texto(ejecutar(estado, 'git log --oneline'))).toContain('tag: v1.0');
  });
});

describe('git log · filtros y formato', () => {
  // Las cifras estan comprobadas contra el Git de verdad sobre el mismo
  // escenario: cinco confirmaciones, tres autores, de enero a septiembre.

  it('--author filtra por coincidencia parcial del nombre', () => {
    const estado = repoLineal();
    const filtrado = texto(ejecutar(estado, 'git log --author="Juana" --oneline')).split('\n');
    expect(filtrado).toHaveLength(2);
    for (const fila of filtrado) expect(fila).not.toContain('cocineros');
    // Sin el filtro son cinco: es la diferencia que antes no se veia.
    expect(texto(ejecutar(estado, 'git log --oneline')).split('\n')).toHaveLength(5);
  });

  it('--author acepta cualquier autor, no solo el que trae el enunciado', () => {
    // El contrato es por forma (punto 2.2). Un participante que tantea con
    // otro nombre tiene que obtener lo que Git le daria.
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git log --author=Sofia --oneline')).split('\n')).toHaveLength(1);
    expect(texto(ejecutar(estado, 'git log --author=Nadie --oneline'))).toBe('');
  });

  it('--author se escribe con igual o con espacio, como en Git', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git log --author=Juana --oneline'))).toBe(
      texto(ejecutar(estado, 'git log --author Juana --oneline')),
    );
  });

  it('--since y --until recortan por fecha', () => {
    const estado = repoLineal();
    expect(
      texto(ejecutar(estado, 'git log --oneline --since=2024-04-01')).split('\n'),
    ).toHaveLength(3);
    expect(
      texto(ejecutar(estado, 'git log --oneline --until=2024-03-01')).split('\n'),
    ).toHaveLength(2);
    expect(
      texto(ejecutar(estado, 'git log --oneline --since=2024-04-01 --until=2024-08-01')).split('\n'),
    ).toHaveLength(2);
  });

  it('una fecha que no se entiende se dice, en vez de filtrar por cualquier cosa', () => {
    const resultado = ejecutar(repoLineal(), 'git log --since=zapallo');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('zapallo');
  });

  it('el separador -- limita el historial a un archivo o a una carpeta', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git log --oneline -- platos.md')).split('\n')).toHaveLength(1);
    expect(texto(ejecutar(estado, 'git log --oneline -- recetas'))).toContain('pastel de choclo');
    expect(texto(ejecutar(estado, 'git log --oneline -- fantasma.md'))).toBe('');
  });

  it('el rango a..b muestra lo que hay en b y no en a', () => {
    const estado = repoLineal();
    const tercera = estado.confirmaciones[2]?.id ?? '';
    const filas = texto(ejecutar(estado, `git log --oneline ${tercera}..main`)).split('\n');
    expect(filas).toHaveLength(2);
    expect(texto(ejecutar(estado, 'git log --oneline main..main'))).toBe('');
  });

  it('--format escribe solo lo que se le pide', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git log --format="%an')).split('\n')).toHaveLength(5);
    const conFecha = texto(ejecutar(estado, 'git log --format="%h %an %ad %s" --date=short'));
    expect(conFecha.split('\n')[0]).toMatch(/^[0-9a-f]{7} Marco Diaz 2024-09-30 se docuemnta/);
  });

  it('un especificador que no esta en el contrato se declara, no se copia tal cual', () => {
    // Es el caso que el punto 1 del SPEC 010 viene a eliminar: antes el motor
    // devolvia la plantilla escrita con los %algo sin reemplazar.
    const resultado = ejecutar(repoLineal(), 'git log --format="%cd"');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('«%cd»');
    expect(resultado.salida.every((linea) => linea.tipo === 'limite')).toBe(true);
  });

  it('los filtros se combinan entre si y con el limite', () => {
    const estado = repoLineal();
    expect(
      texto(ejecutar(estado, 'git log --oneline --author=Juana --since=2024-03-01')).split('\n'),
    ).toHaveLength(1);
    expect(texto(ejecutar(estado, 'git log --format="%an" -2')).split('\n')).toHaveLength(2);
  });
});

describe('git diff', () => {
  it('sin opciones describe los archivos modificados', () => {
    const salida = texto(ejecutar(repoLineal(), 'git diff'));
    expect(salida).toContain('diff --git a/ingredientes.md b/ingredientes.md');
  });

  it('--staged describe los archivos preparados', () => {
    const estado = correr(repoLineal(), 'git add ingredientes.md');
    expect(texto(ejecutar(estado, 'git diff'))).toBe('');
    expect(texto(ejecutar(estado, 'git diff --staged'))).toContain('diff --git a/ingredientes.md');
  });
});

describe('git branch', () => {
  it('lista las ramas y marca la actual', () => {
    const salida = texto(ejecutar(repoConRamaDesdeMain(), 'git branch'));
    expect(salida).toContain('* main');
    expect(salida).toContain('  tailandesa');
  });

  it('crea una rama sobre una referencia dada', () => {
    const estado = correr(repoLineal(), 'git branch andina HEAD~2');
    expect(ramaPorNombre(estado, 'andina')?.id).toBe(estado.confirmaciones[2]?.id);
  });

  it('reclama si la rama ya existe o si el repositorio no tiene confirmaciones', () => {
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch tailandesa'))).toContain(
      'already exists',
    );
    expect(texto(ejecutar(repoVacio(), 'git branch tailandesa'))).toContain(
      'not a valid object name',
    );
    expect(texto(ejecutar(repoLineal(), 'git branch nueva fantasma'))).toContain(
      'not a valid object name',
    );
  });

  it('-d borra una rama ya integrada y se niega con una que no lo esta', () => {
    const conIntegrada = correr(repoConRamaDesdeMain(), 'git branch chilena');
    expect(texto(ejecutar(conIntegrada, 'git branch -d chilena'))).toContain('Deleted branch');

    const resultado = ejecutar(repoConRamaDesdeMain(), 'git branch -d tailandesa');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('not fully merged');
  });

  it('-D borra a la fuerza, pero nunca la rama actual', () => {
    const estado = ejecutar(repoConRamaDesdeMain(), 'git branch -D tailandesa').estado;
    expect(ramaPorNombre(estado, 'tailandesa')).toBeUndefined();
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch -D main'))).toContain('Cannot delete');
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch -d fantasma'))).toContain('not found');
  });

  it('-m renombra la rama actual y una rama nombrada', () => {
    const actual = ejecutar(repoConRamaDesdeMain(), 'git branch -m principal').estado;
    expect(ramaActual(actual)).toBe('principal');

    const otra = ejecutar(repoConRamaDesdeMain(), 'git branch -m tailandesa thai').estado;
    expect(ramaPorNombre(otra, 'thai')).toBeDefined();
    expect(ramaActual(otra)).toBe('main');
  });

  it('-m reclama ante nombres inexistentes o repetidos', () => {
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch -m fantasma otra'))).toContain(
      'not found',
    );
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch -m tailandesa main'))).toContain(
      'already exists',
    );
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git branch -d'))).toContain('branch name required');
  });
});

describe('git switch y git checkout', () => {
  it('git switch cambia de rama', () => {
    const resultado = ejecutar(repoConRamaDesdeMain(), 'git switch tailandesa');
    expect(texto(resultado)).toBe("Switched to branch 'tailandesa'");
    expect(ramaActual(resultado.estado)).toBe('tailandesa');
  });

  it('git switch -c crea y cambia en un paso', () => {
    const resultado = ejecutar(repoConRamaDesdeMain(), 'git switch -c chilena');
    expect(texto(resultado)).toBe("Switched to a new branch 'chilena'");
    expect(ramaActual(resultado.estado)).toBe('chilena');
  });

  it('git switch reclama ante una rama inexistente, un identificador o sin argumentos', () => {
    const estado = repoConRamaDesdeMain();
    expect(texto(ejecutar(estado, 'git switch fantasma'))).toContain('invalid reference');
    // Git distingue los dos casos: la referencia que no existe y la que si
    // existe pero no es una rama. Con esta ultima ofrece --detach.
    const aUnIdentificador = ejecutar(estado, `git switch ${estado.confirmaciones[0]?.id ?? ''}`);
    expect(texto(aUnIdentificador)).toContain('a branch is expected, got commit');
    expect(texto(aUnIdentificador)).toContain('--detach');
    expect(texto(ejecutar(estado, 'git switch'))).toContain('missing branch');
    expect(texto(ejecutar(estado, 'git switch -c tailandesa'))).toContain('already exists');
  });

  it('git checkout cambia de rama y -b crea', () => {
    expect(ramaActual(ejecutar(repoConRamaDesdeMain(), 'git checkout tailandesa').estado)).toBe(
      'tailandesa',
    );
    expect(ramaActual(ejecutar(repoConRamaDesdeMain(), 'git checkout -b chilena').estado)).toBe(
      'chilena',
    );
  });

  it('git checkout sobre un identificador deja la posicion desconectada', () => {
    const partida = repoLineal();
    const objetivo = partida.confirmaciones[1]?.id ?? '';
    const resultado = ejecutar(partida, `git checkout ${objetivo}`);

    expect(texto(resultado)).toContain("detached HEAD");
    expect(resultado.estado.puntero).toEqual({ tipo: 'confirmacion', id: objetivo });
  });

  it('git checkout -- descarta los cambios de un archivo', () => {
    const estado = ejecutar(repoLineal(), 'git checkout -- platos.md').estado;
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('limpio');
  });

  it('git checkout reclama ante rutas y referencias que no existen', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git checkout -- fantasma.md'))).toContain('did not match');
    expect(texto(ejecutar(estado, 'git checkout --'))).toContain('you must specify path');
    expect(texto(ejecutar(estado, 'git checkout fantasma'))).toContain('did not match');
    expect(texto(ejecutar(estado, 'git checkout'))).toContain('must specify a branch name');
  });
});

describe('git merge', () => {
  it('la fusion limpia registra los archivos que trae la otra rama', () => {
    const resultado = ejecutar(repoConRamaDesdeMain(), 'git merge tailandesa');
    const union = resultado.estado.confirmaciones.at(-1);

    expect(texto(resultado)).toContain("Merge made by the 'ort' strategy.");
    expect(union?.mensaje).toBe("Merge branch 'tailandesa'");
    expect(union?.archivos).toContain('recetas/pad-thai.md');
  });

  it('la fusion con conflicto deja la fusion en curso y el archivo en conflicto', () => {
    const resultado = ejecutar(repoConRamas(), 'git merge andina');

    expect(texto(resultado)).toContain('CONFLICT (content): Merge conflict in platos.md');
    expect(resultado.estado.fusion?.conflictos).toEqual(['platos.md']);
    expect(archivoPorNombre(resultado.estado, 'platos.md')?.estado).toBe('en-conflicto');
    expect(archivoPorNombre(resultado.estado, 'recetas/lomo-saltado.md')?.estado).toBe('preparado');
    expect(resultado.estado.confirmaciones).toHaveLength(7);
  });

  it('no deja confirmar mientras queden archivos en conflicto', () => {
    const estado = correr(repoConRamas(), 'git merge andina');
    const resultado = ejecutar(estado, 'git commit -m "A medias"');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('unmerged files');
  });

  it('resolver y confirmar cierra la fusion con una union de dos padres', () => {
    const estado = correr(
      repoConRamas(),
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );
    const union = estado.confirmaciones.at(-1);

    expect(estado.fusion).toBeNull();
    expect(union?.padres).toHaveLength(2);
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('limpio');
  });

  it('--abort devuelve los archivos al estado previo', () => {
    const partida = repoConRamaDesdeMain();
    const despues = correr(partida, 'git merge tailandesa', 'git merge --abort');

    expect(despues.fusion).toBeNull();
    expect(despues.archivos).toEqual(partida.archivos);
  });

  it('--abort reclama si no hay fusion en curso', () => {
    expect(texto(ejecutar(repoConRamaDesdeMain(), 'git merge --abort'))).toContain(
      'no merge to abort',
    );
  });

  it('rechaza una fusion nueva mientras haya otra sin resolver', () => {
    const estado = correr(repoConRamas(), 'git merge andina');
    expect(ejecutar(estado, 'git merge main').error).toBe(true);
  });

  it('reclama sin argumento o ante una referencia desconocida', () => {
    const estado = repoConRamaDesdeMain();
    expect(texto(ejecutar(estado, 'git merge'))).toContain('No commit specified');
    expect(texto(ejecutar(estado, 'git merge fantasma'))).toContain('not something we can merge');
    // En un repositorio sin confirmaciones, main todavia no existe como rama.
    expect(texto(ejecutar(repoVacio(), 'git merge main'))).toContain(
      'not something we can merge',
    );
  });
});

describe('git tag', () => {
  it('crea una etiqueta simple sobre la posicion actual y la lista', () => {
    const estado = correr(repoLineal(), 'git tag v1.0');
    expect(etiquetaPorNombre(estado, 'v1.0')?.tipo).toBe('simple');
    expect(etiquetaPorNombre(estado, 'v1.0')?.id).toBe(idActual(estado));
    expect(texto(ejecutar(estado, 'git tag'))).toBe('v1.0');
  });

  it('-a con -m crea una etiqueta anotada', () => {
    const estado = correr(repoLineal(), 'git tag -a v2.0 -m "Segunda entrega"');
    const etiqueta = etiquetaPorNombre(estado, 'v2.0');

    expect(etiqueta?.tipo).toBe('anotada');
    expect(etiqueta?.mensaje).toBe('Segunda entrega');
  });

  it('crea una etiqueta sobre una referencia anterior', () => {
    const estado = correr(repoLineal(), 'git tag v0.1 HEAD~3');
    expect(etiquetaPorNombre(estado, 'v0.1')?.id).toBe(estado.confirmaciones[1]?.id);
  });

  it('-d borra la etiqueta', () => {
    const estado = correr(repoLineal(), 'git tag v1.0');
    const resultado = ejecutar(estado, 'git tag -d v1.0');

    expect(texto(resultado)).toContain("Deleted tag 'v1.0'");
    expect(etiquetaPorNombre(resultado.estado, 'v1.0')).toBeUndefined();
  });

  it('reclama ante duplicados, borrados imposibles, anotadas sin mensaje y referencias malas', () => {
    const estado = correr(repoLineal(), 'git tag v1.0');
    expect(texto(ejecutar(estado, 'git tag v1.0'))).toContain('already exists');
    expect(texto(ejecutar(estado, 'git tag -d fantasma'))).toContain('not found');
    expect(texto(ejecutar(estado, 'git tag -a v3.0'))).toContain('no tag message');
    expect(texto(ejecutar(estado, 'git tag v9.9 fantasma'))).toContain('Failed to resolve');
  });
});

describe('git reset', () => {
  it('--soft mueve el puntero y deja preparados los archivos descartados', () => {
    const partida = repoLineal();
    const despues = ejecutar(partida, 'git reset --soft HEAD~1').estado;

    expect(idActual(despues)).toBe(partida.confirmaciones[3]?.id);
    expect(archivoPorNombre(despues, 'recetas/pastel-de-choclo.md')?.estado).toBe('preparado');
  });

  it('--mixed deja los archivos modificados y lo informa', () => {
    const resultado = ejecutar(repoLineal(), 'git reset HEAD~1');

    expect(archivoPorNombre(resultado.estado, 'cocineros.md')?.estado).toBe('modificado');
    expect(texto(resultado)).toContain('Unstaged changes after reset:');
  });

  it('--hard deja el directorio de trabajo limpio', () => {
    const resultado = ejecutar(repoLineal(), 'git reset --hard HEAD~1');

    expect(archivoPorNombre(resultado.estado, 'cocineros.md')?.estado).toBe('limpio');
    expect(archivoPorNombre(resultado.estado, 'platos.md')?.estado).toBe('limpio');
    expect(texto(resultado)).toContain('HEAD is now at');
  });

  it('sin argumentos deja de preparar lo que estuviera preparado', () => {
    const estado = correr(repoLineal(), 'git add ingredientes.md', 'git reset');
    expect(archivoPorNombre(estado, 'ingredientes.md')?.estado).toBe('modificado');
  });

  it('acepta el nombre de un archivo para dejar de prepararlo', () => {
    const estado = correr(repoLineal(), 'git add ingredientes.md', 'git reset ingredientes.md');
    expect(archivoPorNombre(estado, 'ingredientes.md')?.estado).toBe('modificado');
  });

  it('reclama ante una referencia que no existe', () => {
    expect(texto(ejecutar(repoLineal(), 'git reset fantasma'))).toContain(
      'unknown revision or path',
    );
  });
});

describe('git revert', () => {
  it('reclama sin argumentos o ante una referencia mala', () => {
    const estado = repoLineal();
    expect(texto(ejecutar(estado, 'git revert'))).toContain('empty commit set');
    expect(texto(ejecutar(estado, 'git revert fantasma'))).toContain('bad revision');
  });

  it('registra los mismos archivos que la confirmacion revertida', () => {
    const resultado = ejecutar(repoLineal(), 'git revert HEAD');
    expect(resultado.estado.confirmaciones.at(-1)?.archivos).toEqual(['recetas/pastel-de-choclo.md']);
    expect(texto(resultado)).toContain('1 file changed');
  });
});

describe('git stash', () => {
  it('guarda los cambios y deja limpio el directorio de trabajo', () => {
    const resultado = ejecutar(repoLineal(), 'git stash push -m "a medio hacer"');

    expect(texto(resultado)).toContain('Saved working directory');
    expect(archivoPorNombre(resultado.estado, 'platos.md')?.estado).toBe('limpio');
    expect(resultado.estado.guardados).toHaveLength(1);
  });

  it('sin mensaje describe la entrada con WIP', () => {
    const estado = correr(repoLineal(), 'git stash');
    expect(estado.guardados[0]?.mensaje).toContain('WIP on main:');
  });

  it('save acepta el mensaje como argumento suelto', () => {
    const estado = correr(repoLineal(), 'git stash save "pendiente"');
    expect(estado.guardados[0]?.mensaje).toBe('On main: pendiente');
  });

  it('avisa cuando no hay nada que guardar', () => {
    const estado = correr(
      repoLineal(),
      'git restore ingredientes.md',
      'git restore --staged cocineros.md',
      'git restore cocineros.md',
    );
    expect(texto(ejecutar(estado, 'git stash'))).toBe('No local changes to save');
  });

  it('list y list --stat describen la pila', () => {
    const estado = correr(repoLineal(), 'git stash push -m "uno"');
    expect(texto(ejecutar(estado, 'git stash list'))).toBe('stash@{0}: On main: uno');
    expect(texto(ejecutar(estado, 'git stash list --stat'))).toContain('ingredientes.md | 1 +');
  });

  it('show describe los archivos de una entrada', () => {
    const estado = correr(repoLineal(), 'git stash push -m "uno"');
    expect(texto(ejecutar(estado, 'git stash show'))).toContain('2 files changed');
  });

  it('apply devuelve los archivos como modificados y conserva la entrada', () => {
    const partida = correr(repoLineal(), 'git add ingredientes.md', 'git stash push -m "uno"');
    const despues = ejecutar(partida, 'git stash apply').estado;

    expect(archivoPorNombre(despues, 'ingredientes.md')?.estado).toBe('modificado');
    expect(despues.guardados).toHaveLength(1);
  });

  it('apply --index restituye tambien lo que estaba preparado', () => {
    const partida = correr(repoLineal(), 'git add ingredientes.md', 'git stash push -m "uno"');
    const despues = ejecutar(partida, 'git stash apply --index').estado;

    expect(archivoPorNombre(despues, 'ingredientes.md')?.estado).toBe('preparado');
  });

  it('drop y clear vacian la pila', () => {
    const partida = correr(
      repoLineal(),
      'git stash push -m "uno"',
      'echo "x" >> ingredientes.md',
      'git stash push -m "dos"',
    );

    const conDrop = ejecutar(partida, 'git stash drop stash@{1}');
    expect(texto(conDrop)).toContain('Dropped stash@{1}');
    expect(conDrop.estado.guardados).toHaveLength(1);

    expect(ejecutar(partida, 'git stash clear').estado.guardados).toHaveLength(0);
  });

  it('reclama al operar sobre una pila vacia o con una suborden inventada', () => {
    const estado = correr(repoLineal(), 'git restore ingredientes.md');
    expect(texto(ejecutar(estado, 'git stash pop'))).toContain('No stash entries found.');
    expect(texto(ejecutar(estado, 'git stash show'))).toContain('No stash entries found.');
    expect(texto(ejecutar(estado, 'git stash drop'))).toContain('No stash entries found.');
    expect(texto(ejecutar(estado, 'git stash inventada'))).toContain('unknown subcommand');
  });
});

describe('git reflog', () => {
  it('registra los movimientos de HEAD en orden, del mas reciente al mas antiguo', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git switch tailandesa', 'git switch main');
    const salida = texto(ejecutar(estado, 'git reflog'));
    const filas = salida.split('\n');

    expect(filas[0]).toContain('HEAD@{0}: checkout: moving from tailandesa to main');
    expect(filas[1]).toContain('HEAD@{1}: checkout: moving from main to tailandesa');
    expect(salida).toContain('commit');
  });

  it('permite consultar el registro de una rama', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git branch chilena');
    expect(texto(ejecutar(estado, 'git reflog chilena'))).toContain('chilena@{0}: branch:');
  });
});

describe('git rebase', () => {
  it('avisa cuando la rama ya esta al dia', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git switch tailandesa');
    expect(texto(ejecutar(estado, 'git rebase HEAD~1'))).toContain('is up to date');
  });

  it('avanza el puntero cuando la rama esta contenida en la base', () => {
    const partida = correr(repoConRamaDesdeMain(), 'git branch chilena', 'git switch chilena');
    const conAvance = correr(
      partida,
      'git switch main',
      'echo "x" >> cocineros.md',
      'git add cocineros.md',
      'git commit -m "Avanza main"',
      'git switch chilena',
    );
    const resultado = ejecutar(conAvance, 'git rebase main');

    expect(texto(resultado)).toContain('Fast-forwarded chilena to main');
    expect(ramaPorNombre(resultado.estado, 'chilena')?.id).toBe(
      ramaPorNombre(resultado.estado, 'main')?.id,
    );
  });

  it('reclama sin argumentos o ante una base desconocida', () => {
    const estado = repoConRamaDesdeMain();
    expect(texto(ejecutar(estado, 'git rebase'))).toContain('No rebase in progress');
    expect(texto(ejecutar(estado, 'git rebase fantasma'))).toContain('invalid upstream');
  });

  it('conserva el mensaje y los archivos de cada confirmacion reescrita', () => {
    const partida = correr(repoConRamaDesdeMain(), 'git switch tailandesa');
    const despues = ejecutar(partida, 'git rebase main').estado;
    const salida = texto(ejecutar(despues, 'git log --oneline'));

    // Los mensajes que el laboratorio 07 manda arreglar sobreviven al rebase.
    expect(salida).toContain('wip');
    expect(salida).toContain('arreglos');
    expect(salida).toContain('Agrega la tabla de cocineros');
  });
});

describe('git remote', () => {
  it('add registra el remoto y -v lo muestra con sus dos direcciones', () => {
    const estado = correr(
      repoConRamaDesdeMain(),
      'git remote add origin https://gitlab.sii.cl/taller/recetario.git',
    );

    expect(texto(ejecutar(estado, 'git remote'))).toBe('origin');
    const detalle = texto(ejecutar(estado, 'git remote -v'));
    expect(detalle).toContain('(fetch)');
    expect(detalle).toContain('(push)');
  });

  it('reclama ante duplicados, uso incorrecto y remotos inexistentes', () => {
    const estado = correr(repoConRamaDesdeMain(), 'git remote add origin https://ejemplo.cl/r.git');

    expect(texto(ejecutar(estado, 'git remote add origin https://otro.cl/r.git'))).toContain(
      'already exists',
    );
    expect(texto(ejecutar(estado, 'git remote add origin'))).toContain('usage: git remote add');
    expect(texto(ejecutar(estado, 'git remote remove fantasma'))).toContain('No such remote');
    expect(texto(ejecutar(estado, 'git remote remove'))).toContain('usage: git remote remove');
    expect(ejecutar(estado, 'git remote remove origin').estado.remotos).toHaveLength(0);
  });
});
