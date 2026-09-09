/**
 * El escenario del simulador contra el repositorio del disco (SPEC 007).
 *
 * Un laboratorio tiene un escenario y ese escenario se declara una sola vez.
 * De esa declaracion salen dos cosas: el estado inicial que carga el simulador
 * y el repositorio que `preparar.sh` arma en la maquina del participante. Si
 * se separan, el participante ve dos repositorios distintos a la vez y no
 * entiende por que.
 *
 * `preparar.sh` se escribe a mano y no se genera. Estas pruebas son lo que
 * impide que las dos caras se separen: comparan la forma, confirmacion por
 * confirmacion. La razon de haber elegido ese camino esta en la seccion 23 de
 * docs/arquitectura.md.
 *
 * **Los identificadores no se comparan**, y no tienen por que coincidir: el
 * simulador genera los suyos con una huella propia. Lo que tiene que coincidir
 * es todo lo demas.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { construirEscenario, ESCENARIOS } from '../src/escenarios';
import type { EscenarioDeclarado } from '../src/escenarios';
import type { EstadoArchivo, EstadoRepositorio } from '../src/core/tipos';
import { type Escenario, git, montarLab, preparar } from './laboratorios-en-disco';

const LABS = fileURLToPath(new URL('../../labs', import.meta.url));

/** Los laboratorios que ya tienen `preparar.sh` en el repositorio. */
function tienePreparacion(declaracion: EscenarioDeclarado): boolean {
  const numero = String(declaracion.laboratorio).padStart(2, '0');
  return existsSync(join(LABS, `lab-${numero}`, 'preparar.sh'));
}

const CON_PREPARACION = ESCENARIOS.filter(tienePreparacion);
const SIN_PREPARACION = ESCENARIOS.filter((declaracion) => !tienePreparacion(declaracion));

/** La forma de un repositorio, en lo que las dos caras pueden compartir. */
interface Forma {
  readonly mensajes: readonly string[];
  readonly autores: readonly string[];
  readonly fechas: readonly string[];
  readonly archivosPorConfirmacion: readonly string[];
  readonly ramas: readonly string[];
  readonly posicion: string;
  readonly etiquetas: readonly string[];
  readonly archivos: readonly string[];
}

/**
 * Traduce los codigos de dos columnas de `git status --porcelain` al
 * vocabulario del simulador. Es la unica traduccion del asunto: comparar los
 * codigos crudos obligaria a que la declaracion supiera si un archivo estaba
 * seguido de antes, que es justo lo que no le corresponde saber.
 */
function estadoDe(codigo: string): EstadoArchivo {
  if (codigo === '??') return 'sin-seguimiento';
  if (codigo === 'UU' || codigo === 'AA' || codigo === 'DD') return 'en-conflicto';
  const indice = codigo[0] ?? ' ';
  const trabajo = codigo[1] ?? ' ';
  if (indice !== ' ' && indice !== '?') return 'preparado';
  if (trabajo !== ' ') return 'modificado';
  return 'limpio';
}

/** La forma del repositorio que `preparar.sh` dejo en el disco. */
function formaDelDisco(esc: Escenario): Forma {
  const g = (...argumentos: readonly string[]): string =>
    git(esc.recetario, esc.configGlobal, ...argumentos);
  const lineas = (salida: string): readonly string[] =>
    salida === '' ? [] : salida.split('\n');

  const identificadores = lineas(g('log', '--format=%H', '--reverse'));
  const archivosPorConfirmacion = identificadores.map((id) =>
    [...lineas(g('show', '--name-only', '--format=', id))].sort().join(','),
  );

  const seguidos = lineas(g('ls-files'));
  const sucios = new Map<string, EstadoArchivo>();
  for (const linea of lineas(g('status', '--porcelain'))) {
    sucios.set(linea.slice(3), estadoDe(linea.slice(0, 2)));
  }
  const nombres = new Set([...seguidos, ...sucios.keys()]);
  const archivos = [...nombres]
    .map((nombre) => `${nombre}:${sucios.get(nombre) ?? 'limpio'}`)
    .sort();

  const ramas = [...lineas(g('for-each-ref', '--format=%(refname:short)', 'refs/heads'))].map(
    (rama) => `${rama}->${g('log', '-1', '--format=%s', rama)}`,
  );
  const etiquetas = [...lineas(g('tag'))].map(
    (etiqueta) => `${etiqueta}->${g('log', '-1', '--format=%s', etiqueta)}`,
  );

  return {
    mensajes: lineas(g('log', '--format=%s', '--reverse')),
    autores: lineas(g('log', '--format=%an', '--reverse')),
    fechas: lineas(g('log', '--format=%at', '--reverse')),
    archivosPorConfirmacion,
    ramas: ramas.sort(),
    posicion: g('branch', '--show-current'),
    etiquetas: etiquetas.sort(),
    archivos,
  };
}

