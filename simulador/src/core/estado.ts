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
    carpetas: [],
    borrados: [],
    borradosSinPreparar: [],
    guardados: [],
    reflog: [],
    remotos: [],
    config: { local: {}, global: {} },
    fusion: null,
    origHead: null,
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
  return archivosSeguidos(estado).has(nombre);
}

/**
 * Nombres que el repositorio esta versionando ahora mismo.
 *
 * Se recorre la historia alcanzable en orden: cada confirmacion suma lo que
 * registro y resta lo que saco del seguimiento. Mirar solo si el nombre
 * aparece en alguna confirmacion diria que un archivo retirado con `git rm`
 * sigue versionado, y ese es el error que el laboratorio 03 desmonta.
 */
export function archivosSeguidos(estado: EstadoRepositorio): ReadonlySet<string> {
  const seguidos = new Set<string>();
  const cabeza = idActual(estado);
  if (cabeza === null) return seguidos;
  const historia = antepasados(estado, cabeza);
  for (const confirmacion of estado.confirmaciones) {
    if (!historia.has(confirmacion.id)) continue;
    for (const nombre of confirmacion.archivos) seguidos.add(nombre);
    for (const nombre of confirmacion.borrados) seguidos.delete(nombre);
  }
  return seguidos;
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
        archivo.nombre === nombre
          ? { ...archivo, nombre, estado: nuevoEstado }
          : archivo,
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

/**
 * Lo no seguido, agrupado como lo agrupa Git.
 *
 * Git **no lista los archivos de una carpeta cuyo contenido esta entero sin
 * seguir**: muestra la carpeta, con la barra al final, y no entra. Solo baja a
 * los archivos cuando dentro de la carpeta hay algo que si conoce.
 *
 *     $ mkdir recetas && echo x > recetas/tacos.md
 *     $ git status --short
 *     ?? recetas/
 *
 * El simulador listaba `recetas/tacos.md`, o sea le mostraba al participante
 * algo distinto de lo que su terminal iba a decirle. Lo destaparon las capturas
 * del SPEC 011, en el laboratorio 04, donde la rama `mexicana` nace tres
 * confirmaciones atras y ahi la carpeta `recetas` todavia no existe.
 *
 * Devuelve las entradas en el orden en que aparecen los archivos, sin repetir
 * carpeta.
 */
export function sinSeguimientoAgrupado(estado: EstadoRepositorio): readonly string[] {
  // Todo lo que Git ya conoce: cualquier archivo que no sea de los sin seguir,
  // mas las rutas con la baja anotada, que siguen siendo rutas conocidas.
  const conocidos = [
    ...estado.archivos
      .filter((archivo) => archivo.estado !== 'sin-seguimiento')
      .map((archivo) => archivo.nombre),
    ...estado.borrados,
    ...estado.borradosSinPreparar,
  ];

  const entradas: string[] = [];
  for (const archivo of estado.archivos) {
    if (archivo.estado !== 'sin-seguimiento') continue;

    // De la carpeta mas alta hacia abajo: la primera que no contenga nada
    // conocido es la que Git muestra.
    const partes = archivo.nombre.split('/');
    let entrada = archivo.nombre;
    for (let hasta = 1; hasta < partes.length; hasta += 1) {
      const carpeta = partes.slice(0, hasta).join('/');
      if (conocidos.some((nombre) => nombre.startsWith(`${carpeta}/`))) continue;
      entrada = `${carpeta}/`;
      break;
    }
    if (!entradas.includes(entrada)) entradas.push(entrada);
  }
  return entradas;
}

/**
 * Deja el directorio de trabajo como corresponde a donde quedo la posicion.
 *
 * Al cambiar de rama o de confirmacion, Git **reemplaza el directorio de
 * trabajo** por el arbol del destino: los archivos que ahi no existen
 * desaparecen y los que si existen aparecen. Lo que no toca es el trabajo
 * pendiente, que viaja con el participante.
 *
 * El simulador no lo hacia: `estado.archivos` era una lista plana que se
 * arrastraba entera de una rama a otra, de modo que en el laboratorio 04, sobre
 * la rama `mexicana` abierta tres confirmaciones atras, seguian figurando las
 * recetas que todavia no existian. La comparacion de punta a punta no lo veia
 * porque solo mira los archivos con algo pendiente, y esos estaban limpios.
 *
 * Solo se llama donde el arbol de verdad cambia: `switch`, `checkout` y
 * `reset --hard`. Un `reset --soft` o `--mixed` mueve la posicion y deja el
 * directorio como estaba, y ahi esta funcion no interviene.
 */
export function sincronizarDirectorio(estado: EstadoRepositorio): EstadoRepositorio {
  const seguidos = archivosSeguidos(estado);

  // Lo que el participante tiene a medias viaja con el, este o no versionado en
  // el destino. Lo limpio es lo que se reemplaza.
  const pendientes = estado.archivos.filter((archivo) => archivo.estado !== 'limpio');
  const conPendiente = new Set(pendientes.map((archivo) => archivo.nombre));

  const limpios: Archivo[] = [...seguidos]
    .filter((nombre) => !conPendiente.has(nombre))
    .map((nombre) => ({ nombre, estado: 'limpio' as const }));

  // Se conserva el orden que ya tenian los que siguen versionados, para que la
  // pantalla no reordene la lista al cambiar de rama.
  const orden = new Map(estado.archivos.map((archivo, indice) => [archivo.nombre, indice]));
  limpios.sort(
    (una, otra) =>
      (orden.get(una.nombre) ?? Number.MAX_SAFE_INTEGER) -
      (orden.get(otra.nombre) ?? Number.MAX_SAFE_INTEGER),
  );

  return {
    ...estado,
    archivos: [...limpios, ...pendientes],
    // Un archivo versionado que ya no esta en el directorio deja de faltar
    // cuando el destino tampoco lo versiona.
    borradosSinPreparar: estado.borradosSinPreparar.filter((nombre) => seguidos.has(nombre)),
  };
}
