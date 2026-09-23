/**
 * Cada laboratorio recorrido dos veces en paralelo (SPEC 008).
 *
 * Una vez en el simulador, escribiendo en su consola como lo haria el
 * participante. Otra en un repositorio de Git real, con las mismas ordenes.
 * Despues de cada orden se comparan los dos estados.
 *
 * **Si el simulador le enseña al participante algo distinto de lo que va a ver
 * en su terminal, la prueba falla.** Ese es el objetivo entero.
 *
 * Las ordenes salen del enunciado y no de una lista escrita aparte: ver
 * `cypress/soporte/ordenes.ts`.
 */

import {
  aliasDelTaller,
  direccionDelSimulador,
  ordenesDe,
  ordenPara,
  resolverMarcadores,
  resumen,
} from '../soporte/ordenes';
import type { OrdenDelEnunciado } from '../soporte/ordenes';
import { cabeDentro, dibujoDelGrafo, nodosSolidosPintados, PIEZAS } from '../soporte/dibujo';
import type { Pieza } from '../soporte/dibujo';

interface EstadoComparable {
  readonly historia: readonly string[];
  readonly ramas: readonly string[];
  readonly posicion: string;
  readonly etiquetas: readonly string[];
  readonly archivos: readonly string[];
  readonly guardados: readonly string[];
}

interface Laboratorio {
  readonly raiz: string;
  readonly recetario: string;
  readonly configGlobal: string;
}

/** El tono con que la pantalla pinta cada estado de archivo. */
const ESTADO_POR_TONO: Readonly<Record<string, string>> = {
  preparado: 'preparado',
  pendiente: 'modificado',
  nuevo: 'sin-seguimiento',
  conflicto: 'en-conflicto',
  limpio: 'limpio',
  // Git muestra las bajas con el mismo codigo de dos columnas que el resto:
  // `D ` cuando estan preparadas y ` D` cuando no.
  'borrado-preparado': 'preparado',
  'borrado-pendiente': 'modificado',
};

/**
 * Lee de la pantalla el mismo conjunto de datos que se le pide a Git.
 *
 * Se lee del documento, no del modelo: lo que se compara es lo que el
 * participante ve. El DOM lleva los datos en atributos `data-` puestos para
 * esto.
 */
function estadoDelSimulador(): Cypress.Chainable<EstadoComparable> {
  return cy.document().then((doc): EstadoComparable => {
    const nodos = [...doc.querySelectorAll<SVGGElement>('g[data-confirmacion]')].filter(
      (nodo) => nodo.dataset.previsualizada === 'no',
    );
    const mensajePorId = new Map(
      nodos.map((nodo) => [nodo.dataset.confirmacion ?? '', nodo.dataset.mensaje ?? '']),
    );

    // Las aristas van en el orden de los padres de cada confirmacion.
    const padres = new Map<string, string[]>();
    for (const arista of doc.querySelectorAll<SVGPathElement>('path[data-desde]')) {
      if (arista.dataset.previsualizada !== 'no') continue;
      const desde = arista.dataset.desde ?? '';
      padres.set(desde, [...(padres.get(desde) ?? []), arista.dataset.hasta ?? '']);
    }

    const etiquetas = [...doc.querySelectorAll<SVGGElement>('g[data-etiqueta]')];
    const puntero = etiquetas.find((etiqueta) => etiqueta.dataset.forma === 'puntero');
    const ramaActual = etiquetas.find(
      (etiqueta) => etiqueta.dataset.forma === 'rama' && etiqueta.dataset.actual === 'si',
    );
    const cabeza = (ramaActual ?? puntero)?.dataset.en ?? '';

    // La historia es lo alcanzable desde donde esta parado el participante,
    // que es lo mismo que `git log` muestra.
    const alcanzables: string[] = [];
    const vistos = new Set<string>();
    const pendientes = cabeza === '' ? [] : [cabeza];
    while (pendientes.length > 0) {
      const id = pendientes.shift() ?? '';
      if (id === '' || vistos.has(id)) continue;
      vistos.add(id);
      alcanzables.push(mensajePorId.get(id) ?? `(sin nodo: ${id})`);
      pendientes.push(...(padres.get(id) ?? []));
    }

    const ramas = etiquetas
      .filter((etiqueta) => etiqueta.dataset.forma === 'rama')
      .map(
        (etiqueta) =>
          `${etiqueta.dataset.etiqueta} -> ${mensajePorId.get(etiqueta.dataset.en ?? '') ?? ''}`,
      )
      .sort();

    const nombresDeEtiqueta = etiquetas
      .filter((etiqueta) => etiqueta.dataset.forma === 'version')
      .map(
        (etiqueta) =>
          `${etiqueta.dataset.etiqueta} -> ${mensajePorId.get(etiqueta.dataset.en ?? '') ?? ''}`,
      )
      .sort();

    // Solo las dos columnas que listan archivos: la del repositorio local
    // enumera confirmaciones y ramas, que no son archivos.
    const archivos = [
      ...doc.querySelectorAll<HTMLElement>(
        'section[data-columna="trabajo"] li[data-archivo], section[data-columna="preparacion"] li[data-archivo]',
      ),
    ]
      .map((elemento) => {
        const tono = elemento.dataset.tono ?? 'limpio';
        return `${elemento.dataset.archivo}:${ESTADO_POR_TONO[tono] ?? tono}`;
      })
      .sort();

    const guardados = [...doc.querySelectorAll<HTMLElement>('li[data-guardado]')].map(
      (elemento) => elemento.dataset.guardado ?? '',
    );

    const nombreActual = ramaActual?.dataset.etiqueta ?? 'desconectado';
    return {
      historia: [...alcanzables].sort(),
      ramas,
      posicion: `${nombreActual} -> ${mensajePorId.get(cabeza) ?? ''}`,
      etiquetas: nombresDeEtiqueta,
      archivos,
      guardados,
    };
  });
}