/** La forma del escenario tal como lo carga el simulador. */
function formaDeclarada(declaracion: EscenarioDeclarado): Forma {
  const estado: EstadoRepositorio = construirEscenario(declaracion);
  const mensajePorClave = new Map(
    declaracion.confirmaciones.map((confirmacion) => [confirmacion.clave, confirmacion.mensaje]),
  );

  return {
    mensajes: estado.confirmaciones.map((confirmacion) => confirmacion.mensaje),
    autores: estado.confirmaciones.map((confirmacion) => confirmacion.autor),
    fechas: declaracion.confirmaciones.map((confirmacion) => String(confirmacion.epoca ?? '')),
    archivosPorConfirmacion: declaracion.confirmaciones.map((confirmacion) =>
      [...confirmacion.archivos].sort().join(','),
    ),
    ramas: declaracion.ramas
      .map((rama) => `${rama.nombre}->${mensajePorClave.get(rama.en) ?? '?'}`)
      .sort(),
    posicion: declaracion.posicion,
    etiquetas: declaracion.etiquetas
      .map((etiqueta) => `${etiqueta.nombre}->${mensajePorClave.get(etiqueta.en) ?? '?'}`)
      .sort(),
    archivos: declaracion.archivos
      .map((archivo) => `${archivo.nombre}:${archivo.estado}`)
      .sort(),
  };
}

describe('CA2 · el escenario del simulador es el repositorio que el participante tiene delante', () => {
  for (const declaracion of CON_PREPARACION) {
    describe(`${declaracion.id} · ${declaracion.titulo}`, () => {
      const numero = String(declaracion.laboratorio).padStart(2, '0');
      const esc = montarLab(numero);
      const corrida = preparar(esc);
      const disco = formaDelDisco(esc);
      const declarada = formaDeclarada(declaracion);

      it('la preparacion corre bien', () => {
        expect(corrida.codigo, corrida.salida).toBe(0);
      });

      it('las mismas confirmaciones, con los mismos mensajes y en el mismo orden', () => {
        expect(disco.mensajes).toEqual(declarada.mensajes);
      });

      it('los mismos autores', () => {
        expect(disco.autores).toEqual(declarada.autores);
      });

      it('las mismas fechas', () => {
        // La declaracion las lleva en segundos desde la epoca, que es la misma
        // unidad que `preparar.sh` le pasa a Git.
        expect(disco.fechas).toEqual(declarada.fechas);
      });

      it('cada confirmacion registra los mismos archivos', () => {
        expect(disco.archivosPorConfirmacion).toEqual(declarada.archivosPorConfirmacion);
      });

      it('las mismas ramas, apuntando a la misma confirmacion', () => {
        expect(disco.ramas).toEqual(declarada.ramas);
      });

      it('el mismo puntero de posicion', () => {
        expect(disco.posicion).toEqual(declarada.posicion);
      });

      it('las mismas etiquetas', () => {
        expect(disco.etiquetas).toEqual(declarada.etiquetas);
      });

      it('el mismo estado de cada archivo del directorio de trabajo', () => {
        expect(disco.archivos).toEqual(declarada.archivos);
      });
    });
  }
});

