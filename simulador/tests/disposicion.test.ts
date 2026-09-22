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
import { CARRIL_MINIMO, disponer, FILA_MINIMA, FILA_PUNTERO_DEBAJO, TEXTO_HUERFANAS } from '../src/grafico/disposicion';
import { MEDIDAS } from '../src/grafico/tipos';
import type { EstadoRepositorio } from '../src/core/tipos';
import { correr, repoConRamaDeTrabajo, repoConRamas, repoLineal, repoVacio } from './ayudas';

/** Carril asignado a la confirmacion a la que apunta una rama. */
function carrilDe(estado: EstadoRepositorio, rama: string): number {
  const punta = ramaPorNombre(estado, rama)?.id ?? '';
  return disponer(estado).nodos.find((nodo) => nodo.id === punta)?.carril ?? -1;
}

describe('CA6 · casos que el calculo de posiciones debe cubrir', () => {
  it('historia lineal: una sola columna, la mas reciente arriba', () => {
    const estado = repoLineal();
    const { nodos } = disponer(estado);

    expect(nodos).toHaveLength(5);
    expect(nodos.every((nodo) => nodo.carril === 0)).toBe(true);
    expect(nodos[0]?.id).toBe(idActual(estado));
    expect(nodos[0]?.y).toBeLessThan(nodos[4]?.y ?? 0);
    for (let i = 1; i < nodos.length; i += 1) {
      expect(nodos[i]?.y).toBe((nodos[i - 1]?.y ?? 0) + MEDIDAS.espacioFila);
    }
  });

  it('cuatro ramas divergentes: cada linea ocupa su propia columna', () => {
    const estado = repoConRamas();
    const { nodos, aristas } = disponer(estado);

    expect(nodos).toHaveLength(estado.confirmaciones.length);
    // Una columna por rama, en el orden en que el enunciado las fusiona.
    expect(carrilDe(estado, 'main')).toBe(0);
    expect(carrilDe(estado, 'tailandesa')).toBe(1);
    expect(carrilDe(estado, 'azteca')).toBe(2);
    expect(carrilDe(estado, 'criolla')).toBe(3);
    expect(carrilDe(estado, 'andina')).toBe(4);
    // Cuatro lineas vuelven a la misma base: main, azteca, criolla y andina
    // nacen todas de la tercera confirmacion.
    const base = estado.confirmaciones[2]?.id ?? '';
    expect(aristas.filter((arista) => arista.hasta === base)).toHaveLength(4);
  });

  it('fusion: la union se marca como tal y sale de sus dos padres', () => {
    const estado = correr(
      repoConRamas(),
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );
    const { nodos, aristas } = disponer(estado);
    const union = nodos[0];

    expect(union?.esUnion).toBe(true);
    expect(aristas.filter((arista) => arista.desde === union?.id)).toHaveLength(2);
    expect(nodos.filter((nodo) => nodo.esUnion)).toHaveLength(1);
  });

  it('tres ramas simultaneas: tres columnas distintas y ningun solapamiento', () => {
    const estado = correr(
      repoConRamas(),
      'git switch -c chilena',
      'echo "* Tacos" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma los tacos"',
      'git switch main',
      'git switch -c boliviana',
      'echo "* Ceviche" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el ceviche"',
    );
    const { nodos } = disponer(estado);

    const carriles = [
      carrilDe(estado, 'main'),
      carrilDe(estado, 'andina'),
      carrilDe(estado, 'chilena'),
      carrilDe(estado, 'boliviana'),
    ];
    expect(new Set(carriles).size).toBe(4);

    const posiciones = nodos.map((nodo) => `${nodo.x}:${nodo.y}`);
    expect(new Set(posiciones).size).toBe(nodos.length);
  });
});

describe('CA3 · previsualizacion de la fusion sobre el laboratorio 05', () => {
  it('dibuja la union proyectada en trazo discontinuo sin haberla creado', () => {
    const estado = repoConRamas();
    const vista = previsualizar(estado, 'git merge andina');
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
    const { nodos } = disponer(repoConRamas());
    expect(nodos.some((nodo) => nodo.previsualizada)).toBe(false);
  });

  it('al ejecutar la fusion, la union conserva el identificador anunciado', () => {
    const estado = repoConRamas();
    const anunciada = previsualizar(estado, 'git merge andina').confirmacionesNuevas[0];

    const final = correr(
      estado,
      'git merge andina',
      'git add platos.md',
      'git commit -m "Fusiona andina"',
    );
    const nodo = disponer(final).nodos.find((candidato) => candidato.id === anunciada);

    expect(nodo).toBeDefined();
    expect(nodo?.previsualizada).toBe(false);
  });
});

