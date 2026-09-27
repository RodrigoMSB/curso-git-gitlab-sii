/**
 * El modo taller (SPEC 026): la pantalla dibujada con lo que dice Git.
 *
 * El programa local ejecuta las ordenes con Git de verdad y entrega el estado
 * del repositorio. Aqui ese estado se traduce a lo mismo que ya consumen los
 * componentes, el grafo, las areas, la barra y el indicador, sin pasar por el
 * motor: el motor no calcula nada en este modo (punto 1.5).
 *
 * El grafo se dispone con el mismo calculo de posiciones que el modo de
 * escenarios. Para eso el estado de Git se vuelca en la forma del estado del
 * motor, llenando solo lo que el dibujo lee: confirmaciones, ramas, etiquetas,
 * puntero y guardados.
 */

import type { EstadoRepositorio, LineaSalida } from '../core/tipos';
import { disponer } from '../grafico/disposicion';
import type { Disposicion } from '../grafico/tipos';
import { contar } from './contar';
import { AYUDA, esOrdenPropia, ordenesPegadas } from './ordenesConocidas';
import { colorearSalida, completar, type Completado, type Indicador, type Renglon } from './consola';
import type { ColumnaArea, ElementoArea, EntradaGuardadoVista } from './pantalla';

// --- Lo que entrega el programa local --------------------------------------

export interface ConfirmacionGit {
  readonly id: string;
  readonly corto: string;
  readonly padres: readonly string[];
  readonly autor: string;
  readonly correo: string;
  readonly epoca: number;
  readonly asunto: string;
  readonly huerfana: boolean;
}

export interface ReferenciaGit {
  readonly nombre: string;
  readonly id: string;
  readonly anotada?: boolean;
}

export interface EntradaAreaGit {
  readonly ruta: string;
  readonly tipo: string;
  readonly origen?: string;
}

export interface GuardadoGit {
  readonly indice: number;
  readonly id: string;
  readonly base: string;
  readonly mensaje: string;
}

export type EstadoGit =
  | { readonly repositorio: false; readonly motivo: string }
  | {
      readonly repositorio: true;
      readonly raiz: string;
      readonly gitdir: string;
      readonly dentroDeGit: boolean;
      readonly rama: string | null;
      readonly head: string | null;
      readonly confirmaciones: readonly ConfirmacionGit[];
      readonly ramas: readonly ReferenciaGit[];
      readonly remotas: readonly ReferenciaGit[];
      readonly etiquetas: readonly ReferenciaGit[];
      readonly guardados: readonly GuardadoGit[];
      readonly operacion: string | null;
      readonly areas: {
        readonly preparado: readonly EntradaAreaGit[];
        readonly modificado: readonly EntradaAreaGit[];
        readonly sinSeguimiento: readonly string[];
        readonly conflicto: readonly string[];
      };
      readonly cambios: number;
      /** Los archivos de la ultima confirmacion, el arbol de HEAD. */
      readonly arbol?: readonly string[];
    };

export interface SesionGit {
  readonly sistema: 'windows' | 'mac' | 'otro';
  readonly usuario: string;
  readonly equipo: string;
  readonly limite: string;
  readonly carpeta: string;
  readonly relativa: string;
  readonly avisos: readonly string[];
  readonly tiempoMaximo: number;
  /** Que motor responde: el de Java, o el de Python si el de Java no arranco (SPEC 028). */
  readonly motor?: 'java' | 'python';
}

export interface DocumentoTaller {
  readonly version: number;
  readonly sesion: SesionGit;
  readonly estado: EstadoGit;
}

export interface RespuestaOrden {
  readonly codigo: number;
  readonly salida: string;
  readonly error: string;
  readonly agotado: boolean;
  readonly avisos: readonly string[];
}

// --- La direccion ------------------------------------------------------------

/**
 * La clave del modo taller, si la pagina se abrio desde el programa local.
 *
 * El programa sirve la pagina en 127.0.0.1 con la clave en la direccion.
 * Abierta con doble clic, desde `file://`, no hay clave y la pagina sigue en el
 * modo de escenarios.
 */
export function claveDelTaller(direccion: {
  readonly protocol: string;
  readonly hostname: string;
  readonly search: string;
}): string | null {
  if (direccion.protocol !== 'http:' || direccion.hostname !== '127.0.0.1') return null;
  const clave = new URLSearchParams(direccion.search).get('clave');
  return clave !== null && /^[0-9a-f]{32,}$/.test(clave) ? clave : null;
}

// --- El estado de Git en la forma que el dibujo lee --------------------------

/** El identificador corto con que se dibuja una confirmacion. */
function cortoDe(estado: Extract<EstadoGit, { repositorio: true }>): (id: string) => string {
  const cortos = new Map(estado.confirmaciones.map((c) => [c.id, c.corto]));
  return (id) => cortos.get(id) ?? id.slice(0, 7);
}

