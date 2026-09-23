/**
 * Las confirmaciones que se dibujan de un repositorio real (SPEC 020, 2.2 y 2.5).
 *
 * Se recorre desde cada rama, etiqueta, rama remota y HEAD, como
 * `git log --branches --tags --remotes HEAD`. Aparte quedan las huerfanas: las
 * que el registro de movimientos de HEAD recuerda y ya no alcanza ninguna
 * referencia, que el simulador dibuja en gris.
 *
 * En un clon superficial las confirmaciones del borde se leen sin padres, como
 * las muestra Git. El `nucleo.js` original buscaba esos padres y fallaba con
 * «no encuentro el objeto».
 */

import type { Almacen } from './almacen';
import { type ConfirmacionReal, leerConfirmacion } from './objetosGit';
import type { Referencias } from './referencias';

export interface Historia {
  readonly confirmaciones: ReadonlyMap<string, ConfirmacionReal>;
  /** Alcanzables solo desde el registro de movimientos de HEAD. */
  readonly huerfanas: ReadonlySet<string>;
}

async function recorrer(
  almacen: Almacen,
  superficiales: ReadonlySet<string>,
  inicios: Iterable<string>,
  vistas: Map<string, ConfirmacionReal>,
): Promise<Set<string>> {
  const nuevas = new Set<string>();
  const pendientes = [...inicios];
  while (pendientes.length > 0) {
    const sha = pendientes.pop() ?? '';
    if (vistas.has(sha)) continue;
    const objeto = await almacen.objeto(sha);
    if (objeto.tipo !== 'commit') continue;
    const leida = leerConfirmacion(sha, objeto.datos);
    const confirmacion = superficiales.has(sha) ? { ...leida, padres: [] } : leida;
    vistas.set(sha, confirmacion);
    nuevas.add(sha);
    pendientes.push(...confirmacion.padres);
  }
  return nuevas;
}

export async function leerHistoria(
  almacen: Almacen,
  referencias: Referencias,
  superficiales: ReadonlySet<string>,
): Promise<Historia> {
  const inicios = [
    ...referencias.ramas.values(),
    ...referencias.remotas.values(),
    ...[...referencias.etiquetas.values()].flatMap((e) => (e.confirmacion === null ? [] : [e.confirmacion])),
    ...(referencias.cabeza.sha === null ? [] : [referencias.cabeza.sha]),
  ];
  const confirmaciones = new Map<string, ConfirmacionReal>();
  await recorrer(almacen, superficiales, inicios, confirmaciones);

  // Lo que el registro recuerda y todavia esta en el almacen: `git gc` pudo haberlo borrado.
  const recordadas: string[] = [];
  for (const { nuevo } of referencias.movimientos) {
    if (/^0{40}$/.test(nuevo) || confirmaciones.has(nuevo)) continue;
    if (await almacen.existe(nuevo)) recordadas.push(nuevo);
  }
  const huerfanas = await recorrer(almacen, superficiales, recordadas, confirmaciones);
  return { confirmaciones, huerfanas };
}
