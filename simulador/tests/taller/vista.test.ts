/**
 * La vista del modo taller (SPEC 026): de lo que manda el programa local a la
 * pantalla del simulador.
 */

import { describe, expect, it } from 'vitest';
import {
  anotarCierre,
  anotarEstado,
  anotarOrden,
  anotarResultado,
  claveDelTaller,
  construirPantallaTaller,
  type EstadoTaller,
  indicadorTaller,
  iniciarSesionTaller,
  limpiarConsola,
  seleccionarEnTaller,
} from '../../src/vista';

const sha = (n: number): string => n.toString(16).padStart(40, `${n}`);
const c = (n: number, padres: number[], mensaje: string) => ({
  id: sha(n),
  padres: padres.map(sha),
  autor: 'P',
  correo: 'p@sii.cl',
  epoca: 1_800_000_000 + n,
  mensaje,
});

const REPOSITORIO: EstadoTaller = {
  huella: 'h1',
  carpeta: '/home/p/taller-git-trabajo/lab-04/recetario',
  indicador: '~/taller-git-trabajo/lab-04/recetario',
  ocupada: false,
  repositorio: true,
  raiz: '/home/p/taller-git-trabajo/lab-04/recetario',
  rama: 'main',
  cabeza: sha(3),
  // Como las entrega git log: de la mas nueva a la mas vieja.
  confirmaciones: [c(4, [2], 'huerfana'), c(3, [2], 'tercera'), c(5, [2], 'en peruana'), c(2, [1], 'segunda'), c(1, [], 'primera')],
  referencias: [
    { nombre: 'refs/heads/main', id: sha(3), anotada: false, mensaje: null },
    { nombre: 'refs/heads/peruana', id: sha(5), anotada: false, mensaje: null },
    { nombre: 'refs/tags/v1.0', id: sha(2), anotada: true, mensaje: 'primera version' },
    { nombre: 'refs/remotes/origin/main', id: sha(2), anotada: false, mensaje: null },
  ],
  movimientos: [
    { id: sha(3), descripcion: 'reset: moving to HEAD~1' },
    { id: sha(4), descripcion: 'commit: huerfana' },
  ],
  cambios: [
    { x: 'M', y: 'M', ruta: 'platos.md' },
    { x: 'R', y: ' ', ruta: 'recetas/nuevo.md', origen: 'recetas/viejo.md' },
    { x: 'U', y: 'U', ruta: 'cocineros.md' },
    { x: '?', y: '?', ruta: 'notas/' },
    { x: 'D', y: ' ', ruta: 'borrado.md' },
    { x: ' ', y: 'D', ruta: 'perdido.md' },
  ],
  guardados: [{ id: sha(6), base: sha(2), mensaje: 'WIP on main: 2222222 segunda', archivos: ['platos.md'] }],
  operacion: 'fusion',
};

const OPCIONES = { altoGrafo: null, anchoGrafo: null, modoRelator: false };

describe('la pantalla del modo taller', () => {
  const pantalla = construirPantallaTaller(anotarEstado(iniciarSesionTaller(), REPOSITORIO), OPCIONES);

  it('dibuja cada confirmacion con el identificador corto de Git, y la del registro que nada alcanza, como huerfana', () => {
    const nodos = pantalla.grafo.nodos.map((n) => `${n.id}:${n.huerfana ? 'huerfana' : 'viva'}`).sort();
    expect(nodos).toEqual(
      [`${sha(1).slice(0, 7)}:viva`, `${sha(2).slice(0, 7)}:viva`, `${sha(3).slice(0, 7)}:viva`, `${sha(4).slice(0, 7)}:huerfana`, `${sha(5).slice(0, 7)}:viva`].sort(),
    );
  });

  it('ramas locales, remotas y etiquetas, con HEAD en su rama', () => {
    const etiquetas = pantalla.grafo.etiquetas.map((e) => `${e.forma}:${e.texto}`).sort();
    expect(etiquetas).toEqual(['puntero:HEAD', 'rama:main', 'rama:peruana', 'remota:origin/main', 'version:v1.0'].sort());
  });

  it('las tres areas como git status: MM en las dos, renombrado, conflicto, no seguido y borrados', () => {
    const de = (clave: string) => pantalla.columnas.find((col) => col.clave === clave)?.elementos.map((e) => `${e.texto}:${e.tono}`);
    expect(de('trabajo')).toEqual(['platos.md:modificado', 'cocineros.md:conflicto', 'notas/:nuevo', 'perdido.md:borrado-pendiente']);
    expect(de('preparacion')).toEqual(['platos.md:preparado', 'recetas/viejo.md -> recetas/nuevo.md:preparado', 'borrado.md:borrado-preparado']);
    expect(de('local')).toEqual(['5 confirmaciones:neutro', 'main (actual):neutro', 'peruana:neutro', 'origin/main:neutro']);
  });

  it('el guardado temporal, donde se muestra hoy', () => {
    expect(pantalla.paneles.guardado).toEqual([{ clave: 'stash-0', texto: 'stash@{0}: WIP on main: 2222222 segunda', archivos: ['platos.md'] }]);
  });

  it('la barra y el prompt: carpeta, rama y la fusion a medias', () => {
    expect(pantalla.barra).toEqual({ carpeta: '~/taller-git-trabajo/lab-04/recetario', repositorio: true, rama: 'main|MERGING', cambios: 6, cerrado: false });
    expect(pantalla.indicador.ruta).toBe('~/taller-git-trabajo/lab-04/recetario');
  });

  it('HEAD desconectada se ve en el grafo y en el prompt', () => {
    const suelta: EstadoTaller = { ...REPOSITORIO, rama: null, cabeza: sha(2), operacion: null };
    const otra = construirPantallaTaller(anotarEstado(iniciarSesionTaller(), suelta), OPCIONES);
    expect(otra.indicador.rama).toBe(`(${sha(2).slice(0, 7)}...)`);
    expect(otra.grafo.etiquetas.find((e) => e.forma === 'puntero')?.idConfirmacion).toBe(sha(2).slice(0, 7));
  });
});