/**
 * Las ramas en el orden en que se reparten los carriles: la principal primero,
 * para que quede a la izquierda como en el modo de escenarios, despues las
 * locales y al final las remotas.
 */
function ramasOrdenadas(estado: Extract<EstadoGit, { repositorio: true }>): readonly ReferenciaGit[] {
  const principal = (nombre: string): number => (nombre === 'main' || nombre === 'master' ? 0 : 1);
  const locales = [...estado.ramas].sort(
    (a, b) => principal(a.nombre) - principal(b.nombre) || a.nombre.localeCompare(b.nombre),
  );
  return [...locales, ...estado.remotas];
}

export function comoEstadoDelDibujo(estado: EstadoGit): EstadoRepositorio | null {
  if (!estado.repositorio) return null;
  const corto = cortoDe(estado);
  // Git las entrega de la mas reciente a la mas antigua; el dibujo las quiere
  // en orden de creacion.
  const confirmaciones = [...estado.confirmaciones].reverse().map((c) => ({
    id: c.corto,
    mensaje: c.asunto,
    padres: c.padres.map(corto),
    carril: 0,
    autor: c.autor,
    correo: c.correo,
    epoca: c.epoca,
    fecha: '',
    archivos: [],
    arbol: {},
    borrados: [],
  }));
  return {
    iniciado: true,
    directorio: estado.raiz,
    confirmaciones,
    ramas: ramasOrdenadas(estado).map((r) => ({ nombre: r.nombre, id: corto(r.id) })),
    etiquetas: estado.etiquetas.map((e) => ({
      nombre: e.nombre,
      id: corto(e.id),
      tipo: e.anotada === true ? ('anotada' as const) : ('simple' as const),
      mensaje: null,
    })),
    puntero:
      estado.rama !== null
        ? { tipo: 'rama', rama: estado.rama }
        : { tipo: 'confirmacion', id: estado.head === null ? '' : corto(estado.head) },
    archivos: [],
    carpetas: [],
    borrados: [],
    borradosSinPreparar: [],
    guardados: estado.guardados.map((g) => ({
      mensaje: g.mensaje,
      archivos: [],
      rama: '',
      idBase: corto(g.base),
      id: corto(g.id),
    })),
    reflog: [],
    remotos: [],
    config: { local: {}, global: {} },
    fusion: null,
    reversion: null,
    origHead: null,
    carriles: [],
    contador: 0,
  };
}

export function grafoDelTaller(
  estado: EstadoGit,
  medidas: { readonly altoGrafo: number | null; readonly anchoGrafo: number | null },
): Disposicion | null {
  const dibujo = comoEstadoDelDibujo(estado);
  if (dibujo === null) return null;
  return disponer(dibujo, {
    previsualizadas: [],
    altoMaximo: medidas.altoGrafo,
    anchoMaximo: medidas.anchoGrafo,
  });
}

// --- Las areas -----------------------------------------------------------------

/**
 * Las tres areas, con los mismos titulos que el modo de escenarios.
 *
 * Un archivo preparado y despues vuelto a tocar aparece en las dos, como lo
 * muestra `git status`: son dos versiones distintas del mismo archivo.
 */
export function columnasDelTaller(estado: EstadoGit): readonly ColumnaArea[] {
  if (!estado.repositorio) return [];
  const { areas } = estado;
  const vivas = estado.confirmaciones.filter((c) => !c.huerfana).length;
  return [
    {
      clave: 'trabajo',
      titulo: 'Directorio de trabajo',
      orden: 'git status',
      elementos: [
        ...areas.conflicto.map((ruta) => ({ texto: ruta, tono: 'conflicto' as const })),
        ...areas.modificado.map((e) => ({
          texto: e.ruta,
          tono: e.tipo === 'D' ? ('borrado-pendiente' as const) : ('modificado' as const),
        })),
        ...areas.sinSeguimiento.map((ruta) => ({ texto: ruta, tono: 'nuevo' as const })),
      ],
      vacio: 'sin cambios pendientes',
    },
    {
      clave: 'preparacion',
      titulo: 'Área de preparación',
      orden: 'git add',
      elementos: areas.preparado.map((e) => ({
        texto: e.origen === undefined ? e.ruta : `${e.origen} -> ${e.ruta}`,
        tono: e.tipo === 'D' ? ('borrado-preparado' as const) : ('preparado' as const),
      })),
      vacio: 'nada preparado',
    },
    {
      clave: 'local',
      titulo: 'Repositorio local',
      orden: 'git commit',
      elementos:
        vivas === 0
          ? []
          : [
              // Los archivos de la ultima confirmacion, como las otras dos areas
              // listan los suyos: asi se ve un archivo pasar de un area a la
              // siguiente (SPEC 027, punto 2.2).
              ...arbolVisible(estado.arbol ?? []),
              { texto: contar(vivas, 'confirmación', 'confirmaciones'), tono: 'neutro' as const },
              ...ramasOrdenadas(estado)
                .filter((r) => !estado.remotas.includes(r))
                .map((r) => ({
                  texto: r.nombre === estado.rama ? `${r.nombre} (actual)` : r.nombre,
                  tono: 'neutro' as const,
                })),
            ],
      vacio: 'sin confirmaciones',
    },
  ];
}

