/**
 * Ordenes sobre ramas, posicion y etiquetas: `branch`, `switch`, `checkout`,
 * `merge` y `tag`.
 *
 * Aqui viven tres de los comportamientos que el SPEC 001 declara nucleo
 * pedagogico: crear una rama no mueve nada (8.1), cambiar de rama mueve
 * unicamente el puntero (8.2) y la fusion distingue tres casos (8.3).
 */

import { posicionales, tieneOpcion, valorDeOpcion } from '../analizador';
import { agregarConfirmacion, reservarId } from '../confirmaciones';
import {
  anotarMovimiento,
  anotarReflog,
  asignarCarril,
  confirmacionPorId,
  establecerArchivo,
  establecerRama,
  etiquetaPorNombre,
  idActual,
  liberarCarril,
  moverPosicionActual,
  ramaActual,
  ramaPorNombre,
  renombrarCarril,
} from '../estado';
import { formatearEstadisticas } from '../formato';
import { antepasados, archivosCambiados, baseComun, esAntepasado } from '../grafo';
import { resolverReferencia } from '../referencias';
import { fallo, lineas, ok, sinRepositorio } from '../salida';
import type { EstadoRepositorio, ResultadoOrden } from '../tipos';
import type { Manejador } from './basicas';

/** Crea una rama sin tocar la posicion actual. Es el punto 8.1 del SPEC 001. */
function crearRama(
  estado: EstadoRepositorio,
  nombre: string,
  desde: string | null,
): ResultadoOrden {
  if (ramaPorNombre(estado, nombre) !== undefined) {
    return fallo(estado, `fatal: a branch named '${nombre}' already exists`);
  }

  const referencia = desde ?? 'HEAD';
  const id = resolverReferencia(estado, referencia);
  if (id === null) {
    const rama = ramaActual(estado) ?? 'HEAD';
    return fallo(
      estado,
      desde === null
        ? `fatal: not a valid object name: '${rama}'`
        : `fatal: not a valid object name: '${desde}'`,
    );
  }

  const siguiente = anotarReflog(establecerRama(estado, nombre, id), {
    ref: nombre,
    id,
    idAnterior: null,
    operacion: 'branch',
    descripcion: `Created from ${referencia}`,
  });
  return ok(siguiente);
}

function eliminarRama(
  estado: EstadoRepositorio,
  nombre: string,
  forzado: boolean,
): ResultadoOrden {
  const rama = ramaPorNombre(estado, nombre);
  if (rama === undefined) return fallo(estado, `error: branch '${nombre}' not found.`);
  if (ramaActual(estado) === nombre) {
    return fallo(
      estado,
      `error: Cannot delete branch '${nombre}' checked out at '${estado.directorio}'`,
    );
  }

  const cabeza = idActual(estado);
  const integrada = cabeza !== null && esAntepasado(estado, rama.id, cabeza);
  if (!forzado && !integrada) {
    return fallo(
      estado,
      `error: The branch '${nombre}' is not fully merged.`,
      `If you are sure you want to delete it, run 'git branch -D ${nombre}'.`,
    );
  }

  const siguiente = liberarCarril(
    { ...estado, ramas: estado.ramas.filter((candidata) => candidata.nombre !== nombre) },
    nombre,
  );
  return ok(siguiente, lineas(`Deleted branch ${nombre} (was ${rama.id}).`));
}

function renombrarRama(
  estado: EstadoRepositorio,
  anterior: string,
  nuevo: string,
): ResultadoOrden {
  const rama = ramaPorNombre(estado, anterior);
  if (rama === undefined) {
    return fallo(estado, `error: refname refs/heads/${anterior} not found`);
  }
  if (ramaPorNombre(estado, nuevo) !== undefined) {
    return fallo(estado, `fatal: a branch named '${nuevo}' already exists`);
  }

  let siguiente: EstadoRepositorio = {
    ...estado,
    ramas: estado.ramas.map((candidata) =>
      candidata.nombre === anterior ? { nombre: nuevo, id: candidata.id } : candidata,
    ),
  };
  siguiente = renombrarCarril(siguiente, anterior, nuevo);
  if (ramaActual(estado) === anterior) {
    siguiente = { ...siguiente, puntero: { tipo: 'rama', rama: nuevo } };
  }
  return ok(siguiente);
}

