/**
 * La interfaz contra el navegador de verdad (seccion 9 del SPEC 008).
 *
 * Hasta aqui la pantalla estaba probada por su modelo de vista, que es codigo
 * puro. Lo que ninguna prueba tocaba era el navegador: que la consola reciba
 * texto, que las flechas recorran el historial, que la linea de tiempo
 * retroceda de verdad. Esto se corre sobre el artefacto construido, el mismo
 * que el participante abre.
 */

const CONSOLA = '[data-prueba="entrada-consola"]';

/** Escribe una orden y la ejecuta, como lo haria el participante. */
function ejecutar(orden: string): void {
  cy.get(CONSOLA)
    .clear()
    .type(orden, { delay: 4, parseSpecialCharSequences: false })
    .type('{enter}');
}

/** Confirmaciones dibujadas que ya existen, sin contar las previsualizadas. */
function nodosSolidos(): Cypress.Chainable<JQuery<HTMLElement>> {
  return cy.get('g[data-confirmacion][data-previsualizada="no"]');
}

/**
 * Deja una confirmacion nueva. Va con un cambio de verdad y no con
 * `--allow-empty`, que el motor no implementa.
 */
function confirmarAlgo(): void {
  ejecutar('echo "sopaipillas" >> platos.md');
  ejecutar('git add platos.md');
  ejecutar('git commit -m "una mas"');
}

describe('9.1 · la consola recibe texto y ejecuta al apretar entrada', () => {
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=03');
  });

  it('la orden aparece en la consola y su salida debajo', () => {
    ejecutar('git status');
    cy.get('[aria-label="Consola"]').should('contain.text', 'git status');
    cy.get('[aria-label="Consola"]').should('contain.text', 'nothing to commit');
  });

  it('la orden cambia el estado que la pantalla muestra', () => {
    nodosSolidos().should('have.length', 4);
    confirmarAlgo();
    nodosSolidos().should('have.length', 5);
  });

  it('el campo queda vacio despues de ejecutar, listo para la siguiente', () => {
    ejecutar('git status');
    cy.get(CONSOLA).should('have.value', '');
  });
});

describe('9.2 · el historial de ordenes responde a las flechas', () => {
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=03');
    ejecutar('git status');
    ejecutar('git log --oneline');
  });

  it('la flecha hacia arriba trae la ultima orden, y otra vez la anterior', () => {
    cy.get(CONSOLA).type('{upArrow}').should('have.value', 'git log --oneline');
    cy.get(CONSOLA).type('{upArrow}').should('have.value', 'git status');
  });

  it('la flecha hacia abajo vuelve sobre sus pasos hasta dejar el campo vacio', () => {
    cy.get(CONSOLA).type('{upArrow}{upArrow}').should('have.value', 'git status');
    cy.get(CONSOLA).type('{downArrow}').should('have.value', 'git log --oneline');
    cy.get(CONSOLA).type('{downArrow}').should('have.value', '');
  });
});

describe('9.3 · la previsualizacion aparece al escribir y desaparece al borrar', () => {
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=03');
  });

  it('escribir una orden que crearia una confirmacion la dibuja discontinua', () => {
    cy.get('g[data-confirmacion][data-previsualizada="si"]').should('not.exist');
    ejecutar('echo "sopaipillas" >> platos.md');
    ejecutar('git add platos.md');
    cy.get(CONSOLA).type('git commit -m "prueba"', {
      delay: 4,
      parseSpecialCharSequences: false,
    });
    cy.get('g[data-confirmacion][data-previsualizada="si"]').should('have.length', 1);
    // La confirmacion anunciada todavia no existe: sigue habiendo cuatro.
    nodosSolidos().should('have.length', 4);
  });

  it('borrar la orden hace desaparecer lo anunciado', () => {
    ejecutar('echo "sopaipillas" >> platos.md');
    ejecutar('git add platos.md');
    cy.get(CONSOLA).type('git commit -m "prueba"', {
      delay: 4,
      parseSpecialCharSequences: false,
    });
    cy.get('g[data-confirmacion][data-previsualizada="si"]').should('exist');
    cy.get(CONSOLA).clear();
    cy.get('g[data-confirmacion][data-previsualizada="si"]').should('not.exist');
  });

  it('una orden que no toca el grafo no anuncia nada', () => {
    cy.get(CONSOLA).type('git status', { delay: 4 });
    cy.get('g[data-confirmacion][data-previsualizada="si"]').should('not.exist');
  });
});

