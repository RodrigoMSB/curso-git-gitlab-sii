/**
 * Las dos familias de ordenes que el SPEC 010 agrego y dejo sin pruebas de
 * unidad: `git mv`, `git rm`, `git ls-files` por un lado, y `git show`,
 * `git rev-parse`, `git merge-base`, `git cat-file -t` por el otro.
 *
 * Estaban cubiertas solo por el recorrido de punta a punta, que corre en
 * Cypress y no cuenta para la cobertura del motor. Con trescientas sesenta
 * lineas de motor dependiendo de un arnes que tarda cinco minutos en correr, la
 * suite rapida dejo de decir la verdad sobre lo que esta probado. Lo destapo el
 * SPEC 011, al medir la cobertura del arbol tal como estaba.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { archivoPorNombre, idActual, ramaPorNombre } from '../src/core/estado';
import { estaExcluida, leerExclusiones } from '../src/core/exclusiones';
import type { EstadoRepositorio } from '../src/core/tipos';
import { correr, correrHasta, repoConRamas, repoLimpio, repoVacio, texto } from './ayudas';

describe('git rm', () => {
  it('con --cached saca del seguimiento y deja el archivo en el disco', () => {
    const resultado = correrHasta(repoLimpio(), 'git rm --cached notas.tmp');

    expect(resultado.error).toBe(false);
    expect(texto(resultado)).toContain("rm 'notas.tmp'");
    expect(resultado.estado.borrados).toContain('notas.tmp');
    expect(archivoPorNombre(resultado.estado, 'notas.tmp')?.estado).toBe('sin-seguimiento');
  });

  it('sin --cached tambien lo saca del directorio de trabajo', () => {
    const estado = correr(repoLimpio(), 'git rm notas.tmp');

    expect(estado.borrados).toContain('notas.tmp');
    expect(archivoPorNombre(estado, 'notas.tmp')).toBeUndefined();
  });

  it('reclama cuando la ruta no versiona nada', () => {
    const resultado = correrHasta(repoLimpio(), 'git rm inexistente.md');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain("did not match any files");
  });

  it('se niega a borrar una carpeta sin -r, y con -r la borra entera', () => {
    const sinRecursion = correrHasta(repoLimpio(), 'git rm --cached recetas');
    expect(sinRecursion.error).toBe(true);
    expect(texto(sinRecursion)).toContain('without -r');

    const conRecursion = correrHasta(repoLimpio(), 'git rm -r --cached recetas');
    expect(conRecursion.error).toBe(false);
    expect(conRecursion.estado.borrados.length).toBeGreaterThan(1);
  });

  it('se niega a borrar un archivo con cambios locales, salvo con -f', () => {
    const conCambio = correr(repoLimpio(), 'echo "x" >> platos.md');

    const sinForzar = correrHasta(conCambio, 'git rm platos.md');
    expect(sinForzar.error).toBe(true);
    expect(texto(sinForzar)).toContain('local modifications');

    expect(correrHasta(conCambio, 'git rm -f platos.md').error).toBe(false);
  });

  it('pide una ruta y avisa fuera de un repositorio', () => {
    expect(correrHasta(repoLimpio(), 'git rm').error).toBe(true);
    expect(correrHasta(ejecutar(repoVacio(), 'git rm x').estado, 'git rm x').error).toBe(true);
  });
});

describe('git mv', () => {
  it('renombra y deja el destino preparado, recordando de donde vino', () => {
    const estado = correr(repoLimpio(), 'git mv platos.md listado-de-platos.md');

    const destino = archivoPorNombre(estado, 'listado-de-platos.md');
    expect(destino?.estado).toBe('preparado');
    expect(destino?.renombradoDe).toBe('platos.md');
    expect(archivoPorNombre(estado, 'platos.md')).toBeUndefined();
  });

  it('mueve a una carpeta conservando el nombre del archivo', () => {
    const estado = correr(
      repoLimpio(),
      'mkdir -p recetas/principales',
      'git mv recetas/pastel-de-choclo.md recetas/principales',
    );

    expect(archivoPorNombre(estado, 'recetas/principales/pastel-de-choclo.md')).toBeDefined();
  });

  it('reclama por el origen que no existe, el que no esta versionado y el destino ocupado', () => {
    expect(texto(correrHasta(repoLimpio(), 'git mv fantasma.md otro.md'))).toContain(
      'bad source',
    );
    // Un archivo que existe en el disco pero que Git no sigue.
    const conSuelto = correr(repoLimpio(), 'echo "x" > suelto.md');
    expect(texto(correrHasta(conSuelto, 'git mv suelto.md otro.md'))).toContain(
      'not under version control',
    );
    expect(texto(correrHasta(repoLimpio(), 'git mv platos.md ingredientes.md'))).toContain(
      'destination exists',
    );
  });

  it('con varios origenes exige que el destino sea una carpeta', () => {
    expect(
      texto(correrHasta(repoLimpio(), 'git mv platos.md ingredientes.md uno.md')),
    ).toContain('is not a directory');
    expect(texto(correrHasta(repoLimpio(), 'git mv'))).toContain('usage: git mv');
  });
});

describe('git ls-files', () => {
  it('enumera lo versionado ahora, sin lo que salio del seguimiento', () => {
    const antes = texto(ejecutar(repoLimpio(), 'git ls-files'));
    expect(antes).toContain('notas.tmp');

    const despues = texto(correrHasta(repoLimpio(), 'git rm --cached notas.tmp', 'git ls-files'));
    expect(despues).not.toContain('notas.tmp');
  });

  it('con --others enumera solo lo que esta sin seguimiento', () => {
    const estado = correr(repoLimpio(), 'echo "x" > suelto.md');
    const salida = texto(ejecutar(estado, 'git ls-files --others'));

    expect(salida).toContain('suelto.md');
    expect(salida).not.toContain('platos.md');
  });

  it('cuenta lo preparado, que ya esta en el indice', () => {
    const estado = correr(repoLimpio(), 'echo "x" > nuevo.md', 'git add nuevo.md');
    expect(texto(ejecutar(estado, 'git ls-files'))).toContain('nuevo.md');
  });
});

describe('git show', () => {
  it('muestra la cabecera de la confirmacion y los archivos que registro', () => {
    const salida = texto(ejecutar(repoLimpio(), 'git show HEAD'));

    expect(salida).toContain(`commit ${idActual(repoLimpio())}`);
    expect(salida).toContain('Author:');
    expect(salida).toContain('Date:');
  });

  it('sobre una etiqueta anotada muestra primero el objeto de la etiqueta', () => {
    const estado = correr(repoLimpio(), 'git tag -a v1.0 -m "primera version"');
    const salida = texto(ejecutar(estado, 'git show v1.0'));

    expect(salida).toContain('tag v1.0');
    expect(salida).toContain('Tagger:');
    expect(salida).toContain('primera version');
    expect(salida).toContain('commit ');
  });

  it('nombra los dos padres de una union', () => {
    const estado = correr(repoConRamas(), 'git merge azteca');
    const union = estado.confirmaciones.filter(
      (confirmacion) => confirmacion.padres.length > 1,
    );
    expect(union.length).toBeGreaterThan(0);
    expect(texto(ejecutar(estado, `git show ${union[0]?.id}`))).toContain('Merge:');
  });

  it('reclama por una referencia que no resuelve', () => {
    const resultado = correrHasta(repoLimpio(), 'git show noexiste');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('unknown revision');
  });
});

describe('git rev-parse', () => {
  it('traduce un nombre de rama a su identificador', () => {
    const estado = repoLimpio();
    const salida = texto(ejecutar(estado, 'git rev-parse main'));
    expect(salida).toBe(ramaPorNombre(estado, 'main')?.id);
  });

  it('con --abbrev-ref devuelve el nombre de la rama en vez del identificador', () => {
    expect(texto(ejecutar(repoLimpio(), 'git rev-parse --abbrev-ref HEAD'))).toBe('main');
    expect(texto(ejecutar(repoLimpio(), 'git rev-parse --abbrev-ref main'))).toBe('main');
  });

  it('responde a las preguntas sobre el repositorio mismo', () => {
    expect(texto(ejecutar(repoLimpio(), 'git rev-parse --is-inside-work-tree'))).toBe('true');
    expect(texto(ejecutar(repoLimpio(), 'git rev-parse --git-dir'))).toBe('.git');
  });

  it('fuera de un repositorio dice que no lo hay', () => {
    const fuera = ejecutar(repoLimpio(), 'git rev-parse');
    expect(fuera.error).toBe(true);
  });

  it('reclama por una referencia que no resuelve', () => {
    const resultado = correrHasta(repoLimpio(), 'git rev-parse noexiste');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('unknown revision');
  });
});

describe('git merge-base', () => {
  it('devuelve la confirmacion donde las dos ramas se separaron', () => {
    const estado = repoConRamas();
    const salida = texto(ejecutar(estado, 'git merge-base main andina'));

    expect(salida).not.toBe('');
    expect(estado.confirmaciones.some((confirmacion) => confirmacion.id === salida)).toBe(true);
  });

  it('pide dos referencias y reclama por la que no resuelve', () => {
    expect(texto(correrHasta(repoConRamas(), 'git merge-base main'))).toContain('usage:');
    expect(texto(correrHasta(repoConRamas(), 'git merge-base noexiste main'))).toContain(
      'Not a valid object name',
    );
    expect(texto(correrHasta(repoConRamas(), 'git merge-base main noexiste'))).toContain(
      'Not a valid object name',
    );
  });
});

describe('git cat-file -t', () => {
  it('distingue la etiqueta anotada, que es un objeto propio, de la simple', () => {
    const estado = correr(
      repoLimpio(),
      'git tag v0.9',
      'git tag -a v1.0 -m "primera version completa"',
    );

    expect(texto(ejecutar(estado, 'git cat-file -t v0.9'))).toBe('commit');
    expect(texto(ejecutar(estado, 'git cat-file -t v1.0'))).toBe('tag');
  });

  it('una confirmacion es una confirmacion', () => {
    expect(texto(ejecutar(repoLimpio(), 'git cat-file -t HEAD'))).toBe('commit');
  });

  it('sin -t y con un objeto que no existe, reclama', () => {
    expect(texto(correrHasta(repoLimpio(), 'git cat-file v1.0'))).toContain('usage:');
    expect(texto(correrHasta(repoLimpio(), 'git cat-file -t'))).toContain('usage:');
    expect(texto(correrHasta(repoLimpio(), 'git cat-file -t noexiste'))).toContain(
      'Not a valid object name',
    );
  });
});

/**
 * El `mv` y el `rm` del interprete, que no son los de Git.
 *
 * El laboratorio 03 los usa justamente para enseñar la diferencia: renombrar
 * por fuera deja un archivo borrado y otro sin seguimiento, porque para Git son
 * dos hechos separados. Estaban cubiertos solo por el recorrido de Cypress.
 */
