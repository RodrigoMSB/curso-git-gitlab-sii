/**
 * El simulador mirando el repositorio real del alumno (SPEC 020).
 *
 * Es un modo aparte de los escenarios, no un reemplazo (punto 1.2). Lo que se
 * reutiliza es toda la pantalla: el grafo, las tres areas, la consola y la
 * barra. Lo que cambia es de donde sale el estado: de la carpeta `.git` que el
 * alumno eligio, releida cada vez que Git la cambia.
 *
 * La consola **no ejecuta**. Previsualiza sobre el estado real, en trazo
 * discontinuo, y al apretar Enter dice que la orden se escribe en Git Bash. La
 * pagina nunca escribe en el repositorio (punto 1.3).
 */

import { cadenaDeObjetos, previsualizar, ramaActual } from '../core';
import { estadoVacio } from '../core/estado';
import type { EstadoRepositorio, Previsualizacion } from '../core/tipos';
import { ALIAS_DEL_TALLER } from '../escenarios';
import { disponer } from '../grafico/disposicion';
import type { Adaptador } from '../real/adaptador';
import { LectorReal, type Operacion } from '../real/lector';
import { elegirCarpeta, puedeAbrirCarpetas } from '../real/navegador';
import type { Cambio } from '../real/trabajo';
import { marcaDelRepositorio } from '../real/vigilancia';
import { type Completado, completar, indicadorDe, type Renglon } from './consola';
import { type ColumnaArea, type ElementoArea, type OpcionesPantalla, type Pantalla, resumenBarra } from './pantalla';

/** Lo que el lector trajo, ya traducido a lo que la pantalla usa. */
export interface DatosReales {
  readonly estado: EstadoRepositorio;
  readonly ramasRemotas: readonly { readonly nombre: string; readonly id: string }[];
  readonly cambios: readonly Cambio[];
  readonly operacion: Operacion;
  /** Milisegundos que tomo leer, por parte: se muestran porque el punto 3 pide medirlos. */
  readonly tiempos: Readonly<Record<string, number>>;
}

export interface SesionReal {
  readonly nombre: string;
  readonly datos: DatosReales | null;
  /** Por que no se dibuja, si no se dibuja (punto 2.9). */
  readonly motivo: string | null;
  readonly renglones: readonly Renglon[];
  readonly historial: readonly string[];
  /** La ultima orden que se escribio con Enter, que sigue previsualizada hasta que Git la haga. */
  readonly pendiente: string | null;
  readonly seleccion: string | null;
  /** Cuantas veces se releyo el repositorio desde que se conecto. */
  readonly lecturas: number;
}

/** La configuracion global del alumno no esta en la carpeta; se supone la que deja el laboratorio 01. */
const CONFIGURACION_DEL_TALLER = {
  'user.name': 'Participante del taller',
  'user.email': 'participante@sii.cl',
  'alias.s': ALIAS_DEL_TALLER.s,
  'alias.lg': ALIAS_DEL_TALLER.lg,
};

export type ResultadoLectura = { readonly tipo: 'leido'; readonly datos: DatosReales } | { readonly tipo: 'no-soportado'; readonly motivo: string };

/**
 * La carpeta conectada: la lee y vigila si cambio. Cada lectura arma un lector
 * nuevo, para no arrastrar nada de la anterior; lo que se reutiliza entre
 * vueltas es la marca, que decide si hace falta leer.
 */
export class Conexion {
  private marca: string | null = null;

  constructor(
    readonly nombre: string,
    private readonly fs: Adaptador,
    private readonly windows: boolean,
  ) {}