/**
 * La pantalla solo lista los archivos que tienen algo pendiente; los limpios no
 * se dibujan. Se comparan entonces los que si aparecen, y aparte que Git no
 * tenga ningun pendiente que la pantalla no muestre.
 */
function pendientesDe(estado: EstadoComparable): readonly string[] {
  return estado.archivos.filter((archivo) => !archivo.endsWith(':limpio'));
}

/**
 * Si la ultima orden escrita en la consola termino en error.
 *
 * Se mira lo que el participante lee: Git antepone `fatal:` o `error:` cuando
 * rechaza una orden. El color no sirve para esto, porque la consola pinta de
 * rojo tambien los archivos modificados de un `git status` que funciono.
 */
function falloEnElSimulador(): Cypress.Chainable<boolean> {
  return cy.document().then((doc) => {
    const renglones = [...doc.querySelectorAll<HTMLElement>('[data-color]')];
    const ultimoEco = renglones.map((renglon) => renglon.dataset.color).lastIndexOf('orden');
    return renglones
      .slice(ultimoEco + 1)
      .some((renglon) => /^(fatal|error):/.test(renglon.textContent ?? ''));
  });
}

/**
 * Si la ultima orden recibio la respuesta de limite del simulador.
 *
 * Se reconoce por el color con que la consola la pinta, que es distinto del de
 * un reclamo de Git a proposito (punto 6.3): un limite de la herramienta no es
 * una falla del participante.
 */
function limiteEnElSimulador(): Cypress.Chainable<boolean> {
  return cy.document().then((doc) => {
    const renglones = [...doc.querySelectorAll<HTMLElement>('[data-color]')];
    const ultimoEco = renglones.map((renglon) => renglon.dataset.color).lastIndexOf('orden');
    return renglones
      .slice(ultimoEco + 1)
      .some((renglon) => renglon.dataset.color === 'limite');
  });
}

/**
 * El directorio de trabajo que el simulador muestra, incluido lo limpio.
 *
 * La pantalla no dibuja los archivos limpios en ninguna parte: la zona D lista
 * solo lo que tiene algo pendiente. La unica ventana al directorio completo es
 * `ls`, asi que se escribe `ls` como sonda y se lee lo que la consola imprime.
 *
 * **La sonda no queda en el guion.** Despues de leerla se retrocede un paso en
 * la linea de tiempo, y la orden siguiente la reemplaza, igual que en Git una
 * confirmacion nueva hecha desde un punto anterior corta lo que habia delante.
 * Asi el recorrido, las capturas y la linea de tiempo siguen siendo los del
 * enunciado y no los del arnes.
 */
