/**
 * La disposicion de la pantalla (SPEC 017), contra el navegador de verdad.
 *
 * La consola ocupa la columna entera y ancla su contenido abajo; el tirador
 * reparte el ancho entre el veinticuatro y el setenta y dos por ciento, con
 * raton, con dedo y con teclado, y el reparto sobrevive al cambio de
 * escenario. Se mide lo que el navegador pinta.
 */

const CONSOLA = '[data-prueba="entrada-consola"]';
const TIRADOR = '[role="separator"]';

function ejecutar(orden: string): void {
  cy.get(CONSOLA).clear().type(orden, { delay: 2, parseSpecialCharSequences: false }).type('{enter}');
}

/** Porcentaje del ancho del bloque central que ocupa la consola. */
function repartoPintado(): Cypress.Chainable<number> {
  return cy.get('section[aria-label="Consola"]').then(($consola) => {
    const bloque = $consola.parent()[0] as HTMLElement;
    return ($consola[0]?.getBoundingClientRect().width ?? 0) / bloque.clientWidth * 100;
  });
}

/**
 * Arrastra el tirador hasta un porcentaje del bloque, con eventos de puntero
 * del tipo pedido.
 *
 * Se despachan `PointerEvent` de verdad. El `trigger` de Cypress fabrica un
 * evento generico con las propiedades pegadas encima, y con el el arrastre no
 * ocurria; con un raton de verdad, conducido por el protocolo de Chrome, si.
 * Un `PointerEvent` con `pointerType: 'touch'` es lo que el navegador entrega
 * cuando arrastra un dedo.
 */
function arrastrarA(porcentaje: number, tipo: 'mouse' | 'touch'): void {
  const comun = { pointerId: tipo === 'touch' ? 7 : 1, pointerType: tipo, isPrimary: true, bubbles: true, cancelable: true };
  /** Despacha un evento de puntero sobre el tirador, a la altura de su centro. */
  const despachar = (tipoEvento: string, x: (tirador: DOMRect, bloque: DOMRect) => number, botones: number): void => {
    cy.get('section[aria-label="Consola"]').parent().then(($bloque) => {
      cy.get(TIRADOR).then(($tirador) => {
        const tirador = $tirador[0] as HTMLElement;
        const ventana = tirador.ownerDocument.defaultView as Window & typeof globalThis;
        const caja = tirador.getBoundingClientRect();
        const bloque = ($bloque[0] as HTMLElement).getBoundingClientRect();
        tirador.dispatchEvent(
          new ventana.PointerEvent(tipoEvento, {
            ...comun,
            clientX: x(caja, bloque),
            clientY: caja.top + caja.height / 2,
            buttons: botones,
          }),
        );
      });
    });
    // Con la pulsacion y el movimiento en el mismo instante, dentro de
    // Cypress el movimiento se perdia; una mano de verdad nunca los junta.
    cy.wait(40);
  };
  const destino = (_: DOMRect, bloque: DOMRect): number => bloque.left + (bloque.width * porcentaje) / 100;
  despachar('pointerdown', (caja) => caja.left + caja.width / 2, 1);
  despachar('pointermove', destino, 1);
  despachar('pointerup', destino, 0);
}

describe('CA1 · la consola ocupa la columna y deja el prompt abajo', () => {
  beforeEach(() => cy.visit('/SIMULADOR.html?lab=05'));

  it('ocupa el alto entero del bloque, igual que el grafo', () => {
    cy.get('section[aria-label="Consola"]').then(($consola) => {
      cy.get('section[aria-label="Grafo de confirmaciones"]').should(($grafo) => {
        const consola = $consola[0]?.getBoundingClientRect();
        const grafo = $grafo[0]?.getBoundingClientRect();
        expect(Math.round(consola?.top ?? 0)).to.equal(Math.round(grafo?.top ?? -1));
        expect(Math.round(consola?.bottom ?? 0)).to.equal(Math.round(grafo?.bottom ?? -1));
      });
    });
  });

  it('con poco texto, lo escrito queda abajo y el espacio que sobra, arriba', () => {
    // Pegado al prompt no alcanza: la consola de antes tambien lo dejaba asi,
    // porque media lo que su contenido. Lo que cambio es donde queda el
    // espacio sobrante, y eso es lo que se mide.
    ejecutar('git status');
    cy.get('section[aria-label="Consola"] .overflow-auto').should(($caja) => {
      const caja = ($caja[0] as HTMLElement).getBoundingClientRect();
      const renglones = [...($caja[0] as HTMLElement).querySelectorAll('[data-color]')];
      const primero = renglones[0]?.getBoundingClientRect();
      const ultimo = renglones.at(-1)?.getBoundingClientRect();
      expect((primero?.top ?? 0) - caja.top, 'espacio arriba').to.be.greaterThan(150);
      expect(caja.bottom - (ultimo?.bottom ?? 0), 'lo escrito, abajo').to.be.lessThan(40);
    });
  });

  it('despues de cada orden el prompt sigue a la vista y la consola baja sola al final', () => {
    for (let vez = 0; vez < 8; vez += 1) ejecutar('git log --oneline');
    cy.get('section[aria-label="Consola"] .overflow-auto').should(($caja) => {
      const caja = $caja[0] as HTMLElement;
      expect(caja.scrollHeight, 'el historial se desplaza').to.be.greaterThan(caja.clientHeight);
      expect(caja.scrollHeight - caja.scrollTop - caja.clientHeight, 'esta al final').to.be.lessThan(4);
    });
    cy.get(CONSOLA).should(($campo) => {
      const campo = $campo[0]?.getBoundingClientRect();
      expect(campo?.bottom ?? Number.POSITIVE_INFINITY).to.be.lessThan(Cypress.config('viewportHeight'));
    });
  });
});

