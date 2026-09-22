/**
 * Despachador de ordenes.
 *
 * Une el nombre que escribe el participante con el manejador que le
 * corresponde, y produce el reclamo adecuado cuando no hay ninguno.
 */

import type { OrdenAnalizada } from '../analizador';
import { tokenizar } from '../analizador';
import { desagrupar, esOperador } from '../analizador';
import { AGRUPABLES_GIT, formaSinSoporte, type Revision, revisarOpciones } from '../contrato';
import { archivoPorNombre, establecerArchivo } from '../estado';
import { fallo, limite } from '../salida';
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
import { ordenLsFiles, ordenMv, ordenRm } from './archivos';
import { ordenCommit, ordenLog } from './confirmar';
import { ordenStash } from './guardado';
import { ordenRebase, ordenReflog, ordenReset, ordenRevert } from './historia';
import {
  ordenCatFile,
  ordenMergeBase,
  ordenRevParse,
  ordenShow,
} from './inspeccion';
import {
  ordenCat,
  ordenClear,
  ordenDesconocida,
  ordenEcho,
  ordenGrep,
  ordenLs,
  ordenMkdir,
  ordenMv as ordenMvInterprete,
  ordenPwd,
  ordenRm as ordenRmInterprete,
  ordenRemote,
  ordenWc,
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
  rm: ordenRm,
  mv: ordenMv,
  'ls-files': ordenLsFiles,
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
  show: ordenShow,
  'rev-parse': ordenRevParse,
  'merge-base': ordenMergeBase,
  'cat-file': ordenCatFile,
};

/** Ordenes del interprete de mandatos. */
export const ORDENES_INTERPRETE: Readonly<Record<string, Manejador>> = {
  ls: ordenLs,
  mkdir: ordenMkdir,
  mv: ordenMvInterprete,
  rm: ordenRmInterprete,
  pwd: ordenPwd,
  clear: ordenClear,
  cat: ordenCat,
  echo: ordenEcho,
  wc: ordenWc,
  grep: ordenGrep,
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

/**
 * Aparta la redireccion del final de la linea, si la hay.
 *
 * `git log --oneline > historial.txt` se ejecuta igual, pero su salida va al
 * archivo en vez de a la consola y el archivo aparece en el directorio de
 * trabajo. Es lo que el laboratorio 06 usa para guardarse un respaldo antes de
 * reescribir la historia.
 */
function apartarRedireccion(argumentos: readonly string[]): {
  readonly argumentos: readonly string[];
  readonly destino: string | null;
} {
  const corte = argumentos.findIndex(esOperador);
  if (corte < 0) return { argumentos, destino: null };
  return { argumentos: argumentos.slice(0, corte), destino: argumentos[corte + 1] ?? null };
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

    const redirigida = apartarRedireccion(orden.argumentos);
    if (redirigida.destino === null && orden.argumentos.some(esOperador)) {
      return fallo(estado, "bash: syntax error near unexpected token `newline'");
    }
    const expandida = expandirAlias(estado, redirigida.argumentos);
    const subOrden = expandida.argumentos[0] ?? '';
    if (expandida.ciclo) {
      return fallo(estado, `fatal: alias loop detected: expansion of '${subOrden}' does not terminate`);
    }

    // La forma se consulta sobre la linea entera, con la redireccion incluida:
    // escribir fuera del repositorio es justo una de las formas declaradas.
    const revision = revisarContrato(
      `git ${expandida.argumentos.join(' ')}${redirigida.destino === null ? '' : ` > ${redirigida.destino}`}`,
      subOrden,
      expandida.argumentos.slice(1),
      `git ${subOrden}`,
      'git',
    );
    if (revision !== null) return responder(estado, revision);

    const manejador = ORDENES_GIT[subOrden];
    if (manejador === undefined) {
      return fallo(
        estado,
        `git: '${subOrden}' is not a git command. See 'git --help'.`,
      );
    }

    // `git commit -am "x"` le llega al manejador como `-a -m "x"`: lee palabras
    // enteras, y el contrato ya reviso la forma separada.
    const agrupables = AGRUPABLES_GIT[subOrden];
    const propios = expandida.argumentos.slice(1);
    const resultado = manejador(estado, agrupables === undefined ? propios : desagrupar(propios, agrupables));
    if (redirigida.destino === null || resultado.error) return resultado;
    return { ...resultado, estado: escribirEnArchivo(resultado.estado, redirigida.destino), salida: [] };
  }

  const revision = revisarContrato(
    orden.cruda,
    orden.programa,
    orden.argumentos,
    orden.programa,
    'interprete',
  );
  if (revision !== null) return responder(estado, revision);

  const manejador = ORDENES_INTERPRETE[orden.programa];
  if (manejador === undefined) return ordenDesconocida(estado, orden.programa);
  return manejador(estado, orden.argumentos);
}

/** Deja el archivo de destino de una redireccion en el directorio de trabajo. */
function escribirEnArchivo(estado: EstadoRepositorio, destino: string): EstadoRepositorio {
  const existente = archivoPorNombre(estado, destino);
  if (existente === undefined) return establecerArchivo(estado, destino, 'sin-seguimiento');
  if (existente.estado === 'limpio') return establecerArchivo(estado, destino, 'modificado');
  return estado;
}

/**
 * Consulta el contrato y devuelve que responder en vez de ejecutar la orden, o
 * `null` si la puede ejecutar entera.
 *
 * Primero la forma declarada como no soportada, que lleva su propio motivo.
 * Despues las opciones: las que no existen se responden con el error de Git,
 * y las que existen y el simulador no hace, con el mensaje de limite. Una
 * opcion que llega al manejador sin que este la mire es justo el caso que el
 * punto 1 del SPEC 010 viene a eliminar: aceptada y descartada en silencio.
 */
function revisarContrato(
  linea: string,
  nombre: string,
  argumentos: readonly string[],
  comoSeLlama: string,
  lado: 'git' | 'interprete',
): Revision | null {
  const forma = formaSinSoporte(linea);
  if (forma !== undefined) return { tipo: 'limite', motivo: forma.motivo };
  return revisarOpciones(comoSeLlama, nombre, argumentos, lado);
}

function responder(estado: EstadoRepositorio, revision: Revision): ResultadoOrden {
  return revision.tipo === 'error' ? fallo(estado, ...revision.lineas) : limite(estado, revision.motivo);
}
