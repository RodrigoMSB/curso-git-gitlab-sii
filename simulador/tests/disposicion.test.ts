/**
 * Pruebas del modulo de calculo de posiciones del grafo.
 *
 * Cubre los cuatro casos que exige el criterio CA6 del SPEC 002 (historia
 * lineal, dos ramas divergentes, fusion y tres ramas simultaneas) y los
 * criterios CA3, CA4 y CA5, que son afirmaciones sobre lo que el grafo dibuja.
 */

import { describe, expect, it } from 'vitest';
import { previsualizar } from '../src/core/motor';
import { idActual, ramaPorNombre } from '../src/core/estado';
import { disponer } from '../src/grafico/disposicion';
import { MEDIDAS } from '../src/grafico/tipos';
import { escenarioPorId } from '../src/escenarios';
import { correr } from './ayudas';

/** Carril asignado a la confirmacion a la que apunta una rama. */
function carrilDe(estado: ReturnType<typeof escenarioPorId>, rama: string): number {
  const punta = ramaPorNombre(estado, rama)?.id ?? '';
  return disponer(estado).nodos.find((nodo) => nodo.id === punta)?.carril ?? -1;
}

describe('CA6 · casos que el calculo de posiciones debe cubrir', () => {
  it('historia lineal: una sola columna, la mas reciente arriba', () => {
    const estado = escenarioPorId('E2');
    const { nodos } = disponer(estado);

    expect(nodos).toHaveLength(4);
    expect(nodos.every((nodo) => nodo.carril === 0)).toBe(true);
    expect(nodos[0]?.id).toBe(idActual(estado));
    expect(nodos[0]?.y).toBeLessThan(nodos[3]?.y ?? 0);
    for (let i = 1; i < nodos.length; i += 1) {
      expect(nodos[i]?.y).toBe((nodos[i - 1]?.y ?? 0) + MEDIDAS.espacioFila);
    }
  });

  it('dos ramas divergentes: cada linea ocupa su propia columna', () => {
    const estado = escenarioPorId('E3');
    const { nodos, aristas } = disponer(estado);

    expect(nodos).toHaveLength(6);
    expect(carrilDe(estado, 'main')).toBe(0);
    expect(carrilDe(estado, 'tailandesa')).toBe(1);
    // Las dos lineas vuelven a la misma base.
    const base = estado.confirmaciones[2]?.id ?? '';
    expect(aristas.filter((arista) => arista.hasta === base)).toHaveLength(2);
  });

  it('fusion: la union se marca como tal y sale de sus dos padres', () => {
    const estado = correr(escenarioPorId('E3'), 'git merge tailandesa');
    const { nodos, aristas } = disponer(estado);
    const union = nodos[0];

    expect(union?.esUnion).toBe(true);
    expect(aristas.filter((arista) => arista.desde === union?.id)).toHaveLength(2);
    expect(nodos.filter((nodo) => nodo.esUnion)).toHaveLength(1);
  });

  it('tres ramas simultaneas: tres columnas distintas y ningun solapamiento', () => {
    const estado = correr(
      escenarioPorId('E3'),
      'git switch -c mexicana',
      'echo "* Tacos" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma los tacos"',
      'git switch main',
      'git switch -c peruana',
      'echo "* Ceviche" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el ceviche"',
    );
    const { nodos } = disponer(estado);

    const carriles = [
      carrilDe(estado, 'main'),
      carrilDe(estado, 'tailandesa'),
      carrilDe(estado, 'mexicana'),
      carrilDe(estado, 'peruana'),
    ];
    expect(new Set(carriles).size).toBe(4);

    const posiciones = nodos.map((nodo) => `${nodo.x}:${nodo.y}`);
    expect(new Set(posiciones).size).toBe(nodos.length);
  });
});

