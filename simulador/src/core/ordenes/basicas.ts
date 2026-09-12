/**
 * Ordenes de trabajo diario: `init`, `config`, `status`, `add`, `restore` y
 * `diff`.
 */

import {
  antesDelSeparador,
  posicionales,
  tieneOpcion,
  trasElSeparador,
} from '../analizador';
import {
  arbolDe,
  comparacionesEntre,
  textoDeTrabajo,
  textoEnCabeza,
  textoPreparado,
} from '../contenido';
import { type Comparacion, formatearEstadisticasDe, formatearParches } from '../diferencias';
import { archivosEn, establecerArchivo, establecerContenido, estaSeguido } from '../estado';
import { estaExcluida, exclusionesDe, patronesFuera } from '../exclusiones';
import { formatearEstadoCorto, formatearEstadoLargo } from '../formato';
import { resolverReferencia } from '../referencias';
import { fallo, lineaLimite, lineas, ok, sinRepositorio } from '../salida';
import type { Archivo, EstadoRepositorio, ResultadoOrden } from '../tipos';

export type Manejador = (
  estado: EstadoRepositorio,
  argumentos: readonly string[],
) => ResultadoOrden;

/** `git init` */
export const ordenInit: Manejador = (estado) => {
  const ruta = `${estado.directorio}/.git/`;
  if (estado.iniciado) {
    return ok(estado, lineas(`Reinitialized existing Git repository in ${ruta}`));
  }
  return ok({ ...estado, iniciado: true }, lineas(`Initialized empty Git repository in ${ruta}`));
};

/** `git config`, con `user.name`, `user.email` y `--global`. */
export const ordenConfig: Manejador = (estado, argumentos) => {
  const global = tieneOpcion(argumentos, '--global');
  const ambito = global ? 'global' : 'local';
  const restantes = posicionales(argumentos);

  if (tieneOpcion(argumentos, '-l', '--list')) {
    const fuente = global
      ? estado.config.global
      : { ...estado.config.global, ...estado.config.local };
    return ok(
      estado,
      lineas(...Object.entries(fuente).map(([clave, valor]) => `${clave}=${valor}`)),
    );
  }

  const clave = restantes[0];
  if (clave === undefined) {
    return fallo(estado, 'usage: git config [--global] <name> [<value>]');
  }

  // `--unset` borra la clave. El motor devolvia su valor, que es lo que hace
  // sin opciones: la orden se aceptaba y no quitaba nada.
  if (tieneOpcion(argumentos, '--unset')) {
    const ambitoActual = { ...estado.config[ambito] };
    if (!Object.hasOwn(ambitoActual, clave)) return fallo(estado);
    delete ambitoActual[clave];
    return ok({ ...estado, config: { ...estado.config, [ambito]: ambitoActual } });
  }

  const valor = restantes[1];
  if (valor === undefined) {
    const guardado = global ? estado.config.global[clave] : estado.config.local[clave];
    const heredado = guardado ?? estado.config.global[clave];
    if (heredado === undefined) return fallo(estado);
    return ok(estado, lineas(heredado));
  }

  return ok({
    ...estado,
    config: { ...estado.config, [ambito]: { ...estado.config[ambito], [clave]: valor } },
  });
};

/**
 * `git status`, en forma larga y con `-s`.
 *
 * Si el archivo de exclusiones lleva un patron que el simulador no cubre, se
 * dice aqui: es el momento en que el participante espera que el filtrado haya
 * ocurrido, y callarlo seria dejarlo creyendo que su regla funciono.
 */
export const ordenStatus: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);
  const corto = tieneOpcion(argumentos, '-s', '--short');
  const cuerpo = corto ? formatearEstadoCorto(estado) : formatearEstadoLargo(estado);

  const sinCubrir = patronesFuera(estado);
  const aviso =
    sinCubrir.length === 0
      ? []
      : [
          lineaLimite(
            `el simulador no aplica ${sinCubrir.map((uno) => `«${uno}»`).join(', ')} de .gitignore: solo cubre los comodines de extension, los nombres literales y las carpetas.`,
          ),
          lineaLimite('En tu terminal si funciona: esa regla compruebala ahi.'),
        ];

  return ok(estado, [...lineas(...cuerpo), ...aviso]);
};

