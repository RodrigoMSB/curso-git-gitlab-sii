/**
 * Ordenes que crean y consultan confirmaciones: `commit` y `log`.
 */

import {
  antesDelSeparador,
  posicionales,
  tieneOpcion,
  trasElSeparador,
  valorDeOpcion,
  valorDeOpcionPegado,
} from '../analizador';
import { agregarConfirmacion, resumenArchivos } from '../confirmaciones';
import {
  archivosEn,
  carrilDeRama,
  confirmacionPorId,
  idActual,
  moverPosicionActual,
  anotarMovimiento,
  ramaActual,
  transformarArchivos,
} from '../estado';
import { arbolDe, comparacionesEntre } from '../contenido';
import { formatearEstadisticasDe, formatearParches } from '../diferencias';
import { formatearEstadoLargo, formatearHistorial } from '../formato';
import { historia } from '../grafo';
import {
  aplicarFiltros,
  aplicarFormato,
  especificadoresFuera,
  instanteDe,
  SIN_FILTROS,
  type FiltrosHistorial,
} from '../historial';
import { limite } from '../salida';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { Confirmacion, EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** Etiqueta que Git antepone al identificador tras confirmar. */
function rotuloPosicion(estado: EstadoRepositorio, raiz: boolean): string {
  const rama = ramaActual(estado);
  const nombre = rama ?? 'detached HEAD';
  return raiz ? `${nombre} (root-commit)` : nombre;
}

/** Carril de dibujo que corresponde a la confirmacion que se va a crear. */
function carrilDestino(estado: EstadoRepositorio): number {
  const rama = ramaActual(estado);
  if (rama !== null) return carrilDeRama(estado, rama);
  const cabeza = idActual(estado);
  if (cabeza === null) return 0;
  return confirmacionPorId(estado, cabeza)?.carril ?? 0;
}

/** Cierra una fusion con conflictos ya resueltos creando la confirmacion de union. */
function confirmarFusion(
  estado: EstadoRepositorio,
  mensajePedido: string | null,
): ResultadoOrden {
  const fusion = estado.fusion;
  if (fusion === null) return fallo(estado, 'fatal: no merge in progress');

  const pendientes = archivosEn(estado, 'en-conflicto');
  if (pendientes.length > 0) {
    return fallo(
      estado,
      'error: Committing is not possible because you have unmerged files.',
      'hint: Fix them up in the work tree, and then use \'git add/rm <file>\'',
      'hint: as appropriate to mark resolution and make a commit.',
      'fatal: Exiting because of an unresolved conflict.',
    );
  }

  const preparados = archivosEn(estado, 'preparado').map((archivo) => archivo.nombre);
  const afectados = preparados.length > 0 ? preparados : [...fusion.conflictos];
  const mensaje = mensajePedido ?? `Merge branch '${fusion.rama}'`;

  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: [fusion.idDestino, fusion.idOrigen],
    archivos: afectados,
    carril: carrilDestino(estado),
    idForzado: fusion.idPrevisto,
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado' ? { ...archivo, estado: 'limpio' } : archivo,
  );
  siguiente = { ...siguiente, fusion: null };
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: fusion.idDestino,
    operacion: 'commit (merge)',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(
      `[${rotuloPosicion(siguiente, false)} ${creado.confirmacion.id}] ${mensaje}`,
      resumenArchivos(afectados),
    ),
  );
}

/** Rehace la ultima confirmacion con un identificador nuevo, dejando huerfana la anterior. */
function enmendar(estado: EstadoRepositorio, mensajePedido: string | null): ResultadoOrden {
  const cabeza = idActual(estado);
  const anterior = cabeza === null ? undefined : confirmacionPorId(estado, cabeza);
  if (cabeza === null || anterior === undefined) {
    return fallo(estado, 'fatal: You have nothing to amend.');
  }

  const preparados = archivosEn(estado, 'preparado').map((archivo) => archivo.nombre);
  const archivos = [...new Set([...anterior.archivos, ...preparados])];
  const borrados = [
    ...new Set([...anterior.borrados, ...estado.borrados, ...nombresAnteriores(estado)]),
  ];
  const mensaje = mensajePedido ?? anterior.mensaje;

  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: anterior.padres,
    archivos,
    borrados,
    carril: anterior.carril,
    matiz: `amend:${anterior.id}`,
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado'
      ? { nombre: archivo.nombre, estado: 'limpio' as const, contenido: null }
      : archivo,
  );
  siguiente = { ...siguiente, borrados: [] };
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: 'commit (amend)',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(
      `[${rotuloPosicion(siguiente, anterior.padres.length === 0)} ${creado.confirmacion.id}] ${mensaje}`,
      resumenArchivos(archivos),
    ),
  );
}