describe('CA3 · la comparacion detecta de verdad una declaracion que se separo del disco', () => {
  // Una prueba que nunca se vio fallar no prueba nada. Se altera la
  // declaracion sin tocar el script y se comprueba que la comparacion lo nota.
  const declaracion = CON_PREPARACION[0];
  if (declaracion === undefined) throw new Error('no hay ningun laboratorio con preparacion');

  const numero = String(declaracion.laboratorio).padStart(2, '0');
  const esc = montarLab(numero);
  preparar(esc);
  const disco = formaDelDisco(esc);

  it('nota un mensaje cambiado en la declaracion', () => {
    const alterada = formaDeclarada({
      ...declaracion,
      confirmaciones: declaracion.confirmaciones.map((confirmacion, indice) =>
        indice === 0 ? { ...confirmacion, mensaje: 'otro mensaje cualquiera' } : confirmacion,
      ),
    });
    expect(alterada.mensajes).not.toEqual(disco.mensajes);
  });

  it('nota una confirmacion de mas en la declaracion', () => {
    const primera = declaracion.confirmaciones[0];
    if (primera === undefined) throw new Error('escenario sin confirmaciones');
    const alterada = formaDeclarada({
      ...declaracion,
      confirmaciones: [
        ...declaracion.confirmaciones,
        { ...primera, clave: 'extra', mensaje: 'una de mas', padres: ['c1'] },
      ],
    });
    expect(alterada.mensajes).not.toEqual(disco.mensajes);
  });

  it('nota un autor cambiado en la declaracion', () => {
    const alterada = formaDeclarada({
      ...declaracion,
      confirmaciones: declaracion.confirmaciones.map((confirmacion, indice) =>
        indice === 0 ? { ...confirmacion, autor: 'Otra Persona' } : confirmacion,
      ),
    });
    expect(alterada.autores).not.toEqual(disco.autores);
  });

  it('nota una fecha cambiada en la declaracion', () => {
    const alterada = formaDeclarada({
      ...declaracion,
      confirmaciones: declaracion.confirmaciones.map((confirmacion, indice) =>
        indice === 0 ? { ...confirmacion, epoca: 1_700_000_000 } : confirmacion,
      ),
    });
    expect(alterada.fechas).not.toEqual(disco.fechas);
  });

  it('nota un archivo con otro estado en la declaracion', () => {
    const alterada = formaDeclarada({
      ...declaracion,
      archivos: declaracion.archivos.map((archivo, indice) =>
        indice === 0 ? { ...archivo, estado: 'sin-seguimiento' as const } : archivo,
      ),
    });
    expect(alterada.archivos).not.toEqual(disco.archivos);
  });

  it('nota una rama que apunta a otra confirmacion', () => {
    const primera = declaracion.confirmaciones[0];
    if (primera === undefined) throw new Error('escenario sin confirmaciones');
    const alterada = formaDeclarada({
      ...declaracion,
      ramas: declaracion.ramas.map((rama) => ({ ...rama, en: primera.clave })),
    });
    expect(alterada.ramas).not.toEqual(disco.ramas);
  });
});

describe('los escenarios que todavia no tienen preparacion en el disco', () => {
  it('estan declarados y a la espera del laboratorio', () => {
    // Cuando cada uno de estos laboratorios se arme, su `preparar.sh` entra
    // solo a la comparacion de arriba y tiene que calzar con lo declarado.
    expect(SIN_PREPARACION.map((declaracion) => declaracion.id)).toEqual([
      'lab-01',
      'lab-04',
      'lab-05',
      'lab-06',
      'lab-07',
      'lab-08',
      'lab-09',
      'lab-10',
    ]);
  });

  it('los que si la tienen estan comparados', () => {
    expect(CON_PREPARACION.map((declaracion) => declaracion.id)).toEqual(['lab-02', 'lab-03']);
  });
});