describe('CA2 · el tirador reparte el ancho', () => {
  beforeEach(() => cy.visit('/SIMULADOR.html?lab=05'));

  it('se arrastra con el raton', () => {
    arrastrarA(40, 'mouse');
    repartoPintado().should('be.closeTo', 40, 1);
  });

  it('se arrastra con el dedo', () => {
    arrastrarA(55, 'touch');
    repartoPintado().should('be.closeTo', 55, 1);
  });

  it('no baja del veinticuatro ni pasa del setenta y dos', () => {
    arrastrarA(5, 'mouse');
    repartoPintado().should('be.closeTo', 24, 0.5);
    arrastrarA(95, 'mouse');
    repartoPintado().should('be.closeTo', 72, 0.5);
  });

  it('se mueve con el teclado', () => {
    cy.get(TIRADOR).focus().type('{home}');
    cy.get(TIRADOR).should('have.attr', 'aria-valuenow', '24');
    cy.get(TIRADOR).type('{rightArrow}{rightArrow}');
    repartoPintado().should('be.closeTo', 28, 0.5);
  });

  it('el reparto sobrevive al cambio de escenario', () => {
    arrastrarA(35, 'mouse');
    repartoPintado().should('be.closeTo', 35, 1);
    cy.get('select').select('lab-07');
    cy.get('g[data-etiqueta="trabajo"]').should('exist');
    repartoPintado().should('be.closeTo', 35, 1);
  });

  it('el de partida deja entrar la salida mas larga del guion sin partirla', () => {
    // El `renamed:` de noventa caracteres del laboratorio 03, a 1600 pixeles
    // en modo normal, que es el ancho de las pruebas.
    cy.visit('/SIMULADOR.html?lab=03');
    cy.get('section[aria-label="Consola"] .overflow-auto').then(($caja) => {
      const linea = document.createElement('pre');
      linea.className = 'whitespace-pre-wrap font-mono';
      linea.textContent = `        renamed:    recetas/pastel-de-choclo.md -> recetas/principales/pastel-de-choclo.md`;
      $caja[0]?.appendChild(linea);
      const alto = linea.getBoundingClientRect().height;
      const unaLinea = Number.parseFloat(getComputedStyle(linea).lineHeight);
      linea.remove();
      expect(alto, 'una sola linea').to.be.lessThan(unaLinea * 1.5);
    });
  });
});

describe('SPEC 017 · la barra y las areas', () => {
  beforeEach(() => cy.visit('/SIMULADOR.html?lab=05'));

  it('CA3 · quedan tres areas, sin el remoto', () => {
    cy.get('[data-columna]').should('have.length', 3);
    cy.get('[data-columna="remoto"]').should('not.exist');
    cy.contains('Repositorio remoto').should('not.exist');
  });

  it('CA4 · el tema es un boton redondo al extremo superior derecho, y cambia el tema', () => {
    cy.get('header').then(($barra) => {
      cy.get('button[aria-label="Cambiar tema"]').should(($boton) => {
        const barra = $barra[0]?.getBoundingClientRect();
        const boton = $boton[0]?.getBoundingClientRect();
        expect((barra?.right ?? 0) - (boton?.right ?? 0), 'pegado a la derecha').to.be.lessThan(40);
        expect((boton?.top ?? 0) - (barra?.top ?? 0), 'arriba').to.be.lessThan(30);
        expect(Math.round(boton?.width ?? 0)).to.equal(Math.round(boton?.height ?? -1));
      });
    });
    cy.document().its('documentElement.dataset.tema').should('equal', 'oscuro');
    cy.get('button[aria-label="Cambiar tema"]').click();
    cy.document().its('documentElement.dataset.tema').should('equal', 'claro');
  });

  it('CA5 · encendido y apagado se distinguen por la luz, sin leer el texto', () => {
    cy.contains('button', 'previsualización').find('.luz').then(($encendida) => {
      cy.contains('button', 'modo relator').find('.luz').should(($apagada) => {
        const encendida = getComputedStyle($encendida[0] as Element).backgroundColor;
        const apagada = getComputedStyle($apagada[0] as Element).backgroundColor;
        expect(encendida).to.not.equal(apagada);
      });
    });
  });
});
