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
import type { Acceso, Adaptador } from '../real/adaptador';
import { LectorReal, type Operacion } from '../real/lector';
import { type Carpeta, type CarpetaElegida, elegirCarpeta, puedeAbrirCarpetas, reabrirCarpeta } from '../real/navegador';
import type { Cambio } from '../real/trabajo';
import { type EstadisticaDeVigilancia, Vigia } from '../real/vigilancia';
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

/** En que esta la conexion, para el indicador de la barra (SPEC 024, 5.1). */
export type EstadoConexion = 'en-vivo' | 'sin-repositorio' | 'no-soportado' | 'perdida' | 'sin-permiso';

export interface SesionReal {
  readonly nombre: string;
  readonly datos: DatosReales | null;
  /** Por que no se dibuja, si no se dibuja (punto 2.9). */
  readonly motivo: string | null;
  /** Los archivos de una carpeta que todavia no es repositorio (SPEC 024, 3), o null si lo es. */
  readonly sueltos: readonly string[] | null;
  readonly conexion: EstadoConexion;
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

export type ResultadoLectura =
  | { readonly tipo: 'leido'; readonly datos: DatosReales }
  | { readonly tipo: 'no-soportado'; readonly motivo: string }
  | { readonly tipo: 'sin-repositorio'; readonly archivos: readonly string[] }
  | { readonly tipo: 'perdida' | 'sin-permiso'; readonly motivo: string };

/** Todos los archivos de la carpeta, con su ruta: los de una carpeta que todavia no es repositorio. */
async function archivosSueltos(fs: Adaptador, carpeta: readonly string[] = []): Promise<string[]> {
  const salida: string[] = [];
  for (const entrada of (await fs.listar(carpeta)) ?? []) {
    const ruta = [...carpeta, entrada.nombre];
    if (entrada.esDirectorio) salida.push(...(await archivosSueltos(fs, ruta)));
    else salida.push(ruta.join('/'));
  }
  return salida.sort();
}

function sinAcceso(acceso: Exclude<Acceso, 'ok'>, nombre: string): ResultadoLectura {
  return acceso === 'no-existe'
    ? { tipo: 'perdida', motivo: `La carpeta ${nombre} ya no existe, o se movió. Conecta la carpeta de nuevo.` }
    : {
        tipo: 'sin-permiso',
        motivo: `El navegador ya no deja leer ${nombre}. Aprieta «reconectar» para devolverle el permiso.`,
      };
}

/**
 * La carpeta conectada: la lee y vigila si cambio. Cada lectura arma un lector
 * nuevo, para no arrastrar nada de la anterior. De una vuelta a otra se
 * guardan dos cosas: el vigia, que decide si hace falta leer, y las huellas
 * de los archivos del directorio de trabajo, para no volver a calcular las de
 * los que no cambiaron (SPEC 024, 2.3).
 */
export class Conexion {
  private marca: string | null = null;
  private ultimo: ResultadoLectura['tipo'] | null = null;
  private readonly vigia: Vigia;
  private readonly huellas = new Map<string, string>();

  constructor(
    readonly nombre: string,
    private readonly fs: Adaptador,
    private readonly windows: boolean,
    /** El manejador de la carpeta en el navegador, para recordarla (SPEC 024, 4). */
    readonly carpeta: Carpeta | null = null,
  ) {
    this.vigia = new Vigia(fs);
  }

  /** Lo que costo la ultima vuelta del vigia (CA5). */
  get vigilancia(): EstadisticaDeVigilancia {
    return this.vigia.estadistica;
  }

  async leer(): Promise<ResultadoLectura> {
    const acceso = await this.fs.acceso();
    if (acceso !== 'ok') return this.anotar(sinAcceso(acceso, this.nombre));
    return this.leerCon(await this.vigia.marca());
  }

  private anotar(resultado: ResultadoLectura): ResultadoLectura {
    this.ultimo = resultado.tipo;
    return resultado;
  }

