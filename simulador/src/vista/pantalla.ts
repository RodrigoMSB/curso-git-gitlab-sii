/**
 * Modelo de la pantalla completa.
 *
 * Es la unica puerta entre el motor y los componentes. Traduce el estado del
 * repositorio a datos planos y ya posicionados, de modo que los componentes se
 * limitan a pintar y no calculan nada sobre confirmaciones, ramas ni punteros
 * (restriccion R6 y criterio CA7 del SPEC 002).
 */

import { archivosEn, cadenaDeObjetos, ramaActual } from '../core';
import type { CadenaDeObjetos } from '../core';
import type { EstadoRepositorio } from '../core/tipos';
import { disponer } from '../grafico/disposicion';
import type { Disposicion } from '../grafico/tipos';
import { declaraciones } from '../escenarios';
import { indicadorDe, type Indicador, type Renglon } from './consola';
import { estadoDe, previsualizarOrden, renglonesDe, type Sesion } from './sesion';

/**
 * Tamano de letra mas pequeno de la interfaz, en pixeles, y factor del modo
 * relator. El punto 8.3 exige no bajar de once en modo normal ni de catorce en
 * modo relator: once por uno coma tres son catorce coma tres.
 */
export const TEXTO_MINIMO = 11;
export const ESCALA_RELATOR = 1.3;

/**
 * Filas que muestran las listas de la zona D antes de desplazarse.
 *
 * Vive aqui, y no solo en la hoja de estilos, porque la interfaz necesita el
 * mismo numero para saber cuando la lista pasa a ser alcanzable con el teclado.
 */
export const FILAS_VISIBLES = 6;

export type TonoElemento = 'nuevo' | 'modificado' | 'preparado' | 'conflicto' | 'neutro';

export interface ElementoArea {
  readonly texto: string;
  readonly tono: TonoElemento;
}

export interface ColumnaArea {
  readonly clave: string;
  readonly titulo: string;
  readonly orden: string;
  readonly elementos: readonly ElementoArea[];
  readonly vacio: string;
}

export interface OpcionEscenario {
  readonly id: string;
  readonly titulo: string;
  readonly sesion: number;
  readonly proposito: string;
}

export interface ResumenBarra {
  readonly repositorio: string;
  readonly rama: string;
  readonly desconectado: boolean;
  readonly cambiosSinConfirmar: number;
  readonly escenarios: readonly OpcionEscenario[];
}

export interface EntradaGuardadoVista {
  readonly clave: string;
  readonly texto: string;
  readonly archivos: readonly string[];
}

export interface SegmentoTiempo {
  readonly indice: number;
  readonly etiqueta: string;
  readonly actual: boolean;
  readonly futuro: boolean;
}

export interface AvisoPrevisualizacion {
  readonly confirmacionesNuevas: number;
  readonly punteroMovido: boolean;
}

export interface Paneles {
  readonly guardado: readonly EntradaGuardadoVista[] | null;
  readonly diferencias: readonly Renglon[] | null;
  readonly objetos: CadenaDeObjetos | null;
}

export interface Pantalla {
  readonly barra: ResumenBarra;
  readonly indicador: Indicador;
  readonly renglones: readonly Renglon[];
  readonly grafo: Disposicion;
  readonly aviso: AvisoPrevisualizacion | null;
  readonly columnas: readonly ColumnaArea[];
  readonly paneles: Paneles;
  readonly segmentos: readonly SegmentoTiempo[];
  readonly seleccion: string | null;
}

export interface OpcionesPantalla {
  readonly previsualizacionActiva: boolean;
  readonly entrada: string;
  readonly modoRelator: boolean;
}

const TONO_POR_ESTADO = {
  'sin-seguimiento': 'nuevo',
  modificado: 'modificado',
  preparado: 'preparado',
  'en-conflicto': 'conflicto',
  limpio: 'neutro',
} as const;

/** Las cuatro columnas fijas de la zona D. */
export function columnasDeAreas(estado: EstadoRepositorio): readonly ColumnaArea[] {
  const enTrabajo = archivosEn(estado, 'modificado', 'sin-seguimiento', 'en-conflicto');
  const preparados = archivosEn(estado, 'preparado');
  const rama = ramaActual(estado);

  return [
    {
      clave: 'trabajo',
      titulo: 'Directorio de trabajo',
      orden: 'git status',
      elementos: enTrabajo.map((archivo) => ({
        texto: archivo.nombre,
        tono: TONO_POR_ESTADO[archivo.estado],
      })),
      vacio: 'sin cambios pendientes',
    },
    {
      clave: 'preparacion',
      titulo: 'Área de preparación',
      orden: 'git add',
      elementos: preparados.map((archivo) => ({
        texto: archivo.nombre,
        tono: 'preparado' as const,
      })),
      vacio: 'nada preparado',
    },
    {
      clave: 'local',
      titulo: 'Repositorio local',
      orden: 'git commit',
      elementos: [
        {
          texto: `${estado.confirmaciones.length} confirmaciones`,
          tono: 'neutro' as const,
        },
        ...estado.ramas.map((candidata) => ({
          texto: candidata.nombre === rama ? `${candidata.nombre} (actual)` : candidata.nombre,
          tono: 'neutro' as const,
        })),
      ],
      vacio: 'sin confirmaciones',
    },
    {
      clave: 'remoto',
      titulo: 'Repositorio remoto',
      orden: 'git push',
      elementos: estado.remotos.map((remoto) => ({
        texto: `${remoto.nombre} · ${remoto.url}`,
        tono: 'neutro' as const,
      })),
      vacio: 'sin remoto configurado',
    },
  ];
}