/** `git branch`: listar, crear, `-d`, `-D` y `-m`. */
export const ordenBranch: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const nombres = posicionales(argumentos);
  const actual = ramaActual(estado);

  if (tieneOpcion(argumentos, '-d', '--delete', '-D')) {
    const objetivo = nombres[0];
    if (objetivo === undefined) return fallo(estado, 'fatal: branch name required');
    return eliminarRama(estado, objetivo, tieneOpcion(argumentos, '-D'));
  }

  if (tieneOpcion(argumentos, '-m', '--move')) {
    const primero = nombres[0];
    const segundo = nombres[1];
    if (primero === undefined) return fallo(estado, 'fatal: branch name required');
    if (segundo === undefined) {
      if (actual === null) return fallo(estado, 'fatal: cannot rename a detached HEAD');
      return renombrarRama(estado, actual, primero);
    }
    return renombrarRama(estado, primero, segundo);
  }

  const nuevo = nombres[0];
  if (nuevo !== undefined) return crearRama(estado, nuevo, nombres[1] ?? null);

  const ordenadas = [...estado.ramas].sort((una, otra) => una.nombre.localeCompare(otra.nombre));
  return ok(
    estado,
    lineas(
      ...ordenadas.map((rama) => (rama.nombre === actual ? `* ${rama.nombre}` : `  ${rama.nombre}`)),
    ),
  );
};

/**
 * Cambia la posicion actual. Mueve el puntero y nada mas, que es el punto 8.2
 * del SPEC 001: ninguna confirmacion se toca.
 */
/**
 * Cambia la posicion a una rama o, si no lo es, a la confirmacion que el
 * nombre resuelva.
 *
 * `avisoLargo` distingue las dos ordenes: `git checkout` explica el estado
 * desconectado con su parrafo, y `git switch --detach` solo dice donde quedo
 * la posicion. Es la diferencia que Git hace y que el participante ve.
 */
function cambiarA(
  estado: EstadoRepositorio,
  destino: string,
  nueva: boolean,
  avisoLargo = true,
): ResultadoOrden {
  const origen = ramaActual(estado) ?? idActual(estado) ?? 'HEAD';
  const rama = ramaPorNombre(estado, destino);

  if (rama !== undefined) {
    const siguiente = anotarReflog(
      asignarCarril({ ...estado, puntero: { tipo: 'rama', rama: destino } }, destino),
      {
        ref: 'HEAD',
        id: rama.id,
        idAnterior: idActual(estado),
        operacion: 'checkout',
        descripcion: `moving from ${origen} to ${destino}`,
      },
    );
    return ok(
      siguiente,
      lineas(nueva ? `Switched to a new branch '${destino}'` : `Switched to branch '${destino}'`),
    );
  }

  const id = resolverReferencia(estado, destino);
  if (id === null) return fallo(estado, `fatal: invalid reference: '${destino}'`);

  const confirmacion = confirmacionPorId(estado, id);
  const siguiente = anotarReflog(
    { ...estado, puntero: { tipo: 'confirmacion', id } },
    {
      ref: 'HEAD',
      id,
      idAnterior: idActual(estado),
      operacion: 'checkout',
      descripcion: `moving from ${origen} to ${id}`,
    },
  );
  if (!avisoLargo) {
    return ok(
      siguiente,
      lineas(`HEAD is now at ${id} ${confirmacion?.mensaje ?? ''}`.trimEnd()),
    );
  }
  return ok(
    siguiente,
    lineas(
      `Note: switching to '${destino}'.`,
      '',
      "You are in 'detached HEAD' state. You can look around, make experimental",
      'changes and commit them, and you can discard any commits you make in this',
      'state without impacting any branches by switching back to a branch.',
      '',
      `HEAD is now at ${id} ${confirmacion?.mensaje ?? ''}`.trimEnd(),
    ),
  );
}

