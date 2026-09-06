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
import { escenarioPorId } from '../src/escenarios';
import { correr, texto } from './ayudas';

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
    const partida = escenarioPorId('E2');
    const resultado = ejecutar(partida, '');
    expect(resultado.estado).toBe(partida);
    expect(resultado.salida).toHaveLength(0);
  });
});

describe('resolucion de referencias', () => {
  it('resuelve HEAD, ramas, etiquetas e identificadores abreviados', () => {
    const estado = correr(escenarioPorId('E3'), 'git tag v1.0');
    const punta = estado.confirmaciones[3]?.id ?? '';

    expect(resolverReferencia(estado, 'HEAD')).toBe(punta);
    expect(resolverReferencia(estado, '@')).toBe(punta);
    expect(resolverReferencia(estado, 'main')).toBe(punta);
    expect(resolverReferencia(estado, 'v1.0')).toBe(punta);
    expect(resolverReferencia(estado, punta)).toBe(punta);
    expect(resolverReferencia(estado, punta.slice(0, 5))).toBe(punta);
  });

  it('recorre los sufijos ~ y ^', () => {
    const estado = escenarioPorId('E3');
    expect(resolverReferencia(estado, 'HEAD~1')).toBe(estado.confirmaciones[2]?.id);
    expect(resolverReferencia(estado, 'HEAD~3')).toBe(estado.confirmaciones[0]?.id);
    expect(resolverReferencia(estado, 'HEAD^')).toBe(estado.confirmaciones[2]?.id);
  });

  it('el segundo padre de una union se alcanza con ^2', () => {
    const estado = correr(escenarioPorId('E3'), 'git merge tailandesa');
    expect(resolverReferencia(estado, 'HEAD^2')).toBe(estado.confirmaciones[5]?.id);
  });

  it('devuelve nulo ante referencias que no existen o que se salen del grafo', () => {
    const estado = escenarioPorId('E3');
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
      escenarioPorId('E1'),
      'git add .',
      'git commit -m "Primera confirmacion"',
    );
    const segunda = correr(
      escenarioPorId('E1'),
      'git add .',
      'git commit -m "Primera confirmacion"',
    );
    expect(primera.confirmaciones[0]?.id).toBe(segunda.confirmaciones[0]?.id);
  });
});

describe('ordenes del interprete de mandatos', () => {
  it('pwd muestra el directorio de trabajo', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'pwd'))).toBe('/home/participante/recetario');
  });

  it('ls muestra las entradas de primer nivel y las carpetas con barra', () => {
    const filas = texto(ejecutar(escenarioPorId('E3'), 'ls')).split('\n');
    expect(filas).toContain('platos.md');
    expect(filas).toContain('recetas/');
    expect(filas).not.toContain('recetas/empanadas.md');
  });

  it('ls sobre una carpeta muestra su contenido y reclama si no existe', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'ls recetas'))).toContain('empanadas.md');
    expect(texto(ejecutar(escenarioPorId('E3'), 'ls fantasma'))).toContain(
      'No such file or directory',
    );
  });

  it('clear pide a la consola que se limpie', () => {
    const resultado = ejecutar(escenarioPorId('E3'), 'clear');
    expect(resultado.limpiarConsola).toBe(true);
    expect(resultado.salida).toHaveLength(0);
  });

  it('cat declara que el simulador no versiona contenido y reclama si el archivo no existe', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'cat platos.md'))).toContain('no su contenido');
    expect(texto(ejecutar(escenarioPorId('E3'), 'cat fantasma.md'))).toContain(
      'No such file or directory',
    );
    expect(texto(ejecutar(escenarioPorId('E3'), 'cat'))).toContain('falta el nombre');
  });

  it('echo sin redireccion escribe en la consola', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'echo "hola taller"'))).toBe('hola taller');
  });

  it('echo con anexion marca el archivo como modificado', () => {
    const estado = correr(escenarioPorId('E3'), 'echo "* Charquican" >> platos.md');
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('modificado');
  });

  it('echo sobre un archivo que no existe lo crea sin seguimiento', () => {
    const estado = correr(escenarioPorId('E3'), 'echo "*.tmp" >> .gitignore');
    expect(archivoPorNombre(estado, '.gitignore')?.estado).toBe('sin-seguimiento');
  });

  it('echo sobre un archivo ya modificado o preparado no lo cambia de estado', () => {
    const estado = correr(
      escenarioPorId('E3'),
      'echo "a" >> platos.md',
      'git add platos.md',
      'echo "b" >> platos.md',
    );
    expect(archivoPorNombre(estado, 'platos.md')?.estado).toBe('preparado');
  });

  it('echo reclama si falta el destino de la redireccion', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'echo hola >>'))).toContain('syntax error');
  });
});

describe('ordenes no reconocidas', () => {
  it('una orden inexistente responde como lo hace un interprete real', () => {
    const resultado = ejecutar(escenarioPorId('E3'), 'gti status');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toBe('bash: gti: command not found');
  });

  it('una suborden de git inexistente responde como lo hace Git', () => {
    const resultado = ejecutar(escenarioPorId('E3'), 'git pushear');
    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain("git: 'pushear' is not a git command");
  });

  it('git a secas muestra el modo de uso', () => {
    expect(texto(ejecutar(escenarioPorId('E3'), 'git'))).toContain('usage: git <command>');
  });
});
