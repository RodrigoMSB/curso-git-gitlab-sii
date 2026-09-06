/**
 * Construccion y transformacion del estado del repositorio.
 *
 * Ninguna funcion de este modulo modifica el estado que recibe: todas
 * devuelven uno nuevo.
 */

import { antepasados } from './grafo';
import type {
  Archivo,
  Confirmacion,
  EstadoArchivo,
  EstadoRepositorio,
  Etiqueta,
  EntradaReflog,
  Rama,
} from './tipos';

export const DIRECTORIO_POR_DEFECTO = '/home/participante/recetario';
export const RAMA_POR_DEFECTO = 'main';
export const AUTOR_POR_DEFECTO = 'Participante del taller';
export const CORREO_POR_DEFECTO = 'participante@sii.cl';

/** Estado de partida: ni siquiera hay repositorio. */
export function estadoVacio(directorio: string = DIRECTORIO_POR_DEFECTO): EstadoRepositorio {
  return {
    iniciado: false,
    directorio,
    confirmaciones: [],
    ramas: [],
    etiquetas: [],
    puntero: { tipo: 'rama', rama: RAMA_POR_DEFECTO },
    archivos: [],
    guardados: [],
    reflog: [],
    remotos: [],
    config: { local: {}, global: {} },
    fusion: null,
    carriles: [{ rama: RAMA_POR_DEFECTO, carril: 0 }],
    contador: 0,
  };
}

// --- Consultas ---------------------------------------------------------------

/** Identificadores ya comprometidos, incluido el reservado por una fusion pendiente. */
export function idsUsados(estado: EstadoRepositorio): ReadonlySet<string> {
  const usados = new Set<string>();
  for (const confirmacion of estado.confirmaciones) usados.add(confirmacion.id);
  if (estado.fusion !== null) usados.add(estado.fusion.idPrevisto);
  return usados;
}

export function confirmacionPorId(
  estado: EstadoRepositorio,
  id: string,
): Confirmacion | undefined {
  return estado.confirmaciones.find((confirmacion) => confirmacion.id === id);
}

export function ramaPorNombre(estado: EstadoRepositorio, nombre: string): Rama | undefined {
  return estado.ramas.find((rama) => rama.nombre === nombre);
}

export function etiquetaPorNombre(
  estado: EstadoRepositorio,
  nombre: string,
): Etiqueta | undefined {
  return estado.etiquetas.find((etiqueta) => etiqueta.nombre === nombre);
}

/** Nombre de la rama actual, o `null` si el puntero esta desconectado. */
export function ramaActual(estado: EstadoRepositorio): string | null {
  return estado.puntero.tipo === 'rama' ? estado.puntero.rama : null;
}

/**
 * Confirmacion a la que apunta la posicion actual.
 *
 * Devuelve `null` cuando el puntero nombra una rama que todavia no existe, que
 * es el estado de un repositorio recien iniciado sin confirmaciones.
 */
export function idActual(estado: EstadoRepositorio): string | null {
  if (estado.puntero.tipo === 'confirmacion') return estado.puntero.id;
  return ramaPorNombre(estado, estado.puntero.rama)?.id ?? null;
}

export function archivoPorNombre(
  estado: EstadoRepositorio,
  nombre: string,
): Archivo | undefined {
  return estado.archivos.find((archivo) => archivo.nombre === nombre);
}

/** Indica si el archivo figura en alguna confirmacion alcanzable desde la posicion actual. */
export function estaSeguido(estado: EstadoRepositorio, nombre: string): boolean {
  const cabeza = idActual(estado);
  if (cabeza === null) return false;
  const historia = antepasados(estado, cabeza);
  return estado.confirmaciones.some(
    (confirmacion) => historia.has(confirmacion.id) && confirmacion.archivos.includes(nombre),
  );
}

/** Valor de configuracion, con la local por delante de la global. */
export function valorConfig(estado: EstadoRepositorio, clave: string): string | undefined {
  return estado.config.local[clave] ?? estado.config.global[clave];
}

export function autorActual(estado: EstadoRepositorio): { nombre: string; correo: string } {
  return {
    nombre: valorConfig(estado, 'user.name') ?? AUTOR_POR_DEFECTO,
    correo: valorConfig(estado, 'user.email') ?? CORREO_POR_DEFECTO,
  };
}

/** Carril de dibujo de una rama. Las ramas sin carril asignado caen en el cero. */
export function carrilDeRama(estado: EstadoRepositorio, rama: string): number {
  return estado.carriles.find((carril) => carril.rama === rama)?.carril ?? 0;
}