/** Cuantos archivos del arbol se listan antes de resumir el resto. */
export const ARCHIVOS_DEL_ARBOL = 30;

function arbolVisible(arbol: readonly string[]): readonly ElementoArea[] {
  const visibles = arbol.slice(0, ARCHIVOS_DEL_ARBOL).map((ruta) => ({ texto: ruta, tono: 'repositorio' as const }));
  const resto = arbol.length - visibles.length;
  if (resto <= 0) return visibles;
  return [...visibles, { texto: `y ${contar(resto, 'archivo más', 'archivos más')}`, tono: 'neutro' as const }];
}

/** La pila, siempre, aunque este vacia o no haya repositorio (SPEC 029, 2.1). */
export function guardadosDelTaller(estado: EstadoGit): readonly EntradaGuardadoVista[] {
  if (!estado.repositorio) return [];
  return estado.guardados.map((g) => ({
    clave: `stash-${g.indice}`,
    texto: `stash@{${g.indice}}: ${g.mensaje}`,
    archivos: [],
  }));
}

// --- La barra y el indicador -------------------------------------------------------

export interface BarraTaller {
  /** El motor que corre, dicho como se lee en la barra, o null si no lo dijo. */
  readonly motor: string | null;
  /** La carpeta de la consola, relativa a la carpeta del taller. */
  readonly carpeta: string;
  /** El nombre del repositorio, o `null` si la carpeta no esta dentro de uno. */
  readonly repositorio: string | null;
  readonly rama: string | null;
  readonly desconectado: boolean;
  readonly cambios: number;
  readonly operacion: string | null;
}

function nombreDe(ruta: string): string {
  return ruta.split('/').filter(Boolean).at(-1) ?? ruta;
}

function rutaDicha(sesion: SesionGit): string {
  return sesion.relativa === '' ? sesion.limite : `${sesion.limite}/${sesion.relativa}`;
}

const OPERACIONES: Readonly<Record<string, string>> = {
  fusion: 'fusión a medias',
  rebase: 'rebase a medias',
  'cherry-pick': 'cherry-pick a medias',
  revert: 'revert a medias',
};

function motorDicho(sesion: SesionGit): string | null {
  if (sesion.motor === 'java') return 'motor Java';
  if (sesion.motor === 'python') return 'motor Python';
  return null;
}

/** Sin repositorio no hay rama ni contador: no hay nada de que hablar (punto 4.5). */
export function barraDelTaller(documento: DocumentoTaller): BarraTaller {
  const { estado, sesion } = documento;
  if (!estado.repositorio) {
    return { motor: motorDicho(sesion), carpeta: rutaDicha(sesion), repositorio: null, rama: null, desconectado: false, cambios: 0, operacion: null };
  }
  const corto = cortoDe(estado);
  return {
    motor: motorDicho(sesion),
    carpeta: rutaDicha(sesion),
    repositorio: nombreDe(estado.raiz),
    rama: estado.rama ?? (estado.head === null ? null : corto(estado.head)),
    desconectado: estado.rama === null,
    cambios: estado.cambios,
    operacion: estado.operacion === null ? null : (OPERACIONES[estado.operacion] ?? estado.operacion),
  };
}

/**
 * El indicador como el de Git Bash: usuario y equipo, la carpeta y la rama
 * entre parentesis. La carpeta se dice desde la carpeta del taller, que es de
 * donde la consola no sale.
 */
export function indicadorDelTaller(documento: DocumentoTaller): Indicador {
  const { sesion, estado } = documento;
  const usuario = `${sesion.usuario}@${sesion.equipo}${sesion.sistema === 'windows' ? ' MINGW64' : ''}`;
  let rama: string | null = null;
  if (estado.repositorio) {
    const corto = cortoDe(estado);
    const base = estado.rama ?? (estado.head === null ? '' : `(${corto(estado.head)}...)`);
    const sufijo = estado.operacion === 'fusion' ? '|MERGING' : estado.operacion === 'rebase' ? '|REBASE' : '';
    rama = estado.dentroDeGit ? 'GIT_DIR!' : `${base}${sufijo}`;
  }
  return { usuario, ruta: rutaDicha(sesion), rama };
}

// --- La consola ----------------------------------------------------------------------

