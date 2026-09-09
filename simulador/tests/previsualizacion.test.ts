/**
 * Previsualizacion: seccion 9 y criterio CA7 del SPEC 001.
 */

import { describe, expect, it } from 'vitest';
import { previsualizar } from '../src/core/motor';
import { idActual, ramaPorNombre } from '../src/core/estado';
import { correr, repoConRamaDeTrabajo, repoConRamas, repoLineal } from './ayudas';

describe('previsualizacion de ordenes', () => {
  it('CA7 la previsualizacion de git merge sobre el laboratorio 06 anuncia exactamente una confirmacion nueva', () => {
    const partida = repoConRamas();
    const copia = structuredClone(partida);

    const vista = previsualizar(partida, 'git merge peruana');

    expect(vista.confirmacionesNuevas).toHaveLength(1);
    expect(partida).toEqual(copia);
  });

  it('CA7 la previsualizacion no altera el estado de entrada aunque la orden confirme', () => {
    const partida = correr(repoLineal(), 'git add platos.md');
    const copia = structuredClone(partida);

    previsualizar(partida, 'git commit -m "Corrige la lista de platos"');

    expect(partida).toEqual(copia);
    expect(partida.confirmaciones).toHaveLength(copia.confirmaciones.length);
  });

  it('anuncia la confirmacion nueva y el movimiento del puntero al confirmar', () => {
    const partida = correr(repoLineal(), 'git add platos.md');
    const vista = previsualizar(partida, 'git commit -m "Corrige la lista de platos"');

    expect(vista.confirmacionesNuevas).toHaveLength(1);
    expect(vista.punteroMovido).toBe(true);
    expect(idActual(vista.estadoResultante)).toBe(vista.confirmacionesNuevas[0]);
  });

  it('no anuncia confirmaciones al crear una rama, y avisa que el puntero no se mueve', () => {
    const vista = previsualizar(repoConRamas(), 'git branch peruana');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(false);
    expect(ramaPorNombre(vista.estadoResultante, 'peruana')).toBeDefined();
  });

  it('avisa que el puntero se mueve al cambiar de rama, sin confirmaciones nuevas', () => {
    const vista = previsualizar(repoConRamas(), 'git switch mexicana');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(true);
  });

  it('anuncia las dos confirmaciones que el rebase va a crear', () => {
    const partida = repoConRamaDeTrabajo();
    const vista = previsualizar(partida, 'git rebase main');

    expect(vista.confirmacionesNuevas).toHaveLength(4);
    expect(vista.punteroMovido).toBe(true);
  });

  it('no anuncia nada ante una fusion que ya esta al dia', () => {
    const partida = correr(repoConRamas(), 'git branch chilena');
    const vista = previsualizar(partida, 'git merge chilena');

    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.punteroMovido).toBe(false);
  });

  it('traslada el fallo de una orden invalida sin proponer cambios', () => {
    const partida = repoConRamas();
    const vista = previsualizar(partida, 'git merge inexistente');

    expect(vista.error).toBe(true);
    expect(vista.confirmacionesNuevas).toHaveLength(0);
    expect(vista.estadoResultante).toEqual(partida);
  });

  it('la fusion con conflicto del laboratorio 06 se materializa en la union que anuncio la previsualizacion', () => {
    const partida = repoConRamas();
    const anunciada = previsualizar(partida, 'git merge peruana').confirmacionesNuevas[0];

    const final = correr(
      partida,
      'git merge peruana',
      'git add platos.md',
      'git commit -m "Fusiona la rama peruana"',
    );

    expect(idActual(final)).toBe(anunciada);
    expect(final.fusion).toBeNull();
  });
});