describe('CA4 · el rebase deja las originales dibujadas', () => {
  it('las confirmaciones originales siguen en el dibujo, atenuadas, y las copias tienen otro identificador', () => {
    const partida = repoConRamaDeTrabajo();
    const originales = partida.confirmaciones.slice(4).map((confirmacion) => confirmacion.id);

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
    const despues = correr(repoConRamaDeTrabajo(), 'git rebase main');
    const { nodos } = disponer(despues);

    const huerfanas = nodos.filter((nodo) => nodo.huerfana);
    const vivas = nodos.filter((nodo) => !nodo.huerfana);

    expect(huerfanas).toHaveLength(4);
    for (const huerfana of huerfanas) {
      for (const viva of vivas) {
        expect(`${huerfana.x}:${huerfana.y}`).not.toBe(`${viva.x}:${viva.y}`);
      }
    }
    expect(new Set(huerfanas.map((nodo) => nodo.carril)).size).toBe(1);
  });

  it('la previsualizacion del rebase muestra a la vez las originales y las copias discontinuas', () => {
    const partida = repoConRamaDeTrabajo();
    const originales = partida.confirmaciones.slice(4).map((confirmacion) => confirmacion.id);
    const vista = previsualizar(partida, 'git rebase main');

    const { nodos } = disponer(vista.estadoResultante, {
      previsualizadas: vista.confirmacionesNuevas,
    });

    const discontinuas = nodos.filter((nodo) => nodo.previsualizada);
    expect(discontinuas).toHaveLength(4);
    for (const original of originales) {
      expect(nodos.map((nodo) => nodo.id)).toContain(original);
    }
    // Las originales y las copias conviven: no hay deslizamiento, hay copia.
    expect(nodos.length).toBe(partida.confirmaciones.length + 4);
  });
});

describe('5.6 · el grupo de huerfanas va rotulado', () => {
  it('sin huerfanas no hay rotulo', () => {
    expect(disponer(repoConRamas()).rotuloHuerfanas).toBeNull();
  });

  it('tras el rebase el rotulo nombra el grupo y dice que estan sin referencia', () => {
    const despues = correr(repoConRamaDeTrabajo(), 'git rebase main');
    const { nodos, rotuloHuerfanas } = disponer(despues);
    const huerfanas = nodos.filter((nodo) => nodo.huerfana);

    expect(rotuloHuerfanas?.texto).toBe(TEXTO_HUERFANAS);
    expect(TEXTO_HUERFANAS).toBe('sin referencia');

    // A la derecha del grupo, que es el costado que una huerfana siempre tiene
    // libre, y a la altura de su centro para que se lea como del conjunto.
    const alturas = huerfanas.map((nodo) => nodo.y);
    expect(rotuloHuerfanas?.x).toBeGreaterThan(Math.max(...huerfanas.map((nodo) => nodo.x)));
    expect(rotuloHuerfanas?.y).toBe((Math.min(...alturas) + Math.max(...alturas)) / 2);
    for (const viva of nodos.filter((nodo) => !nodo.huerfana)) {
      expect(rotuloHuerfanas?.x).toBeGreaterThan(viva.x);
    }
  });

  it('el marco de dibujo alcanza para el rotulo', () => {
    const despues = correr(repoLineal(), 'git reset --hard HEAD~1');
    const disposicion = disponer(despues);
    const rotulo = disposicion.rotuloHuerfanas;

    expect(rotulo).not.toBeNull();
    expect(disposicion.origenX + disposicion.ancho).toBeGreaterThan(rotulo?.x ?? 0);
  });
});