  private async leerCon(marca: string | null): Promise<ResultadoLectura> {
    this.marca = marca;
    const lector = new LectorReal(this.fs, {
      autocrlfPorDefecto: this.windows ? 'true' : 'false',
      huellas: this.huellas,
    });
    try {
      const lectura = await lector.leer();
      if (lectura.tipo === 'sin-repositorio') {
        return this.anotar({ tipo: 'sin-repositorio', archivos: await archivosSueltos(this.fs) });
      }
      if (lectura.tipo !== 'leido') return this.anotar(lectura);
      const inicio = performance.now();
      const { estado, ramasRemotas } = await lector.estadoDelMotor(lectura.repositorio, {
        directorio: this.nombre,
        configuracionGlobal: CONFIGURACION_DEL_TALLER,
      });
      const repositorio = lectura.repositorio;
      return this.anotar({
        tipo: 'leido',
        datos: {
          estado,
          ramasRemotas,
          cambios: repositorio.cambios,
          operacion: repositorio.operacion,
          tiempos: { ...repositorio.tiempos, motor: Math.round((performance.now() - inicio) * 10) / 10 },
        },
      });
    } catch (error) {
      return this.anotar({
        tipo: 'no-soportado',
        motivo: `no se pudo leer el repositorio: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Relee solo si algo cambio. Devuelve null si no cambio nada, o si Git esta
   * escribiendo. Si la carpeta se perdio, lo dice una vez y despues espera.
   */
  async revisar(): Promise<ResultadoLectura | null> {
    const acceso = await this.fs.acceso();
    if (acceso !== 'ok') {
      const perdida = sinAcceso(acceso, this.nombre);
      return perdida.tipo === this.ultimo ? null : this.anotar(perdida);
    }
    if (this.ultimo === 'perdida' || this.ultimo === 'sin-permiso') return this.leer();
    let marca: string | null;
    try {
      marca = await this.vigia.marca();
    } catch {
      // La carpeta cambio mientras se recorria: la vuelta siguiente lo vera.
      return null;
    }
    if (marca === null || marca === this.marca) return null;
    return this.leerCon(marca);
  }
}

export function navegadorPuedeConectar(): boolean {
  return puedeAbrirCarpetas();
}

function nuevaConexion(elegida: CarpetaElegida): Conexion {
  const windows = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);
  return new Conexion(elegida.nombre, elegida.adaptador, windows, elegida.carpeta);
}

/** Pide la carpeta. Null si el alumno cancelo. */
export async function conectarRepositorio(): Promise<Conexion | null> {
  const carpeta = await elegirCarpeta();
  return carpeta === null ? null : nuevaConexion(carpeta);
}

/** Vuelve a conectar una carpeta guardada, con el clic que el navegador exige. Null si no dio permiso. */
export async function reconectarRepositorio(carpeta: Carpeta): Promise<Conexion | null> {
  const elegida = await reabrirCarpeta(carpeta);
  return elegida === null ? null : nuevaConexion(elegida);
}

/** Lo que dice la barra cuando el navegador no deja abrir la carpeta (SPEC 024, 1.4). */
export const SIN_LA_API = 'Este navegador no deja abrir una carpeta: usa Chrome o Edge. Los escenarios siguen funcionando.';

/** Una linea clara para cualquier falla al pedir la carpeta. */
export function motivoDeFalla(error: unknown): string {
  const nombre = typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (nombre === 'SecurityError' || nombre === 'NotAllowedError') {
    return 'Este equipo no permite que el navegador abra carpetas (lo bloquea una política o un permiso). Los escenarios siguen funcionando.';
  }
  const mensaje = (error instanceof Error ? error.message : String(error)).replace(/\.$/, '');
  return `No se pudo abrir la carpeta: ${mensaje}. Los escenarios siguen funcionando.`;
}

const AVISO_DE_CONSOLA: Renglon = {
  clave: 'modo-conectado',
  texto:
    'Modo conectado: esta consola previsualiza sobre tu repositorio y no ejecuta nada. Las órdenes se escriben en Git Bash.',
  color: 'limite',
};

export function iniciarSesionReal(nombre: string, lectura: ResultadoLectura): SesionReal {
  return actualizarSesionReal(
    {
      nombre,
      datos: null,
      motivo: null,
      sueltos: null,
      conexion: 'en-vivo',
      renglones: [AVISO_DE_CONSOLA],
      historial: [],
      pendiente: null,
      seleccion: null,
      lecturas: 0,
    },
    lectura,
  );
}

/** Lo que Git cambio llego: se redibuja y la previsualizacion pendiente se borra (punto 2.8). */
export function actualizarSesionReal(sesion: SesionReal, lectura: ResultadoLectura): SesionReal {
  const base = { ...sesion, pendiente: null, lecturas: sesion.lecturas + 1 };
  switch (lectura.tipo) {
    case 'leido':
      return { ...base, datos: lectura.datos, motivo: null, sueltos: null, conexion: 'en-vivo' };
    case 'sin-repositorio':
      return { ...base, datos: null, motivo: null, sueltos: lectura.archivos, conexion: 'sin-repositorio' };
    case 'no-soportado':
      return { ...base, datos: null, motivo: lectura.motivo, sueltos: null, conexion: 'no-soportado' };
    default:
      // Sin carpeta no se deja el dibujo viejo como si fuera el de ahora.
      return { ...base, datos: null, motivo: lectura.motivo, sueltos: null, conexion: lectura.tipo };
  }
}

/** El indicador de la barra: a que carpeta mira la pagina y si la esta leyendo en vivo (SPEC 024, 5.1). */
export function estadoDeConexion(sesion: SesionReal): { readonly estado: EstadoConexion; readonly texto: string } {
  const textos: Readonly<Record<EstadoConexion, string>> = {
    'en-vivo': `${sesion.nombre} · leyendo en vivo`,
    'sin-repositorio': `${sesion.nombre} · en vivo, todavía sin repositorio`,
    'no-soportado': `${sesion.nombre} · en vivo, pero no se puede dibujar`,
    perdida: `${sesion.nombre} ya no existe`,
    'sin-permiso': `${sesion.nombre} · sin permiso para leer`,
  };
  return { estado: sesion.conexion, texto: textos[sesion.conexion] };
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

export const AVISO_SIN_REPOSITORIO =
  'Esta carpeta todavía no es un repositorio: no tiene carpeta .git. Cuando hagas git init, la pantalla empieza a dibujar sola.';

export function avisosReales(sesion: SesionReal): AvisosReales {
  if (sesion.sueltos !== null) return { lineas: [AVISO_SIN_REPOSITORIO], tiempos: null };
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
/**
 * Las areas de una carpeta que todavia no es repositorio (SPEC 024, 3.2): los
 * archivos estan, pero no son de Git todavia, ni nuevos ni nada.
 */
function columnasSinRepositorio(sueltos: readonly string[]): readonly ColumnaArea[] {
  return [
    {
      clave: 'trabajo',
      titulo: 'Carpeta, sin Git todavía',
      orden: 'git init',
      elementos: sueltos.map((ruta) => ({ texto: ruta, tono: 'suelto' as const })),
      vacio: 'carpeta vacía',
    },
    { clave: 'preparacion', titulo: 'Área de preparación', orden: 'git add', elementos: [], vacio: 'no hay repositorio' },
    { clave: 'local', titulo: 'Repositorio local', orden: 'git commit', elementos: [], vacio: 'no hay repositorio' },
  ];
}

export function construirPantallaReal(sesion: SesionReal, opciones: OpcionesPantalla): Pantalla {
  // Lo que no se sabe representar no se dibuja a medias (punto 2.9): la
  // pantalla queda vacia y el aviso dice por que.
  const datos: DatosReales = sesion.datos ?? {
    // Sin repositorio el motor tambien lo sabe: asi `git init` se previsualiza como en el escenario.
    estado: { ...estadoVacio(sesion.nombre), iniciado: sesion.sueltos === null },
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
    columnas: sesion.sueltos === null ? columnasReales(datos) : columnasSinRepositorio(sesion.sueltos),
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