/** `git commit`, con `-m` y `--amend`. */
export const ordenCommit: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const heredado = mensajeHeredado(estado, argumentos);
  if (typeof heredado === 'string' && heredado.startsWith('fatal:')) {
    return fallo(estado, heredado);
  }
  const mensaje = valorDeOpcion(argumentos, '-m', '--message') ?? (heredado as string | null);

  if (estado.fusion !== null) return confirmarFusion(estado, mensaje);
  if (tieneOpcion(argumentos, '--amend')) return enmendar(estado, mensaje);

  const preparados = archivosEn(estado, 'preparado').map((archivo) => archivo.nombre);
  // Un renombrado deja de seguir el nombre viejo. Sin anotarlo, `git ls-files`
  // seguiria enumerando la ruta anterior despues de confirmar el movimiento.
  const borrados = [...new Set([...estado.borrados, ...nombresAnteriores(estado)])];
  if (preparados.length === 0 && borrados.length === 0) {
    return ok(estado, lineas(...formatearEstadoLargo(estado)));
  }
  if (mensaje === null) {
    return fallo(
      estado,
      'Aborting commit due to empty commit message.',
      'hint: use "git commit -m \'<mensaje>\'" to describe the change',
    );
  }

  const cabeza = idActual(estado);
  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: cabeza === null ? [] : [cabeza],
    archivos: preparados,
    borrados,
    carril: carrilDestino(estado),
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado'
      ? { nombre: archivo.nombre, estado: 'limpio' as const, contenido: null }
      : archivo,
  );
  siguiente = { ...siguiente, borrados: [] };
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: cabeza === null ? 'commit (initial)' : 'commit',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(
      `[${rotuloPosicion(siguiente, cabeza === null)} ${creado.confirmacion.id}] ${mensaje}`,
      resumenArchivos([...preparados, ...borrados]),
    ),
  );
};

/**
 * Mensaje que `-c` y `-C` reutilizan de otra confirmacion.
 *
 * En Git, `-c` abre el editor con ese mensaje ya escrito y `-C` lo toma tal
 * cual. El simulador no tiene editor, asi que las dos toman el mensaje: es lo
 * que ocurre cuando el participante acepta lo que el editor le ofrece, que es
 * justo lo que el enunciado del laboratorio 06 le pide hacer.
 */
function mensajeHeredado(
  estado: EstadoRepositorio,
  argumentos: readonly string[],
): string | null {
  const referencia = valorDeOpcion(argumentos, '-c', '-C');
  if (referencia === null) return null;
  const id = resolverReferencia(estado, referencia);
  if (id === null) return `fatal: could not lookup commit ${referencia}`;
  const confirmacion = confirmacionPorId(estado, id);
  if (confirmacion === undefined) return `fatal: could not lookup commit ${referencia}`;
  return confirmacion.mensaje;
}

/** Nombres que los archivos preparados tenian antes de que `git mv` los moviera. */
function nombresAnteriores(estado: EstadoRepositorio): readonly string[] {
  return estado.archivos
    .filter((archivo) => archivo.estado === 'preparado' && archivo.renombradoDe !== undefined)
    .map((archivo) => archivo.renombradoDe as string);
}

/** La cadena de `git log -S`, escrita suelta o pegada a la opcion. */
function cadenaBuscada(argumentos: readonly string[]): string | null {
  const pegada = argumentos.find(
    (argumento) => argumento.startsWith('-S') && argumento.length > 2,
  );
  if (pegada !== undefined) return pegada.slice(2);
  return valorDeOpcion(argumentos, '-S');
}

