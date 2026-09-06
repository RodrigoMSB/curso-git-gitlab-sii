/**
 * Despachador de ordenes.
 *
 * Une el nombre que escribe el participante con el manejador que le
 * corresponde, y produce el reclamo adecuado cuando no hay ninguno.
 */

import type { OrdenAnalizada } from '../analizador';
import { fallo } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import {
  ordenAdd,
  ordenConfig,
  ordenDiff,
  ordenInit,
  ordenRestore,
  ordenStatus,
  type Manejador,
} from './basicas';
import { ordenCommit, ordenLog } from './confirmar';
import { ordenStash } from './guardado';
import { ordenRebase, ordenReflog, ordenReset, ordenRevert } from './historia';
import {
  ordenCat,
  ordenClear,
  ordenDesconocida,
  ordenEcho,
  ordenLs,
  ordenPwd,
  ordenRemote,
} from './interprete';
import {
  ordenBranch,
  ordenCheckout,
  ordenMerge,
  ordenSwitch,
  ordenTag,
} from './ramas';

/** Subordenes de `git` que el motor interpreta. */
export const ORDENES_GIT: Readonly<Record<string, Manejador>> = {
  init: ordenInit,
  config: ordenConfig,
  status: ordenStatus,
  add: ordenAdd,
  restore: ordenRestore,
  commit: ordenCommit,
  log: ordenLog,
  diff: ordenDiff,
  branch: ordenBranch,
  switch: ordenSwitch,
  checkout: ordenCheckout,
  merge: ordenMerge,
  tag: ordenTag,
  reset: ordenReset,
  revert: ordenRevert,
  stash: ordenStash,
  reflog: ordenReflog,
  rebase: ordenRebase,
  remote: ordenRemote,
};

/** Ordenes del interprete de mandatos. */
export const ORDENES_INTERPRETE: Readonly<Record<string, Manejador>> = {
  ls: ordenLs,
  pwd: ordenPwd,
  clear: ordenClear,
  cat: ordenCat,
  echo: ordenEcho,
};

/** Elige el manejador y lo aplica. */
export function despachar(
  estado: EstadoRepositorio,
  orden: OrdenAnalizada,
): ResultadoOrden {
  if (orden.programa === 'git') {
    const subOrden = orden.argumentos[0];
    if (subOrden === undefined) {
      return fallo(
        estado,
        'usage: git <command> [<args>]',
        "See 'git --help' for the list of commands.",
      );
    }
    const manejador = ORDENES_GIT[subOrden];
    if (manejador === undefined) {
      return fallo(
        estado,
        `git: '${subOrden}' is not a git command. See 'git --help'.`,
      );
    }
    return manejador(estado, orden.argumentos.slice(1));
  }

  const manejador = ORDENES_INTERPRETE[orden.programa];
  if (manejador === undefined) return ordenDesconocida(estado, orden.programa);
  return manejador(estado, orden.argumentos);
}