describe('CA3 · previsualizacion de la fusion sobre E4', () => {
  it('dibuja la union proyectada en trazo discontinuo sin haberla creado', () => {
    const estado = escenarioPorId('E4');
    const vista = previsualizar(estado, 'git merge tailandesa');
    const anunciada = vista.confirmacionesNuevas[0] ?? '';

    const conPrevisualizacion = disponer(vista.estadoResultante, {
      previsualizadas: vista.confirmacionesNuevas,
    });
    const nodo = conPrevisualizacion.nodos.find((candidato) => candidato.id === anunciada);

    expect(nodo?.previsualizada).toBe(true);
    expect(nodo?.esUnion).toBe(true);
    expect(nodo?.huerfana).toBe(false);
    expect(
      conPrevisualizacion.aristas.filter((arista) => arista.desde === anunciada),
    ).toHaveLength(2);
    expect(
      conPrevisualizacion.aristas.every(
        (arista) => arista.previsualizada === (arista.desde === anunciada),
      ),
    ).toBe(true);
  });

  it('sin previsualizacion no aparece ninguna confirmacion discontinua', () => {
    const { nodos } = disponer(escenarioPorId('E4'));
    expect(nodos.some((nodo) => nodo.previsualizada)).toBe(false);
  });

  it('al ejecutar la fusion, la union conserva el identificador anunciado', () => {
    const estado = escenarioPorId('E4');
    const anunciada = previsualizar(estado, 'git merge tailandesa').confirmacionesNuevas[0];

    const final = correr(
      estado,
      'git merge tailandesa',
      'git add platos.md',
      'git commit -m "Fusiona tailandesa"',
    );
    const nodo = disponer(final).nodos.find((candidato) => candidato.id === anunciada);

    expect(nodo).toBeDefined();
    expect(nodo?.previsualizada).toBe(false);
  });
});

describe('CA4 · el rebase deja las originales dibujadas', () => {
  it('las confirmaciones originales siguen en el dibujo, atenuadas, y las copias tienen otro identificador', () => {
    const partida = correr(escenarioPorId('E3'), 'git switch tailandesa');
    const originales = [partida.confirmaciones[4]?.id ?? '', partida.confirmaciones[5]?.id ?? ''];

    const despues = correr(partida, 'git rebase main');
    const { nodos } = disponer(despues);
    const dibujadas = nodos.map((nodo) => nodo.id);

    for (const original of originales) {
      expect(dibujadas).toContain(original);
      expect(nodos.find((nodo) => nodo.id === original)?.huerfana).toBe(true);
    }

    const copias = nodos.filter((nodo) => !nodo.huerfana && !originales.includes(nodo.id));
    expect(copias.map((nodo) => nodo.id)).not.toContain(originales[0]);
    expect(copias.map((nodo) => nodo.id)).not.toContain(originales[1]);
  });

  it('las copias no se superponen con las originales: quedan en columnas distintas', () => {
    const despues = correr(escenarioPorId('E3'), 'git switch tailandesa', 'git rebase main');
    const { nodos } = disponer(despues);

    const huerfanas = nodos.filter((nodo) => nodo.huerfana);
    const vivas = nodos.filter((nodo) => !nodo.huerfana);

    expect(huerfanas).toHaveLength(2);
    for (const huerfana of huerfanas) {
      for (const viva of vivas) {
        expect(`${huerfana.x}:${huerfana.y}`).not.toBe(`${viva.x}:${viva.y}`);
      }
    }
    expect(new Set(huerfanas.map((nodo) => nodo.carril)).size).toBe(1);
  });

  it('la previsualizacion del rebase muestra a la vez las originales y las copias discontinuas', () => {
    const partida = correr(escenarioPorId('E3'), 'git switch tailandesa');
    const originales = [partida.confirmaciones[4]?.id ?? '', partida.confirmaciones[5]?.id ?? ''];
    const vista = previsualizar(partida, 'git rebase main');

    const { nodos } = disponer(vista.estadoResultante, {
      previsualizadas: vista.confirmacionesNuevas,
    });

    const discontinuas = nodos.filter((nodo) => nodo.previsualizada);
    expect(discontinuas).toHaveLength(2);
    for (const original of originales) {
      expect(nodos.map((nodo) => nodo.id)).toContain(original);
    }
    // Las originales y las copias conviven: no hay deslizamiento, hay copia.
    expect(nodos.length).toBe(partida.confirmaciones.length + 2);
  });
});

describe('CA5 · el retroceso destructivo deja la confirmacion abandonada en pantalla', () => {
  it('la confirmacion abandonada permanece dibujada y atenuada', () => {
    const partida = escenarioPorId('E2');
    const abandonada = idActual(partida) ?? '';

    const despues = correr(partida, 'git reset --hard HEAD~1');
    const { nodos } = disponer(despues);
    const nodo = nodos.find((candidato) => candidato.id === abandonada);

    expect(nodo).toBeDefined();
    expect(nodo?.huerfana).toBe(true);
    expect(nodos).toHaveLength(partida.confirmaciones.length);
  });
});