/**
 * Paneles que corresponde mostrar.
 *
 * Los que no aplican no se muestran, y no se muestran vacios. En modo relator
 * no se muestra ninguno: en proyeccion comprimida los paneles pequenos no se
 * leen y solo aportan ruido (punto 8.2).
 */
export function panelesVisibles(
  estado: EstadoRepositorio,
  ultimaOrden: string | null,
  renglones: readonly Renglon[],
  seleccion: string | null,
  modoRelator: boolean,
): Paneles {
  if (modoRelator) return { guardado: null, diferencias: null, objetos: null };

  const guardado =
    estado.guardados.length === 0
      ? null
      : estado.guardados.map((entrada, posicion) => ({
          clave: `stash-${posicion}`,
          texto: `stash@{${posicion}}: ${entrada.mensaje}`,
          archivos: entrada.archivos.map((archivo) => archivo.nombre),
        }));

  const fueComparacion = ultimaOrden !== null && /^git\s+diff\b/.test(ultimaOrden);
  const cuerpo = renglones.filter((renglon) => renglon.color !== 'orden');
  const diferencias = fueComparacion && cuerpo.length > 0 ? ultimoBloque(renglones) : null;

  const objetos = seleccion === null ? null : cadenaDeObjetos(estado, seleccion);

  return { guardado, diferencias, objetos };
}

/** Lineas que produjo la ultima orden, sin el eco de la orden misma. */
function ultimoBloque(renglones: readonly Renglon[]): readonly Renglon[] {
  const ultimoEco = renglones.map((renglon) => renglon.color).lastIndexOf('orden');
  return renglones.slice(ultimoEco + 1);
}

export function resumenBarra(estado: EstadoRepositorio): ResumenBarra {
  const rama = ramaActual(estado);
  return {
    repositorio: estado.directorio.split('/').filter(Boolean).at(-1) ?? 'repositorio',
    rama: rama ?? 'posición desconectada',
    desconectado: rama === null,
    cambiosSinConfirmar: estado.archivos.filter((archivo) => archivo.estado !== 'limpio').length,
    escenarios: Object.values(declaraciones).map((declaracion) => ({
      id: declaracion.id,
      titulo: declaracion.titulo,
      sesion: declaracion.sesion,
      proposito: declaracion.proposito,
    })),
  };
}

function segmentosDe(sesion: Sesion): readonly SegmentoTiempo[] {
  return sesion.pasos.map((paso, indice) => ({
    indice,
    etiqueta: paso.orden ?? 'estado inicial',
    actual: indice === sesion.indice,
    futuro: indice > sesion.indice,
  }));
}

/** Arma todo lo que la pantalla necesita para dibujarse. */
export function construirPantalla(sesion: Sesion, opciones: OpcionesPantalla): Pantalla {
  const estado = estadoDe(sesion);
  const renglones = renglonesDe(sesion);

  const vista = opciones.previsualizacionActiva
    ? previsualizarOrden(sesion, opciones.entrada)
    : null;

  // Una fusion con conflictos deja comprometida su union: el motor ya reservo
  // el identificador. Se sigue dibujando en trazo discontinuo mientras el
  // conflicto esta abierto, y se solidifica con ese mismo identificador cuando
  // el participante resuelve y confirma.
  const comprometidas = estado.fusion === null ? [] : [estado.fusion.idPrevisto];

  const grafo =
    vista === null
      ? disponer(estado, { previsualizadas: comprometidas })
      : disponer(vista.estadoResultante, { previsualizadas: vista.confirmacionesNuevas });

  return {
    barra: resumenBarra(estado),
    indicador: indicadorDe(estado),
    renglones,
    grafo,
    aviso:
      vista === null
        ? null
        : {
            confirmacionesNuevas: vista.confirmacionesNuevas.length,
            punteroMovido: vista.punteroMovido,
          },
    columnas: columnasDeAreas(estado),
    paneles: panelesVisibles(
      estado,
      sesion.pasos[sesion.indice]?.orden ?? null,
      renglones,
      sesion.seleccion,
      opciones.modoRelator,
    ),
    segmentos: segmentosDe(sesion),
    seleccion: sesion.seleccion,
  };
}