/** Limite de confirmaciones pedido con `-n 3` o con `-3`. Lo usan tambien `git reflog`. */
export function limitePedido(argumentos: readonly string[]): number | null {
  const explicito = valorDeOpcion(argumentos, '-n', '--max-count');
  if (explicito !== null) {
    const numero = Number.parseInt(explicito, 10);
    return Number.isNaN(numero) ? null : numero;
  }
  for (const argumento of argumentos) {
    const coincidencia = /^-(\d+)$/.exec(argumento);
    const digitos = coincidencia?.[1];
    if (digitos !== undefined) return Number.parseInt(digitos, 10);
  }
  return null;
}

/** `git log`, con `--oneline`, `--graph`, `-n` y `--all`. */
/**
 * Rutas pedidas detras del separador `--`, que es como Git limita el historial
 * a un archivo o a una carpeta.
 */
function rutaFiltrada(argumentos: readonly string[]): string | null {
  return trasElSeparador(argumentos)[0] ?? null;
}

/**
 * Puntas del recorrido, resueltas desde lo que el participante nombro.
 *
 * Un rango `a..b` es lo que hay en `b` y no en `a`, que es como Git lo define.
 * Se devuelve tambien lo que hay que excluir para poder aplicarlo despues.
 */
function puntasPedidas(
  estado: EstadoRepositorio,
  argumentos: readonly string[],
): { puntas: readonly string[]; excluidas: readonly string[] } | string {
  const referencias = posicionales(
    antesDelSeparador(argumentos),
    ['-n', '--max-count', '--author', '--since', '--after', '--until', '--before', '--format', '--pretty', '--date', '-S'],
  );

  if (tieneOpcion(argumentos, '--all')) {
    const puntas = [
      ...estado.ramas.map((rama) => rama.id),
      ...estado.etiquetas.map((etiqueta) => etiqueta.id),
    ];
    const cabeza = idActual(estado);
    if (cabeza !== null) puntas.push(cabeza);
    return { puntas, excluidas: [] };
  }

  if (referencias.length === 0) {
    const cabeza = idActual(estado);
    if (cabeza === null) {
      const rama = ramaActual(estado) ?? 'HEAD';
      return `fatal: your current branch '${rama}' does not have any commits yet`;
    }
    return { puntas: [cabeza], excluidas: [] };
  }

  const puntas: string[] = [];
  const excluidas: string[] = [];
  for (const referencia of referencias) {
    const rango = /^(.+?)\.\.(.+)$/.exec(referencia);
    const desde = rango?.[1];
    const hasta = rango?.[2];
    if (desde !== undefined && hasta !== undefined) {
      const idDesde = resolverReferencia(estado, desde);
      const idHasta = resolverReferencia(estado, hasta);
      if (idDesde === null) return `fatal: ambiguous argument '${desde}': unknown revision`;
      if (idHasta === null) return `fatal: ambiguous argument '${hasta}': unknown revision`;
      puntas.push(idHasta);
      excluidas.push(idDesde);
      continue;
    }
    const id = resolverReferencia(estado, referencia);
    if (id === null) return `fatal: ambiguous argument '${referencia}': unknown revision`;
    puntas.push(id);
  }
  return { puntas, excluidas };
}

/** Lee los filtros de la linea. Devuelve el texto del reclamo si alguno no se entiende. */
function filtrosPedidos(
  estado: EstadoRepositorio,
  argumentos: readonly string[],
): FiltrosHistorial | string {
  const autor = valorDeOpcionPegado(argumentos, '--author');
  const desdeTexto = valorDeOpcionPegado(argumentos, '--since', '--after');
  const hastaTexto = valorDeOpcionPegado(argumentos, '--until', '--before');

  // El «ahora» del simulador es su confirmacion mas reciente, no el reloj de
  // la maquina: el motor es codigo puro y las fechas del escenario son de 2024.
  const ahora = estado.confirmaciones.reduce(
    (mayor, confirmacion) => Math.max(mayor, confirmacion.epoca),
    0,
  );

  let desde: number | null = null;
  if (desdeTexto !== null) {
    desde = instanteDe(desdeTexto, ahora);
    if (desde === null) return `fatal: no puedo interpretar la fecha '${desdeTexto}'`;
  }
  let hasta: number | null = null;
  if (hastaTexto !== null) {
    hasta = instanteDe(hastaTexto, ahora);
    if (hasta === null) return `fatal: no puedo interpretar la fecha '${hastaTexto}'`;
  }

  return {
    ...SIN_FILTROS,
    autor,
    desde,
    hasta,
    archivo: rutaFiltrada(argumentos),
    // Git acepta `-S "texto"` y `-S"texto"` pegado; las dos aparecen en el
    // guion segun quien escriba el enunciado.
    cadena: cadenaBuscada(argumentos),
  };
}

