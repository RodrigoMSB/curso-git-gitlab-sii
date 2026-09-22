/**
 * El grafo tiene que caber (SPEC 016, CA1).
 *
 * En los ocho escenarios, en los dos modos y en los dos temas, cada etiqueta
 * de rama y el puntero de posicion tienen que estar a la vista: dentro de la
 * parte del panel del grafo que no esta desplazada fuera, y dentro de la
 * ventana. Se mide lo que el navegador pinto, con `getBoundingClientRect`,
 * no lo que el modelo dice (seccion 37).
 *
 * Nacio de un defecto concreto: tras el rebase del laboratorio 07, en modo
 * relator, el grafo se cortaba antes de `main` y la leccion entera, donde
 * quedo `main` y donde quedo la rama reescrita, se perdia de vista. Ese estado
 * se prueba ademas de los iniciales.
 */

const CONSOLA = '[data-prueba="entrada-consola"]';
const ESCENARIOS = ['01', '02', '03', '04', '05', '06', '07', '09'];

/**
 * Las etiquetas de rama y el puntero que no quedan enteros a la vista.
 *
 * **La vista es la interseccion de todo lo que recorta**, no la caja del
 * dibujo. La primera version de esta prueba media contra la caja que tiene
 * `overflow-auto`, y paso en verde con el defecto presente: esa caja lleva
 * `max-h-full` sobre un padre de alto automatico, asi que el porcentaje no se
 * resuelve y crece con el dibujo entero; quien recorta es la seccion de
 * afuera, con `overflow-hidden`. Ahora se sube por los antepasados y se
 * interseca cada uno que recorte, y al final la ventana.
 */
function fueraDeLaVista(ventana: Window, etiquetas: readonly Element[]): string[] {
  const fuera: string[] = [];
  for (const etiqueta of etiquetas) {
    const caja = etiqueta.getBoundingClientRect();
    let arriba = 0;
    let abajo = ventana.innerHeight;
    let izquierda = 0;
    let derecha = ventana.innerWidth;
    for (let ancestro = etiqueta.parentElement; ancestro !== null; ancestro = ancestro.parentElement) {
      const estilo = ventana.getComputedStyle(ancestro);
      if (estilo.overflowX === 'visible' && estilo.overflowY === 'visible') continue;
      const marco = ancestro.getBoundingClientRect();
      arriba = Math.max(arriba, marco.top);
      abajo = Math.min(abajo, marco.bottom);
      izquierda = Math.max(izquierda, marco.left);
      derecha = Math.min(derecha, marco.right);
    }
    const dentro =
      caja.width > 0 &&
      caja.top >= arriba - 0.5 &&
      caja.bottom <= abajo + 0.5 &&
      caja.left >= izquierda - 0.5 &&
      caja.right <= derecha + 0.5;
    if (!dentro) {
      fuera.push(`${(etiqueta as HTMLElement).dataset.etiqueta} (termina en ${Math.round(caja.bottom)}, la vista en ${Math.round(abajo)})`);
    }
  }
  return fuera;
}

/**
 * Espera a que el grafo este dibujado y exige que no quede ninguna etiqueta
 * fuera. Se reintenta sobre las etiquetas ya pintadas: medir antes de que
 * existan daria una lista vacia, que tambien es «ninguna fuera».
 */
function todasALaVista(): void {
  cy.window().then((ventana) => {
    cy.get('g[data-forma="rama"], g[data-forma="puntero"]').should(($etiquetas) => {
      expect($etiquetas.length, 'etiquetas dibujadas').to.be.greaterThan(0);
      expect(fueraDeLaVista(ventana, $etiquetas.toArray())).to.deep.equal([]);
    });
  });
}

function preparar(lab: string, modo: string, tema: string): void {
  cy.visit(`/SIMULADOR.html?lab=${lab}`);
  if (modo === 'relator') cy.contains('button', 'modo relator').click();
  if (tema === 'claro') cy.contains('button', 'tema claro').click();
}

for (const tema of ['oscuro', 'claro']) {
  for (const modo of ['normal', 'relator']) {
    describe(`CA1 · todas las etiquetas a la vista · tema ${tema}, modo ${modo}`, () => {
      for (const lab of ESCENARIOS) {
        it(`laboratorio ${lab}`, () => {
          preparar(lab, modo, tema);
          // El 01 arranca sin repositorio: no hay nada que dibujar ni que
          // perder de vista, y se comprueba que de verdad no haya etiquetas.
          if (lab === '01') cy.get('g[data-forma]').should('not.exist');
          else todasALaVista();
        });
      }

      it('laboratorio 07 despues del rebase, que es donde se perdia main', () => {
        preparar('07', modo, tema);
        cy.get(CONSOLA).type('git rebase main{enter}', { delay: 4 });
        cy.get('g[data-huerfana="si"]').should('have.length', 4);
        cy.get('g[data-etiqueta="main"]').should('exist');
        todasALaVista();
      });
    });
  }
}