describe('mv y rm del interprete', () => {
  it('renombrar por fuera deja una baja pendiente y un archivo sin seguimiento', () => {
    const estado = correr(repoLimpio(), 'mv platos.md listado.md');

    expect(estado.borradosSinPreparar).toContain('platos.md');
    expect(archivoPorNombre(estado, 'listado.md')?.estado).toBe('sin-seguimiento');
    expect(archivoPorNombre(estado, 'listado.md')?.renombradoDe).toBe('platos.md');
  });

  it('devolver el archivo a su nombre deshace la baja pendiente', () => {
    const estado = correr(repoLimpio(), 'mv platos.md listado.md', 'mv listado.md platos.md');

    expect(estado.borradosSinPreparar).not.toContain('platos.md');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('limpio');
  });

  it('con la baja ya preparada, devolverlo lo deja sin seguimiento y la baja en pie', () => {
    // Es la propiedad de la seccion 34b: el area de preparacion guarda rutas.
    const estado = correr(
      repoLimpio(),
      'git mv platos.md listado.md',
      // Sacar de la preparacion el nombre nuevo no saca la baja del viejo.
      'git restore --staged listado.md',
      'mv listado.md platos.md',
    );

    expect(estado.borrados).toContain('platos.md');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('sin-seguimiento');
  });

  it('mover algo que no esta, o sin destino, reclama', () => {
    expect(texto(correrHasta(repoLimpio(), 'mv fantasma.md otro.md'))).toContain(
      'No such file or directory',
    );
    expect(texto(correrHasta(repoLimpio(), 'mv platos.md'))).toContain('usage: mv');
  });

  it('borrar por fuera un archivo versionado deja la baja pendiente', () => {
    const estado = correr(repoLimpio(), 'rm platos.md');

    expect(estado.borradosSinPreparar).toContain('platos.md');
    expect(archivoPorNombre(estado, 'platos.md')).toBeUndefined();
  });

  it('borrar por fuera algo sin seguimiento no deja nada pendiente', () => {
    const estado = correr(repoLimpio(), 'echo "x" > suelto.md', 'rm suelto.md');

    expect(estado.borradosSinPreparar).not.toContain('suelto.md');
    expect(archivoPorNombre(estado, 'suelto.md')).toBeUndefined();
  });

  it('borrar algo que no esta, o sin ruta, reclama', () => {
    expect(texto(correrHasta(repoLimpio(), 'rm fantasma.md'))).toContain(
      'No such file or directory',
    );
    expect(texto(correrHasta(repoLimpio(), 'rm'))).toContain('usage: rm');
  });
});