/** `git switch`, con cambio de rama y `-c`. */
export const ordenSwitch: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const nombres = posicionales(argumentos, ['-c', '--create', '-C', '--force-create']);
  const aCrear = valorDeOpcion(argumentos, '-c', '--create', '-C', '--force-create');

  if (aCrear !== null) {
    const creacion = crearRama(estado, aCrear, nombres[0] ?? null);
    if (creacion.error) return creacion;
    return cambiarA(creacion.estado, aCrear, true);
  }

  const destino = nombres[0];
  if (destino === undefined) {
    return fallo(estado, 'fatal: missing branch or commit argument');
  }

  // Con `--detach` el destino puede ser cualquier referencia; sin el, Git
  // exige una rama y lo dice con esas palabras.
  if (tieneOpcion(argumentos, '--detach')) {
    if (resolverReferencia(estado, destino) === null) {
      return fallo(estado, `fatal: invalid reference: '${destino}'`);
    }
    return cambiarA(estado, destino, false, false);
  }

  if (ramaPorNombre(estado, destino) === undefined) {
    if (resolverReferencia(estado, destino) !== null) {
      return fallo(
        estado,
        `fatal: a branch is expected, got commit '${destino}'`,
        'hint: If you want to detach HEAD at the commit, try again with the --detach option.',
      );
    }
    return fallo(estado, `fatal: invalid reference: '${destino}'`);
  }
  return cambiarA(estado, destino, false);
};

/** `git checkout`, con cambio, `-b` y `--` para descartar cambios. */
/** Si la ruta existia en el arbol alcanzable desde esa confirmacion. */
function confirmacionesQueTocan(
  estado: EstadoRepositorio,
  id: string,
  ruta: string,
): boolean {
  const alcanzables = antepasados(estado, id);
  let existia = false;
  for (const confirmacion of estado.confirmaciones) {
    if (!alcanzables.has(confirmacion.id)) continue;
    if (confirmacion.archivos.includes(ruta)) existia = true;
    if (confirmacion.borrados.includes(ruta)) existia = false;
  }
  return existia;
}

export const ordenCheckout: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const separador = argumentos.indexOf('--');
  if (separador >= 0) {
    const rutas = argumentos.slice(separador + 1);
    if (rutas.length === 0) return fallo(estado, 'fatal: you must specify path(s) to restore');

    // `git checkout <confirmacion> -- <ruta>` no es lo mismo que
    // `git checkout -- <ruta>`. El primero saca el archivo de esa confirmacion
    // y lo deja **preparado**; el segundo solo descarta lo que hubiera en el
    // directorio de trabajo. Es la orden con la que el rescate del laboratorio
    // 03 recupera un archivo borrado por error.
    const desde = posicionales(argumentos.slice(0, separador))[0];
    const origen = desde === undefined ? null : resolverReferencia(estado, desde);
    if (desde !== undefined && origen === null) {
      return fallo(estado, `fatal: invalid reference: ${desde}`);
    }

    let siguiente = estado;
    for (const ruta of rutas) {
      if (origen !== null) {
        const registrada = confirmacionesQueTocan(siguiente, origen, ruta);
        if (!registrada) {
          return fallo(
            estado,
            `error: pathspec '${ruta}' did not match any file(s) known to git`,
          );
        }
        siguiente = establecerArchivo(siguiente, ruta, 'preparado');
        siguiente = {
          ...siguiente,
          borrados: siguiente.borrados.filter((nombre) => nombre !== ruta),
          borradosSinPreparar: siguiente.borradosSinPreparar.filter((nombre) => nombre !== ruta),
        };
        continue;
      }

      const archivo = siguiente.archivos.find((candidato) => candidato.nombre === ruta);
      if (archivo === undefined) {
        return fallo(
          estado,
          `error: pathspec '${ruta}' did not match any file(s) known to git`,
        );
      }
      if (archivo.estado === 'modificado') {
        siguiente = establecerArchivo(siguiente, ruta, 'limpio');
      }
    }
    return ok(siguiente);
  }

  const aCrear = valorDeOpcion(argumentos, '-b', '-B');
  const nombres = posicionales(argumentos, ['-b', '-B']);

  if (aCrear !== null) {
    const creacion = crearRama(estado, aCrear, nombres[0] ?? null);
    if (creacion.error) return creacion;
    return cambiarA(creacion.estado, aCrear, true);
  }

  const destino = nombres[0];
  if (destino === undefined) return fallo(estado, 'fatal: you must specify a branch name');
  if (
    ramaPorNombre(estado, destino) === undefined &&
    resolverReferencia(estado, destino) === null
  ) {
    return fallo(estado, `error: pathspec '${destino}' did not match any file(s) known to git`);
  }
  return cambiarA(estado, destino, false);
};

