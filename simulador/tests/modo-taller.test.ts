/**
 * El modo taller (SPEC 026): el estado que entrega Git, traducido a lo que la
 * pantalla dibuja.
 */

import { describe, expect, it } from 'vitest';
import {
  barraDelTaller,
  claveDelTaller,
  columnasDelTaller,
  completarEnTaller,
  grafoDelTaller,
  guardadosDelTaller,
  indicadorDelTaller,
  presentacion,
  renglonesDeOrden,
  type DocumentoTaller,
  type EstadoGit,
  type SesionGit,
} from '../src/vista';
import { comoEstadoDelDibujo } from '../src/vista/modoTaller';

const CLAVE = 'a'.repeat(32);

const SESION: SesionGit = {
  sistema: 'windows',
  usuario: 'ana',
  equipo: 'SII-123',
  limite: 'José Pérez',
  carpeta: 'C:/Users/José Pérez/taller-git-trabajo/lab-02/recetario',
  relativa: 'taller-git-trabajo/lab-02/recetario',
  avisos: [],
  tiempoMaximo: 600000,
};

const id = (letra: string): string => letra.repeat(40);

/** main con tres confirmaciones, una huerfana que dejo un --amend, y una rama. */
function repositorio(cambios: Partial<Extract<EstadoGit, { repositorio: true }>> = {}): EstadoGit {
  return {
    repositorio: true,
    raiz: 'C:/Users/José Pérez/taller-git-trabajo/lab-02/recetario',
    gitdir: 'C:/Users/José Pérez/taller-git-trabajo/lab-02/recetario/.git',
    dentroDeGit: false,
    rama: 'main',
    head: id('c'),
    confirmaciones: [
      { id: id('c'), corto: 'ccccccc', padres: [id('b')], autor: 'Ana', correo: 'a@b', epoca: 3, asunto: 'tres', huerfana: false },
      { id: id('d'), corto: 'ddddddd', padres: [id('b')], autor: 'Ana', correo: 'a@b', epoca: 2, asunto: 'mal escrita', huerfana: true },
      { id: id('b'), corto: 'bbbbbbb', padres: [id('a')], autor: 'Ana', correo: 'a@b', epoca: 1, asunto: 'dos', huerfana: false },
      { id: id('a'), corto: 'aaaaaaa', padres: [], autor: 'Ana', correo: 'a@b', epoca: 0, asunto: 'uno', huerfana: false },
    ],
    ramas: [
      { nombre: 'prueba', id: id('b') },
      { nombre: 'main', id: id('c') },
    ],
    remotas: [{ nombre: 'origin/main', id: id('b') }],
    etiquetas: [{ nombre: 'v1.0', id: id('a'), anotada: true }],
    guardados: [],
    operacion: null,
    areas: { preparado: [], modificado: [], sinSeguimiento: [], conflicto: [] },
    cambios: 0,
    ...cambios,
  };
}

const documento = (estado: EstadoGit, sesion: Partial<SesionGit> = {}): DocumentoTaller => ({
  version: 1,
  sesion: { ...SESION, ...sesion },
  estado,
});

describe('la direccion decide el modo', () => {
  it('solo el programa local, en 127.0.0.1 y con clave, abre el modo taller', () => {
    expect(claveDelTaller({ protocol: 'http:', hostname: '127.0.0.1', search: `?clave=${CLAVE}` })).toBe(CLAVE);
    expect(claveDelTaller({ protocol: 'file:', hostname: '', search: `?clave=${CLAVE}` })).toBeNull();
    expect(claveDelTaller({ protocol: 'file:', hostname: '', search: '?lab=02' })).toBeNull();
    expect(claveDelTaller({ protocol: 'http:', hostname: 'localhost', search: `?clave=${CLAVE}` })).toBeNull();
    expect(claveDelTaller({ protocol: 'http:', hostname: '127.0.0.1', search: '' })).toBeNull();
    expect(claveDelTaller({ protocol: 'http:', hostname: '127.0.0.1', search: '?clave=<script>' })).toBeNull();
  });
});