/**
 * El archivo de exclusiones, que ahora filtra de verdad (SPEC 012, CA2).
 *
 * Es la razon del spec. El laboratorio 03 enseña que ignorar un archivo y
 * sacarlo del seguimiento son cosas distintas, y hasta el SPEC 011 el
 * simulador no podia mostrar la primera mitad: el participante escribia las
 * reglas, pedia el estado, y la pantalla le decia que no sabia leerlas.
 *
 * Las pruebas recorren el camino del enunciado, de su punto 2.2 al 3.2.
 */
describe('.gitignore', () => {
  /** Lo que el punto 2.2 del laboratorio 03 hace escribir, linea por linea. */
  const escribirExclusiones = (estado: EstadoRepositorio): EstadoRepositorio =>
    correr(
      estado,
      'echo "*.tmp" > .gitignore',
      'echo "*.bak" >> .gitignore',
      'echo "credenciales.txt" >> .gitignore',
    );

  it('crearlo ya no trae ningun aviso de limite', () => {
    const resultado = correrHasta(repoLimpio(), 'echo "*.tmp" > .gitignore');

    expect(resultado.salida.some((linea) => linea.tipo === 'limite')).toBe(false);
    expect(archivoPorNombre(resultado.estado, '.gitignore')?.estado).toBe('sin-seguimiento');
  });

  it('tapa lo que todavia no esta en seguimiento', () => {
    // El escenario trae los tres archivos ya confirmados, asi que primero hay
    // que sacarlos del seguimiento: es el orden del propio enunciado.
    const estado = escribirExclusiones(
      correr(
        repoLimpio(),
        'git rm --cached notas.tmp',
        'git rm --cached respaldo.bak',
        'git rm credenciales.txt',
      ),
    );

    // Siguen anotados como bajas preparadas, que es correcto: lo que las
    // reglas tapan es su reaparicion como archivos sin seguimiento.
    const sinSeguir = texto(correrHasta(estado, 'git status')).split('Untracked files:')[1] ?? '';
    expect(sinSeguir).not.toContain('notas.tmp');
    expect(sinSeguir).not.toContain('respaldo.bak');
    // El archivo de exclusiones si aparece: no se tapa a si mismo.
    expect(sinSeguir).toContain('.gitignore');
  });

  it('no toca lo que ya esta en seguimiento, que es el punto del laboratorio', () => {
    const estado = escribirExclusiones(repoLimpio());

    // Los tres siguen versionados, por mucho que las reglas los nombren.
    const enumerados = texto(correrHasta(estado, 'git ls-files'));
    expect(enumerados).toContain('notas.tmp');
    expect(enumerados).toContain('respaldo.bak');
    expect(enumerados).toContain('credenciales.txt');
  });

  it('un archivo nuevo que cae bajo una regla no aparece en el estado', () => {
    const estado = correr(escribirExclusiones(repoLimpio()), 'echo "prueba" > temporal.tmp');

    expect(texto(correrHasta(estado, 'git status'))).not.toContain('temporal.tmp');
    expect(texto(correrHasta(estado, 'git status -s'))).not.toContain('temporal.tmp');
  });

  it('nombrarlo a mano en git add es un error que dice como insistir', () => {
    const estado = correr(escribirExclusiones(repoLimpio()), 'echo "esta si va" > importante.tmp');

    const resultado = correrHasta(estado, 'git add importante.tmp');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('ignored by one of your .gitignore files');
    expect(texto(resultado)).toContain('Use -f if you really want to add them');
  });

  it('con -f entra igual', () => {
    const estado = correr(escribirExclusiones(repoLimpio()), 'echo "esta si va" > importante.tmp');

    const resultado = correrHasta(estado, 'git add -f importante.tmp');
    expect(resultado.error).toBe(false);
    expect(archivoPorNombre(resultado.estado, 'importante.tmp')?.estado).toBe('preparado');
  });

  it('barrer con git add . se salta lo tapado sin decir nada', () => {
    const estado = correr(
      escribirExclusiones(repoLimpio()),
      'echo "prueba" > temporal.tmp',
      'git add .',
    );

    expect(archivoPorNombre(estado, 'temporal.tmp')?.estado).toBe('sin-seguimiento');
    expect(archivoPorNombre(estado, '.gitignore')?.estado).toBe('preparado');
  });

  it('una carpeta con barra al final tapa todo lo que cuelga de ella', () => {
    const estado = correr(
      repoLimpio(),
      'echo "construido/" > .gitignore',
      'echo "x" > construido/salida.txt',
    );

    const salida = texto(correrHasta(estado, 'git status'));
    expect(salida).not.toContain('construido');
  });

  it('lo que la sintaxis cubierta no alcanza se declara en vez de callarse', () => {
    const exclusiones = leerExclusiones('*.tmp\n!importante.tmp\n');

    expect(exclusiones.fuera).toEqual(['!importante.tmp']);
    expect(estaExcluida(exclusiones, 'notas.tmp')).toBe(true);
    // La negacion no se aplica: el patron que la lleva no entra en las reglas.
    expect(estaExcluida(exclusiones, 'importante.tmp')).toBe(true);
  });

  it('y git status lo dice, que es donde el participante lo espera', () => {
    const estado = correr(
      repoLimpio(),
      'echo "*.tmp" > .gitignore',
      'echo "!importante.tmp" >> .gitignore',
    );

    const resultado = correrHasta(estado, 'git status');
    expect(resultado.salida.some((linea) => linea.tipo === 'limite')).toBe(true);
    expect(texto(resultado)).toContain('«!importante.tmp»');
    expect(texto(resultado)).toContain('En tu terminal si funciona');
  });

  it('con las reglas que si cubre, git status no dice nada de mas', () => {
    const estado = correr(repoLimpio(), 'echo "*.tmp" > .gitignore');

    expect(
      correrHasta(estado, 'git status').salida.some((linea) => linea.tipo === 'limite'),
    ).toBe(false);
  });

  it('los comentarios y las lineas en blanco no son reglas', () => {
    const exclusiones = leerExclusiones('# lo que no va\n\n*.bak\n');

    expect(exclusiones.reglas).toHaveLength(1);
    expect(estaExcluida(exclusiones, 'respaldo.bak')).toBe(true);
    expect(estaExcluida(exclusiones, 'respaldo.md')).toBe(false);
  });

  it('un patron sin barras tapa en cualquier nivel, y uno anclado solo en la raiz', () => {
    const suelto = leerExclusiones('*.tmp\n');
    expect(estaExcluida(suelto, 'notas.tmp')).toBe(true);
    expect(estaExcluida(suelto, 'recetas/notas.tmp')).toBe(true);

    const anclado = leerExclusiones('/notas.tmp\n');
    expect(estaExcluida(anclado, 'notas.tmp')).toBe(true);
    expect(estaExcluida(anclado, 'recetas/notas.tmp')).toBe(false);
  });
});
