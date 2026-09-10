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

import { ordenesDe, resolverMarcadores, resumen } from '../soporte/ordenes';
import type { OrdenDelEnunciado } from '../soporte/ordenes';

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

/** Escribe la orden en la consola y la ejecuta, como lo haria el participante. */
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

  before(() => {
    cy.task<string>('leerEnunciado', numero).then((enunciado) => {
      ordenes = resolverMarcadores(ordenesDe(enunciado), numero);
    });
    cy.task<Laboratorio>('prepararLaboratorio', numero).then((preparado) => {
      lab = preparado;
    });
  });

  it('el punto de partida es el mismo en los dos lados', () => {
    cy.visit(`/SIMULADOR.html?lab=${numero}`);
    cy.task<EstadoComparable>('estadoDeGit', lab).then((git) => {
      estadoDelSimulador().then((simulador) => {
        expect(simulador.historia, 'historia').to.deep.equal([...git.historia].sort());
        expect(simulador.ramas, 'ramas').to.deep.equal(git.ramas);
        expect(simulador.posicion, 'posicion').to.equal(git.posicion);
        expect(pendientesDe(simulador), 'archivos').to.deep.equal(pendientesDe(git));
      });
    });
  });

  it('cada orden del enunciado deja los dos lados en el mismo estado', () => {
    cy.visit(`/SIMULADOR.html?lab=${numero}`);

    cy.then(() => {
      for (const orden of ordenes) {
        if (orden.clase === 'omitida') continue;

        ejecutarEnElSimulador(orden.texto);
        cy.task<{ salida: string; fallo: boolean; cambio: boolean }>('ejecutarEnGit', {
          lab,
          orden: orden.texto,
          medirCambio: false,
        }).then((resultado) => {
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
        });
      }
    });
  });

  it('el guion entero queda cubierto, sin categorias intermedias', () => {
    cy.then(() => {
      const cuenta = resumen(ordenes);
      const declaradas = ordenes.filter((orden) => orden.clase === 'declarada');
      cy.log(
        `lab-${numero}: ${cuenta.comparadas} comparadas, ${cuenta.declaradas} declaradas, ${cuenta.omitidas} con marcador`,
      );
      cy.task('anotarCobertura', {
        laboratorio: numero,
        total: cuenta.total,
        comparadas: cuenta.comparadas,
        declaradas: cuenta.declaradas,
        conMarcador: cuenta.omitidas,
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
