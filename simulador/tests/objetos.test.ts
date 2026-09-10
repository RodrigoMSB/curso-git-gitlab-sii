/**
 * Agregados al motor que autoriza la seccion 9 del SPEC 002.
 */

import { describe, expect, it } from 'vitest';
import { cadenaDeObjetos } from '../src/core/objetos';
import { huerfanas } from '../src/core/grafo';
import { ejecutar } from '../src/core/motor';
import { correr, repoConRamas, repoLineal } from './ayudas';

describe('9.1 · confirmaciones huerfanas del estado actual', () => {
  it('el motor las expone para que la vista las atenue sin calcularlo', () => {
    const partida = repoLineal();
    const abandonada = partida.confirmaciones.at(-1)?.id;

    expect(huerfanas(partida)).toHaveLength(0);

    const despues = correr(partida, 'git reset --hard HEAD~1');
    expect(huerfanas(despues).map((confirmacion) => confirmacion.id)).toEqual([abandonada]);
  });
});

describe('9.2 · cadena de objetos de una confirmacion', () => {
  it('devuelve la confirmacion, su arbol y un elemento por archivo', () => {
    const estado = repoLineal();
    const id = estado.confirmaciones[3]?.id ?? '';
    const cadena = cadenaDeObjetos(estado, id);

    expect(cadena?.confirmacion.tipo).toBe('confirmacion');
    expect(cadena?.confirmacion.id).toBe(id);
    expect(cadena?.arbol.tipo).toBe('arbol');
    expect(cadena?.elementos).toHaveLength(1);
    expect(cadena?.elementos[0]?.nombre).toBe('cocineros.md');
  });

  it('la confirmacion apunta a su arbol y el arbol a sus elementos', () => {
    const estado = repoLineal();
    const cadena = cadenaDeObjetos(estado, estado.confirmaciones[3]?.id ?? '');

    const enlaceArbol = cadena?.confirmacion.campos.find((campo) => campo.clave === 'tree');
    expect(enlaceArbol?.valor).toBe(cadena?.arbol.id);
    expect(cadena?.arbol.campos[0]?.valor).toBe(cadena?.elementos[0]?.id);
  });

  it('registra los padres de una confirmacion de union', () => {
    const estado = correr(
      repoConRamas(),
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );
    const cadena = cadenaDeObjetos(estado, estado.confirmaciones.at(-1)?.id ?? '');
    const padres = cadena?.confirmacion.campos.filter((campo) => campo.clave === 'parent');

    expect(padres).toHaveLength(2);
  });

  it('los identificadores son deterministas y distintos entre objetos', () => {
    const estado = repoLineal();
    const id = estado.confirmaciones[1]?.id ?? '';
    const primera = cadenaDeObjetos(estado, id);
    const segunda = cadenaDeObjetos(repoLineal(), id);

    expect(primera).toEqual(segunda);
    expect(primera?.arbol.id).not.toBe(primera?.confirmacion.id);
    expect(primera?.elementos[0]?.id).not.toBe(primera?.arbol.id);
    expect(primera?.arbol.id).toMatch(/^[0-9a-f]{7}$/);
  });

  it('devuelve nulo si el identificador no corresponde a ninguna confirmacion', () => {
    expect(cadenaDeObjetos(repoLineal(), 'fantasma')).toBeNull();
  });
});

describe('9.3 · abortar la fusion libera el identificador reservado', () => {
  it('el estado vuelve a ser exactamente el de antes de la fusion', () => {
    const partida = repoConRamas();
    const despues = correr(partida, 'git merge andina', 'git merge --abort');

    // Igualdad completa: si el identificador siguiera reservado, la fusion
    // quedaria en el estado y esta comparacion fallaria.
    expect(despues).toEqual(partida);
    expect(despues.fusion).toBeNull();
  });

  it('tras abortar, volver a fusionar reserva otra vez el mismo identificador', () => {
    const partida = repoConRamas();
    const primera = ejecutar(partida, 'git merge andina');
    const reservadoAntes = primera.estado.fusion?.idPrevisto;

    const segunda = ejecutar(ejecutar(primera.estado, 'git merge --abort').estado, 'git merge andina');

    expect(segunda.estado.fusion?.idPrevisto).toBe(reservadoAntes);
    expect(segunda.proyectadas).toEqual([reservadoAntes]);
  });

  it('abortar sin fusion en curso reclama y no cambia nada', () => {
    const partida = repoConRamas();
    const resultado = ejecutar(partida, 'git merge --abort');

    expect(resultado.error).toBe(true);
    expect(resultado.estado).toEqual(partida);
  });
});