function directorioDelSimulador(): Cypress.Chainable<readonly string[]> {
  ejecutarEnElSimulador('ls');
  return cy
    .document()
    .then((doc) => {
      const renglones = [...doc.querySelectorAll<HTMLElement>('[data-color]')];
      const ultimoEco = renglones.map((renglon) => renglon.dataset.color).lastIndexOf('orden');
      return renglones
        .slice(ultimoEco + 1)
        .map((renglon) => (renglon.textContent ?? '').trim())
        .filter((entrada) => entrada !== '')
        .sort((una, otra) => una.localeCompare(otra));
    })
    .then((entradas) => {
      // Se deshace la sonda: la orden siguiente ocupa su lugar.
      cy.contains('button', 'retroceder').click();
      return cy.wrap(entradas, { log: false });
    });
}

/**
 * Guarda la pantalla completa despues de una orden (punto 3 del SPEC 011).
 *
 * El nombre lleva el laboratorio, el numero de paso y la orden, de modo que la
 * secuencia se sigue ordenando los archivos y sin abrir ningun indice. Se
 * captura la pagina entera y no el panel del grafo: si el problema fuera de
 * disposicion, o de que el dibujo quedara fuera de la vista, recortar el panel
 * lo escondería.
 *
 * Son unas trescientas imagenes por corrida, a proposito: el punto 3.1 pide el
 * recorrido completo y no una muestra. Van a `docs/capturas-recorrido`, que
 * queda fuera del seguimiento.
 */
function capturar(laboratorio: string, paso: number, orden: string): void {
  const limpia = orden
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  const nombre = `lab-${laboratorio}/paso-${String(paso).padStart(3, '0')}-${limpia}`;
  cy.screenshot(nombre, { capture: 'fullPage', overwrite: true, log: false });
}

/** Escribe la orden en la consola y la ejecuta, como lo haria el participante. */
/** Lo que la consola del simulador imprimio en respuesta a la ultima orden. */
function salidaDelSimulador(): Cypress.Chainable<string> {
  return cy.document().then((doc) => {
    const renglones = [...doc.querySelectorAll<HTMLElement>('[data-color]')];
    const ultimoEco = renglones.map((renglon) => renglon.dataset.color).lastIndexOf('orden');
    return renglones
      .slice(ultimoEco + 1)
      .map((renglon) => renglon.textContent ?? '')
      .join('\n');
  });
}

/**
 * El identificador que el participante copiaria para esta orden, en un lado.
 *
 * Sale de lo que **ese lado** imprimio la ultima vez que corrio la orden de la
 * que el enunciado manda copiarlo. Si esa orden no corrio, o su salida no trae
 * lo que el enunciado dice que trae, la prueba falla con los dos datos: una
 * orden del guion que no se puede seguir no se salta en silencio.
 */
function identificadorEn(
  lado: 'Git' | 'el simulador',
  orden: OrdenDelEnunciado,
  salidas: ReadonlyMap<string, string>,
): string | null {
  const eleccion = orden.eleccion;
  if (eleccion === undefined) return null;
  const donde = `«${orden.texto}» (enunciado, linea ${orden.linea})`;
  const salida = salidas.get(eleccion.de);
  expect(salida, `${donde} copia el identificador de la salida de «${eleccion.de}», que en ${lado} no corrio antes`).to.be.a('string');
  const identificador = eleccion.elegir(salida ?? '');
  expect(
    identificador,
    `${donde}: en ${lado} no se pudo elegir el identificador —${eleccion.como}— de la salida de «${eleccion.de}»:\n${salida}`,
  ).to.be.a('string');
  return identificador;
}

function ejecutarEnElSimulador(orden: string): void {
  // Con retardo cero el campo controlado por React llega a perder el primer
  // caracter, y la prueba termina comparando una orden que nadie escribio.
  cy.get('[data-prueba="entrada-consola"]')
    .clear()
    .type(orden, { delay: 4, parseSpecialCharSequences: false })
    .should('have.value', orden)
    .type('{enter}');
}