/** Archivos que una ruta abarca: el archivo exacto o todo lo que cuelga de una carpeta. */
function coincidencias(estado: EstadoRepositorio, ruta: string): readonly Archivo[] {
  if (ruta === '.' || ruta === './') return estado.archivos;
  const carpeta = ruta.endsWith('/') ? ruta : `${ruta}/`;
  return estado.archivos.filter(
    (archivo) => archivo.nombre === ruta || archivo.nombre.startsWith(carpeta),
  );
}

/**
 * `git add`, con archivo puntual, `.`, `-A` y `-f`.
 *
 * Lo que el archivo de exclusiones tapa **no entra**, que es lo que el punto
 * 3.2 del laboratorio 03 hace comprobar. La diferencia entre nombrarlo y
 * barrer es la de Git: `git add .` se salta lo tapado en silencio, y nombrarlo
 * a mano es un error que dice como insistir.
 */
export const ordenAdd: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const rutas = posicionales(argumentos);
  const todo = tieneOpcion(argumentos, '-A', '--all', '-a');
  const forzado = tieneOpcion(argumentos, '-f', '--force');
  const exclusiones = exclusionesDe(estado);
  /** Una regla solo tapa lo que todavia no esta en seguimiento. */
  const tapado = (archivo: Archivo): boolean =>
    !forzado &&
    archivo.estado === 'sin-seguimiento' &&
    !estaSeguido(estado, archivo.nombre) &&
    estaExcluida(exclusiones, archivo.nombre);

  if (rutas.length === 0 && !todo) {
    return ok(
      estado,
      lineas(
        'Nothing specified, nothing added.',
        'hint: Maybe you wanted to say \'git add .\'?',
      ),
    );
  }

  const objetivo: Archivo[] = [];
  if (todo || rutas.length === 0) {
    // Barrer se salta lo tapado sin decir nada, igual que Git.
    objetivo.push(...estado.archivos.filter((archivo) => !tapado(archivo)));
  } else {
    for (const ruta of rutas) {
      const encontrados = coincidencias(estado, ruta);
      if (encontrados.length === 0) {
        return fallo(estado, `fatal: pathspec '${ruta}' did not match any files`);
      }
      // Nombrar a mano un archivo tapado es un error, y Git dice como
      // insistir. Alcanzarlo a traves de una carpeta, como hace `git add .`,
      // no lo es: ahi se salta en silencio.
      const tapados = encontrados.filter(tapado);
      const nombrados = tapados.filter((archivo) => archivo.nombre === ruta);
      if (nombrados.length > 0) {
        return fallo(
          estado,
          'The following paths are ignored by one of your .gitignore files:',
          ...nombrados.map((archivo) => archivo.nombre),
          'hint: Use -f if you really want to add them.',
        );
      }
      objetivo.push(...encontrados.filter((archivo) => !tapado(archivo)));
    }
  }

  let siguiente = estado;
  for (const archivo of objetivo) {
    if (archivo.estado === 'limpio' || archivo.estado === 'preparado') continue;
    siguiente = establecerArchivo(siguiente, archivo.nombre, 'preparado');
    // El nombre que este archivo tenia antes deja de estar pendiente: su
    // desaparicion ya esta contada como parte del renombrado.
    if (archivo.renombradoDe !== undefined) {
      siguiente = {
        ...siguiente,
        borradosSinPreparar: siguiente.borradosSinPreparar.filter(
          (nombre) => nombre !== archivo.renombradoDe,
        ),
      };
    }
  }

  // Preparar un borrado que estaba pendiente lo pasa al area de preparacion,
  // que es lo que hace `git add` sobre un archivo que ya no esta. Se mira la
  // lista ya podada: el nombre viejo de un renombrado salio de ahi arriba y
  // volver a tomarlo lo contaria dos veces, como baja y como renombrado.
  siguiente = prepararBorrados(siguiente, todo, rutas);

  // Resolver el ultimo conflicto no cierra la fusion: falta confirmar.
  return ok(siguiente);
};

/**
 * Pasa al area de preparacion los borrados pendientes que la orden alcanza.
 *
 * `git add .` y `git add -A` los toman todos; `git add <ruta>` solo el que
 * nombra, aunque el archivo ya no este en el directorio de trabajo.
 */
