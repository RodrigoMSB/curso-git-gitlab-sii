/**
 * `git revert`, que deshace todo lo que la confirmacion hizo (SPEC 019).
 *
 * Revertir es una fusion de tres vias con los papeles cambiados: la base es la
 * confirmacion que se revierte, lo nuestro es la posicion actual y lo de ellos
 * es el padre de esa confirmacion. Asi lo hace Git, y de ahi salen los tres
 * casos del punto 1: lo que la confirmacion borro vuelve, lo que agrego se va,
 * y lo que modifico se deshace linea por linea sin llevarse los cambios que
 * vinieron despues. Cuando deshacer choca con uno de esos cambios, choca como
 * Git, con conflicto, marcadores y el mismo texto.
 *
 * Antes cada archivo volvia entero a su version previa, lo que se habia
 * borrado no volvia y nada chocaba nunca. Cada texto de este archivo se copio
 * de una corrida de Git 2.54.
 */

import { posicionales, tieneOpcion } from '../analizador';
import { agregarConfirmacion } from '../confirmaciones';
import { arbolDe, comparacionesEntre } from '../contenido';
import { formatearEstadisticasDe, fusionarTresVias } from '../diferencias';
import {
  anotarMovimiento,
  archivoPorNombre,
  archivosEn,
  confirmacionPorId,
  establecerArchivo,
  establecerContenido,
  idActual,
  moverPosicionActual,
  ramaActual,
  sincronizarDirectorio,
  transformarArchivos,
} from '../estado';
import { formatearEstadoLargo } from '../formato';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { Confirmacion, EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** Las lineas de ayuda que Git agrega a toda reversion que choca. */
const AYUDA_CONFLICTO = [
  'hint: After resolving the conflicts, mark them with',
  'hint: "git add/rm <pathspec>", then run',
  'hint: "git revert --continue".',
  'hint: You can instead skip this commit with "git revert --skip".',
  'hint: To abort and get back to the state before "git revert",',
  'hint: run "git revert --abort".',
  'hint: Disable this message with "git config set advice.mergeConflict false"',
];

/** Lo que Git dice cuando hay archivos sin resolver y se le pide avanzar. */
function sinResolver(estado: EstadoRepositorio, queSeIntento: 'commit' | 'revert'): ResultadoOrden {
  if (queSeIntento === 'revert') {
    return fallo(
      estado,
      'error: Reverting is not possible because you have unmerged files.',
      "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
      'hint: as appropriate to mark resolution and make a commit.',
      'fatal: revert failed',
    );
  }
  return fallo(
    estado,
    ...archivosEn(estado, 'en-conflicto').map((archivo) => `U\t${archivo.nombre}`),
    'error: Committing is not possible because you have unmerged files.',
    "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
    'hint: as appropriate to mark resolution and make a commit.',
    'fatal: Exiting because of an unresolved conflict.',
  );
}

/**
 * El resumen que Git imprime al confirmar: el total y los modos, sin el
 * detalle por archivo que si lleva `git merge`.
 */
function resumenDeConfirmacion(estado: EstadoRepositorio, antes: string, despues: string): readonly string[] {
  return formatearEstadisticasDe(comparacionesEntre(estado, antes, despues), true).filter(
    (linea) => !linea.includes(' | '),
  );
}

/** Como queda un archivo tras revertir, y si choco. */
interface Revertido {
  readonly ruta: string;
  /** El texto que queda, o `null` si el archivo se va. */
  readonly texto: string | null;
  /** Si Git tuvo que fusionarlo linea por linea, que es cuando dice `Auto-merging`. */
  readonly fusionado: boolean;
  /** El reclamo de Git, si choco. */
  readonly conflicto: string | null;
}

/**
 * La fusion de tres vias de un archivo, con los papeles del revert: `base` es
 * la confirmacion que se revierte, `nuestro` la posicion actual y `suyo` su
 * padre. Los textos ausentes son `null`.
 */
function revertirArchivo(
  ruta: string,
  base: string | null,
  nuestro: string | null,
  suyo: string | null,
  rotuloSuyo: string,
): Revertido {
  // Nadie lo toco despues de la confirmacion: queda como estaba antes de ella.
  if (nuestro === base) return { ruta, texto: suyo, fusionado: false, conflicto: null };
  // Ya esta como tendria que quedar.
  if (nuestro === suyo) return { ruta, texto: nuestro, fusionado: false, conflicto: null };

  // La confirmacion lo agrego y despues se modifico: se deja lo nuestro.
  if (suyo === null && nuestro !== null) {
    return {
      ruta,
      texto: nuestro,
      fusionado: false,
      conflicto: `CONFLICT (modify/delete): ${ruta} deleted in ${rotuloSuyo} and modified in HEAD.  Version HEAD of ${ruta} left in tree.`,
    };
  }
  // La confirmacion lo modifico y despues se borro: se deja lo suyo.
  if (nuestro === null && suyo !== null) {
    return {
      ruta,
      texto: suyo,
      fusionado: false,
      conflicto: `CONFLICT (modify/delete): ${ruta} deleted in HEAD and modified in ${rotuloSuyo}.  Version ${rotuloSuyo} of ${ruta} left in tree.`,
    };
  }

  // Los dos lados tienen texto y los dos cambiaron respecto de la base, o la
  // confirmacion lo borro y despues volvio distinto: linea por linea.
  const fusion = fusionarTresVias(base ?? '', nuestro ?? '', suyo ?? '', 'HEAD', rotuloSuyo);
  const clase = base === null ? 'add/add' : 'content';
  return {
    ruta,
    texto: fusion.texto,
    fusionado: true,
    conflicto: fusion.choco ? `CONFLICT (${clase}): Merge conflict in ${ruta}` : null,
  };
}

/** Los archivos que la reversion toca: los que la confirmacion cambio, por ruta. */
function revertirTodo(estado: EstadoRepositorio, objetivo: Confirmacion, cabeza: string): readonly Revertido[] {
  const padre = objetivo.padres[0] ?? null;
  const base = arbolDe(estado, objetivo.id);
  const nuestro = arbolDe(estado, cabeza);
  const suyo = arbolDe(estado, padre);
  const rotulo = `parent of ${objetivo.id} (${objetivo.mensaje})`;
  return [...new Set([...Object.keys(base), ...Object.keys(suyo)])]
    .filter((ruta) => (base[ruta] ?? null) !== (suyo[ruta] ?? null))
    .sort()
    .map((ruta) => revertirArchivo(ruta, base[ruta] ?? null, nuestro[ruta] ?? null, suyo[ruta] ?? null, rotulo));
}

/** El mensaje de la reversion: `Reapply` si se revierte una reversion (Git 2.43 en adelante). */
function mensajeDe(objetivo: Confirmacion): string {
  const reaplicado = /^Revert "(.*)"$/.exec(objetivo.mensaje);
  return reaplicado === null ? `Revert "${objetivo.mensaje}"` : `Reapply "${reaplicado[1]}"`;
}

/**
 * Cierra una reversion que choco, con `git revert --continue` o con
 * `git commit`: confirma lo que quedo preparado. Git no imprime la fecha en
 * este caso, y si en la reversion que no choca.
 */
export function confirmarReversion(estado: EstadoRepositorio, mensajePedido: string | null): ResultadoOrden {
  const reversion = estado.reversion;
  if (reversion === null) return fallo(estado, 'error: no cherry-pick or revert in progress', 'fatal: revert failed');
  if (archivosEn(estado, 'en-conflicto').length > 0) return sinResolver(estado, 'commit');

  const cabeza = idActual(estado);
  if (cabeza === null) return fallo(estado, 'fatal: Failed to resolve HEAD as a valid ref.');
  const mensaje = mensajePedido ?? reversion.mensaje;
  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: [cabeza],
    archivos: archivosEn(estado, 'preparado').map((archivo) => archivo.nombre),
    borrados: [...estado.borrados],
    carril: confirmacionPorId(estado, cabeza)?.carril ?? 0,
    matiz: `revert:${reversion.idObjetivo}`,
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = transformarArchivos(siguiente, (archivo) =>
    archivo.estado === 'preparado' ? { nombre: archivo.nombre, estado: 'limpio' as const, contenido: null } : archivo,
  );
  siguiente = { ...siguiente, borrados: [], reversion: null };
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: 'commit',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });
  return ok(
    siguiente,
    lineas(
      `[${ramaActual(siguiente) ?? 'detached HEAD'} ${creado.confirmacion.id}] ${mensaje}`,
      ...resumenDeConfirmacion(creado.estado, cabeza, creado.confirmacion.id),
    ),
  );
}

