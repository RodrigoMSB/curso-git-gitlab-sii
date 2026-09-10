/**
 * Despachador de ordenes.
 *
 * Une el nombre que escribe el participante con el manejador que le
 * corresponde, y produce el reclamo adecuado cuando no hay ninguno.
 */

import type { OrdenAnalizada } from '../analizador';
import { tokenizar } from '../analizador';
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

/**
 * Valor de un alias declarado con `git config alias.<nombre>`.
 *
 * La configuracion local manda sobre la global, igual que en Git. Los alias
 * del taller se declaran en el laboratorio 01 con `--global` y desde ahi
 * acompañan al participante en los demas laboratorios.
 */
function alias(estado: EstadoRepositorio, nombre: string): string | undefined {
  return estado.config.local[`alias.${nombre}`] ?? estado.config.global[`alias.${nombre}`];
}

/** Cuantas veces se permite que un alias apunte a otro antes de cortar. */
const SALTOS_DE_ALIAS = 10;

/**
 * Resuelve los alias hasta dar con una suborden de verdad.
 *
 * Un alias no puede tapar una orden del propio Git: primero se busca entre las
 * ordenes conocidas y solo despues entre los alias, que es el orden que sigue
 * Git. Los alias de interprete, los que empiezan con `!`, no se expanden.
 */
function expandirAlias(
  estado: EstadoRepositorio,
  argumentos: readonly string[],
): { readonly argumentos: readonly string[]; readonly ciclo: boolean } {
  let actuales = argumentos;
  const vistos = new Set<string>();

  for (let salto = 0; salto <= SALTOS_DE_ALIAS; salto += 1) {
    const subOrden = actuales[0];
    if (subOrden === undefined || Object.hasOwn(ORDENES_GIT, subOrden)) {
      return { argumentos: actuales, ciclo: false };
    }
    const valor = alias(estado, subOrden);
    if (valor === undefined || valor.startsWith('!')) {
      return { argumentos: actuales, ciclo: false };
    }
    if (vistos.has(subOrden)) return { argumentos: actuales, ciclo: true };
    vistos.add(subOrden);
    actuales = [...tokenizar(valor), ...actuales.slice(1)];
  }
  return { argumentos: actuales, ciclo: true };
}

/** Elige el manejador y lo aplica. */
export function despachar(
  estado: EstadoRepositorio,
  orden: OrdenAnalizada,
): ResultadoOrden {
  if (orden.programa === 'git') {
    if (orden.argumentos[0] === undefined) {
      return fallo(
        estado,
        'usage: git <command> [<args>]',
        "See 'git --help' for the list of commands.",
      );
    }

    const expandida = expandirAlias(estado, orden.argumentos);
    const subOrden = expandida.argumentos[0] ?? '';
    if (expandida.ciclo) {
      return fallo(estado, `fatal: alias loop detected: expansion of '${subOrden}' does not terminate`);
    }

    const manejador = ORDENES_GIT[subOrden];
    if (manejador === undefined) {
      return fallo(
        estado,
        `git: '${subOrden}' is not a git command. See 'git --help'.`,
      );
    }
    return manejador(estado, expandida.argumentos.slice(1));
  }

  const manejador = ORDENES_INTERPRETE[orden.programa];
  if (manejador === undefined) return ordenDesconocida(estado, orden.programa);
  return manejador(estado, orden.argumentos);
}