// --- Transformaciones --------------------------------------------------------

/** Reserva el primer carril libre para una rama que aun no tiene uno. */
export function asignarCarril(estado: EstadoRepositorio, rama: string): EstadoRepositorio {
  if (estado.carriles.some((carril) => carril.rama === rama)) return estado;
  const ocupados = new Set(estado.carriles.map((carril) => carril.carril));
  let libre = 0;
  while (ocupados.has(libre)) libre += 1;
  return { ...estado, carriles: [...estado.carriles, { rama, carril: libre }] };
}

export function renombrarCarril(
  estado: EstadoRepositorio,
  anterior: string,
  nuevo: string,
): EstadoRepositorio {
  return {
    ...estado,
    carriles: estado.carriles.map((carril) =>
      carril.rama === anterior ? { ...carril, rama: nuevo } : carril,
    ),
  };
}

export function liberarCarril(estado: EstadoRepositorio, rama: string): EstadoRepositorio {
  return { ...estado, carriles: estado.carriles.filter((carril) => carril.rama !== rama) };
}

/** Crea la rama si no existe, o la mueve si ya existe. */
export function establecerRama(
  estado: EstadoRepositorio,
  nombre: string,
  id: string,
): EstadoRepositorio {
  const existe = estado.ramas.some((rama) => rama.nombre === nombre);
  const ramas = existe
    ? estado.ramas.map((rama) => (rama.nombre === nombre ? { nombre, id } : rama))
    : [...estado.ramas, { nombre, id }];
  return asignarCarril({ ...estado, ramas }, nombre);
}

/**
 * Mueve la posicion actual a una confirmacion.
 *
 * Si el puntero nombra una rama, mueve la rama. Si esta desconectado, mueve el
 * puntero mismo.
 */
export function moverPosicionActual(
  estado: EstadoRepositorio,
  id: string,
): EstadoRepositorio {
  const rama = ramaActual(estado);
  if (rama === null) return { ...estado, puntero: { tipo: 'confirmacion', id } };
  return establecerRama(estado, rama, id);
}

/** Agrega una entrada al registro de referencias. La mas reciente queda primero. */
export function anotarReflog(
  estado: EstadoRepositorio,
  entrada: EntradaReflog,
): EstadoRepositorio {
  return { ...estado, reflog: [entrada, ...estado.reflog] };
}

/**
 * Anota el movimiento de la posicion actual, tanto en `HEAD` como en la rama
 * afectada, que es lo que permite recuperar confirmaciones huerfanas.
 */
export function anotarMovimiento(
  estado: EstadoRepositorio,
  opciones: {
    readonly id: string;
    readonly idAnterior: string | null;
    readonly operacion: string;
    readonly descripcion: string;
    readonly rama: string | null;
  },
): EstadoRepositorio {
  const { id, idAnterior, operacion, descripcion, rama } = opciones;
  let siguiente = anotarReflog(estado, {
    ref: 'HEAD',
    id,
    idAnterior,
    operacion,
    descripcion,
  });
  if (rama !== null) {
    siguiente = anotarReflog(siguiente, {
      ref: rama,
      id,
      idAnterior,
      operacion,
      descripcion,
    });
  }
  return siguiente;
}

/** Cambia el estado de un archivo, creandolo si no estaba presente. */
export function establecerArchivo(
  estado: EstadoRepositorio,
  nombre: string,
  nuevoEstado: EstadoArchivo,
): EstadoRepositorio {
  const existe = estado.archivos.some((archivo) => archivo.nombre === nombre);
  const archivos = existe
    ? estado.archivos.map((archivo) =>
        archivo.nombre === nombre ? { nombre, estado: nuevoEstado } : archivo,
      )
    : [...estado.archivos, { nombre, estado: nuevoEstado }];
  return { ...estado, archivos };
}

/** Aplica una transformacion a cada archivo del directorio de trabajo. */
export function transformarArchivos(
  estado: EstadoRepositorio,
  transformar: (archivo: Archivo) => Archivo,
): EstadoRepositorio {
  return { ...estado, archivos: estado.archivos.map(transformar) };
}

export function archivosEn(
  estado: EstadoRepositorio,
  ...estados: readonly EstadoArchivo[]
): readonly Archivo[] {
  return estado.archivos.filter((archivo) => estados.includes(archivo.estado));
}
