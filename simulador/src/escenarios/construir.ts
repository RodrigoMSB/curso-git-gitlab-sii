/**
 * Traduccion de un escenario declarado a un estado del repositorio.
 *
 * Usa la misma fabrica de confirmaciones que las ordenes, de modo que los
 * identificadores de los escenarios se generan igual que los que produce el
 * participante durante la clase.
 */

import { agregarConfirmacion } from '../core/confirmaciones';
import { normalizar } from '../core/contenido';
import { estadoVacio } from '../core/estado';
import type { Archivo, EstadoRepositorio } from '../core/tipos';
import type { ArchivoDeclarado, EscenarioDeclarado } from './tipos';

/**
 * Traduce un archivo declarado al del modelo.
 *
 * El texto se normaliza al entrar: finales de linea en `\n` y salto final. Lo
 * que el disco escribe pasa por la misma regla, de modo que la comparacion de
 * la suite no dependa del sistema donde se corra (punto 2.5 del SPEC 012).
 */
function archivoDeclarado(declarado: ArchivoDeclarado): Archivo {
  return {
    nombre: declarado.nombre,
    estado: declarado.estado,
    contenido: declarado.contenido === undefined ? null : normalizar(declarado.contenido),
    ...(declarado.renombradoDe === undefined ? {} : { renombradoDe: declarado.renombradoDe }),
  };
}

/**
 * El texto de cada archivo que la confirmacion registra, ya normalizado.
 *
 * Se exige una entrada por nombre y ninguna de sobra. Un archivo registrado sin
 * texto es una confirmacion que dice haber cambiado algo sin decir que, y un
 * texto sin archivo es contenido que no llega al arbol: las dos cosas son
 * formas de que la declaracion y el disco se separen sin que nadie lo note.
 */
function contenidosDeclarados(
  escenario: string,
  clave: string,
  archivos: readonly string[],
  contenido: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const textos: Record<string, string> = {};
  for (const nombre of archivos) {
    const texto = contenido[nombre];
    if (texto === undefined) {
      throw new Error(
        `El escenario ${escenario} registra '${nombre}' en ${clave} y no declara su contenido.`,
      );
    }
    textos[nombre] = normalizar(texto);
  }
  for (const nombre of Object.keys(contenido)) {
    if (archivos.includes(nombre)) continue;
    throw new Error(
      `El escenario ${escenario} declara el contenido de '${nombre}' en ${clave}, que esa confirmacion no registra.`,
    );
  }
  return textos;
}

export function construirEscenario(declaracion: EscenarioDeclarado): EstadoRepositorio {
  const base = estadoVacio(declaracion.directorio);

  let estado: EstadoRepositorio = {
    ...base,
    iniciado: declaracion.iniciado ?? true,
    archivos: declaracion.archivos.map(archivoDeclarado),
    remotos: declaracion.remotos.map((remoto) => ({ ...remoto })),
    config: { local: {}, global: { ...declaracion.configuracion } },
    carriles: [],
  };

  const identificadores = new Map<string, string>();

  for (const declarada of declaracion.confirmaciones) {
    const padres = declarada.padres.map((clave) => {
      const id = identificadores.get(clave);
      if (id === undefined) {
        throw new Error(
          `El escenario ${declaracion.id} nombra el padre '${clave}', que no está declarado antes.`,
        );
      }
      return id;
    });

    const creado = agregarConfirmacion(estado, {
      mensaje: declarada.mensaje,
      archivos: declarada.archivos,
      padres,
      carril: declarada.carril,
      contenidos: contenidosDeclarados(
        declaracion.id,
        declarada.clave,
        declarada.archivos,
        declarada.contenido,
      ),
      matiz: `${declaracion.id}:${declarada.clave}`,
      ...(declarada.autor === undefined ? {} : { autor: declarada.autor }),
      ...(declarada.correo === undefined ? {} : { correo: declarada.correo }),
      ...(declarada.epoca === undefined ? {} : { epoca: declarada.epoca }),
    });
    estado = creado.estado;
    identificadores.set(declarada.clave, creado.confirmacion.id);

    estado = {
      ...estado,
      reflog: [
        {
          ref: 'HEAD',
          id: creado.confirmacion.id,
          idAnterior: padres[0] ?? null,
          operacion: padres.length === 0 ? 'commit (initial)' : 'commit',
          descripcion: declarada.mensaje,
        },
        ...estado.reflog,
      ],
    };
  }

  const resolver = (clave: string): string => {
    const id = identificadores.get(clave);
    if (id === undefined) {
      throw new Error(`El escenario ${declaracion.id} apunta a '${clave}', que no existe.`);
    }
    return id;
  };

  estado = {
    ...estado,
    ramas: declaracion.ramas.map((rama) => ({ nombre: rama.nombre, id: resolver(rama.en) })),
    carriles:
      declaracion.ramas.length > 0
        ? declaracion.ramas.map((rama) => ({ rama: rama.nombre, carril: rama.carril }))
        : [{ rama: declaracion.posicion, carril: 0 }],
    etiquetas: declaracion.etiquetas.map((etiqueta) => ({
      nombre: etiqueta.nombre,
      id: resolver(etiqueta.en),
      tipo: etiqueta.tipo,
      mensaje: etiqueta.mensaje,
    })),
    puntero: { tipo: 'rama', rama: declaracion.posicion },
    guardados: (declaracion.guardados ?? []).map((guardado) => ({
      mensaje: guardado.mensaje,
      archivos: guardado.archivos.map(archivoDeclarado),
      rama: guardado.rama,
      idBase: resolver(guardado.sobre),
    })),
  };

  return estado;
}