/** Aborta una fusion con conflictos y devuelve los archivos a su estado previo. */
function abortarFusion(estado: EstadoRepositorio): ResultadoOrden {
  const fusion = estado.fusion;
  if (fusion === null) {
    return fallo(estado, 'fatal: There is no merge to abort (MERGE_HEAD missing).');
  }
  return ok({ ...estado, archivos: [...fusion.archivosPrevios], fusion: null });
}

/** `git merge`, con fusion normal y `--abort`. Implementa el punto 8.3 del SPEC 001. */
export const ordenMerge: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);
  if (tieneOpcion(argumentos, '--abort')) return abortarFusion(estado);
  if (estado.fusion !== null) {
    return fallo(
      estado,
      'error: Merging is not possible because you have unmerged files.',
      'fatal: Exiting because of an unresolved conflict.',
    );
  }

  const nombres = posicionales(argumentos, ['-m']);
  const objetivo = nombres[0];
  if (objetivo === undefined) {
    return fallo(estado, 'fatal: No commit specified and merge.defaultToUpstream not set.');
  }

  const idOtro = resolverReferencia(estado, objetivo);
  if (idOtro === null) {
    return fallo(estado, `merge: ${objetivo} - not something we can merge`);
  }

  const cabeza = idActual(estado);
  if (cabeza === null) {
    return fallo(estado, 'fatal: Non-fast-forward commit does not make sense into an empty head');
  }

  // Caso 1: la otra rama ya esta contenida en la actual.
  if (esAntepasado(estado, idOtro, cabeza)) {
    return ok(estado, lineas('Already up to date.'));
  }

  const traidos = [...archivosCambiados(estado, cabeza, idOtro)];

  // Caso 2: la actual esta contenida en la otra. Avance del puntero, sin confirmacion.
  if (esAntepasado(estado, cabeza, idOtro)) {
    let siguiente = moverPosicionActual(estado, idOtro);
    siguiente = anotarMovimiento(siguiente, {
      id: idOtro,
      idAnterior: cabeza,
      operacion: 'merge',
      descripcion: `Fast-forward to ${objetivo}`,
      rama: ramaActual(siguiente),
    });
    return ok(
      siguiente,
      lineas(
        `Updating ${cabeza}..${idOtro}`,
        'Fast-forward',
        ...formatearEstadisticas(traidos),
      ),
    );
  }

  // Caso 3: historias divergentes. Corresponde una confirmacion con dos padres.
  const base = baseComun(estado, cabeza, idOtro);
  const aqui = archivosCambiados(estado, base, cabeza);
  const alla = archivosCambiados(estado, base, idOtro);
  const conflictos = [...alla].filter((archivo) => aqui.has(archivo));
  const idPrevisto = reservarId(estado, `merge:${cabeza}:${idOtro}`);

  if (conflictos.length > 0) {
    let siguiente = estado;
    for (const archivo of alla) {
      siguiente = establecerArchivo(
        siguiente,
        archivo,
        conflictos.includes(archivo) ? 'en-conflicto' : 'preparado',
      );
    }
    siguiente = {
      ...siguiente,
      fusion: {
        rama: objetivo,
        idOrigen: idOtro,
        idDestino: cabeza,
        idPrevisto,
        conflictos,
        archivosPrevios: [...estado.archivos],
      },
    };
    return {
      estado: siguiente,
      salida: lineas(
        ...conflictos.map((archivo) => `Auto-merging ${archivo}`),
        ...conflictos.map((archivo) => `CONFLICT (content): Merge conflict in ${archivo}`),
        'Automatic merge failed; fix conflicts and then commit the result.',
      ),
      error: false,
      // La union esta comprometida aunque todavia no exista: la
      // previsualizacion debe poder anunciarla.
      proyectadas: [idPrevisto],
      limpiarConsola: false,
    };
  }

  const mensaje = valorDeOpcion(argumentos, '-m') ?? `Merge branch '${objetivo}'`;
  const creado = agregarConfirmacion(estado, {
    mensaje,
    padres: [cabeza, idOtro],
    archivos: traidos,
    carril: confirmacionPorId(estado, cabeza)?.carril ?? 0,
    idForzado: idPrevisto,
  });

  let siguiente = moverPosicionActual(creado.estado, creado.confirmacion.id);
  siguiente = anotarMovimiento(siguiente, {
    id: creado.confirmacion.id,
    idAnterior: cabeza,
    operacion: 'merge',
    descripcion: mensaje,
    rama: ramaActual(siguiente),
  });

  return ok(
    siguiente,
    lineas(`Merge made by the 'ort' strategy.`, ...formatearEstadisticas(traidos)),
  );
};

