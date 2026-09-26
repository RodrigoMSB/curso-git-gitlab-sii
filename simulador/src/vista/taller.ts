/**
 * El modo taller: la consola ejecuta Git de verdad (SPEC 026).
 *
 * La página la sirve el programa local `taller/taller.py`, que ejecuta cada
 * orden con Git Bash y le pregunta a Git el estado del repositorio con órdenes
 * de porcelana. Aquí no hay motor ni lector: lo que llega del programa se
 * traduce a la misma pantalla que dibuja un escenario, con el grafo, las tres
 * áreas y la consola de siempre.
 *
 * Tampoco hay previsualización (punto 1.5): la orden se ejecuta al apretar
 * Enter, y lo que Git hizo es lo que se dibuja.
 */

import { ramaActual } from '../core';
import { estadoVacio } from '../core/estado';
import type { Archivo, Confirmacion, EntradaGuardado, EntradaReflog, EstadoRepositorio } from '../core/tipos';
import { disponer } from '../grafico/disposicion';
import { colorearSalida, type Indicador, type Renglon } from './consola';
import type { ColumnaArea, ElementoArea, OpcionesPantalla, Pantalla } from './pantalla';

// --- Lo que manda el programa local ------------------------------------------

export interface ConfirmacionTaller {
  readonly id: string;
  readonly padres: readonly string[];
  readonly autor: string;
  readonly correo: string;
  readonly epoca: number;
  readonly mensaje: string;
}

export interface ReferenciaTaller {
  /** Con su prefijo: `refs/heads/main`, `refs/tags/v1`, `refs/remotes/origin/main`. */
  readonly nombre: string;
  /** La confirmacion a la que apunta; en una etiqueta anotada, ya pelada. */
  readonly id: string;
  readonly anotada: boolean;
  readonly mensaje: string | null;
}

export interface CambioTaller {
  /** Primera columna de `git status --porcelain`: HEAD contra el indice. */
  readonly x: string;
  /** Segunda columna: el indice contra el disco. */
  readonly y: string;
  readonly ruta: string;
  readonly origen?: string;
}

export interface GuardadoTaller {
  readonly id: string;
  readonly base: string;
  readonly mensaje: string;
  readonly archivos: readonly string[];
}

export type OperacionTaller = 'fusion' | 'reversion' | 'seleccion' | 'reorganizacion' | null;

interface Comun {
  readonly huella: string;
  readonly carpeta: string;
  /** La carpeta como la escribe Git Bash: `~/taller-git-trabajo/lab-01/recetario`. */
  readonly indicador: string;
  readonly ocupada: boolean;
}

export type EstadoTaller =
  | (Comun & {
      readonly repositorio: false;
      /** La carpeta esta dentro de un repositorio que Git no quiso leer. */
      readonly dentroDeGit: boolean;
      readonly archivos: readonly string[];
    })
  | (Comun & {
      readonly repositorio: true;
      readonly raiz: string;
      readonly rama: string | null;
      readonly cabeza: string | null;
      readonly confirmaciones: readonly ConfirmacionTaller[];
      readonly referencias: readonly ReferenciaTaller[];
      readonly movimientos: readonly { readonly id: string; readonly descripcion: string }[];
      readonly cambios: readonly CambioTaller[];
      readonly guardados: readonly GuardadoTaller[];
      readonly operacion: OperacionTaller;
    });

export interface ResultadoOrdenTaller {
  readonly salida: string;
  readonly error: string;
  readonly codigo: number;
  readonly carpeta: string;
  readonly carpetaAntes: string;
  readonly detenida?: boolean;
}

// --- La sesion -----------------------------------------------------------------

export interface SesionTaller {
  readonly estado: EstadoTaller | null;
  readonly renglones: readonly Renglon[];
  readonly historial: readonly string[];
  /** Una orden corriendo: la consola no acepta otra (punto 3.9). */
  readonly ocupada: boolean;
  /** El programa local no contesta: se cerro la ventana negra (punto 2.9). */
  readonly cerrado: boolean;
  readonly seleccion: string | null;
  /** Cuantas ordenes se escribieron, para dar claves unicas a los renglones. */
  readonly contador: number;
}

export function iniciarSesionTaller(): SesionTaller {
  return { estado: null, renglones: [], historial: [], ocupada: false, cerrado: false, seleccion: null, contador: 0 };
}

const USUARIO = 'participante@SII-TALLER MINGW64';