function lineasDe(texto: string): readonly string[] {
  if (texto === '') return [];
  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  if (lineas.at(-1) === '') lineas.pop();
  return lineas;
}

/**
 * Lo que la consola muestra de una orden: el eco, lo que Git imprimio y, en
 * otro color, lo que agrega el programa.
 *
 * La salida estandar va tal cual, con los mismos colores que el modo de
 * escenarios le da a `git status`. El error estandar va en rojo solo si la
 * orden fallo: Git escribe ahi tambien cosas que no son errores, como
 * «Switched to a new branch» (punto 4.2).
 */
export function renglonesDeOrden(
  orden: string,
  respuesta: RespuestaOrden,
  prefijo: string,
  indicador: Indicador,
): readonly Renglon[] {
  const fallo = respuesta.codigo !== 0;
  const salida: LineaSalida[] = lineasDe(respuesta.salida).map((texto) => ({ tipo: 'salida', texto }));
  // Los colores son los de Git: una linea que empieza con guion es una linea
  // quitada en un diff. En la salida de ls -l es un permiso, y va sin color.
  const deGit = /^\s*git\s/.test(orden);
  const error: Renglon[] = lineasDe(respuesta.error).map((texto, i) => ({
    clave: `${prefijo}:e${i}`,
    texto,
    color: fallo ? 'error' : 'normal',
  }));
  const avisos: Renglon[] = respuesta.avisos.map((texto, i) => ({
    clave: `${prefijo}:a${i}`,
    texto,
    color: 'programa',
  }));
  const pegadas = ordenesPegadas(orden);
  const aviso: Renglon[] =
    pegadas === null
      ? []
      : [
          {
            clave: `${prefijo}:pegadas`,
            texto: `¿Eran ${pegadas.length === 2 ? 'dos órdenes' : `${pegadas.length} órdenes`}? En la línea aparecen ${pegadas.join(' y ')}, y bash la toma como una sola. Si eran varias, escríbelas de a una.`,
            color: 'programa',
          },
        ];
  return [
    { clave: `${prefijo}:orden`, texto: orden, color: 'orden', indicador, propia: esOrdenPropia(orden) },
    ...aviso,
    ...(deGit
      ? colorearSalida(salida, `${prefijo}:s`)
      : salida.map((linea, i): Renglon => ({ clave: `${prefijo}:s:${i}`, texto: linea.texto, color: 'normal' }))),
    ...error,
    ...avisos,
  ];
}

/** Lo que la consola muestra al escribir `ayuda`, que no se manda al programa. */
export function renglonesDeAyuda(prefijo: string, indicador: Indicador): readonly Renglon[] {
  return [
    { clave: `${prefijo}:orden`, texto: 'ayuda', color: 'orden', indicador, propia: true },
    ...AYUDA.map((texto, i) => ({ clave: `${prefijo}:a${i}`, texto, color: 'programa' as const })),
  ];
}

/** Una linea propia del programa, en su color, fuera de cualquier orden. */
export function renglonDelPrograma(texto: string, clave: string): Renglon {
  return { clave, texto, color: 'programa' };
}

/** La unica linea fija de la consola, al abrirla (punto 4.7). */
export function presentacion(documento: DocumentoTaller): string {
  const donde = rutaDicha(documento.sesion);
  return `Modo taller. Lo que escribas aquí corre con Git de verdad en ${donde}.`;
}

/**
 * Completa la orden con la tecla de tabulacion, igual que el modo de
 * escenarios, pero con las ramas, etiquetas y archivos que Git conoce.
 */
export function completarEnTaller(entrada: string, estado: EstadoGit): Completado {
  const dibujo = comoEstadoDelDibujo(estado);
  if (dibujo === null || !estado.repositorio) return completar(entrada, VACIO);
  const rutas = [
    ...estado.areas.modificado.map((e) => e.ruta),
    ...estado.areas.preparado.map((e) => e.ruta),
    ...estado.areas.sinSeguimiento,
    ...estado.areas.conflicto,
  ];
  const archivos = [...new Set(rutas)].map((nombre) => ({ nombre, estado: 'modificado' as const, contenido: null }));
  return completar(entrada, { ...dibujo, ramas: dibujo.ramas.filter((r) => !r.nombre.includes('/')), archivos });
}

/** Un repositorio sin nada, para completar solo nombres de ordenes fuera de un repositorio. */
const VACIO: EstadoRepositorio = {
  ...(comoEstadoDelDibujo({
    repositorio: true,
    raiz: '',
    gitdir: '',
    dentroDeGit: false,
    rama: null,
    head: null,
    confirmaciones: [],
    ramas: [],
    remotas: [],
    etiquetas: [],
    guardados: [],
    operacion: null,
    areas: { preparado: [], modificado: [], sinSeguimiento: [], conflicto: [] },
    cambios: 0,
  }) as EstadoRepositorio),
};