describe('punteros y etiquetas', () => {
  it('5.4 la posicion actual es una etiqueta aparte que cuelga de la rama que sigue', () => {
    const estado = escenarioPorId('E3');
    const { etiquetas, enlacePuntero } = disponer(estado);

    const puntero = etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
    const main = etiquetas.find((etiqueta) => etiqueta.clave === 'rama:main');

    expect(puntero?.texto).toBe('HEAD');
    expect(enlacePuntero?.ancla).toBe('rama');
    expect(main?.actual).toBe(true);
    expect(etiquetas.find((etiqueta) => etiqueta.clave === 'rama:tailandesa')?.actual).toBe(false);
    // Cuelga de la etiqueta de rama: misma columna, mas abajo.
    expect(puntero?.x).toBe(main?.x);
    expect(puntero?.y).toBeGreaterThan(main?.y ?? 0);
  });

  it('5.4 al cambiar de rama solo se mueve la etiqueta de posicion', () => {
    const antes = disponer(escenarioPorId('E3'));
    const despues = disponer(correr(escenarioPorId('E3'), 'git switch tailandesa'));

    expect(despues.nodos).toEqual(antes.nodos);
    const ramasAntes = antes.etiquetas.filter((etiqueta) => etiqueta.forma === 'rama');
    const ramasDespues = despues.etiquetas.filter((etiqueta) => etiqueta.forma === 'rama');
    expect(ramasDespues.map((etiqueta) => ({ x: etiqueta.x, y: etiqueta.y }))).toEqual(
      ramasAntes.map((etiqueta) => ({ x: etiqueta.x, y: etiqueta.y })),
    );

    const punteroAntes = antes.etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
    const punteroDespues = despues.etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
    expect(punteroDespues?.y).not.toBe(punteroAntes?.y);
  });

  it('5.4 con la posicion desconectada, la etiqueta cuelga de la confirmacion', () => {
    const estado = correr(escenarioPorId('E2'), 'git checkout HEAD~1');
    const { etiquetas, enlacePuntero } = disponer(estado);
    const puntero = etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');

    expect(enlacePuntero?.ancla).toBe('confirmacion');
    expect(puntero?.idConfirmacion).toBe(idActual(estado));
    expect(etiquetas.some((etiqueta) => etiqueta.actual && etiqueta.forma === 'rama')).toBe(false);
  });

  it('5.5 las etiquetas de version van al otro lado y distinguen la anotada', () => {
    const estado = correr(
      escenarioPorId('E2'),
      'git tag v1.0',
      'git tag -a v2.0 -m "Segunda entrega"',
    );
    const { nodos, etiquetas } = disponer(estado);
    const nodo = nodos[0];
    const versiones = etiquetas.filter((etiqueta) => etiqueta.forma === 'version');
    const ramas = etiquetas.filter((etiqueta) => etiqueta.forma === 'rama');

    expect(versiones).toHaveLength(2);
    for (const version of versiones) {
      expect(version.x).toBeLessThan(nodo?.x ?? 0);
    }
    for (const rama of ramas) {
      expect(rama.x).toBeGreaterThan(nodo?.x ?? 0);
    }
    expect(versiones.find((version) => version.texto === 'v2.0')?.anotada).toBe(true);
    expect(versiones.find((version) => version.texto === 'v1.0')?.anotada).toBe(false);
  });
});

describe('marco y limites del dibujo', () => {
  it('5.8 sobre el limite se dibujan las mas recientes y se informa cuantas quedaron fuera', () => {
    const estado = escenarioPorId('E2');
    const recortado = disponer(estado, { limite: 2 });

    expect(recortado.nodos).toHaveLength(2);
    expect(recortado.ocultas).toBe(2);
    expect(recortado.nodos[0]?.id).toBe(idActual(estado));
    expect(recortado.nodos[1]?.padresOcultos).toBe(true);
    expect(disponer(estado).ocultas).toBe(0);
  });

  it('el marco abarca todo lo dibujado, incluidas las etiquetas de la izquierda', () => {
    const estado = correr(escenarioPorId('E2'), 'git tag version-inicial-del-recetario');
    const disposicion = disponer(estado);

    const minimoX = Math.min(...disposicion.etiquetas.map((etiqueta) => etiqueta.x));
    const maximoX = Math.max(
      ...disposicion.etiquetas.map((etiqueta) => etiqueta.x + etiqueta.ancho),
    );

    expect(disposicion.origenX).toBeLessThanOrEqual(minimoX);
    expect(disposicion.origenX + disposicion.ancho).toBeGreaterThanOrEqual(maximoX);
    expect(disposicion.alto).toBeGreaterThan(0);
  });

  it('un repositorio sin confirmaciones produce un dibujo vacio pero valido', () => {
    const disposicion = disponer(escenarioPorId('E1'));

    expect(disposicion.nodos).toHaveLength(0);
    expect(disposicion.aristas).toHaveLength(0);
    expect(disposicion.etiquetas).toHaveLength(0);
    expect(disposicion.ancho).toBeGreaterThan(0);
  });
});