describe('el estado de Git en la forma del dibujo', () => {
  it('en orden de creacion, con identificadores cortos, y main primero', () => {
    const dibujo = comoEstadoDelDibujo(repositorio());
    expect(dibujo?.confirmaciones.map((c) => c.id)).toEqual(['aaaaaaa', 'bbbbbbb', 'ddddddd', 'ccccccc']);
    expect(dibujo?.confirmaciones.at(-1)?.padres).toEqual(['bbbbbbb']);
    expect(dibujo?.ramas.map((r) => r.nombre)).toEqual(['main', 'prueba', 'origin/main']);
    expect(dibujo?.etiquetas).toEqual([{ nombre: 'v1.0', id: 'aaaaaaa', tipo: 'anotada', mensaje: null }]);
    expect(dibujo?.puntero).toEqual({ tipo: 'rama', rama: 'main' });
  });

  it('desconectado, el puntero es la confirmacion', () => {
    const dibujo = comoEstadoDelDibujo(repositorio({ rama: null, head: id('b') }));
    expect(dibujo?.puntero).toEqual({ tipo: 'confirmacion', id: 'bbbbbbb' });
  });

  it('la huerfana se dibuja atenuada, y sin repositorio no se dibuja nada', () => {
    const grafo = grafoDelTaller(repositorio(), { altoGrafo: null, anchoGrafo: null });
    const huerfanas = grafo?.nodos.filter((n) => n.huerfana).map((n) => n.id);
    expect(huerfanas).toEqual(['ddddddd']);
    expect(grafoDelTaller({ repositorio: false, motivo: 'fuera' }, { altoGrafo: null, anchoGrafo: null })).toBeNull();
    expect(comoEstadoDelDibujo({ repositorio: false, motivo: 'fuera' })).toBeNull();
  });

  it('la base de un guardado temporal cuenta como viva', () => {
    const estado = repositorio({
      guardados: [{ indice: 0, id: id('e'), base: id('d'), mensaje: 'WIP on main: ccccccc tres' }],
    });
    const grafo = grafoDelTaller(estado, { altoGrafo: null, anchoGrafo: null });
    expect(grafo?.nodos.find((n) => n.id === 'ddddddd')?.huerfana).toBe(false);
    expect(guardadosDelTaller(estado)).toEqual([
      { clave: 'stash-0', texto: 'stash@{0}: WIP on main: ccccccc tres', archivos: [] },
    ]);
    expect(guardadosDelTaller(repositorio())).toBeNull();
  });
});

describe('las tres areas', () => {
  it('cada entrada en su area, y un archivo tocado dos veces en las dos', () => {
    const columnas = columnasDelTaller(
      repositorio({
        areas: {
          preparado: [
            { ruta: 'platos.md', tipo: 'M' },
            { ruta: 'recetas/canción nueva.md', tipo: 'R', origen: 'canción.md' },
            { ruta: 'viejo.md', tipo: 'D' },
          ],
          modificado: [
            { ruta: 'platos.md', tipo: 'M' },
            { ruta: 'borrado a mano.md', tipo: 'D' },
          ],
          sinSeguimiento: ['recetas/ñoquis.md'],
          conflicto: ['cocineros.md'],
        },
      }),
    );
    const [trabajo, preparacion, local] = columnas;
    expect(trabajo?.elementos).toEqual([
      { texto: 'cocineros.md', tono: 'conflicto' },
      { texto: 'platos.md', tono: 'modificado' },
      { texto: 'borrado a mano.md', tono: 'borrado-pendiente' },
      { texto: 'recetas/ñoquis.md', tono: 'nuevo' },
    ]);
    expect(preparacion?.elementos).toEqual([
      { texto: 'platos.md', tono: 'preparado' },
      { texto: 'canción.md -> recetas/canción nueva.md', tono: 'preparado' },
      { texto: 'viejo.md', tono: 'borrado-preparado' },
    ]);
    // Las huerfanas no cuentan, y las remotas no son ramas locales.
    expect(local?.elementos.map((e) => e.texto)).toEqual(['3 confirmaciones', 'main (actual)', 'prueba']);
  });

  it('sin confirmaciones el repositorio local esta vacio, y sin repositorio no hay areas', () => {
    const columnas = columnasDelTaller(repositorio({ confirmaciones: [], ramas: [], remotas: [], etiquetas: [], head: null }));
    expect(columnas[2]?.elementos).toEqual([]);
    expect(columnasDelTaller({ repositorio: false, motivo: 'fuera' })).toEqual([]);
  });
});

describe('la barra', () => {
  it('sin repositorio no dice rama ni cambios', () => {
    const barra = barraDelTaller(documento({ repositorio: false, motivo: 'fuera' }, { relativa: 'taller-git-trabajo' }));
    expect(barra).toEqual({
      carpeta: 'José Pérez/taller-git-trabajo',
      repositorio: null,
      rama: null,
      desconectado: false,
      cambios: 0,
      operacion: null,
    });
  });

  it('con repositorio dice su nombre, la rama, los cambios y la operacion a medias', () => {
    const barra = barraDelTaller(documento(repositorio({ cambios: 2, operacion: 'fusion' })));
    expect(barra.repositorio).toBe('recetario');
    expect(barra.rama).toBe('main');
    expect(barra.cambios).toBe(2);
    expect(barra.operacion).toBe('fusión a medias');
    const suelta = barraDelTaller(documento(repositorio({ rama: null, head: id('b') })));
    expect(suelta.desconectado).toBe(true);
    expect(suelta.rama).toBe('bbbbbbb');
  });

  it('en el limite mismo la carpeta es el limite', () => {
    expect(barraDelTaller(documento({ repositorio: false, motivo: 'fuera' }, { relativa: '' })).carpeta).toBe('José Pérez');
  });
});

