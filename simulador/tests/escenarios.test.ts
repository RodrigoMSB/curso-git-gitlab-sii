/**
 * Integridad de los cuatro escenarios de la seccion 10 del SPEC 001.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { idActual, ramaActual, ramaPorNombre } from '../src/core/estado';
import { baseComun, huerfanas } from '../src/core/grafo';
import {
  construirEscenario,
  declaraciones,
  escenarioDeSesion,
  escenarioPorId,
  escenarios,
  ESCENARIOS,
  type EscenarioDeclarado,
} from '../src/escenarios';
import { texto } from './ayudas';

/**
 * Trae una declaracion por su identificador. Con `noUncheckedIndexedAccess`
 * el acceso por clave puede venir vacio, y aqui conviene que la prueba falle
 * diciendo cual falta antes que arrastrar un valor indefinido.
 */
function declaracion(id: string): EscenarioDeclarado {
  const encontrada = declaraciones[id];
  if (encontrada === undefined) throw new Error(`no hay escenario declarado con id ${id}`);
  return encontrada;
}

describe('escenarios del recetario COMIDA CHILENA', () => {
  it('hay uno por cada una de las cuatro primeras sesiones', () => {
    expect(ESCENARIOS.map((escenario) => escenario.sesion)).toEqual([1, 2, 3, 4]);
    expect(Object.keys(escenarios)).toEqual(['E1', 'E2', 'E3', 'E4']);
    expect(escenarioDeSesion(3).confirmaciones).toHaveLength(6);
    expect(idActual(escenarioPorId('E2'))).toBe(idActual(escenarios.E2?.() ?? escenarioPorId('E2')));
  });

  it('todos parten con repositorio iniciado y ningun huerfano', () => {
    for (const escenario of ESCENARIOS) {
      const estado = construirEscenario(escenario);
      expect(estado.iniciado).toBe(true);
      expect(ramaActual(estado)).toBe(escenario.posicion);
      expect(huerfanas(estado)).toHaveLength(0);
    }
  });

  it('los identificadores de cada escenario son unicos y de siete caracteres', () => {
    for (const escenario of ESCENARIOS) {
      const estado = construirEscenario(escenario);
      const identificadores = estado.confirmaciones.map((confirmacion) => confirmacion.id);
      expect(new Set(identificadores).size).toBe(identificadores.length);
      for (const id of identificadores) expect(id).toMatch(/^[0-9a-f]{7}$/);
    }
  });

  it('reclama al pedir un escenario que no existe', () => {
    expect(() => escenarioDeSesion(9)).toThrow('sesion 9');
    expect(() => escenarioPorId('E9')).toThrow('E9');
  });

  it('E1 esta recien creado, sin confirmaciones y con todo sin seguimiento', () => {
    const estado = escenarioPorId('E1');

    expect(estado.confirmaciones).toHaveLength(0);
    expect(estado.ramas).toHaveLength(0);
    expect(idActual(estado)).toBeNull();
    expect(estado.archivos.every((archivo) => archivo.estado === 'sin-seguimiento')).toBe(true);
    expect(estado.archivos.map((archivo) => archivo.nombre)).toEqual(
      expect.arrayContaining([
        'README.md',
        'platos.md',
        'ingredientes.md',
        'cocineros.md',
        'recetas/pastel-de-choclo.md',
      ]),
    );
    // La identidad todavia no esta puesta: configurarla es el primer ejercicio.
    expect(estado.config.global).toEqual({});
  });

  it('E2 tiene cuatro confirmaciones lineales, un archivo modificado y un mensaje mal escrito', () => {
    const estado = escenarioPorId('E2');

    expect(estado.confirmaciones).toHaveLength(4);
    expect(estado.confirmaciones.every((confirmacion) => confirmacion.padres.length <= 1)).toBe(true);
    expect(estado.confirmaciones.at(-1)?.mensaje).toBe('Agrega la lsita de cocinerps');
    expect(
      estado.archivos.filter((archivo) => archivo.estado === 'modificado').map((a) => a.nombre),
    ).toEqual(['platos.md']);
  });

  it('E3 separa tailandesa en la tercera confirmacion y trae estorbos sin excluir', () => {
    const estado = escenarioPorId('E3');
    const puntaMain = ramaPorNombre(estado, 'main')?.id ?? '';
    const puntaThai = ramaPorNombre(estado, 'tailandesa')?.id ?? '';

    expect(estado.confirmaciones).toHaveLength(6);
    expect(baseComun(estado, puntaMain, puntaThai)).toBe(estado.confirmaciones[2]?.id);
    expect(estado.archivos.map((archivo) => archivo.nombre)).toEqual(
      expect.arrayContaining(['notas.tmp', 'respaldo.bak', 'credenciales.txt']),
    );
    expect(
      estado.archivos.find((archivo) => archivo.nombre === '.gitignore'),
    ).toBeUndefined();
  });

  it('E3 se fusiona sin conflicto porque las ramas tocan archivos distintos', () => {
    const resultado = ejecutar(escenarioPorId('E3'), 'git merge tailandesa');
    expect(resultado.estado.fusion).toBeNull();
    expect(texto(resultado)).not.toContain('CONFLICT');
  });

  it('E4 repite la forma de E3 pero hace divergir platos.md, de modo que la fusion choca', () => {
    const estado = escenarioPorId('E4');
    const resultado = ejecutar(estado, 'git merge tailandesa');

    expect(estado.confirmaciones).toHaveLength(6);
    expect(declaraciones.E4?.ramas.map((rama) => rama.nombre)).toEqual(['main', 'tailandesa']);
    expect(texto(resultado)).toContain('CONFLICT (content): Merge conflict in platos.md');
  });

  it('un escenario mal declarado se rechaza al construirse', () => {
    expect(() =>
      construirEscenario({
        ...declaracion('E2'),
        confirmaciones: [
          { clave: 'x', mensaje: 'Suelta', archivos: [], padres: ['inexistente'], carril: 0 },
        ],
        ramas: [{ nombre: 'main', en: 'x', carril: 0 }],
      }),
    ).toThrow('no esta declarado');

    expect(() =>
      construirEscenario({
        ...declaracion('E1'),
        ramas: [{ nombre: 'main', en: 'fantasma', carril: 0 }],
      }),
    ).toThrow('no existe');
  });
});