function prepararBorrados(
  siguiente: EstadoRepositorio,
  todo: boolean,
  rutas: readonly string[],
): EstadoRepositorio {
  const alcanza = (nombre: string): boolean => {
    if (todo || rutas.length === 0) return true;
    return rutas.some(
      (ruta) => ruta === '.' || ruta === './' || ruta === nombre || nombre.startsWith(`${ruta}/`),
    );
  };
  const alcanzados = siguiente.borradosSinPreparar.filter(alcanza);
  if (alcanzados.length === 0) return siguiente;
  return {
    ...siguiente,
    borrados: [...new Set([...siguiente.borrados, ...alcanzados])],
    borradosSinPreparar: siguiente.borradosSinPreparar.filter((nombre) => !alcanza(nombre)),
  };
}

/** `git restore`, con archivo puntual y `--staged`. */
export const ordenRestore: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);

  const preparado = tieneOpcion(argumentos, '--staged', '--cached');
  const rutas = posicionales(argumentos);

  if (rutas.length === 0) {
    return fallo(estado, 'fatal: you must specify path(s) to restore');
  }

  let siguiente = estado;
  for (const ruta of rutas) {
    // Una baja preparada tambien se saca de la preparacion, y entonces el
    // archivo vuelve a estar versionado. Es la ruta la que estaba anotada como
    // borrada, no el archivo del disco: por eso hay que nombrarla aparte
    // aunque el archivo este ahi delante.
    if (preparado && siguiente.borrados.includes(ruta)) {
      siguiente = {
        ...siguiente,
        borrados: siguiente.borrados.filter((nombre) => nombre !== ruta),
        archivos: siguiente.archivos.some((archivo) => archivo.nombre === ruta)
          ? siguiente.archivos.map((archivo) =>
              archivo.nombre === ruta
                ? { nombre: ruta, estado: 'limpio' as const, contenido: null }
                : archivo,
            )
          : siguiente.archivos,
        borradosSinPreparar: siguiente.archivos.some((archivo) => archivo.nombre === ruta)
          ? siguiente.borradosSinPreparar
          : [...siguiente.borradosSinPreparar, ruta],
      };
      continue;
    }

    const encontrados = coincidencias(estado, ruta);
    if (encontrados.length === 0) {
      return fallo(estado, `error: pathspec '${ruta}' did not match any file(s) known to git`);
    }
    for (const archivo of encontrados) {
      if (preparado) {
        if (archivo.estado !== 'preparado') continue;
        const destino = estaSeguido(siguiente, archivo.nombre) ? 'modificado' : 'sin-seguimiento';
        siguiente = establecerArchivo(siguiente, archivo.nombre, destino);
        // El indice de Git es por ruta: sacar de la preparacion el nombre
        // nuevo de un renombrado **no** saca la baja del nombre viejo, que
        // sigue preparada. Comprobado contra Git: queda `D  platos.md` junto
        // al archivo nuevo sin seguimiento.
        if (archivo.renombradoDe !== undefined) {
          siguiente = {
            ...siguiente,
            borrados: [...new Set([...siguiente.borrados, archivo.renombradoDe])],
          };
        }
      } else {
        if (archivo.estado !== 'modificado') continue;
        // Descartar el cambio devuelve el texto de la confirmacion actual, que
        // es lo que el `null` significa.
        siguiente = establecerContenido(
          establecerArchivo(siguiente, archivo.nombre, 'limpio'),
          archivo.nombre,
          null,
        );
      }
    }
  }

  return ok(siguiente);
};

/**
 * `git diff`, sin opciones y con `--staged` (seccion 4 del SPEC 012).
 *
 * Son dos preguntas distintas y el taller vive de esa distincion:
 *
 * - `git diff` compara **el area de preparacion con el directorio**: lo que
 *   cambiaste y todavia no preparaste.
 * - `git diff --staged` compara **la confirmacion con el area**: lo que
 *   preparaste y todavia no confirmaste.
 *
 * Hasta el SPEC 011 las dos mostraban la forma del parche y una linea que
 * declaraba que el detalle era simulado. Ahora muestran el texto.
 */