describe('el indicador, como el de Git Bash', () => {
  it('usuario, equipo y MINGW64 en Windows, y la rama entre parentesis', () => {
    expect(indicadorDelTaller(documento(repositorio()))).toEqual({
      usuario: 'ana@SII-123 MINGW64',
      ruta: 'José Pérez/taller-git-trabajo/lab-02/recetario',
      rama: 'main',
    });
    expect(indicadorDelTaller(documento(repositorio(), { sistema: 'mac' })).usuario).toBe('ana@SII-123');
  });

  it('sin repositorio no hay rama, desconectado va el identificador, y a medias la operacion', () => {
    expect(indicadorDelTaller(documento({ repositorio: false, motivo: 'fuera' })).rama).toBeNull();
    expect(indicadorDelTaller(documento(repositorio({ rama: null, head: id('b') }))).rama).toBe('(bbbbbbb...)');
    expect(indicadorDelTaller(documento(repositorio({ operacion: 'fusion' }))).rama).toBe('main|MERGING');
    expect(indicadorDelTaller(documento(repositorio({ operacion: 'rebase', rama: null, head: id('b') }))).rama).toBe(
      '(bbbbbbb...)|REBASE',
    );
    expect(indicadorDelTaller(documento(repositorio({ dentroDeGit: true }))).rama).toBe('GIT_DIR!');
    expect(indicadorDelTaller(documento(repositorio({ rama: null, head: null }))).rama).toBe('');
  });
});

describe('la consola', () => {
  const donde = { usuario: 'ana@SII-123 MINGW64', ruta: 'José Pérez/taller-git-trabajo', rama: null };

  it('el error de una orden que funciono no va en rojo', () => {
    const r = renglonesDeOrden(
      'git switch -c peruana',
      { codigo: 0, salida: '', error: "Switched to a new branch 'peruana'\n", agotado: false, avisos: [] },
      'o1',
      donde,
    );
    expect(r.map((x) => [x.texto, x.color])).toEqual([
      ['git switch -c peruana', 'orden'],
      ["Switched to a new branch 'peruana'", 'normal'],
    ]);
    expect(r[0]?.indicador).toEqual(donde);
  });

  it('el error de una orden que fallo va en rojo, y lo que dice el programa en su color', () => {
    const r = renglonesDeOrden(
      'git commit',
      {
        codigo: 1,
        salida: '',
        error: 'error: Terminal is dumb, but EDITOR unset\r\nPlease supply the message using either -m or -F option.\n',
        agotado: false,
        avisos: ['Git no pudo abrir el editor.'],
      },
      'o2',
      donde,
    );
    expect(r.map((x) => x.color)).toEqual(['orden', 'error', 'error', 'programa']);
    expect(r[1]?.texto).toBe('error: Terminal is dumb, but EDITOR unset');
  });

  it('la salida estandar lleva los colores de git status', () => {
    const r = renglonesDeOrden(
      'git status',
      {
        codigo: 0,
        salida: 'On branch main\nChanges to be committed:\n\tmodified:   cocineros.md\n\nUntracked files:\n\tnuevo.md\n',
        error: '',
        agotado: false,
        avisos: [],
      },
      'o3',
      donde,
    );
    expect(r.find((x) => x.texto.includes('cocineros.md'))?.color).toBe('exito');
    expect(r.find((x) => x.texto.includes('nuevo.md'))?.color).toBe('error');
    expect(r.filter((x) => x.texto === '')).toHaveLength(1);
  });

  it('la presentacion dice donde corre', () => {
    expect(presentacion(documento({ repositorio: false, motivo: 'fuera' }, { relativa: 'taller-git-trabajo' }))).toContain(
      'José Pérez/taller-git-trabajo',
    );
  });

  it('completa con las ramas locales y los archivos que Git conoce', () => {
    const estado = repositorio({
      areas: { preparado: [], modificado: [{ ruta: 'platos.md', tipo: 'M' }], sinSeguimiento: [], conflicto: [] },
    });
    expect(completarEnTaller('git switch pru', estado).texto).toBe('git switch prueba');
    expect(completarEnTaller('git add pla', estado).texto).toBe('git add platos.md');
    expect(completarEnTaller('git swi', { repositorio: false, motivo: 'fuera' }).texto).toBe('git switch');
  });
});