const MARCA_DE_OPERACION: Readonly<Record<Exclude<OperacionTaller, null>, string>> = {
  fusion: 'MERGING',
  reversion: 'REVERTING',
  seleccion: 'CHERRY-PICKING',
  reorganizacion: 'REBASE',
};

/** El indicador de Git Bash: la carpeta, y la rama si la carpeta es un repositorio. */
export function indicadorTaller(estado: EstadoTaller | null): Indicador {
  if (estado === null) return { usuario: USUARIO, ruta: '', rama: null };
  if (!estado.repositorio) return { usuario: USUARIO, ruta: estado.indicador, rama: null };
  const base = estado.rama ?? (estado.cabeza === null ? 'HEAD' : `(${estado.cabeza.slice(0, 7)}...)`);
  const marca = estado.operacion === null ? '' : `|${MARCA_DE_OPERACION[estado.operacion]}`;
  return { usuario: USUARIO, ruta: estado.indicador, rama: `${base}${marca}` };
}

/**
 * La orden, con el indicador con que se escribio. Al volver a entrar, las
 * ordenes anteriores traen el suyo desde el programa local.
 */
export function anotarOrden(sesion: SesionTaller, orden: string, indicador?: Indicador): SesionTaller {
  const numero = sesion.contador + 1;
  const renglon: Renglon = {
    clave: `${numero}:orden`,
    texto: orden,
    color: 'orden',
    indicador: indicador ?? indicadorTaller(sesion.estado),
  };
  return {
    ...sesion,
    ocupada: true,
    contador: numero,
    renglones: [...sesion.renglones, renglon],
    historial: [...sesion.historial, orden],
  };
}

/**
 * Lo que Git imprimio. La salida de error va en rojo solo si la orden fallo:
 * Git escribe ahi tambien lo que no es un error, como «Switched to branch»
 * (punto 4.2).
 */
export function anotarResultado(sesion: SesionTaller, resultado: ResultadoOrdenTaller): SesionTaller {
  const lineas = (texto: string): string[] => (texto === '' ? [] : texto.replace(/\n$/, '').split('\n'));
  const fallo = resultado.codigo !== 0;
  const salida = colorearSalida(
    [
      ...lineas(resultado.salida).map((texto) => ({ tipo: 'salida' as const, texto })),
      ...lineas(resultado.error).map((texto) => ({ tipo: fallo ? ('error' as const) : ('salida' as const), texto })),
    ],
    `${sesion.contador}`,
  );
  return { ...sesion, ocupada: false, renglones: [...sesion.renglones, ...salida] };
}

export function limpiarConsola(sesion: SesionTaller): SesionTaller {
  return { ...sesion, renglones: [], historial: [...sesion.historial, 'clear'] };
}

export function anotarEstado(sesion: SesionTaller, estado: EstadoTaller): SesionTaller {
  return { ...sesion, estado, cerrado: false };
}

export function anotarCierre(sesion: SesionTaller): SesionTaller {
  return sesion.cerrado ? sesion : { ...sesion, cerrado: true, ocupada: false };
}

export function seleccionarEnTaller(sesion: SesionTaller, id: string | null): SesionTaller {
  return { ...sesion, seleccion: sesion.seleccion === id ? null : id };
}

// --- Del estado de Git al del simulador ---------------------------------------------

const corto = (sha: string): string => sha.slice(0, 7);

export interface EstadoParaDibujar {
  readonly estado: EstadoRepositorio;
  readonly ramasRemotas: readonly { readonly nombre: string; readonly id: string }[];
}

/**
 * El estado que el grafo sabe dibujar. Las confirmaciones van de padres a
 * hijos, como las agrega el motor; las del registro de HEAD que ya no alcanza
 * ninguna referencia entran igual, y el grafo las dibuja en gris (punto 4.4).
 */
