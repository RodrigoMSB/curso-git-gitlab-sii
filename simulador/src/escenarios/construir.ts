/**
 * Traduccion de un escenario declarado a un estado del repositorio.
 *
 * Usa la misma fabrica de confirmaciones que las ordenes, de modo que los
 * identificadores de los escenarios se generan igual que los que produce el
 * participante durante la clase.
 */

import { agregarConfirmacion } from '../core/confirmaciones';
import { estadoVacio } from '../core/estado';
import type { EstadoRepositorio } from '../core/tipos';
import type { EscenarioDeclarado } from './tipos';

export function construirEscenario(declaracion: EscenarioDeclarado): EstadoRepositorio {
  const base = estadoVacio(declaracion.directorio);

  let estado: EstadoRepositorio = {
    ...base,
    iniciado: true,
    archivos: declaracion.archivos.map((archivo) => ({ ...archivo })),
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
      matiz: `${declaracion.id}:${declarada.clave}`,
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
  };

  return estado;
}