describe('una carpeta que no es repositorio (2.6)', () => {
  const carpeta: EstadoTaller = {
    huella: 'h',
    carpeta: '/home/p/taller-git-trabajo',
    indicador: '~/taller-git-trabajo',
    ocupada: false,
    repositorio: false,
    dentroDeGit: false,
    archivos: ['lab-01/'],
  };
  const pantalla = construirPantallaTaller(anotarEstado(iniciarSesionTaller(), carpeta), OPCIONES);

  it('lo dice y no dibuja nada', () => {
    expect(pantalla.grafo.nodos).toEqual([]);
    expect(pantalla.grafoVacio).toBe('Esta carpeta no es un repositorio de Git.');
    expect(pantalla.barra.repositorio).toBe(false);
    expect(pantalla.columnas.find((col) => col.clave === 'trabajo')?.vacio).toBe('esta carpeta no es un repositorio');
    expect(indicadorTaller(carpeta)).toEqual({ usuario: 'participante@SII-TALLER MINGW64', ruta: '~/taller-git-trabajo', rama: null });
  });
});

describe('la consola (4.2)', () => {
  it('cada orden queda con el prompt con que se escribio', () => {
    let sesion = anotarEstado(iniciarSesionTaller(), REPOSITORIO);
    sesion = anotarOrden(sesion, 'cd ..');
    sesion = anotarResultado(sesion, { salida: '', error: '', codigo: 0, carpeta: '', carpetaAntes: '' });
    expect(sesion.renglones[0]?.indicador?.ruta).toBe('~/taller-git-trabajo/lab-04/recetario');
    expect(sesion.ocupada).toBe(false);
  });

  it('la salida de error va en rojo solo si la orden fallo', () => {
    let sesion = anotarOrden(iniciarSesionTaller(), 'git switch peruana');
    expect(sesion.ocupada).toBe(true);
    sesion = anotarResultado(sesion, { salida: '', error: "Switched to branch 'peruana'", codigo: 0, carpeta: '', carpetaAntes: '' });
    expect(sesion.renglones.at(-1)?.color).toBe('normal');
    sesion = anotarOrden(sesion, 'git switch nada');
    sesion = anotarResultado(sesion, { salida: '', error: "fatal: invalid reference: nada", codigo: 128, carpeta: '', carpetaAntes: '' });
    expect(sesion.renglones.at(-1)?.color).toBe('error');
  });

  it('git status se pinta como en Git Bash', () => {
    let sesion = anotarOrden(iniciarSesionTaller(), 'git status');
    sesion = anotarResultado(sesion, {
      salida: 'Changes to be committed:\n\tmodified:   platos.md\n\nUntracked files:\n\tnotas/',
      error: '',
      codigo: 0,
      carpeta: '',
      carpetaAntes: '',
    });
    expect(sesion.renglones.slice(1).map((r) => r.color)).toEqual(['normal', 'exito', 'normal', 'normal', 'error']);
  });

  it('clear limpia la pantalla y queda en el historial', () => {
    let sesion = anotarOrden(iniciarSesionTaller(), 'git status');
    sesion = limpiarConsola(sesion);
    expect(sesion.renglones).toEqual([]);
    expect(sesion.historial).toEqual(['git status', 'clear']);
  });

  it('el cierre del programa se anota una vez y suelta la consola', () => {
    const cerrada = anotarCierre(anotarOrden(iniciarSesionTaller(), 'git log'));
    expect(cerrada.cerrado).toBe(true);
    expect(cerrada.ocupada).toBe(false);
    expect(anotarCierre(cerrada)).toBe(cerrada);
    expect(construirPantallaTaller(cerrada, OPCIONES).barra.cerrado).toBe(true);
  });

  it('seleccionar una confirmacion y soltarla', () => {
    const sesion = seleccionarEnTaller(iniciarSesionTaller(), 'abc1234');
    expect(sesion.seleccion).toBe('abc1234');
    expect(seleccionarEnTaller(sesion, 'abc1234').seleccion).toBeNull();
  });
});

describe('el modo se elige por la direccion', () => {
  it('solo servida por el programa local, con clave', () => {
    expect(claveDelTaller({ protocol: 'http:', hostname: '127.0.0.1', search: '?clave=abc' })).toBe('abc');
    expect(claveDelTaller({ protocol: 'file:', hostname: '', search: '?clave=abc' })).toBeNull();
    expect(claveDelTaller({ protocol: 'http:', hostname: '127.0.0.1', search: '?lab=02' })).toBeNull();
    expect(claveDelTaller({ protocol: 'https:', hostname: 'example.com', search: '?clave=abc' })).toBeNull();
  });
});