/** `git tag`: listar, crear simple, `-a` con `-m` y `-d`. */
export const ordenTag: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const nombres = posicionales(argumentos, ['-m', '--message', '-a', '--annotate', '-d', '--delete']);
  const anotada = tieneOpcion(argumentos, '-a', '--annotate');
  const mensaje = valorDeOpcion(argumentos, '-m', '--message');
  const nombreAnotada = valorDeOpcion(argumentos, '-a', '--annotate');
  const aBorrar = valorDeOpcion(argumentos, '-d', '--delete');

  if (aBorrar !== null || tieneOpcion(argumentos, '-d', '--delete')) {
    const objetivo = aBorrar ?? nombres[0];
    if (objetivo === undefined) return fallo(estado, 'fatal: tag name required');
    const etiqueta = etiquetaPorNombre(estado, objetivo);
    if (etiqueta === undefined) {
      return fallo(estado, `error: tag '${objetivo}' not found.`);
    }
    return ok(
      {
        ...estado,
        etiquetas: estado.etiquetas.filter((candidata) => candidata.nombre !== objetivo),
      },
      lineas(`Deleted tag '${objetivo}' (was ${etiqueta.id})`),
    );
  }

  const nombre = anotada ? (nombreAnotada ?? nombres[0]) : nombres[0];

  if (nombre === undefined) {
    const ordenadas = [...estado.etiquetas].sort((una, otra) =>
      una.nombre.localeCompare(otra.nombre),
    );
    return ok(estado, lineas(...ordenadas.map((etiqueta) => etiqueta.nombre)));
  }

  if (etiquetaPorNombre(estado, nombre) !== undefined) {
    return fallo(estado, `fatal: tag '${nombre}' already exists`);
  }

  const referencia = anotada ? (nombres[0] ?? 'HEAD') : (nombres[1] ?? 'HEAD');
  const id = resolverReferencia(estado, referencia);
  if (id === null) {
    return fallo(estado, `fatal: Failed to resolve '${referencia}' as a valid ref.`);
  }
  if (anotada && mensaje === null) {
    return fallo(estado, 'fatal: no tag message?');
  }

  return ok({
    ...estado,
    etiquetas: [
      ...estado.etiquetas,
      { nombre, id, tipo: anotada ? 'anotada' : 'simple', mensaje: anotada ? mensaje : null },
    ],
  });
};