export function estadoParaDibujar(estado: EstadoTaller): EstadoParaDibujar {
  const directorio = estado.indicador.replace(/^~\/?/, '');
  if (!estado.repositorio) return { estado: { ...estadoVacio(directorio), iniciado: false }, ramasRemotas: [] };

  const conocidas = new Set(estado.confirmaciones.map((c) => c.id));
  const confirmaciones: Confirmacion[] = [...estado.confirmaciones].reverse().map((c) => ({
    id: corto(c.id),
    mensaje: c.mensaje,
    padres: c.padres.filter((p) => conocidas.has(p)).map(corto),
    carril: 0,
    autor: c.autor,
    correo: c.correo,
    epoca: c.epoca,
    fecha: '',
    archivos: [],
    arbol: {},
    borrados: [],
  }));

  const ramas: { nombre: string; id: string }[] = [];
  const ramasRemotas: { nombre: string; id: string }[] = [];
  const etiquetas: EstadoRepositorio['etiquetas'][number][] = [];
  for (const referencia of estado.referencias) {
    if (!conocidas.has(referencia.id)) continue;
    if (referencia.nombre.startsWith('refs/heads/')) {
      ramas.push({ nombre: referencia.nombre.slice('refs/heads/'.length), id: corto(referencia.id) });
    } else if (referencia.nombre.startsWith('refs/remotes/')) {
      ramasRemotas.push({ nombre: referencia.nombre.slice('refs/remotes/'.length), id: corto(referencia.id) });
    } else if (referencia.nombre.startsWith('refs/tags/')) {
      etiquetas.push({
        nombre: referencia.nombre.slice('refs/tags/'.length),
        id: corto(referencia.id),
        tipo: referencia.anotada ? 'anotada' : 'simple',
        mensaje: referencia.mensaje,
      });
    }
  }
  const principal = estado.rama ?? ramas[0]?.nombre ?? 'main';

  const guardados: EntradaGuardado[] = estado.guardados.map((g) => ({
    mensaje: g.mensaje,
    archivos: g.archivos.map((nombre): Archivo => ({ nombre, estado: 'modificado', contenido: null })),
    rama: /^(?:WIP on|On) (.+?):/.exec(g.mensaje)?.[1] ?? 'HEAD',
    idBase: corto(g.base),
    id: corto(g.id),
  }));

  const reflog: EntradaReflog[] = estado.movimientos.map((m) => {
    const dos = m.descripcion.indexOf(': ');
    return {
      ref: 'HEAD',
      id: corto(m.id),
      idAnterior: null,
      operacion: dos < 0 ? m.descripcion : m.descripcion.slice(0, dos),
      descripcion: dos < 0 ? '' : m.descripcion.slice(dos + 2),
    };
  });

  const puntero: EstadoRepositorio['puntero'] =
    estado.rama !== null
      ? { tipo: 'rama', rama: estado.rama }
      : { tipo: 'confirmacion', id: corto(estado.cabeza ?? '') };

  return {
    estado: {
      ...estadoVacio(directorio),
      iniciado: true,
      confirmaciones,
      ramas,
      etiquetas,
      puntero,
      guardados,
      reflog,
      carriles: [principal, ...ramas.map((r) => r.nombre).filter((n) => n !== principal)].map((rama, carril) => ({
        rama,
        carril,
      })),
    },
    ramasRemotas,
  };
}

const TONO_TRABAJO: Readonly<Record<string, ElementoArea['tono']>> = {
  M: 'modificado',
  T: 'modificado',
  D: 'borrado-pendiente',
  A: 'nuevo',
};

/**
 * Las tres areas, como las muestra `git status`. Un archivo preparado y
 * modificado despues (`MM`) aparece en las dos columnas.
 */
export function columnasTaller(estado: EstadoTaller, dibujo: EstadoParaDibujar): readonly ColumnaArea[] {
  if (!estado.repositorio) {
    return [
      {
        clave: 'trabajo',
        titulo: 'Directorio de trabajo',
        orden: 'git status',
        elementos: [],
        vacio: 'esta carpeta no es un repositorio',
      },
      { clave: 'preparacion', titulo: 'Área de preparación', orden: 'git add', elementos: [], vacio: '—' },
      { clave: 'local', titulo: 'Repositorio local', orden: 'git commit', elementos: [], vacio: '—' },
    ];
  }
  const trabajo: ElementoArea[] = [];
  const preparacion: ElementoArea[] = [];
  for (const { x, y, ruta, origen } of estado.cambios) {
    const conflicto = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D');
    if (conflicto) {
      trabajo.push({ texto: ruta, tono: 'conflicto' });
      continue;
    }
    if (x === '?') {
      trabajo.push({ texto: ruta, tono: 'nuevo' });
      continue;
    }
    if (x === '!') continue;
    if (x === 'D') preparacion.push({ texto: ruta, tono: 'borrado-preparado' });
    else if (x === 'R' || x === 'C') preparacion.push({ texto: `${origen ?? ''} -> ${ruta}`, tono: 'preparado' });
    else if (x !== ' ') preparacion.push({ texto: ruta, tono: 'preparado' });
    const tono = TONO_TRABAJO[y];
    if (tono !== undefined) trabajo.push({ texto: ruta, tono });
  }
  const repositorio = dibujo.estado;
  const rama = ramaActual(repositorio);
  return [
    { clave: 'trabajo', titulo: 'Directorio de trabajo', orden: 'git status', elementos: trabajo, vacio: 'sin cambios pendientes' },
    { clave: 'preparacion', titulo: 'Área de preparación', orden: 'git add', elementos: preparacion, vacio: 'nada preparado' },
    {
      clave: 'local',
      titulo: 'Repositorio local',
      orden: 'git commit',
      elementos: [
        { texto: `${repositorio.confirmaciones.length} confirmaciones`, tono: 'neutro' },
        ...repositorio.ramas.map((r) => ({ texto: r.nombre === rama ? `${r.nombre} (actual)` : r.nombre, tono: 'neutro' as const })),
        ...dibujo.ramasRemotas.map((r) => ({ texto: r.nombre, tono: 'neutro' as const })),
      ],
      vacio: 'sin confirmaciones',
    },
  ];
}