export const ordenDiff: Manejador = (estado, argumentos) => {
  if (!estado.iniciado) return sinRepositorio(estado);
  const preparado = tieneOpcion(argumentos, '--staged', '--cached');

  // `git diff <referencia> [<referencia>]` compara dos puntos de la historia,
  // o uno contra el directorio de trabajo. Es lo que el laboratorio 05 usa
  // para mirar por que dos ramas van a chocar, y hasta ahora el simulador la
  // aceptaba y **no imprimia nada**: la cuarta respuesta que el contrato del
  // SPEC 010 no admite, en el paso 3.1 de ese enunciado.
  const referencias = posicionales(antesDelSeparador(argumentos));
  if (referencias.length > 0) {
    const entreRevisiones = compararRevisiones(estado, referencias);
    if (typeof entreRevisiones === 'string') return fallo(estado, entreRevisiones);
    return escribirDiff(estado, limitarARutas(entreRevisiones, trasElSeparador(argumentos)), argumentos);
  }

  const comparaciones: Comparacion[] = preparado
    ? [
        // Las bajas preparadas van primero, como las ordena `git status`.
        ...estado.borrados.map((ruta) => ({
          ruta,
          antes: textoEnCabeza(estado, ruta),
          despues: null,
        })),
        ...archivosEn(estado, 'preparado').map((archivo) => ({
          ruta: archivo.nombre,
          antes: textoEnCabeza(estado, archivo.nombre),
          despues: textoDeTrabajo(estado, archivo.nombre),
        })),
      ]
    : [
        ...estado.borradosSinPreparar.map((ruta) => ({
          ruta,
          antes: textoEnCabeza(estado, ruta),
          despues: null,
        })),
        ...archivosEn(estado, 'modificado').map((archivo) => ({
          ruta: archivo.nombre,
          // Sin preparar, el lado izquierdo es lo que hay en el indice, que en
          // un archivo no preparado es lo mismo que en la confirmacion.
          antes: textoPreparado(estado, archivo.nombre),
          despues: textoDeTrabajo(estado, archivo.nombre),
        })),
      ];

  return escribirDiff(estado, limitarARutas(comparaciones, trasElSeparador(argumentos)), argumentos);
};

/**
 * Escribe el parche o el resumen, segun lo que se pidio.
 *
 * `--stat` esta en la carta de opciones, asi que tiene que hacer algo: una
 * opcion aceptada y descartada es lo unico que el contrato no admite.
 */
function escribirDiff(
  estado: EstadoRepositorio,
  comparaciones: readonly Comparacion[],
  argumentos: readonly string[],
): ResultadoOrden {
  const resumir = tieneOpcion(argumentos, '--stat');
  return ok(
    estado,
    lineas(
      ...(resumir
        ? formatearEstadisticasDe(comparaciones)
        : formatearParches(comparaciones)),
    ),
  );
}

/** Deja solo las comparaciones de las rutas pedidas detras del `--`. */
function limitarARutas(
  comparaciones: readonly Comparacion[],
  rutas: readonly string[],
): readonly Comparacion[] {
  if (rutas.length === 0) return comparaciones;
  return comparaciones.filter((comparacion) =>
    rutas.some(
      (ruta) => comparacion.ruta === ruta || comparacion.ruta.startsWith(`${ruta}/`),
    ),
  );
}

/**
 * Las comparaciones de `git diff <referencia> [<referencia>]`.
 *
 * Con dos referencias se comparan los dos arboles. Con una, ese arbol contra
 * el directorio de trabajo, que es lo que hace Git. Devuelve el texto del
 * reclamo cuando alguna referencia no existe.
 */
function compararRevisiones(
  estado: EstadoRepositorio,
  referencias: readonly string[],
): readonly Comparacion[] | string {
  const primera = referencias[0] ?? '';
  const idUna = resolverReferencia(estado, primera);
  if (idUna === null) {
    return `fatal: ambiguous argument '${primera}': unknown revision or path not in the working tree.`;
  }

  const segunda = referencias[1];
  if (segunda !== undefined) {
    const idOtra = resolverReferencia(estado, segunda);
    if (idOtra === null) {
      return `fatal: ambiguous argument '${segunda}': unknown revision or path not in the working tree.`;
    }
    return comparacionesEntre(estado, idUna, idOtra);
  }

  // Una sola referencia: ese arbol contra lo que hay en el disco ahora.
  const arbol = arbolDe(estado, idUna);
  const rutas = [
    ...new Set([...Object.keys(arbol), ...estado.archivos.map((archivo) => archivo.nombre)]),
  ].sort();
  return rutas
    .map((ruta) => ({
      ruta,
      antes: arbol[ruta] ?? null,
      despues: textoDeTrabajo(estado, ruta),
    }))
    .filter((comparacion) => comparacion.antes !== comparacion.despues);
}
