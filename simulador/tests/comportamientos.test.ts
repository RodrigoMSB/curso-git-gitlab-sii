/**
 * Una prueba por cada punto de la seccion 8 del SPEC 001.
 *
 * Estos comportamientos son el nucleo pedagogico del simulador: si alguno
 * falla, la implementacion es incorrecta aunque todo lo demas pase.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { idActual, ramaActual, ramaPorNombre, confirmacionPorId } from '../src/core/estado';
import { antepasados, huerfanas } from '../src/core/grafo';
import { correr, correrHasta, ids, repoConRamaDeTrabajo, repoConRamas, repoLineal, texto } from './ayudas';

describe('seccion 8 del SPEC 001, comportamientos que el motor debe respetar', () => {
  it('8.1 crear una rama no mueve nada: solo agrega un nombre sobre la confirmacion actual', () => {
    const antes = repoConRamas();
    const resultado = ejecutar(antes, 'git branch chilena');
    const despues = resultado.estado;

    expect(despues.puntero).toEqual(antes.puntero);
    expect(idActual(despues)).toBe(idActual(antes));
    expect(despues.confirmaciones).toEqual(antes.confirmaciones);
    expect(ramaPorNombre(despues, 'chilena')?.id).toBe(idActual(antes));
    expect(ramaPorNombre(despues, 'main')?.id).toBe(ramaPorNombre(antes, 'main')?.id);
  });

  it('8.2 cambiar de rama mueve unicamente el puntero de posicion: ninguna confirmacion cambia', () => {
    const antes = repoConRamas();
    const despues = ejecutar(antes, 'git switch andina').estado;

    expect(ramaActual(antes)).toBe('main');
    expect(ramaActual(despues)).toBe('andina');
    expect(despues.confirmaciones).toEqual(antes.confirmaciones);
    expect(despues.ramas).toEqual(antes.ramas);
    expect(idActual(despues)).toBe(ramaPorNombre(antes, 'andina')?.id);
  });

  it('8.3 la fusion informa que no hay nada que hacer cuando la otra rama ya esta contenida', () => {
    const partida = correr(repoConRamas(), 'git branch chilena');
    const resultado = ejecutar(partida, 'git merge chilena');

    expect(texto(resultado)).toContain('Already up to date.');
    expect(resultado.estado.confirmaciones).toHaveLength(partida.confirmaciones.length);
    expect(idActual(resultado.estado)).toBe(idActual(partida));
  });

  it('8.3 la fusion avanza el puntero sin crear confirmacion cuando la actual esta contenida en la otra', () => {
    const partida = correr(
      repoConRamas(),
      'git switch -c chilena',
      'echo "* Tacos" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma los tacos"',
      'git switch main',
    );
    const resultado = ejecutar(partida, 'git merge chilena');

    expect(texto(resultado)).toContain('Fast-forward');
    expect(resultado.estado.confirmaciones).toHaveLength(partida.confirmaciones.length);
    expect(ramaPorNombre(resultado.estado, 'main')?.id).toBe(
      ramaPorNombre(partida, 'chilena')?.id,
    );
  });

  it('8.3 la fusion crea una confirmacion con dos padres cuando las historias divergen', () => {
    // andina toca la misma linea que main, asi que hay que resolver antes de
    // que la union exista.
    const partida = repoConRamas();
    const resultado = correrHasta(
      partida,
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );
    const union = confirmacionPorId(resultado.estado, idActual(resultado.estado) ?? '');

    expect(resultado.estado.confirmaciones).toHaveLength(partida.confirmaciones.length + 1);
    expect(union?.padres).toHaveLength(2);
    expect(union?.padres[0]).toBe(idActual(partida));
    expect(union?.padres[1]).toBe(ramaPorNombre(partida, 'andina')?.id);
  });

  it('8.4 el rebase produce confirmaciones nuevas y deja las originales en el modelo', () => {
    // El laboratorio 08 es el que tiene una rama de trabajo con varias
    // confirmaciones propias, que es lo que el rebase reescribe.
    const partida = repoConRamaDeTrabajo();
    const originales = [...antepasados(partida, ramaPorNombre(partida, 'tailandesa')?.id ?? '')];
    const antesDeLaBase = new Set(antepasados(partida, ramaPorNombre(partida, 'main')?.id ?? ''));
    const reescritas = originales.filter((id) => !antesDeLaBase.has(id));

    const despues = ejecutar(partida, 'git rebase main').estado;
    const resultantes = antepasados(despues, ramaPorNombre(despues, 'tailandesa')?.id ?? '');

    expect(reescritas).toHaveLength(4);
    for (const original of reescritas) {
      expect(resultantes.has(original)).toBe(false);
      expect(confirmacionPorId(despues, original)).toBeDefined();
    }
    const idsHuerfanas = huerfanas(despues).map((confirmacion) => confirmacion.id);
    expect(idsHuerfanas).toEqual(expect.arrayContaining(reescritas));
  });

  it('8.5 el retroceso destructivo mueve el puntero pero no destruye confirmaciones', () => {
    const partida = repoLineal();
    const descartadas = partida.confirmaciones.slice(-2).map((confirmacion) => confirmacion.id);

    const despues = ejecutar(partida, 'git reset --hard HEAD~2').estado;

    expect(despues.confirmaciones).toHaveLength(partida.confirmaciones.length);
    for (const id of descartadas) {
      expect(confirmacionPorId(despues, id)).toBeDefined();
    }
    expect(huerfanas(despues).map((confirmacion) => confirmacion.id)).toEqual(
      expect.arrayContaining(descartadas),
    );
    // El registro de referencias conserva la posicion anterior, que es lo que
    // permite recuperarlas.
    const registro = texto(ejecutar(despues, 'git reflog'));
    expect(registro).toContain(descartadas[1] ?? '');
  });

  it('8.6 el guardado temporal se comporta como pila: lo mas reciente va al indice cero', () => {
    const partida = correr(
      repoLineal(),
      'git stash push -m "primero"',
      'echo "* Curanto" >> ingredientes.md',
      'git stash push -m "segundo"',
    );

    expect(partida.guardados).toHaveLength(2);
    expect(partida.guardados[0]?.mensaje).toContain('segundo');
    expect(partida.guardados[1]?.mensaje).toContain('primero');

    const despues = ejecutar(partida, 'git stash pop').estado;
    expect(despues.guardados).toHaveLength(1);
    expect(despues.guardados[0]?.mensaje).toContain('primero');
  });

  it('8.7 la reversion no reescribe historia: crea una confirmacion nueva y conserva la original', () => {
    const partida = repoLineal();
    const revertida = idActual(partida) ?? '';

    const resultado = ejecutar(partida, 'git revert HEAD');
    const despues = resultado.estado;
    const nueva = confirmacionPorId(despues, idActual(despues) ?? '');

    expect(despues.confirmaciones).toHaveLength(partida.confirmaciones.length + 1);
    expect(confirmacionPorId(despues, revertida)).toBeDefined();
    expect(nueva?.padres).toEqual([revertida]);
    expect(nueva?.mensaje).toBe('Revert "se docuemnta la reseta del pastel de choclo"');
    expect(huerfanas(despues)).toHaveLength(0);
  });
});

describe('secuencias completas exigidas por los criterios de aceptacion', () => {
  it('CA5: rama nueva, confirmacion y fusion terminan en avance de puntero sin union', () => {
    const partida = repoConRamas();
    const resultado = correrHasta(
      partida,
      'git branch tailandesa',
      'git switch tailandesa',
      'echo "* Tacos al pastor" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma los tacos al recetario"',
      'git switch main',
      'git merge tailandesa',
    );
    const final = resultado.estado;

    expect(texto(resultado)).toContain('Fast-forward');
    // Una sola confirmacion nueva, la del participante: la fusion no creo union.
    expect(final.confirmaciones).toHaveLength(partida.confirmaciones.length + 1);
    const puntaMain = ramaPorNombre(final, 'main')?.id ?? '';
    expect(puntaMain).toBe(ramaPorNombre(final, 'tailandesa')?.id);
    expect(confirmacionPorId(final, puntaMain)?.padres).toHaveLength(1);
    expect(ramaActual(final)).toBe('main');
    expect(final.archivos.find((archivo) => archivo.nombre === 'platos.md')?.estado).toBe(
      'limpio',
    );
  });

  it('CA6: el rebase no reutiliza ningun identificador original y los conserva', () => {
    const partida = repoConRamaDeTrabajo();
    const idsOriginales = ids(partida);
    const puntaOriginal = ramaPorNombre(partida, 'tailandesa')?.id ?? '';
    const base = ramaPorNombre(partida, 'main')?.id ?? '';
    const reescritas = [...antepasados(partida, puntaOriginal)].filter(
      (id) => !antepasados(partida, base).has(id),
    );

    const despues = ejecutar(partida, 'git rebase main').estado;
    const resultante = [...antepasados(despues, ramaPorNombre(despues, 'tailandesa')?.id ?? '')];

    for (const original of reescritas) {
      expect(resultante).not.toContain(original);
    }
    for (const original of idsOriginales) {
      expect(ids(despues)).toContain(original);
    }
    expect(resultante).toContain(base);
    expect(despues.confirmaciones).toHaveLength(idsOriginales.length + reescritas.length);
  });
});