/** Lo que dice la barra del modo taller (punto 4.6). */
export interface BarraTaller {
  readonly carpeta: string;
  readonly repositorio: boolean;
  readonly rama: string | null;
  readonly cambios: number;
  readonly cerrado: boolean;
}

export type PantallaTaller = Omit<Pantalla, 'barra' | 'segmentos' | 'aviso'> & {
  readonly barra: BarraTaller;
  /** Lo que el grafo dice cuando no hay nada que dibujar. */
  readonly grafoVacio: string;
};

export function construirPantallaTaller(
  sesion: SesionTaller,
  opciones: Pick<OpcionesPantalla, 'altoGrafo' | 'anchoGrafo' | 'modoRelator'>,
): PantallaTaller {
  const estado = sesion.estado;
  const dibujo: EstadoParaDibujar =
    estado === null ? { estado: { ...estadoVacio(''), iniciado: false }, ramasRemotas: [] } : estadoParaDibujar(estado);
  const grafo = disponer(dibujo.estado, {
    previsualizadas: [],
    altoMaximo: opciones.altoGrafo ?? null,
    anchoMaximo: opciones.anchoGrafo ?? null,
    ramasRemotas: dibujo.ramasRemotas,
  });
  const indicador = indicadorTaller(estado);
  return {
    barra: {
      carpeta: estado?.indicador ?? '',
      repositorio: estado?.repositorio ?? false,
      rama: estado?.repositorio ? indicador.rama : null,
      cambios: estado?.repositorio ? estado.cambios.filter((c) => c.x !== '!').length : 0,
      cerrado: sesion.cerrado,
    },
    indicador,
    renglones: sesion.renglones,
    grafo,
    grafoVacio:
      estado === null
        ? 'Conectando con el taller…'
        : !estado.repositorio
          ? 'Esta carpeta no es un repositorio de Git.'
          : 'Todavía no hay confirmaciones. La primera aparecerá aquí en cuanto confirmes algo preparado.',
    columnas: estado === null ? [] : columnasTaller(estado, dibujo),
    paneles: opciones.modoRelator
      ? { guardado: null, diferencias: null, objetos: null }
      : {
          guardado:
            dibujo.estado.guardados.length === 0
              ? null
              : dibujo.estado.guardados.map((entrada, posicion) => ({
                  clave: `stash-${posicion}`,
                  texto: `stash@{${posicion}}: ${entrada.mensaje}`,
                  archivos: entrada.archivos.map((archivo) => archivo.nombre),
                })),
          diferencias: null,
          objetos: null,
        },
    seleccion: sesion.seleccion,
  };
}

// --- La direccion ----------------------------------------------------------------

/**
 * La clave del taller, si la pagina la sirvio el programa local. Abierta con
 * doble clic no hay clave, y la pagina es el simulador de siempre.
 */
export function claveDelTaller(direccion: { readonly protocol: string; readonly hostname: string; readonly search: string }): string | null {
  if (direccion.protocol !== 'http:' || direccion.hostname !== '127.0.0.1') return null;
  const clave = new URLSearchParams(direccion.search).get('clave');
  return clave === null || clave === '' ? null : clave;
}
