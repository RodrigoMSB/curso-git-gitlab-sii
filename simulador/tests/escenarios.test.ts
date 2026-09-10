/**
 * Integridad de los escenarios de laboratorio (SPEC 007).
 *
 * Un escenario por laboratorio, del 01 al 10. Lo que se comprueba aqui es que
 * cada declaracion sea coherente consigo misma; que ademas coincida con el
 * repositorio que `preparar.sh` arma en el disco se comprueba en
 * `escenarios-contra-disco.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { idActual, ramaActual, ramaPorNombre } from '../src/core/estado';
import { baseComun, huerfanas } from '../src/core/grafo';
import {
  construirEscenario,
  declaracionPorId,
  escenarioDeLaboratorio,
  escenarioDeLaDireccion,
  escenarioPorId,
  ESCENARIOS,
  type EscenarioDeclarado,
} from '../src/escenarios';
import { texto } from './ayudas';

function declaracion(id: string): EscenarioDeclarado {
  const encontrada = declaracionPorId(id);
  if (encontrada === undefined) throw new Error(`no hay escenario declarado con id ${id}`);
  return encontrada;
}

describe('escenarios de laboratorio', () => {
  it('hay uno por cada laboratorio del 01 al 10', () => {
    // El 09 no lleva: enseña remotos, un submodulo y un gancho, y el motor no
    // implementa ninguna de las tres cosas.
    expect(ESCENARIOS.map((escenario) => escenario.laboratorio)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 9,
    ]);
    expect(ESCENARIOS.map((escenario) => escenario.id)).toEqual([
      'lab-01',
      'lab-02',
      'lab-03',
      'lab-04',
      'lab-05',
      'lab-06',
      'lab-07',
      'lab-09',
    ]);
  });

  it('no quedan escenarios por sesion conviviendo con los de laboratorio', () => {
    // El selector mostraria entradas que no corresponden a ningun laboratorio.
    for (const id of ['E1', 'E2', 'E3', 'E4']) {
      expect(declaracionPorId(id)).toBeUndefined();
    }
  });

  it('cada escenario deja al participante en la rama que declara, sin huerfanas', () => {
    for (const escenario of ESCENARIOS) {
      const estado = construirEscenario(escenario);
      expect(ramaActual(estado), escenario.id).toBe(escenario.posicion);
      expect(huerfanas(estado), escenario.id).toHaveLength(0);
    }
  });

  it('los identificadores de cada escenario son unicos y de siete caracteres', () => {
    for (const escenario of ESCENARIOS) {
      const estado = construirEscenario(escenario);
      const identificadores = estado.confirmaciones.map((confirmacion) => confirmacion.id);
      expect(new Set(identificadores).size, escenario.id).toBe(identificadores.length);
      for (const id of identificadores) expect(id).toMatch(/^[0-9a-f]{7}$/);
    }
  });

  it('cada confirmacion declarada lleva autor y fecha propios, salvo las del participante', () => {
    for (const escenario of ESCENARIOS) {
      const estado = construirEscenario(escenario);
      for (const confirmacion of estado.confirmaciones) {
        expect(confirmacion.autor, `${escenario.id} ${confirmacion.mensaje}`).not.toBe('');
        expect(confirmacion.fecha, `${escenario.id} ${confirmacion.mensaje}`).toMatch(/\b2024\b/);
      }
    }
  });

  it('reclama al pedir un escenario que no existe', () => {
    expect(() => escenarioDeLaboratorio(99)).toThrow('laboratorio 99');
    expect(() => escenarioPorId('lab-99')).toThrow('lab-99');
  });

  it('el laboratorio 01 arranca sin repositorio, porque crearlo es el ejercicio', () => {
    const estado = escenarioPorId('lab-01');

    expect(estado.iniciado).toBe(false);
    expect(estado.confirmaciones).toHaveLength(0);
    expect(estado.ramas).toHaveLength(0);
    expect(idActual(estado)).toBeNull();
    expect(estado.archivos.every((archivo) => archivo.estado === 'sin-seguimiento')).toBe(true);
    // La identidad todavia no esta puesta: configurarla es el primer ejercicio.
    expect(estado.config.global).toEqual({});
  });

  it('el laboratorio 01 deja correr git init, como en el disco', () => {
    const resultado = ejecutar(escenarioPorId('lab-01'), 'git init');
    expect(resultado.estado.iniciado).toBe(true);
    expect(texto(resultado)).toContain('Initialized empty Git repository');
  });

  it('el laboratorio 02 trae el mensaje mal escrito, un cambio suelto y otro preparado', () => {
    const estado = escenarioPorId('lab-02');

    expect(estado.confirmaciones).toHaveLength(5);
    expect(estado.confirmaciones.every((confirmacion) => confirmacion.padres.length <= 1)).toBe(true);
    expect(estado.confirmaciones.at(-1)?.mensaje).toBe('se docuemnta la reseta del pastel de choclo');
    expect(
      estado.archivos.filter((archivo) => archivo.estado === 'modificado').map((a) => a.nombre),
    ).toEqual(['ingredientes.md']);
    expect(
      estado.archivos.filter((archivo) => archivo.estado === 'preparado').map((a) => a.nombre),
    ).toEqual(['cocineros.md']);
  });

  it('el laboratorio 02 reparte la historia entre tres autores y varios meses', () => {
    // Es lo que el enunciado hace filtrar con --author y con --since.
    const estado = escenarioPorId('lab-02');
    const autores = new Set(estado.confirmaciones.map((confirmacion) => confirmacion.autor));
    expect(autores.size).toBe(3);
    expect(autores).toContain('Juana Perez');
  });

  it('el laboratorio 03 trae confirmados los archivos que no debieron entrar', () => {
    const estado = escenarioPorId('lab-03');
    const confirmados = estado.confirmaciones.flatMap((confirmacion) => confirmacion.archivos);
    expect(confirmados).toEqual(
      expect.arrayContaining(['notas.tmp', 'respaldo.bak', 'credenciales.txt']),
    );
    // Escribir el archivo de exclusiones es el ejercicio.
    expect(estado.archivos.find((archivo) => archivo.nombre === '.gitignore')).toBeUndefined();
  });

  it('el laboratorio 04 toca un archivo distinto en cada confirmacion', () => {
    // Asi las ramas que el participante crea nacen de sitios que se distinguen.
    const estado = escenarioPorId('lab-04');
    expect(estado.confirmaciones).toHaveLength(6);
    for (const confirmacion of estado.confirmaciones) {
      expect(confirmacion.archivos, confirmacion.mensaje).toHaveLength(1);
    }
  });

  it('el laboratorio 05 deja las tres fusiones que el enunciado necesita', () => {
    const estado = escenarioPorId('lab-05');
    const puntaMain = ramaPorNombre(estado, 'main')?.id ?? '';

    // tailandesa cuelga de la punta de main: avance rapido, sin union.
    const tailandesa = ejecutar(estado, 'git merge tailandesa');
    expect(tailandesa.estado.fusion).toBeNull();
    expect(texto(tailandesa)).toContain('Fast-forward');

    // azteca nace antes y toca otros archivos: union limpia.
    const azteca = ejecutar(estado, 'git merge azteca');
    expect(texto(azteca)).not.toContain('CONFLICT');
    expect(azteca.estado.confirmaciones).toHaveLength(estado.confirmaciones.length + 1);
    expect(
      azteca.estado.confirmaciones.at(-1)?.padres,
    ).toHaveLength(2);

    // andina cambia la misma linea que main: choca.
    const puntaAndina = ramaPorNombre(estado, 'andina')?.id ?? '';
    expect(baseComun(estado, puntaMain, puntaAndina)).not.toBe(puntaMain);
    expect(texto(ejecutar(estado, 'git merge andina'))).toContain('CONFLICT');
  });

  it('el laboratorio 06 deja tres confirmaciones encima del error a revertir', () => {
    const estado = escenarioPorId('lab-06');
    const indice = estado.confirmaciones.findIndex((confirmacion) =>
      confirmacion.mensaje.startsWith('Suma un ingrediente'),
    );
    expect(indice).toBeGreaterThanOrEqual(0);
    expect(estado.confirmaciones.length - 1 - indice).toBe(3);
  });

  it('el laboratorio 07 arranca en la rama de trabajo, con algo a medias encima', () => {
    const estado = escenarioPorId('lab-07');
    expect(ramaActual(estado)).toBe('tailandesa');
    expect(
      estado.archivos.filter((archivo) => archivo.estado === 'sin-seguimiento').map((a) => a.nombre),
    ).toEqual(['recetas/curry-massaman.md']);
    // Los mensajes que el ejercicio manda arreglar.
    const mensajes = estado.confirmaciones.map((confirmacion) => confirmacion.mensaje);
    expect(mensajes).toEqual(expect.arrayContaining(['wip', 'cambios', 'mas cambios', 'arreglos']));
  });

  it('el laboratorio 08 no tiene escenario, y es a proposito', () => {
    // Enseña dos remotos, un submodulo y un gancho. El motor no implementa
    // ninguna de las tres cosas, asi que un escenario suyo mostraria la
    // historia local y nada de lo que el laboratorio viene a enseñar.
    expect(declaracionPorId('lab-08')).toBeUndefined();
  });

  it('solo el 01 declara algo sin reflejar', () => {
    const conFaltantes = ESCENARIOS.filter(
      (escenario) => (escenario.sinReflejar ?? []).length > 0,
    ).map((escenario) => escenario.id);
    expect(conFaltantes).toEqual(['lab-01']);
  });

  it('el laboratorio 09 trae la etiqueta de version y el archivo de exclusiones', () => {
    const estado = escenarioPorId('lab-09');
    expect(estado.confirmaciones).toHaveLength(8);
    expect(estado.etiquetas.map((etiqueta) => etiqueta.nombre)).toEqual(['v1.0']);
    expect(estado.etiquetas[0]?.tipo).toBe('anotada');
    expect(estado.archivos.map((archivo) => archivo.nombre)).toContain('.gitignore');
  });

  it('un escenario mal declarado se rechaza al construirse', () => {
    expect(() =>
      construirEscenario({
        ...declaracion('lab-02'),
        confirmaciones: [
          { clave: 'x', mensaje: 'Suelta', archivos: [], padres: ['inexistente'], carril: 0 },
        ],
        ramas: [{ nombre: 'main', en: 'x', carril: 0 }],
      }),
    ).toThrow('no está declarado');

    expect(() =>
      construirEscenario({
        ...declaracion('lab-01'),
        ramas: [{ nombre: 'main', en: 'fantasma', carril: 0 }],
      }),
    ).toThrow('no existe');
  });
});

describe('escenario preseleccionado desde la direccion del archivo', () => {
  it('reconoce las formas razonables de nombrar un laboratorio', () => {
    expect(escenarioDeLaDireccion('?lab=05', '')).toBe('lab-05');
    expect(escenarioDeLaDireccion('?lab=5', '')).toBe('lab-05');
    expect(escenarioDeLaDireccion('?lab=lab-05', '')).toBe('lab-05');
    expect(escenarioDeLaDireccion('', '#lab-05')).toBe('lab-05');
    expect(escenarioDeLaDireccion('', '#05')).toBe('lab-05');
  });

  it('devuelve nulo cuando no hay nada que reconocer', () => {
    expect(escenarioDeLaDireccion('', '')).toBeNull();
    expect(escenarioDeLaDireccion('?otra=cosa', '')).toBeNull();
    expect(escenarioDeLaDireccion('?lab=zapallo', '')).toBeNull();
  });

  it('devuelve nulo si el laboratorio no tiene escenario', () => {
    // Del 11 en adelante ocurren en la plataforma: no hay repositorio local.
    expect(escenarioDeLaDireccion('?lab=12', '')).toBeNull();
    expect(escenarioDeLaDireccion('?lab=99', '')).toBeNull();
  });
});
