/**
 * Ordenes que crean y consultan confirmaciones: `commit` y `log`.
 */

import { posicionales, tieneOpcion, valorDeOpcion } from '../analizador';
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
import { formatearEstadoLargo, formatearHistorial } from '../formato';
import { historia } from '../grafo';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
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
  const mensaje = mensajePedido ?? anterior.mensaje;

  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: anterior.padres,
    archivos,
    carril: anterior.carril,
    matiz: `amend:${anterior.id}`,
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado' ? { ...archivo, estado: 'limpio' } : archivo,
  );
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

  const mensaje = valorDeOpcion(argumentos, '-m', '--message');

  if (estado.fusion !== null) return confirmarFusion(estado, mensaje);
  if (tieneOpcion(argumentos, '--amend')) return enmendar(estado, mensaje);

  const preparados = archivosEn(estado, 'preparado').map((archivo) => archivo.nombre);
  if (preparados.length === 0) {
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
    carril: carrilDestino(estado),
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado' ? { ...archivo, estado: 'limpio' } : archivo,
  );
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
      resumenArchivos(preparados),
    ),
  );
};

/** Limite de confirmaciones pedido con `-n 3` o con `-3`. */
function limitePedido(argumentos: readonly string[]): number | null {
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
export const ordenLog: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const referencias = posicionales(argumentos, ['-n', '--max-count']);
  const puntas: string[] = [];

  if (tieneOpcion(argumentos, '--all')) {
    puntas.push(...estado.ramas.map((rama) => rama.id));
    puntas.push(...estado.etiquetas.map((etiqueta) => etiqueta.id));
    const cabeza = idActual(estado);
    if (cabeza !== null) puntas.push(cabeza);
  } else if (referencias.length > 0) {
    for (const referencia of referencias) {
      const id = resolverReferencia(estado, referencia);
      if (id === null) {
        return fallo(estado, `fatal: ambiguous argument '${referencia}': unknown revision`);
      }
      puntas.push(id);
    }
  } else {
    const cabeza = idActual(estado);
    if (cabeza === null) {
      const rama = ramaActual(estado) ?? 'HEAD';
      return fallo(
        estado,
        `fatal: your current branch '${rama}' does not have any commits yet`,
      );
    }
    puntas.push(cabeza);
  }

  const confirmaciones = historia(estado, puntas);
  return ok(
    estado,
    lineas(
      ...formatearHistorial(estado, confirmaciones, {
        unaLinea: tieneOpcion(argumentos, '--oneline'),
        grafo: tieneOpcion(argumentos, '--graph'),
        limite: limitePedido(argumentos),
      }),
    ),
  );
};
