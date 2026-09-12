/**
 * Ordenes del interprete de mandatos, analisis de la linea y resolucion de
 * referencias.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { analizar, tokenizar } from '../src/core/analizador';
import { archivoPorNombre, estadoVacio } from '../src/core/estado';
import { resolverReferencia } from '../src/core/referencias';
import { huella } from '../src/core/identificadores';
import { correr, repoConRamas, repoLimpio, repoLineal, repoVacio, texto } from './ayudas';

describe('analisis de la linea', () => {
  it('separa palabras respetando comillas dobles y simples', () => {
    expect(tokenizar('git commit -m "Agrega la lista de platos"')).toEqual([
      'git',
      'commit',
      '-m',
      'Agrega la lista de platos',
    ]);
    expect(tokenizar("git config user.name 'Rodrigo Silva'")).toEqual([
      'git',
      'config',
      'user.name',
      'Rodrigo Silva',
    ]);
  });

  it('aisla los operadores de redireccion con espacios y sin ellos', () => {
    expect(tokenizar('echo hola >> platos.md')).toEqual(['echo', 'hola', '>>', 'platos.md']);
    expect(tokenizar('echo hola>>platos.md')).toEqual(['echo', 'hola', '>>', 'platos.md']);
    expect(tokenizar('echo hola > platos.md')).toEqual(['echo', 'hola', '>', 'platos.md']);
  });

  it('conserva las cadenas vacias entre comillas', () => {
    expect(tokenizar('git commit -m ""')).toEqual(['git', 'commit', '-m', '']);
  });

  it('devuelve nulo ante una linea en blanco', () => {
    expect(analizar('   ')).toBeNull();
    expect(analizar('git status')?.programa).toBe('git');
  });

  it('una linea en blanco no altera el estado', () => {
    const partida = repoLineal();
    const resultado = ejecutar(partida, '');
    expect(resultado.estado).toBe(partida);
    expect(resultado.salida).toHaveLength(0);
  });
});

describe('resolucion de referencias', () => {
  it('resuelve HEAD, ramas, etiquetas e identificadores abreviados', () => {
    const estado = correr(repoConRamas(), 'git tag v1.0');
    const punta = estado.confirmaciones[3]?.id ?? '';

    expect(resolverReferencia(estado, 'HEAD')).toBe(punta);
    expect(resolverReferencia(estado, '@')).toBe(punta);
    expect(resolverReferencia(estado, 'main')).toBe(punta);
    expect(resolverReferencia(estado, 'v1.0')).toBe(punta);
    expect(resolverReferencia(estado, punta)).toBe(punta);
    expect(resolverReferencia(estado, punta.slice(0, 5))).toBe(punta);
  });

  it('recorre los sufijos ~ y ^', () => {
    const estado = repoConRamas();
    expect(resolverReferencia(estado, 'HEAD~1')).toBe(estado.confirmaciones[2]?.id);
    expect(resolverReferencia(estado, 'HEAD~3')).toBe(estado.confirmaciones[0]?.id);
    expect(resolverReferencia(estado, 'HEAD^')).toBe(estado.confirmaciones[2]?.id);
  });

  it('el segundo padre de una union se alcanza con ^2', () => {
    const estado = correr(
      repoConRamas(),
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );
    expect(resolverReferencia(estado, 'HEAD^2')).toBe(estado.confirmaciones[6]?.id);
  });

  it('devuelve nulo ante referencias que no existen o que se salen del grafo', () => {
    const estado = repoConRamas();
    expect(resolverReferencia(estado, 'fantasma')).toBeNull();
    expect(resolverReferencia(estado, 'HEAD~99')).toBeNull();
    expect(resolverReferencia(estado, 'HEAD^3')).toBeNull();
    expect(resolverReferencia(estadoVacio(), 'HEAD')).toBeNull();
  });
});

describe('identificadores', () => {
  it('la huella es estable y de siete caracteres hexadecimales', () => {
    expect(huella('recetario')).toBe(huella('recetario'));
    expect(huella('recetario')).toMatch(/^[0-9a-f]{7}$/);
    expect(huella('recetario')).not.toBe(huella('recetarío'));
  });

  it('la misma secuencia de ordenes produce los mismos identificadores', () => {
    const primera = correr(
      repoVacio(),
      'git add .',
      'git commit -m "Primera confirmacion"',
    );
    const segunda = correr(
      repoVacio(),
      'git add .',
      'git commit -m "Primera confirmacion"',
    );
    expect(primera.confirmaciones[0]?.id).toBe(segunda.confirmaciones[0]?.id);
  });
});

describe('ordenes del interprete de mandatos', () => {
  it('pwd muestra el directorio de trabajo', () => {
    expect(texto(ejecutar(repoLimpio(), 'pwd'))).toBe('/taller-git-trabajo/lab-03/recetario');
  });

  it('ls muestra las entradas de primer nivel y las carpetas con barra', () => {
    const filas = texto(ejecutar(repoLimpio(), 'ls')).split('\n');
    expect(filas).toContain('platos.md');
    expect(filas).toContain('recetas/');
    expect(filas).not.toContain('recetas/empanadas.md');
  });

  it('ls sobre una carpeta muestra su contenido y reclama si no existe', () => {
    expect(texto(ejecutar(repoLimpio(), 'ls recetas'))).toContain('empanadas.md');
    expect(texto(ejecutar(repoLimpio(), 'ls fantasma'))).toContain(
      'No such file or directory',
    );
  });

  it('clear pide a la consola que se limpie', () => {
    const resultado = ejecutar(repoConRamas(), 'clear');
    expect(resultado.limpiarConsola).toBe(true);
    expect(resultado.salida).toHaveLength(0);
  });

  it('cat muestra el texto del archivo (SPEC 012, punto 3.2)', () => {
    const resultado = ejecutar(repoConRamas(), 'cat platos.md');

    expect(resultado.error).toBe(false);
    expect(texto(resultado)).toContain('# Platos');
    expect(texto(resultado)).toContain('- pastel de choclo');
    expect(resultado.salida.every((linea) => linea.tipo === 'salida')).toBe(true);
  });

  it('cat sobre la carpeta oculta sigue declarado, y por una razon distinta', () => {
    // No es que no se pueda: es que ese tramo se hace en la terminal a
    // proposito. Fabricar una carpeta oculta de mentira enseñaria lo contrario
    // de lo que ese tramo viene a enseñar (punto 6.1 del SPEC 012).
    const resultado = ejecutar(repoConRamas(), 'cat .git/HEAD');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('mirar dentro de la carpeta .git');
    expect(resultado.salida.every((linea) => linea.tipo === 'limite')).toBe(true);
  });

  it('cat sobre un archivo que no esta reclama como el interprete', () => {
    const resultado = ejecutar(repoConRamas(), 'cat fantasma.md');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('No such file or directory');
  });

  it('cat sin argumentos reclama como el interprete, no como un limite', () => {
    const resultado = ejecutar(repoConRamas(), 'cat');
    expect(texto(resultado)).toContain('falta el nombre');
    expect(resultado.salida.every((linea) => linea.tipo === 'error')).toBe(true);
  });

  it('echo sin redireccion escribe en la consola', () => {
    expect(texto(ejecutar(repoConRamas(), 'echo "hola taller"'))).toBe('hola taller');
  });

  it('echo con anexion marca el archivo como modificado', () => {
    const estado = correr(repoConRamas(), 'echo "* Charquican" >> platos.md');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('modificado');
  });

  it('echo sobre un archivo que no existe lo crea sin seguimiento', () => {
    const estado = correr(repoConRamas(), 'echo "*.tmp" >> .gitignore');
    expect(archivoPorNombre(estado, '.gitignore')?.estado).toBe('sin-seguimiento');
  });

  it('echo sobre un archivo ya modificado o preparado no lo cambia de estado', () => {
    const estado = correr(
      repoConRamas(),
      'echo "a" >> platos.md',
      'git add platos.md',
      'echo "b" >> platos.md',
    );
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('preparado');
  });

  it('echo reclama si falta el destino de la redireccion', () => {
    expect(texto(ejecutar(repoConRamas(), 'echo hola >>'))).toContain('syntax error');
  });
});

describe('ordenes no reconocidas', () => {
  it('una orden inexistente responde como lo hace un interprete real', () => {
    const resultado = ejecutar(repoConRamas(), 'gti status');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toBe('bash: gti: command not found');
  });

  it('una suborden de git inexistente responde como lo hace Git', () => {
    const resultado = ejecutar(repoConRamas(), 'git pushear');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain("git: 'pushear' is not a git command");
  });

  it('git a secas muestra el modo de uso', () => {
    expect(texto(ejecutar(repoConRamas(), 'git'))).toContain('usage: git <command>');
  });
});