describe('9.4 · la linea de tiempo retrocede y el grafo vuelve atras', () => {
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=03');
    confirmarAlgo();
  });

  it('retroceder devuelve el grafo al estado anterior', () => {
    nodosSolidos().should('have.length', 5);
    cy.contains('button', 'retroceder').click();
    nodosSolidos().should('have.length', 4);
  });

  it('avanzar vuelve a dejarlo como estaba', () => {
    cy.contains('button', 'retroceder').click();
    nodosSolidos().should('have.length', 4);
    cy.contains('button', 'avanzar').click();
    nodosSolidos().should('have.length', 5);
  });

  it('la linea de tiempo lleva un paso por orden ejecutada', () => {
    // Un paso por orden ejecutada, mas el estado inicial.
    cy.get('[aria-label="Línea de tiempo"]').should('contain.text', 'paso 4 de 4');
  });
});

describe('9.5 · el selector cambia de escenario', () => {
  it('elegir otro laboratorio carga su historia', () => {
    cy.visit('/SIMULADOR.html?lab=03');
    nodosSolidos().should('have.length', 4);

    cy.get('select').select('lab-02');
    nodosSolidos().should('have.length', 5);
    cy.get('g[data-mensaje="se docuemnta la reseta del pastel de choclo"]').should('exist');
  });

  it('la direccion del archivo preselecciona el escenario', () => {
    // El mecanismo del SPEC 007, comprobado en el navegador.
    cy.visit('/SIMULADOR.html?lab=06');
    cy.get('select').should('have.value', 'lab-06');
    cy.get('g[data-etiqueta="peruana"]').should('exist');
  });
});

describe('9.6 · el modo relator agranda la letra y oculta los paneles secundarios', () => {
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=02');
    // Con algo guardado hay un panel secundario que ocultar.
    ejecutar('git stash push -m "a medias"');
  });

  it('los paneles secundarios estan a la vista antes de encenderlo', () => {
    cy.contains('h2', 'Pila de guardado temporal').should('be.visible');
  });

  it('encenderlo agranda la escala de la pantalla', () => {
    cy.get('[data-relator]').should('have.attr', 'data-relator', 'false');
    cy.contains('button', 'modo relator').click();
    cy.get('[data-relator]').should('have.attr', 'data-relator', 'true');
    cy.get('[data-relator]')
      .should('have.attr', 'style')
      .and('match', /--escala:\s*1\.[0-9]/);
  });

  it('encenderlo oculta los paneles secundarios', () => {
    cy.contains('button', 'modo relator').click();
    cy.contains('h2', 'Pila de guardado temporal').should('not.exist');
  });

  it('apagarlo los devuelve', () => {
    cy.contains('button', 'modo relator').click();
    cy.contains('button', 'modo relator').click();
    cy.contains('h2', 'Pila de guardado temporal').should('be.visible');
  });
});

describe('9.7 · toda la interfaz se puede recorrer con el teclado', () => {
  // Criterio CA8 del SPEC 002, que hasta aqui estaba verificado solo por
  // inspeccion de los componentes.
  beforeEach(() => {
    cy.visit('/SIMULADOR.html?lab=02');
  });

  it('cada control se puede alcanzar con la tabulacion', () => {
    // Ningun control queda fuera del orden natural del documento, que es lo
    // que un tabindex positivo romperia.
    cy.get('[tabindex]').each((elemento) => {
      expect(Number(elemento.attr('tabindex')), 'ningun tabindex positivo').to.be.lessThan(1);
    });
    cy.get('button, select, input, [tabindex="0"]').should('have.length.greaterThan', 5);
  });

  it('los controles se pueden enfocar con el teclado', () => {
    cy.get(CONSOLA).focus().should('have.focus');
    cy.contains('button', 'modo relator').focus().should('have.focus');
    cy.get('select').focus().should('have.focus');
  });

  it('lo que se pulsa y no es un boton nativo se puede enfocar y tiene nombre', () => {
    // Las confirmaciones del grafo son elementos SVG, que no pueden ser un
    // boton nativo. Se exige entonces lo que un boton nativo da gratis: parada
    // de tabulacion y un nombre que se pueda anunciar.
    cy.get('[role="button"]:not(button)').each((elemento) => {
      expect(elemento.attr('tabindex'), 'parada de tabulacion').to.equal('0');
      expect(elemento.attr('aria-label') ?? '', 'nombre anunciable').to.not.equal('');
    });
  });

  it('no hay divisiones con manejador de pulsacion haciendose pasar por controles', () => {
    // Un `div` con onClick se ve igual que un boton y no responde al teclado.
    cy.get('div[onclick], span[onclick]').should('not.exist');
  });

  it('cada control alcanzable tiene un nombre que un lector de pantalla puede decir', () => {
    cy.get('button, select, input').each((elemento) => {
      const nombre =
        elemento.attr('aria-label') ?? elemento.attr('title') ?? elemento.text().trim();
      expect(nombre, `control sin nombre: ${elemento.prop('outerHTML')}`).to.not.equal('');
    });
  });

  it('el grafo se anuncia como imagen con su descripcion', () => {
    cy.get('svg[role="img"]').should('have.attr', 'aria-label', 'Grafo de confirmaciones');
  });
});
