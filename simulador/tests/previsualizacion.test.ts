/**
 * Previsualizacion: seccion 9 y criterio CA7 del SPEC 001.
 */

import { describe, expect, it } from 'vitest';
import { previsualizar } from '../src/core/motor';
import { idActual, ramaPorNombre } from '../src/core/estado';
import { escenarioPorId } from '../src/escenarios';
import { correr } from './ayudas';

describe('previsualizacion de ordenes', () => {
  it('CA7 la previsualizacion de git merge sobre E4 anuncia exactamente una confirmacion nueva', () => {
    const partida = escenarioPorId('E4');
    const copia = structuredClone(partida);

    const vista = previsualizar(partida, 'git merge tailandesa');

    expect(vista.confirmacionesNuevas).toHaveLength(1);
    expect(partida).toEqual(copia);
  });

  it('CA7 la previsualizacion no altera el estado de entrada aunque la orden confirme', () => {
    const partida = correr(escenarioPorId('E2'), 'git add platos.md');
    const copia = structuredClone(partida);

    previsualizar(partida, 'git commit -m "Corrige la lista de platos"');

    expect(partida).toEqual(copia);
    expect(partida.confirmaciones).toHaveLength(copia.confirmaciones.length);
  });

  it('anuncia la confirmacion nueva y el movimiento del puntero al confirmar', () => {
    const partida = correr(escenarioPorId('E2'), 'git add platos.md');
    const vista = previsualizar(partida, 'git commit -m "Corrige la lista de platos"');

    expect(vista.confirmacionesNuevas).toHaveLength(1);
    expect(vista.punteroMovido).toBe(true);
    expect(idActual(vista.estadoResultante)).toBe(vista.confirmacionesNuevas[0]);
  });

  it('no anuncia confirmaciones al crear una rama, y avisa que el puntero no se mueve', () => {
    const vista = previsualizar(escenarioPorId('E3'), 'git branch peruana');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(false);
    expect(ramaPorNombre(vista.estadoResultante, 'peruana')).toBeDefined();
  });

  it('avisa que el puntero se mueve al cambiar de rama, sin confirmaciones nuevas', () => {
    const vista = previsualizar(escenarioPorId('E3'), 'git switch tailandesa');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(true);
  });

  it('anuncia las dos confirmaciones que el rebase va a crear', () => {
    const partida = correr(escenarioPorId('E3'), 'git switch tailandesa');
    const vista = previsualizar(partida, 'git rebase main');

    expect(vista.confirmacionesNuevas).toHaveLength(2);
    expect(vista.punteroMovido).toBe(true);
  });

  it('no anuncia nada ante una fusion que ya esta al dia', () => {
    const partida = correr(escenarioPorId('E3'), 'git branch mexicana');
    const vista = previsualizar(partida, 'git merge mexicana');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(false);
  });

  it('traslada el fallo de una orden invalida sin proponer cambios', () => {
    const partida = escenarioPorId('E3');
    const vista = previsualizar(partida, 'git merge inexistente');

    expect(vista.error).toBe(true);
    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.estadoResultante).toEqual(partida);
  });

  it('la fusion con conflicto de E4 se materializa en la union que anuncio la previsualizacion', () => {
    const partida = escenarioPorId('E4');
    const anunciada = previsualizar(partida, 'git merge tailandesa').confirmacionesNuevas[0];

    const final = correr(
      partida,
      'git merge tailandesa',
      'git add platos.md',
      'git commit -m "Fusiona la rama tailandesa"',
    );

    expect(idActual(final)).toBe(anunciada);
    expect(final.fusion).toBeNull();
  });
});