describe('CA5 · el retroceso destructivo deja la confirmacion abandonada en pantalla', () => {
  it('la confirmacion abandonada permanece dibujada y atenuada', () => {
    const partida = repoLineal();
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
    const estado = repoConRamas();
    const { etiquetas, enlacePuntero } = disponer(estado);

    const puntero = etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
    const main = etiquetas.find((etiqueta) => etiqueta.clave === 'rama:main');

    expect(puntero?.texto).toBe('HEAD');
    expect(enlacePuntero?.ancla).toBe('rama');
    expect(main?.actual).toBe(true);
    expect(etiquetas.find((etiqueta) => etiqueta.clave === 'rama:andina')?.actual).toBe(false);
    // Cuelga de la etiqueta de rama: misma columna, mas abajo.
    expect(puntero?.x).toBe(main?.x);
    expect(puntero?.y).toBeGreaterThan(main?.y ?? 0);
  });

  it('5.4 al cambiar de rama solo se mueve la etiqueta de posicion', () => {
    const antes = disponer(repoConRamas());
    const despues = disponer(correr(repoConRamas(), 'git switch azteca'));

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
    const estado = correr(repoLineal(), 'git checkout HEAD~1');
    const { etiquetas, enlacePuntero } = disponer(estado);
    const puntero = etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');

    expect(enlacePuntero?.ancla).toBe('confirmacion');
    expect(puntero?.idConfirmacion).toBe(idActual(estado));
    expect(etiquetas.some((etiqueta) => etiqueta.actual && etiqueta.forma === 'rama')).toBe(false);
  });

  it('5.5 las etiquetas de version van al otro lado y distinguen la anotada', () => {
    const estado = correr(
      repoLineal(),
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
    const estado = repoLineal();
    const recortado = disponer(estado, { limite: 2 });

    expect(recortado.nodos).toHaveLength(2);
    expect(recortado.ocultas).toBe(3);
    expect(recortado.nodos[0]?.id).toBe(idActual(estado));
    expect(recortado.nodos[1]?.padresOcultos).toBe(true);
    expect(disponer(estado).ocultas).toBe(0);
  });

  it('el marco abarca todo lo dibujado, incluidas las etiquetas de la izquierda', () => {
    const estado = correr(repoLineal(), 'git tag version-inicial-del-recetario');
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
    const disposicion = disponer(repoVacio());

    expect(disposicion.nodos).toHaveLength(0);
    expect(disposicion.aristas).toHaveLength(0);
    expect(disposicion.etiquetas).toHaveLength(0);
    expect(disposicion.ancho).toBeGreaterThan(0);
  });
});

/**
 * SPEC 013 · el grafo como protagonista.
 *
 * Lo que se puede afirmar sin navegador: las medidas, la forma de cada
 * arista, su color y que el trazo del puntero viaje con el. Lo que el
 * navegador pinta y mueve se mide con `herramientas/capturas-rediseno.mjs`.
 */
describe('SPEC 013 · el grafo', () => {
  /** Los numeros de un trazado SVG, en orden. */
  const numeros = (trazado: string): number[] => (trazado.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

  it('2.1 los nodos miden al menos diez de radio', () => {
    expect(MEDIDAS.radio).toBeGreaterThanOrEqual(10);
    expect(MEDIDAS.radio).toBeLessThanOrEqual(11);
  });

  it('2.3 una rama que se abre dobla junto al punto de donde sale y sube recta', () => {
    // `azteca` nace tres confirmaciones abajo: recta por su carril y la curva
    // al final, junto al padre.
    const { aristas, nodos } = disponer(repoConRamas());
    const punta = nodos.find((nodo) => nodo.mensaje.includes('guacamole'));
    const arista = aristas.find((candidata) => candidata.desde === punta?.id);
    expect(arista?.trazado).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ C /);
    const [x1, , xRecta] = numeros(arista?.trazado ?? '');
    expect(xRecta).toBe(x1);
  });

  it('2.3 una union dobla junto a la confirmacion que la cierra y baja recta', () => {
    const estado = correr(repoConRamas(), 'git merge azteca -m "une azteca"');
    const union = disponer(estado);
    const arista = union.aristas.find(
      (candidata) => candidata.desde === idActual(estado) && candidata.clave.endsWith(ramaPorNombre(estado, 'azteca')?.id ?? '?'),
    );
    expect(arista?.trazado).toMatch(/^M [\d.-]+ [\d.-]+ C .* L [\d.-]+ [\d.-]+$/);
  });

  it('2.3 en el mismo carril la arista es una recta', () => {
    const { aristas } = disponer(repoLineal());
    for (const arista of aristas) expect(arista.trazado).toMatch(/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+$/);
  });

  it('la arista toma el color de la rama que dibuja', () => {
    const estado = correr(repoConRamas(), 'git merge azteca -m "une azteca"');
    const { aristas, nodos } = disponer(estado);
    const carril = new Map(nodos.map((nodo) => [nodo.id, nodo.carril]));
    for (const arista of aristas) {
      const primerPadre = estado.confirmaciones.find((c) => c.id === arista.desde)?.padres[0] === arista.hasta;
      const dibujado = primerPadre ? carril.get(arista.desde) : carril.get(arista.hasta);
      expect(arista.derivada, arista.clave).toBe(dibujado !== 0);
    }
    // Hay de las dos, que es lo que hace que la prueba diga algo.
    expect(aristas.some((arista) => arista.derivada)).toBe(true);
    expect(aristas.some((arista) => !arista.derivada)).toBe(true);
  });

  it('6.1 el trazo del puntero, medido desde su etiqueta, es el mismo trazo', () => {
    // Si el relativo no calzara con el absoluto, al deslizarse el puntero su
    // trazo quedaria apuntando a otro lado.
    for (const estado of [repoConRamas(), correr(repoLineal(), 'git checkout HEAD~1')]) {
      const { etiquetas, enlacePuntero } = disponer(estado);
      const puntero = etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
      const absolutos = numeros(enlacePuntero?.trazado ?? '');
      const relativos = numeros(enlacePuntero?.relativo ?? '');
      expect(relativos).toHaveLength(absolutos.length);
      relativos.forEach((valor, indice) => {
        const origen = indice % 2 === 0 ? (puntero?.x ?? 0) : (puntero?.y ?? 0);
        expect(valor + origen).toBeCloseTo(absolutos[indice] ?? Number.NaN);
      });
    }
  });
});

describe('SPEC 013 · la etiqueta de version no tapa el identificador', () => {
  it('va a la izquierda del identificador, no encima', () => {
    // El identificador ocupa, a la izquierda del nodo, hasta
    // `anchoIdentificador`. La etiqueta de version se dibujaba en ese mismo
    // espacio y lo tapaba; lo hacia desde antes del SPEC 013, pero con el
    // relleno opaco de las pildoras dejo de leerse del todo.
    const estado = correr(repoLineal(), 'git tag v0.9', 'git tag -a v1.0 -m "primera"');
    const { etiquetas, nodos } = disponer(estado);
    const versiones = etiquetas.filter((etiqueta) => etiqueta.forma === 'version');
    expect(versiones).toHaveLength(2);
    for (const version of versiones) {
      const nodo = nodos.find((candidato) => candidato.id === version.idConfirmacion);
      expect(version.x + version.ancho, version.texto).toBeLessThanOrEqual(
        (nodo?.x ?? 0) - MEDIDAS.radio - MEDIDAS.anchoIdentificador,
      );
    }
  });
});

/**
 * SPEC 016 · el grafo tiene que caber.
 *
 * Tras el rebase del laboratorio 07, en modo relator, el grafo se cortaba
 * antes de `main`. Cuando no cabe, se aprieta el espacio entre filas; los
 * nodos, las lineas y la letra no se tocan.
 */
describe('SPEC 016 · el grafo cabe en el alto que hay', () => {
  const trasElRebase = (): EstadoRepositorio => correr(repoConRamaDeTrabajo(), 'git rebase main');

  it('sin tope se dibuja como siempre', () => {
    const holgada = disponer(trasElRebase());
    expect(holgada.espacioFila).toBe(MEDIDAS.espacioFila);
    expect(holgada.fueraDeVista).toEqual([]);
  });

  it('con tope, aprieta las filas hasta caber, y solo las filas', () => {
    const holgada = disponer(trasElRebase());
    // El caso del defecto: el alto del panel en modo relator a mil pixeles de ventana.
    const tope = (680 - 34) / 1.3;
    expect(holgada.alto).toBeGreaterThan(tope);
    const apretada = disponer(trasElRebase(), { altoMaximo: tope });
    expect(apretada.alto).toBeLessThanOrEqual(tope);
    expect(apretada.espacioFila).toBeLessThan(MEDIDAS.espacioFila);
    expect(apretada.espacioFila).toBeGreaterThanOrEqual(FILA_MINIMA);
    expect(apretada.fueraDeVista).toEqual([]);
    // Mismas confirmaciones, en los mismos carriles: cambia la altura, nada mas.
    expect(apretada.nodos.map((nodo) => [nodo.id, nodo.carril, nodo.x])).toEqual(
      holgada.nodos.map((nodo) => [nodo.id, nodo.carril, nodo.x]),
    );
    expect(apretada.etiquetas.find((etiqueta) => etiqueta.texto === 'main')).toBeDefined();
  });

  it('si cabe, no toca nada: ni aprieta ni estira', () => {
    // Con un tope justo igual al alto, apretar o no da lo mismo y la prueba no
    // distinguia nada; se vio pasar con la guarda quitada. Con holgura, un
    // calculo sin guarda estiraria las filas para llenar el panel.
    const holgada = disponer(repoLineal());
    expect(disponer(repoLineal(), { altoMaximo: holgada.alto })).toEqual(holgada);
    expect(disponer(repoLineal(), { altoMaximo: holgada.alto + 200 })).toEqual(holgada);
  });

  it('con las filas apretadas, el puntero va al costado de su rama y no debajo', () => {
    const apretada = disponer(trasElRebase(), { altoMaximo: 400 });
    expect(apretada.espacioFila).toBeLessThan(FILA_PUNTERO_DEBAJO);
    const puntero = apretada.etiquetas.find((etiqueta) => etiqueta.forma === 'puntero');
    const rama = apretada.etiquetas.find((etiqueta) => etiqueta.forma === 'rama' && etiqueta.actual);
    expect(puntero?.x).toBeGreaterThan((rama?.x ?? 0) + (rama?.ancho ?? 0));
    // A la misma altura que su rama: no invade la fila siguiente.
    expect((puntero?.y ?? 0) + (puntero?.alto ?? 0) / 2).toBeCloseTo((rama?.y ?? 0) + (rama?.alto ?? 0) / 2);
  });

  it('nunca aprieta por debajo del minimo, y lo que no cabe lo nombra', () => {
    const apretada = disponer(trasElRebase(), { altoMaximo: 150 });
    expect(apretada.espacioFila).toBe(FILA_MINIMA);
    expect(apretada.fueraDeVista).toContain('main');
    expect(apretada.fueraDeVista).not.toContain('HEAD');
  });
});

/**
 * SPEC 017 · el grafo aguanta la consola al maximo.
 *
 * Con el tirador al setenta y dos por ciento el grafo queda angosto. Se
 * aprietan primero los carriles y despues se dejan de dibujar los
 * identificadores, que son lo unico prescindible: las ramas y el puntero se
 * quedan siempre.
 */
describe('SPEC 017 · el grafo cabe en el ancho que hay', () => {
  it('sin tope de ancho se dibuja como siempre, con identificadores', () => {
    const holgada = disponer(repoConRamas());
    expect(holgada.espacioCarril).toBe(MEDIDAS.espacioCarril);
    expect(holgada.identificadores).toBe(true);
  });

  it('con poco ancho, aprieta los carriles y conserva los identificadores si alcanza', () => {
    const holgada = disponer(repoConRamas());
    const apretada = disponer(repoConRamas(), { anchoMaximo: holgada.ancho - 40 });
    expect(apretada.ancho).toBeLessThanOrEqual(holgada.ancho - 40);
    expect(apretada.espacioCarril).toBeLessThan(MEDIDAS.espacioCarril);
    expect(apretada.espacioCarril).toBeGreaterThanOrEqual(CARRIL_MINIMO);
    expect(apretada.identificadores).toBe(true);
    // Mismas confirmaciones, en las mismas filas: cambia el ancho, nada mas.
    expect(apretada.nodos.map((nodo) => [nodo.id, nodo.carril, nodo.y])).toEqual(
      holgada.nodos.map((nodo) => [nodo.id, nodo.carril, nodo.y]),
    );
  });

  it('con menos todavia, deja de dibujar los identificadores antes que una rama', () => {
    // El caso del laboratorio 05 con la consola al maximo a 1600 en modo
    // relator: unas trescientas unidades de ancho.
    const apretada = disponer(repoConRamas(), { anchoMaximo: 300 });
    expect(apretada.identificadores).toBe(false);
    expect(apretada.ancho).toBeLessThanOrEqual(300);
    expect(apretada.fueraDeVista).toEqual([]);
    expect(apretada.etiquetas.filter((etiqueta) => etiqueta.forma !== 'version')).toHaveLength(
      disponer(repoConRamas()).etiquetas.filter((etiqueta) => etiqueta.forma !== 'version').length,
    );
  });

  it('lo que ni asi cabe a lo ancho, lo nombra', () => {
    const imposible = disponer(repoConRamas(), { anchoMaximo: 120 });
    expect(imposible.espacioCarril).toBe(CARRIL_MINIMO);
    expect(imposible.fueraDeVista.length).toBeGreaterThan(0);
  });

  it('si cabe a lo ancho, no toca nada', () => {
    const holgada = disponer(repoConRamas());
    expect(disponer(repoConRamas(), { anchoMaximo: holgada.ancho + 200 })).toEqual(holgada);
  });
});