/**
 * `git log`, con el recorrido, los filtros y el formato.
 *
 * Los filtros se aplican de verdad (punto 4.4 del SPEC 010). Antes se recibian
 * y se descartaban, que es lo que hacia que el simulador enseñara algo distinto
 * de lo que el participante veia en su terminal.
 */
export const ordenLog: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const pedido = puntasPedidas(estado, argumentos);
  if (typeof pedido === 'string') return fallo(estado, pedido);

  const filtros = filtrosPedidos(estado, argumentos);
  if (typeof filtros === 'string') return fallo(estado, filtros);

  const fuera = new Set(
    pedido.excluidas.length === 0
      ? []
      : historia(estado, pedido.excluidas).map((confirmacion) => confirmacion.id),
  );
  const alcanzadas = historia(estado, pedido.puntas).filter(
    (confirmacion) => !fuera.has(confirmacion.id),
  );
  const confirmaciones = aplicarFiltros(alcanzadas, filtros, (id) => arbolDe(estado, id));

  const formato = formatoPedido(argumentos);
  if (formato !== null) {
    const sobrantes = especificadoresFuera(formato);
    if (sobrantes.length > 0) {
      return limite(
        estado,
        `${sobrantes.map((uno) => `«${uno}»`).join(', ')} en el formato de git log`,
      );
    }
    const corta = valorDeOpcionPegado(argumentos, '--date') === 'short';
    const limitadas = recortar(confirmaciones, limitePedido(argumentos));
    return ok(
      estado,
      lineas(...limitadas.map((confirmacion) => aplicarFormato(confirmacion, formato, corta))),
    );
  }

  const cuerpo = formatearHistorial(estado, confirmaciones, {
    unaLinea: tieneOpcion(argumentos, '--oneline'),
    grafo: tieneOpcion(argumentos, '--graph'),
    limite: limitePedido(argumentos),
  });

  // Con `--stat` o con `--patch`, cada confirmacion lleva detras el resumen o
  // el parche de lo que cambio respecto de su primer padre. Se intercalan
  // rehaciendo el recorrido, porque el formateador del historial no los conoce.
  const conStat = tieneOpcion(argumentos, '--stat');
  const conParche = tieneOpcion(argumentos, '-p', '--patch');
  if (!conStat && !conParche) return ok(estado, lineas(...cuerpo));

  const limitadas = recortar(confirmaciones, limitePedido(argumentos));
  const filas: string[] = [];
  for (const confirmacion of limitadas) {
    filas.push(
      ...formatearHistorial(estado, [confirmacion], {
        unaLinea: tieneOpcion(argumentos, '--oneline'),
        grafo: tieneOpcion(argumentos, '--graph'),
        limite: null,
      }),
    );
    const cambios = comparacionesEntre(estado, confirmacion.padres[0] ?? null, confirmacion.id);
    filas.push(...(conStat ? formatearEstadisticasDe(cambios) : formatearParches(cambios)));
    filas.push('');
  }
  if (filas.at(-1) === '') filas.pop();
  return ok(estado, lineas(...filas));
};

function recortar(
  confirmaciones: readonly Confirmacion[],
  limite: number | null,
): readonly Confirmacion[] {
  return limite === null ? confirmaciones : confirmaciones.slice(0, limite);
}

/** El formato pedido con `--format=<x>` o con `--pretty=format:<x>`. */
function formatoPedido(argumentos: readonly string[]): string | null {
  const crudo = valorDeOpcionPegado(argumentos, '--format', '--pretty');
  if (crudo === null) return null;
  if (crudo.startsWith('format:')) return crudo.slice('format:'.length);
  // `--pretty=oneline` y compañia son nombres de formato, no plantillas.
  if (!crudo.includes('%')) return null;
  return crudo;
}