/** `git revert --abort`: todo como estaba antes de la reversion que choco. */
function abortarReversion(estado: EstadoRepositorio): ResultadoOrden {
  const reversion = estado.reversion;
  if (reversion === null) return fallo(estado, 'error: no cherry-pick or revert in progress', 'fatal: revert failed');
  return ok({
    ...estado,
    archivos: [...reversion.archivosPrevios],
    borrados: [...reversion.borradosPrevios],
    borradosSinPreparar: [...reversion.borradosSinPrepararPrevios],
    reversion: null,
  });
}

export const ordenRevert: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  if (tieneOpcion(argumentos, '--abort')) return abortarReversion(estado);
  if (tieneOpcion(argumentos, '--continue')) return confirmarReversion(estado, null);

  const referencia = posicionales(argumentos)[0];
  if (referencia === undefined) {
    return fallo(estado, 'fatal: empty commit set passed');
  }

  const id = resolverReferencia(estado, referencia);
  const objetivo = id === null ? undefined : confirmacionPorId(estado, id);
  if (id === null || objetivo === undefined) {
    return fallo(estado, `fatal: bad revision '${referencia}'`);
  }

  const cabeza = idActual(estado);
  if (cabeza === null) return fallo(estado, 'fatal: Failed to resolve HEAD as a valid ref.');

  // Lo que Git no deja revertir, en el orden en que lo pregunta: archivos sin
  // resolver, cambios preparados, y cambios sin preparar en un archivo que la
  // reversion va a tocar. Antes se revertia igual y se pisaba el trabajo.
  if (archivosEn(estado, 'en-conflicto').length > 0) return sinResolver(estado, 'revert');
  if (archivosEn(estado, 'preparado').length > 0 || estado.borrados.length > 0) {
    return fallo(
      estado,
      'error: your local changes would be overwritten by revert.',
      'hint: commit your changes or stash them to proceed.',
      'fatal: revert failed',
    );
  }

  const revertidos = revertirTodo(estado, objetivo, cabeza);
  const pisados = revertidos
    .map((revertido) => revertido.ruta)
    .filter(
      (ruta) =>
        archivoPorNombre(estado, ruta)?.estado === 'modificado' || estado.borradosSinPreparar.includes(ruta),
    );
  if (pisados.length > 0) {
    return fallo(
      estado,
      'error: Your local changes to the following files would be overwritten by merge:',
      ...pisados.map((ruta) => `\t${ruta}`),
      'Please commit your changes or stash them before you merge.',
      'Aborting',
      'fatal: revert failed',
    );
  }

  const mensaje = mensajeDe(objetivo);
  const avisos = revertidos.flatMap((revertido) => [
    ...(revertido.fusionado ? [`Auto-merging ${revertido.ruta}`] : []),
    ...(revertido.conflicto === null ? [] : [revertido.conflicto]),
  ]);

  // Choco: nada se confirma. Lo que se pudo revertir queda preparado, lo que
  // choco queda en conflicto con su texto, y la reversion queda en curso.
  if (revertidos.some((revertido) => revertido.conflicto !== null)) {
    let siguiente = estado;
    for (const revertido of revertidos) {
      if (revertido.texto === null) {
        siguiente = {
          ...siguiente,
          archivos: siguiente.archivos.filter((archivo) => archivo.nombre !== revertido.ruta),
          borrados: [...siguiente.borrados, revertido.ruta],
        };
        continue;
      }
      siguiente = establecerArchivo(
        siguiente,
        revertido.ruta,
        revertido.conflicto === null ? 'preparado' : 'en-conflicto',
      );
      siguiente = establecerContenido(siguiente, revertido.ruta, revertido.texto);
    }
    siguiente = {
      ...siguiente,
      reversion: {
        idObjetivo: objetivo.id,
        mensaje,
        archivosPrevios: [...estado.archivos],
        borradosPrevios: [...estado.borrados],
        borradosSinPrepararPrevios: [...estado.borradosSinPreparar],
      },
    };
    return fallo(siguiente, ...avisos, `error: could not revert ${objetivo.id}... ${objetivo.mensaje}`, ...AYUDA_CONFLICTO);
  }

  // Nada que revertir: la confirmacion ya esta deshecha. Git lo dice con el
  // estado del repositorio y no crea nada.
  const cambios = revertidos.filter((revertido) => revertido.texto !== (arbolDe(estado, cabeza)[revertido.ruta] ?? null));
  if (cambios.length === 0) return ok(estado, lineas(...formatearEstadoLargo(estado)));

  const contenidos: Record<string, string> = {};
  for (const revertido of cambios) {
    if (revertido.texto !== null) contenidos[revertido.ruta] = revertido.texto;
  }
  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: [cabeza],
    archivos: Object.keys(contenidos),
    borrados: cambios.filter((revertido) => revertido.texto === null).map((revertido) => revertido.ruta),
    contenidos,
    carril: confirmacionPorId(estado, cabeza)?.carril ?? 0,
    matiz: `revert:${objetivo.id}`,
  });

  // El directorio de trabajo queda como la confirmacion nueva, que es lo que
  // hace Git: la reversion no deja nada pendiente.
  let siguiente = sincronizarDirectorio(moverPosicionActual(creado.estado, creado.confirmacion.id));
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: 'revert',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(
      ...avisos,
      `[${ramaActual(siguiente) ?? 'detached HEAD'} ${creado.confirmacion.id}] ${mensaje}`,
      ` Date: ${creado.confirmacion.fecha}`,
      ...resumenDeConfirmacion(creado.estado, cabeza, creado.confirmacion.id),
    ),
  );
};