  async leer(): Promise<ResultadoLectura> {
    this.marca = await marcaDelRepositorio(this.fs);
    const lector = new LectorReal(this.fs, { autocrlfPorDefecto: this.windows ? 'true' : 'false' });
    try {
      const lectura = await lector.leer();
      if (lectura.tipo !== 'leido') return lectura;
      const inicio = performance.now();
      const { estado, ramasRemotas } = await lector.estadoDelMotor(lectura.repositorio, {
        directorio: this.nombre,
        configuracionGlobal: CONFIGURACION_DEL_TALLER,
      });
      const repositorio = lectura.repositorio;
      return {
        tipo: 'leido',
        datos: {
          estado,
          ramasRemotas,
          cambios: repositorio.cambios,
          operacion: repositorio.operacion,
          tiempos: { ...repositorio.tiempos, motor: Math.round((performance.now() - inicio) * 10) / 10 },
        },
      };
    } catch (error) {
      return { tipo: 'no-soportado', motivo: `no se pudo leer el repositorio: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /** Relee solo si algo cambio. Devuelve null si no cambio nada, o si Git esta escribiendo. */
  async revisar(): Promise<ResultadoLectura | null> {
    const marca = await marcaDelRepositorio(this.fs);
    if (marca === null || marca === this.marca) return null;
    return this.leer();
  }
}

export function navegadorPuedeConectar(): boolean {
  return puedeAbrirCarpetas();
}

/** Pide la carpeta. Null si el alumno cancelo. */
export async function conectarRepositorio(): Promise<Conexion | null> {
  const carpeta = await elegirCarpeta();
  if (carpeta === null) return null;
  const windows = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);
  return new Conexion(carpeta.nombre, carpeta.adaptador, windows);
}

export function iniciarSesionReal(nombre: string, lectura: ResultadoLectura): SesionReal {
  return actualizarSesionReal(
    { nombre, datos: null, motivo: null, renglones: [], historial: [], pendiente: null, seleccion: null, lecturas: 0 },
    lectura,
  );
}

/** Lo que Git cambio llego: se redibuja y la previsualizacion pendiente se borra (punto 2.8). */
export function actualizarSesionReal(sesion: SesionReal, lectura: ResultadoLectura): SesionReal {
  return {
    ...sesion,
    datos: lectura.tipo === 'leido' ? lectura.datos : null,
    motivo: lectura.tipo === 'leido' ? null : lectura.motivo,
    pendiente: null,
    lecturas: sesion.lecturas + 1,
  };
}

/** Enter en la consola: no se ejecuta, se dice donde escribirla. */
export function anotarOrdenReal(sesion: SesionReal, linea: string): SesionReal {
  const orden = linea.trim();
  if (orden === '') return sesion;
  const numero = sesion.historial.length + 1;
  const renglones: Renglon[] = [
    { clave: `${numero}:orden`, texto: orden, color: 'orden' },
    { clave: `${numero}:0`, texto: 'Esta orden no se ejecuta aquí: la pantalla solo mira tu repositorio.', color: 'limite' },
    {
      clave: `${numero}:1`,
      texto: 'Escríbela en Git Bash. Cuando Git termine, la pantalla se actualiza sola.',
      color: 'limite',
    },
  ];
  return {
    ...sesion,
    renglones: [...sesion.renglones, ...renglones],
    historial: [...sesion.historial, orden],
    pendiente: orden,
  };
}

export function seleccionarEnReal(sesion: SesionReal, id: string | null): SesionReal {
  return { ...sesion, seleccion: sesion.seleccion === id ? null : id };
}

const TONO_TRABAJO: Readonly<Record<string, ElementoArea['tono']>> = {
  M: 'modificado',
  D: 'borrado-pendiente',
  A: 'nuevo',
};

/**
 * Las areas, desde el estado corto real. Un archivo preparado y despues
 * modificado (`MM`) aparece en las dos columnas, como en `git status`; el
 * modelo del motor no puede decir eso, y por eso las areas no pasan por el.
 */
export function columnasReales(datos: DatosReales): readonly ColumnaArea[] {
  const trabajo: ElementoArea[] = [];
  const preparacion: ElementoArea[] = [];
  const ordenados = [...datos.cambios].sort((a, b) => (a.ruta < b.ruta ? -1 : 1));
  for (const { x, y, ruta, origen } of ordenados) {
    const conflicto = x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D');
    if (conflicto) {
      trabajo.push({ texto: ruta, tono: 'conflicto' });
      continue;
    }
    if (x === '?') {
      trabajo.push({ texto: ruta, tono: 'nuevo' });
      continue;
    }
    if (x === 'D') preparacion.push({ texto: ruta, tono: 'borrado-preparado' });
    else if (x === 'R') preparacion.push({ texto: `${origen ?? ''} -> ${ruta}`, tono: 'preparado' });
    else if (x !== ' ') preparacion.push({ texto: ruta, tono: 'preparado' });
    const tono = TONO_TRABAJO[y];
    if (tono !== undefined) trabajo.push({ texto: ruta, tono });
  }
  const estado = datos.estado;
  const rama = ramaActual(estado);
  return [
    { clave: 'trabajo', titulo: 'Directorio de trabajo', orden: 'git status', elementos: trabajo, vacio: 'sin cambios pendientes' },
    { clave: 'preparacion', titulo: 'Área de preparación', orden: 'git add', elementos: preparacion, vacio: 'nada preparado' },
    {
      clave: 'local',
      titulo: 'Repositorio local',
      orden: 'git commit',
      elementos: [
        { texto: `${estado.confirmaciones.length} confirmaciones`, tono: 'neutro' },
        ...estado.ramas.map((r) => ({ texto: r.nombre === rama ? `${r.nombre} (actual)` : r.nombre, tono: 'neutro' as const })),
        ...datos.ramasRemotas.map((r) => ({ texto: r.nombre, tono: 'neutro' as const })),
      ],
      vacio: 'sin confirmaciones',
    },
  ];
}

const OPERACIONES: Readonly<Record<Exclude<Operacion, null>, string>> = {
  fusion: 'Hay una fusión a medio hacer (git merge): los archivos en conflicto están en amarillo.',
  reversion: 'Hay un git revert a medio hacer: se muestra tal como está.',
  seleccion: 'Hay un git cherry-pick a medio hacer: se muestra tal como está.',
  reorganizacion:
    'Hay un rebase a medio hacer. La pantalla muestra el repositorio tal como está, pero no sabe dibujar el rebase en curso.',
};

export interface AvisosReales {
  /** Una linea por cosa que el alumno tiene que saber de lo que ve. */
  readonly lineas: readonly string[];
  readonly tiempos: Readonly<Record<string, number>> | null;
}

export function avisosReales(sesion: SesionReal): AvisosReales {
  if (sesion.datos === null) return { lineas: [sesion.motivo ?? 'leyendo…'], tiempos: null };
  const lineas: string[] = [];
  const operacion = sesion.datos.operacion;
  if (operacion !== null) lineas.push(OPERACIONES[operacion]);
  return { lineas, tiempos: sesion.datos.tiempos };
}

function previsualizacionReal(estado: EstadoRepositorio, orden: string): Previsualizacion | null {
  if (orden.trim() === '') return null;
  const vista = previsualizar(estado, orden.trim());
  if (vista.error) return null;
  if (vista.confirmacionesNuevas.length === 0 && !vista.punteroMovido) return null;
  return vista;
}

/** La pantalla completa en modo real, con la misma forma que la de un escenario. */
export function construirPantallaReal(sesion: SesionReal, opciones: OpcionesPantalla): Pantalla {
  // Lo que no se sabe representar no se dibuja a medias (punto 2.9): la
  // pantalla queda vacia y el aviso dice por que.
  const datos: DatosReales = sesion.datos ?? {
    estado: { ...estadoVacio(sesion.nombre), iniciado: true },
    ramasRemotas: [],
    cambios: [],
    operacion: null,
    tiempos: {},
  };
  const estado = datos.estado;
  const orden = opciones.entrada.trim() !== '' ? opciones.entrada : (sesion.pendiente ?? '');
  const vista = opciones.previsualizacionActiva ? previsualizacionReal(estado, orden) : null;
  const medidas = {
    altoMaximo: opciones.altoGrafo ?? null,
    anchoMaximo: opciones.anchoGrafo ?? null,
    ramasRemotas: datos.ramasRemotas,
  };
  const grafo =
    vista === null
      ? disponer(estado, { ...medidas, previsualizadas: [] })
      : disponer(vista.estadoResultante, { ...medidas, previsualizadas: vista.confirmacionesNuevas });
  const barra = resumenBarra(estado);
  return {
    barra: { ...barra, repositorio: sesion.nombre, cambiosSinConfirmar: datos.cambios.length },
    indicador: indicadorDe(estado),
    renglones: sesion.renglones,
    grafo,
    aviso: vista === null ? null : { confirmacionesNuevas: vista.confirmacionesNuevas.length, punteroMovido: vista.punteroMovido },
    columnas: columnasReales(datos),
    paneles: opciones.modoRelator
      ? { guardado: null, diferencias: null, objetos: null }
      : {
          guardado:
            estado.guardados.length === 0
              ? null
              : estado.guardados.map((entrada, posicion) => ({
                  clave: `stash-${posicion}`,
                  texto: `stash@{${posicion}}: ${entrada.mensaje}`,
                  archivos: entrada.archivos.map((archivo) => archivo.nombre),
                })),
          diferencias: null,
          objetos: sesion.seleccion === null ? null : cadenaDeObjetos(estado, sesion.seleccion),
        },
    segmentos: [],
    seleccion: sesion.seleccion,
  };
}

/** El tabulador de la consola, sobre el estado real. */
export function completarEnReal(texto: string, sesion: SesionReal): Completado {
  if (sesion.datos === null) return { texto: null, sugerencias: [] };
  return completar(texto, sesion.datos.estado);
}
