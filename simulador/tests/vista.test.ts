/**
 * Modelo de vista: consola, sesion con linea de tiempo y armado de la pantalla.
 *
 * Cubre los criterios CA2 y CA9 del SPEC 002 sobre el modelo que los
 * componentes reciben ya resuelto.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { repoConRamas, repoLineal, repoVacio } from './ayudas';
import { colorearSalida, completar, indicadorDe, navegarHistorial } from '../src/vista/consola';
import {
  avanzar,
  ejecutarOrden,
  estadoDe,
  iniciarSesion,
  irAPaso,
  renglonesDe,
  retroceder,
  seleccionarConfirmacion,
} from '../src/vista/sesion';
import {
  columnasDeAreas,
  construirPantalla,
  ESCALA_RELATOR,
  panelesVisibles,
  resumenBarra,
  TEXTO_MINIMO,
} from '../src/vista/pantalla';

const OPCIONES = { previsualizacionActiva: true, entrada: '', modoRelator: false };

function correrSesion(escenario: string, ...ordenes: readonly string[]) {
  return ordenes.reduce((sesion, orden) => ejecutarOrden(sesion, orden), iniciarSesion(escenario));
}

describe('consola', () => {
  it('4.1 el indicador reproduce el de Git Bash, con carpeta y rama', () => {
    const indicador = indicadorDe(repoConRamas());
    expect(indicador.usuario).toContain('MINGW64');
    // La ruta que el participante ve en su terminal, no solo la ultima carpeta.
    expect(indicador.ruta).toBe('~/taller-git-trabajo/lab-06/recetario');
    expect(indicador.rama).toBe('main');
  });

  it('4.5 la salida larga de git status va en verde lo preparado y en rojo lo pendiente', () => {
    const estado = ejecutar(
      ejecutar(
        ejecutar(repoConRamas(), 'echo "x" >> notas.tmp').estado,
        'git add notas.tmp',
      ).estado,
      'echo "x" >> platos.md',
    ).estado;
    const salida = ejecutar(estado, 'git status').salida;
    const renglones = colorearSalida(salida, 'p');

    const preparado = renglones.find((renglon) => renglon.texto.includes('notas.tmp'));
    const modificado = renglones.find((renglon) => renglon.texto.includes('modified:'));
    expect(preparado?.color).toBe('exito');
    expect(modificado?.color).toBe('error');
  });

  it('4.5 la forma corta colorea por el codigo de dos columnas', () => {
    const conEstorbos = ejecutar(
      ejecutar(repoConRamas(), 'echo "x" >> notas.tmp').estado,
      'echo "x" >> respaldo.bak',
    ).estado;
    const estado = ejecutar(conEstorbos, 'git add notas.tmp').estado;
    const renglones = colorearSalida(ejecutar(estado, 'git status -s').salida, 'p');

    expect(renglones.find((r) => r.texto.startsWith('A '))?.color).toBe('exito');
    expect(renglones.find((r) => r.texto.startsWith('??'))?.color).toBe('error');
  });

  it('4.5 el conflicto va en rojo y el aviso de fusion en amarillo', () => {
    const renglones = colorearSalida(
      ejecutar(repoConRamas(), 'git merge andina').salida,
      'p',
    );
    expect(renglones.find((r) => r.texto.startsWith('CONFLICT'))?.color).toBe('error');
    expect(renglones.find((r) => r.texto.startsWith('Auto-merging'))?.color).toBe('aviso');
  });

  it('4.5 los errores del motor se pintan como errores', () => {
    const renglones = colorearSalida(ejecutar(repoConRamas(), 'gti status').salida, 'p');
    expect(renglones[0]?.color).toBe('error');
  });

  it('4.4 la tabulacion completa cuando hay una unica coincidencia', () => {
    const estado = repoConRamas();
    expect(completar('git swi', estado).texto).toBe('git switch');
    expect(completar('git switch tail', estado).texto).toBe('git switch tailandesa');
    expect(completar('pw', estado).texto).toBe('pwd');
  });

  it('4.4 con varias coincidencias las lista y no completa', () => {
    const resultado = completar('git re', repoConRamas());
    expect(resultado.texto).toBeNull();
    expect(resultado.sugerencias).toEqual(
      expect.arrayContaining(['rebase', 'reflog', 'remote', 'reset', 'restore', 'revert']),
    );
  });

  it('4.4 sin coincidencias no propone nada', () => {
    const resultado = completar('git zzz', repoConRamas());
    expect(resultado.texto).toBeNull();
    expect(resultado.sugerencias).toHaveLength(0);
  });

  it('4.2 las flechas recorren el historial y vuelven a la linea en blanco', () => {
    const historial = ['git status', 'git add .', 'git commit -m "uno"'];

    const primera = navegarHistorial(historial, 0, 'anterior');
    expect(primera).toEqual({ indice: 1, texto: 'git commit -m "uno"' });

    const segunda = navegarHistorial(historial, primera.indice, 'anterior');
    expect(segunda.texto).toBe('git add .');

    const tope = navegarHistorial(historial, 3, 'anterior');
    expect(tope.indice).toBe(3);

    const vuelta = navegarHistorial(historial, 1, 'siguiente');
    expect(vuelta).toEqual({ indice: 0, texto: '' });
  });
});

describe('sesion y linea de tiempo', () => {
  it('7.1 retroceder devuelve el estado y la consola de ese momento', () => {
    const sesion = correrSesion('lab-08', 'git switch tailandesa', 'git switch main');
    expect(sesion.pasos).toHaveLength(3);

    const atras = retroceder(sesion);
    expect(estadoDe(atras).puntero).toEqual({ tipo: 'rama', rama: 'tailandesa' });
    expect(renglonesDe(atras).length).toBeLessThan(renglonesDe(sesion).length);

    const adelante = avanzar(atras);
    expect(estadoDe(adelante).puntero).toEqual({ tipo: 'rama', rama: 'main' });
  });

  it('7.2 ejecutar desde un punto anterior corta la historia desde ahi', () => {
    const sesion = correrSesion('lab-08', 'git switch tailandesa', 'git switch main');
    const desdeElPrimero = ejecutarOrden(irAPaso(sesion, 1), 'git branch azteca');

    expect(desdeElPrimero.pasos).toHaveLength(3);
    expect(desdeElPrimero.pasos[2]?.orden).toBe('git branch azteca');
    expect(desdeElPrimero.pasos.map((paso) => paso.orden)).not.toContain('git switch main');
  });

  it('4.7 clear vacia la consola sin tocar el estado ni la linea de tiempo', () => {
    const antes = correrSesion('lab-08', 'git status');
    const despues = ejecutarOrden(antes, 'clear');

    expect(renglonesDe(despues)).toHaveLength(0);
    expect(despues.pasos).toHaveLength(3);
    expect(estadoDe(despues)).toEqual(estadoDe(antes));
  });

  it('una linea en blanco no agrega pasos', () => {
    const sesion = iniciarSesion('lab-08');
    expect(ejecutarOrden(sesion, '   ')).toBe(sesion);
  });

  it('los limites de la linea de tiempo no se pasan', () => {
    const sesion = iniciarSesion('lab-08');
    expect(retroceder(sesion).indice).toBe(0);
    expect(avanzar(sesion).indice).toBe(0);
    expect(irAPaso(sesion, 99).indice).toBe(0);
  });

  it('seleccionar dos veces la misma confirmacion la deselecciona', () => {
    const sesion = iniciarSesion('lab-08');
    const id = estadoDe(sesion).confirmaciones[0]?.id ?? '';
    expect(seleccionarConfirmacion(sesion, id).seleccion).toBe(id);
    expect(seleccionarConfirmacion(seleccionarConfirmacion(sesion, id), id).seleccion).toBeNull();
  });
});

describe('zona D: areas y paneles', () => {
  it('CA2 preparar un archivo lo pasa de la primera columna a la segunda', () => {
    // El escenario ya trae cocineros.md preparado: la columna de preparados
    // parte con ese, y al preparar ingredientes.md se le suma.
    const antes = columnasDeAreas(repoLineal());
    expect(antes[0]?.elementos.map((e) => e.texto)).toContain('ingredientes.md');
    expect(antes[1]?.elementos.map((e) => e.texto)).toEqual(['cocineros.md']);

    const despues = columnasDeAreas(ejecutar(repoLineal(), 'git add ingredientes.md').estado);
    expect(despues[0]?.elementos.map((e) => e.texto)).not.toContain('ingredientes.md');
    expect(despues[1]?.elementos.map((e) => e.texto)).toEqual(['ingredientes.md', 'cocineros.md']);
  });

  it('los rotulos de la zona D van acentuados', () => {
    const columnas = columnasDeAreas(repoVacio());
    expect(columnas.map((columna) => columna.titulo)).toEqual([
      'Directorio de trabajo',
      'Área de preparación',
      'Repositorio local',
      'Repositorio remoto',
    ]);
  });

  it('las cuatro columnas son fijas y siempre estan', () => {
    const columnas = columnasDeAreas(repoVacio());
    expect(columnas.map((columna) => columna.clave)).toEqual([
      'trabajo',
      'preparacion',
      'local',
      'remoto',
    ]);
    expect(columnas[3]?.vacio).toBe('sin remoto configurado');
  });

  it('los paneles que no aplican no se muestran', () => {
    const paneles = panelesVisibles(repoConRamas(), null, [], null, false);
    expect(paneles.guardado).toBeNull();
    expect(paneles.diferencias).toBeNull();
    expect(paneles.objetos).toBeNull();
  });

  it('el panel de guardado aparece cuando la pila tiene entradas', () => {
    const estado = ejecutar(repoLineal(), 'git stash push -m "a medias"').estado;
    const paneles = panelesVisibles(estado, 'git stash push -m "a medias"', [], null, false);
    expect(paneles.guardado).toHaveLength(1);
    expect(paneles.guardado?.[0]?.texto).toContain('stash@{0}');
    expect(paneles.guardado?.[0]?.archivos).toEqual(['ingredientes.md', 'cocineros.md']);
  });

  it('el panel de diferencias aparece solo tras una comparacion', () => {
    const sesion = correrSesion('lab-02', 'git diff');
    const conDiff = panelesVisibles(
      estadoDe(sesion),
      'git diff',
      renglonesDe(sesion),
      null,
      false,
    );
    expect(conDiff.diferencias?.some((renglon) => renglon.texto.includes('diff --git'))).toBe(true);

    const sinDiff = panelesVisibles(
      estadoDe(sesion),
      'git status',
      renglonesDe(sesion),
      null,
      false,
    );
    expect(sinDiff.diferencias).toBeNull();
  });

  it('9.2 el panel de objetos muestra la confirmacion, su arbol y sus elementos', () => {
    const estado = repoLineal();
    const id = estado.confirmaciones[3]?.id ?? '';
    const paneles = panelesVisibles(estado, null, [], id, false);

    expect(paneles.objetos?.confirmacion.id).toBe(id);
    expect(paneles.objetos?.confirmacion.campos.map((campo) => campo.clave)).toContain('tree');
    expect(paneles.objetos?.elementos.map((elemento) => elemento.nombre)).toEqual([
      'cocineros.md',
    ]);
    expect(paneles.objetos?.arbol.id).toBe(
      paneles.objetos?.confirmacion.campos.find((campo) => campo.clave === 'tree')?.valor,
    );
  });

  it('CA9 el modo relator oculta los tres paneles secundarios', () => {
    const estado = ejecutar(repoLineal(), 'git stash push -m "a medias"').estado;
    const id = estado.confirmaciones[0]?.id ?? '';

    const normal = panelesVisibles(estado, 'git diff', [], id, false);
    expect(normal.guardado).not.toBeNull();
    expect(normal.objetos).not.toBeNull();

    const relator = panelesVisibles(estado, 'git diff', [], id, true);
    expect(relator).toEqual({ guardado: null, diferencias: null, objetos: null });
  });

  it('8.3 la escala del modo relator deja el texto mas pequeno sobre catorce pixeles', () => {
    expect(TEXTO_MINIMO).toBeGreaterThanOrEqual(11);
    expect(TEXTO_MINIMO * ESCALA_RELATOR).toBeGreaterThanOrEqual(14);
  });
});

describe('barra de estado y armado de la pantalla', () => {
  it('resume el repositorio, la rama y los cambios sin confirmar', () => {
    const barra = resumenBarra(repoConRamas());
    expect(barra.repositorio).toBe('recetario');
    expect(barra.rama).toBe('main');
    expect(barra.desconectado).toBe(false);
    expect(barra.cambiosSinConfirmar).toBe(0);
    // El selector ofrece los diez laboratorios con escenario, en su orden.
    // El 09 no lleva escenario: es de terminal pura.
    expect(barra.escenarios.map((escenario) => escenario.laboratorio)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 10,
    ]);
  });

  it('avisa cuando la posicion quedo desconectada', () => {
    const estado = ejecutar(repoLineal(), 'git checkout HEAD~1').estado;
    expect(resumenBarra(estado).desconectado).toBe(true);
  });

  it('6.1 con la previsualizacion activa la pantalla anuncia lo que la orden haria', () => {
    const sesion = correrSesion('lab-02', 'git add platos.md');
    const pantalla = construirPantalla(sesion, {
      ...OPCIONES,
      entrada: 'git commit -m "Corrige"',
    });

    expect(pantalla.aviso?.confirmacionesNuevas).toBe(1);
    expect(pantalla.aviso?.punteroMovido).toBe(true);
    expect(pantalla.grafo.nodos.filter((nodo) => nodo.previsualizada)).toHaveLength(1);
  });

  it('CA3 al borrar la orden desaparece la confirmacion discontinua', () => {
    const sesion = iniciarSesion('lab-06');
    const conOrden = construirPantalla(sesion, {
      ...OPCIONES,
      entrada: 'git merge andina',
    });
    const sinOrden = construirPantalla(sesion, OPCIONES);

    expect(conOrden.grafo.nodos.filter((nodo) => nodo.previsualizada)).toHaveLength(1);
    expect(sinOrden.grafo.nodos.filter((nodo) => nodo.previsualizada)).toHaveLength(0);
  });

  it('con la previsualizacion apagada no se anuncia nada', () => {
    const sesion = iniciarSesion('lab-06');
    const pantalla = construirPantalla(sesion, {
      previsualizacionActiva: false,
      entrada: 'git merge andina',
      modoRelator: false,
    });

    expect(pantalla.aviso).toBeNull();
    expect(pantalla.grafo.nodos.some((nodo) => nodo.previsualizada)).toBe(false);
  });

  it('una orden invalida no anuncia nada', () => {
    const pantalla = construirPantalla(iniciarSesion('lab-08'), {
      ...OPCIONES,
      entrada: 'git merge fantasma',
    });
    expect(pantalla.aviso).toBeNull();
  });

  it('la union comprometida por un conflicto sigue dibujada hasta que se resuelve', () => {
    const enConflicto = correrSesion('lab-06', 'git merge andina');
    const pendiente = construirPantalla(enConflicto, OPCIONES);
    const anunciada = pendiente.grafo.nodos.find((nodo) => nodo.previsualizada);

    expect(anunciada).toBeDefined();
    expect(anunciada?.esUnion).toBe(true);

    const resuelta = construirPantalla(
      ejecutarOrden(
        ejecutarOrden(enConflicto, 'git add platos.md'),
        'git commit -m "Fusiona la cocina andina"',
      ),
      OPCIONES,
    );
    const solida = resuelta.grafo.nodos.find((nodo) => nodo.id === anunciada?.id);

    expect(solida?.previsualizada).toBe(false);
    expect(solida?.esUnion).toBe(true);
  });

  it('la linea de tiempo lleva un segmento por paso y marca el actual', () => {
    const sesion = correrSesion('lab-08', 'git status', 'git branch azteca');
    const pantalla = construirPantalla(irAPaso(sesion, 1), OPCIONES);

    expect(pantalla.segmentos).toHaveLength(3);
    expect(pantalla.segmentos[0]?.etiqueta).toBe('estado inicial');
    expect(pantalla.segmentos[1]?.actual).toBe(true);
    expect(pantalla.segmentos[2]?.futuro).toBe(true);
  });
});