/**
 * Recorre un laboratorio comparando los dos lados despues de cada orden.
 *
 * Desde el SPEC 010 esto no informa un porcentaje: **afirma**. Toda orden del
 * guion se ejecuta en los dos lados y los estados coinciden, o la prueba falla
 * (punto 7.1). Las categorias de «solo en Git» y de corte desaparecieron: si
 * algo del guion no se puede comparar, es un defecto y no una categoria.
 *
 * Quedan dos excepciones, y estan declaradas (punto 7.3):
 *
 * - Los pasos con marcador, donde el participante copia un identificador de
 *   una salida anterior. Los identificadores difieren por diseño.
 * - Las ordenes que el contrato declara no soportadas, de las que se comprueba
 *   que el simulador lo diga, no que las ejecute.
 */
function recorrer(numero: string): void {
  let lab: Laboratorio;
  let ordenes: readonly OrdenDelEnunciado[] = [];
  /**
   * La direccion sale del enunciado, no de aqui.
   *
   * Hasta el SPEC 011 el arnes escribia `?lab=NN` a mano en cada `cy.visit`, y
   * con eso le resolvia al recorrido lo unico que el participante tiene que
   * acertar solo. El enunciado no lo decia en ninguna parte y nadie se entero.
   */
  let direccion = '';
  /** Alias del taller, sacados del enunciado del laboratorio 01. */
  let alias: Readonly<Record<string, string>> = {};
  /** Lo pintado y lo que Git decia tras la orden anterior, para saber si se movio. */
  let dibujadoAnterior: string | null = null;
  let gitAnterior = '';
  /** Que pieza se movio en cada paso, para el informe del punto 4.1. */
  const movimiento: { paso: number; orden: string; piezas: Readonly<Record<Pieza, string>> }[] = [];

  before(() => {
    // El recorrido mide el dibujo final de cada orden, no el camino hasta el.
    // Desde el SPEC 013 el puntero se desliza en doscientos sesenta
    // milisegundos, y el arnes lo media en un punto variable de ese
    // deslizamiento: dos corridas identicas daban informes de movimiento
    // distintos, y a veces un cambio de rama real no figuraba. Con movimiento
    // reducido, que la pantalla respeta, las transiciones terminan en el acto.
    cy.wrap(
      Cypress.automation('remote:debugger:protocol', {
        command: 'Emulation.setEmulatedMedia',
        params: { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] },
      }),
      { log: false },
    );
    // Los alias del taller salen del enunciado del laboratorio 01, que es donde
    // el participante los configura. El arnes no los escribe.
    cy.task<string>('leerEnunciado', '01').then((primero) => {
      alias = aliasDelTaller(primero);
    });
    cy.task<string>('leerEnunciado', numero).then((enunciado) => {
      ordenes = resolverMarcadores(ordenesDe(enunciado, alias), numero, alias);
      direccion = direccionDelSimulador(enunciado, numero) ?? '';
    });
    cy.task<Laboratorio>('prepararLaboratorio', numero).then((preparado) => {
      lab = preparado;
    });
  });

  it('el enunciado dice con que direccion se abre el simulador', () => {
    cy.then(() => {
      expect(
        direccion,
        `el enunciado del laboratorio ${numero} tiene que decir «SIMULADOR.html?lab=${numero}»: sin eso el participante abre el simulador con doble clic y cae en el escenario del laboratorio 01`,
      ).to.equal(`/SIMULADOR.html?lab=${numero}`);
    });
  });

  it('el punto de partida es el mismo en los dos lados', () => {
    cy.visit(direccion);
    cy.task<EstadoComparable>('estadoDeGit', lab).then((git) => {
      estadoDelSimulador().then((simulador) => {
        expect(simulador.historia, 'historia').to.deep.equal([...git.historia].sort());
        expect(simulador.ramas, 'ramas').to.deep.equal(git.ramas);
        expect(simulador.posicion, 'posicion').to.equal(git.posicion);
        expect(pendientesDe(simulador), 'archivos').to.deep.equal(pendientesDe(git));
      });
    });

    // Y el directorio completo, no solo lo que tiene algo pendiente.
    cy.task<readonly string[]>('directorioDeGit', lab).then((git) => {
      directorioDelSimulador().then((simulador) => {
        expect(
          simulador,
          `directorio de trabajo al abrir el laboratorio ${numero}`,
        ).to.deep.equal([...git]);
      });
    });

    // Y lo que de verdad se pinta. Que el documento lleve los atributos no
    // significa que el participante vea nada: el defecto del SPEC 011 tenia
    // todos los atributos en su sitio, porque no habia ni un solo nodo.
    cy.task<EstadoComparable>('estadoDeGit', lab).then((git) => {
      dibujoDelGrafo().then((dibujo) => {
        expect(
          dibujo.hay,
          `el panel del grafo tiene que dibujar el SVG al abrir el laboratorio ${numero}; muestra «${dibujo.leyendaVacia ?? ''}»`,
        ).to.equal(true);
        const pintados = nodosSolidosPintados(dibujo);
        // El grafo dibuja el repositorio entero y `git log` solo lo alcanzable
        // desde donde esta parado el participante, asi que en un laboratorio
        // con ramas paralelas el grafo tiene mas nodos. Lo que se exige es que
        // no falte ninguna: toda confirmacion que la terminal muestra tiene que
        // estar pintada.
        expect(
          pintados.map((nodo) => nodo.mensaje),
          `confirmaciones pintadas al abrir el laboratorio ${numero}`,
        ).to.include.members([...git.historia]);
        for (const nodo of pintados) {
          expect(nodo.visible, `la confirmacion «${nodo.mensaje}» se pinta`).to.equal(true);
          expect(
            cabeDentro(nodo.caja, dibujo.panel ?? nodo.caja),
            `la confirmacion «${nodo.mensaje}» se pinta dentro del panel del grafo`,
          ).to.equal(true);
        }
      });
    });
  });

  it('ninguna orden del guion se salta', () => {
    // Toda orden del enunciado se ejecuta en los dos lados. Una que lleve un
    // marcador de identificador necesita su eleccion en `ELECCIONES`; sin
    // ella, queda omitida y esto falla nombrandola.
    cy.then(() => {
      const saltadas = ordenes
        .filter((orden) => orden.clase === 'omitida')
        .map((orden) => `linea ${orden.linea}: ${orden.texto} (${orden.motivo})`);
      expect(saltadas, 'ordenes del guion que el recorrido saltaria').to.deep.equal([]);
    });
  });

  it('cada orden del enunciado deja los dos lados en el mismo estado', () => {
    cy.visit(direccion);
    capturar(numero, 0, 'estado inicial');

    cy.then(() => {
      let paso = 0;
      // Lo que cada lado imprimio, por orden, para que una orden con marcador
      // de identificador copie el suyo de ahi, como lo copia el participante.
      const salidas = { simulador: new Map<string, string>(), git: new Map<string, string>() };
      for (const orden of ordenes) {
        // Ninguna orden del guion se salta. Hasta aqui las que llevaban un
        // marcador de identificador se omitian, y el recorrido del laboratorio
        // 04 seguia sin la rama `peruana` en los dos lados, igual de mal.
        if (orden.clase === 'omitida') {
          cy.then(() => {
            expect(
              orden.clase,
              `«${orden.texto}» (enunciado, linea ${orden.linea}) se saltaria: ${orden.motivo}`,
            ).to.not.equal('omitida');
          });
          continue;
        }
        paso += 1;
        const numeroDePaso = paso;

        cy.then(() => {
          ejecutarEnElSimulador(ordenPara(orden, identificadorEn('el simulador', orden, salidas.simulador)));
        });
        salidaDelSimulador().then((salida) => {
          salidas.simulador.set(orden.texto, salida);
        });
        // La captura va aqui, despues de cada orden y antes de comparar: si la
        // comparacion falla, la imagen del momento ya quedo guardada.
        capturar(numero, numeroDePaso, orden.texto);
        cy.then(() =>
          cy.task<{ salida: string; fallo: boolean; cambio: boolean }>('ejecutarEnGit', {
            lab,
            orden: ordenPara(orden, identificadorEn('Git', orden, salidas.git)),
            medirCambio: false,
          }),
        ).then((resultado) => {
          salidas.git.set(orden.texto, resultado.salida);
          if (orden.clase === 'declarada') {
            // Lo declarado no se ejecuta: se comprueba que el simulador diga
            // que no lo implementa, con su motivo, y que el estado no cambie.
            limiteEnElSimulador().then((dicho) => {
              expect(
                dicho,
                `«${orden.texto}» (enunciado, linea ${orden.linea}) esta declarada como no soportada y el simulador tiene que decirlo`,
              ).to.equal(true);
            });
            return;
          }
          // Una orden que funciona en la terminal y falla en el simulador, o
          // al reves, enseña algo distinto aunque el estado quede igual.
          falloEnElSimulador().then((falloSimulador) => {
            expect(
              falloSimulador,
              `«${orden.texto}» (enunciado, linea ${orden.linea}): en Git ${
                resultado.fallo ? 'fallo' : 'funciono'
              } y en el simulador ${falloSimulador ? 'fallo' : 'funciono'}`,
            ).to.equal(resultado.fallo);
          });
        });

        if (orden.clase !== 'comparada') continue;

        cy.task<EstadoComparable>('estadoDeGit', lab).then((git) => {
          estadoDelSimulador().then((simulador) => {
            // El mensaje dice en que orden ocurrio y que mostro cada lado
            // (punto 5.4): un fallo que solo diga que difieren no sirve.
            const donde = `«${orden.texto}» (enunciado, linea ${orden.linea})`;
            expect(simulador.historia, `historia tras ${donde}`).to.deep.equal(
              [...git.historia].sort(),
            );
            expect(simulador.ramas, `ramas tras ${donde}`).to.deep.equal(git.ramas);
            expect(simulador.posicion, `posicion tras ${donde}`).to.equal(git.posicion);
            expect(simulador.etiquetas, `etiquetas tras ${donde}`).to.deep.equal(git.etiquetas);
            expect(pendientesDe(simulador), `archivos tras ${donde}`).to.deep.equal(
              pendientesDe(git),
            );
            expect(simulador.guardados.length, `guardados tras ${donde}`).to.equal(
              git.guardados.length,
            );
          });

          // Y ahora lo que el navegador pinto (SPEC 011).
          //
          // Comparar los dos modelos no dice nada sobre el dibujo: el defecto
          // que abrio este spec tenia los dos lados coincidiendo en que no
          // habia ninguna confirmacion, y era verdad, y la pantalla estaba
          // vacia de punta a punta.
          //
          // La regla es simple y no admite categorias: si la parte del estado
          // de Git que el grafo dibuja cambio, el dibujo tiene que haber
          // cambiado; y si no cambio, el dibujo tampoco.
          dibujoDelGrafo().then((dibujo) => {
            const donde = `«${orden.texto}» (enunciado, linea ${orden.linea})`;
            const dibujado = `${dibujo.piezas.nodos}||${dibujo.piezas.ramas}||${dibujo.piezas.puntero}`;
            const enGit = JSON.stringify([git.historia, git.ramas, git.posicion, git.etiquetas]);

            expect(
              dibujo.hay,
              `el panel del grafo tiene que seguir dibujando tras ${donde}; muestra «${dibujo.leyendaVacia ?? ''}»`,
            ).to.equal(true);
            for (const nodo of nodosSolidosPintados(dibujo)) {
              expect(
                nodo.visible,
                `la confirmacion «${nodo.mensaje}» se pinta tras ${donde}`,
              ).to.equal(true);
            }
            // Se afirma en una sola direccion, a proposito: si lo que Git
            // cambio es de lo que el grafo dibuja, el dibujo tiene que haber
            // cambiado. La direccion contraria no se afirma porque el dibujo
            // tiene motivos legitimos para moverse sin que esos cuatro campos
            // cambien, como que un guardado temporal deje de ser huerfana una
            // confirmacion.
            if (dibujadoAnterior !== null && enGit !== gitAnterior) {
              expect(
                dibujado,
                `el grafo tenia que moverse tras ${donde}, porque Git cambio lo que el grafo dibuja`,
              ).to.not.equal(dibujadoAnterior);
            }
            dibujadoAnterior = dibujado;
            gitAnterior = enGit;
            movimiento.push({
              paso: numeroDePaso,
              orden: orden.texto,
              piezas: dibujo.piezas,
            });
          });

          // Y el directorio de trabajo entero, **incluido lo que esta limpio**.
          //
          // Comparar solo lo pendiente dejo pasar un directorio completo
          // equivocado: sobre la rama `mexicana`, abierta tres confirmaciones
          // atras, el simulador seguia mostrando recetas que ahi no existian, y
          // todas estaban limpias. Va al final porque la sonda escribe `ls` y
          // despues retrocede: lo demas se lee antes de tocar nada.
          cy.task<readonly string[]>('directorioDeGit', lab).then((enDisco) => {
            directorioDelSimulador().then((enPantalla) => {
              expect(
                enPantalla,
                `directorio de trabajo tras «${orden.texto}» (enunciado, linea ${orden.linea})`,
              ).to.deep.equal([...enDisco]);
            });
          });
        });
      }
    });
  });

  it('el recorrido mueve las piezas que le tocan', () => {
    // El informe de que se movio despues de cada orden, pieza por pieza (punto
    // 4.1 del SPEC 011). Se escribe **antes** de afirmar nada, para que quede
    // aunque la afirmacion falle: es justo cuando falla cuando hace falta.
    cy.task('anotarMovimiento', { laboratorio: numero, pasos: movimiento }).then(() => {
      // Las cinco piezas que todo laboratorio del taller mueve. Una que se
      // queda quieta el recorrido entero es una que el guion no llega a
      // ejercitar, y entonces el recorrido no prueba lo que el laboratorio
      // enseña. `previsualizacion` y `guardado` no entran: la primera solo se
      // ve mientras se escribe y la segunda solo en los laboratorios que usan
      // el guardado temporal.
      const moviles = PIEZAS.filter((pieza) =>
        movimiento.some(
          (paso, indice) =>
            indice > 0 && paso.piezas[pieza] !== movimiento[indice - 1]?.piezas[pieza],
        ),
      );
      expect(moviles, `piezas que se movieron en el laboratorio ${numero}`).to.include.members([
        'nodos',
        'ramas',
        'puntero',
        'areas',
        'tiempo',
      ]);
    });
  });

  it('el guion entero queda cubierto, sin categorias intermedias', () => {
    cy.then(() => {
      const cuenta = resumen(ordenes);
      const declaradas = ordenes.filter((orden) => orden.clase === 'declarada');
      cy.log(
        `lab-${numero}: ${cuenta.comparadas} comparadas, ${cuenta.declaradas} declaradas, ${cuenta.omitidas} con marcador, ${cuenta.enTerminal} en terminal`,
      );
      cy.task('anotarCobertura', {
        laboratorio: numero,
        total: cuenta.total,
        comparadas: cuenta.comparadas,
        declaradas: cuenta.declaradas,
        conMarcador: cuenta.omitidas,
        // Las que el enunciado saca del simulador a proposito, y el porcentaje
        // del guion que queda en pantalla.
        enTerminal: cuenta.enTerminal,
        enPantalla: `${cuenta.enPantalla} %`,
      });
      // eslint-disable-next-line no-console
      console.table(
        declaradas.map((orden) => ({ orden: orden.texto, motivo: orden.motivo })),
      );
      // Cada orden esta en una de las tres, y ninguna quedo sin decidir.
      expect(cuenta.comparadas + cuenta.declaradas + cuenta.omitidas).to.equal(cuenta.total);
      expect(cuenta.comparadas, 'la mayoria del guion se compara').to.be.greaterThan(
        cuenta.declaradas + cuenta.omitidas,
      );
    });
  });
}

describe('laboratorio 02 · leer la historia y abrir la caja', () => {
  recorrer('02');
});

describe('laboratorio 03 · ordenar el recetario', () => {
  recorrer('03');
});

describe('laboratorio 04 · tres cocinas en paralelo', () => {
  recorrer('04');
});

describe('laboratorio 05 · fusionar y resolver', () => {
  recorrer('05');
});

describe('laboratorio 06 · retroceder, revertir y etiquetar', () => {
  recorrer('06');
});

after(() => {
  cy.task('limpiar');
});
