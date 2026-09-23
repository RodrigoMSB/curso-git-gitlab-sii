/**
 * Del repositorio real al estado del motor (SPEC 020, 1.4).
 *
 * El simulador dibuja y previsualiza a partir de un `EstadoRepositorio`, el
 * mismo que arma un escenario. Esto arma ese estado desde lo que el lector
 * leyo de la carpeta `.git`, para reutilizar sin cambios el grafo y el motor.
 *
 * Los identificadores son los de Git, cortados a siete caracteres: el
 * participante ve en la pantalla los mismos que le muestra `git log --oneline`.
 *
 * ## Lo que se pierde en la traduccion
 *
 * El modelo del motor le da **un** estado a cada archivo. Git puede tener un
 * archivo preparado y ademas modificado despues (`MM`); ahi el motor lo ve
 * preparado con el texto del disco, y una previsualizacion de `git commit`
 * confirmaria el texto del disco y no el del indice. Las areas de la pantalla
 * no pasan por aqui: salen directo del estado real, y ahi el `MM` se ve bien.
 */

import { agregarConfirmacion, reservarId } from '../core/confirmaciones';
import { normalizar } from '../core/contenido';
import { estadoVacio } from '../core/estado';
import type { Archivo, EntradaGuardado, EntradaReflog, EstadoArchivo, EstadoRepositorio } from '../core/tipos';
import type { ConfirmacionReal } from './objetosGit';
import type { RepositorioReal } from './lector';

/** Lo que el puente necesita leer, ademas de lo que ya trae el repositorio. */
export interface Fuentes {
  /** Todas las rutas de un arbol, con el identificador de cada archivo. */
  aplanar(arbol: string): Promise<ReadonlyMap<string, { readonly sha: string }>>;
  /** El texto de un archivo guardado en Git. */
  texto(sha: string): Promise<string>;
  /** El texto de un archivo del directorio de trabajo, o null si no esta. */
  trabajo(ruta: string): Promise<string | null>;
  /** Una confirmacion cualquiera, tambien las del guardado temporal, que el grafo no recorre. */
  confirmacion(sha: string): Promise<ConfirmacionReal>;
  /** Los archivos de una carpeta no seguida, que `git status` resume como `carpeta/`. */
  archivosDe(carpeta: string): Promise<readonly string[]>;
}

/** La configuracion global que el laboratorio 01 deja puesta, porque la del alumno no se puede leer. */
export type ConfiguracionGlobal = Readonly<Record<string, string>>;

export interface EstadoDelMotor {
  readonly estado: EstadoRepositorio;
  /** `origin/main` y compania, que el motor no modela y el grafo dibuja aparte. */
  readonly ramasRemotas: readonly { readonly nombre: string; readonly id: string }[];
}

const corto = (sha: string): string => sha.slice(0, 7);

/** Padres antes que hijos, y entre las que no dependen una de otra, la mas vieja primero. */
function ordenar(confirmaciones: ReadonlyMap<string, ConfirmacionReal>): ConfirmacionReal[] {
  const salida: ConfirmacionReal[] = [];
  const vistas = new Set<string>();
  const porFecha = [...confirmaciones.values()].sort((a, b) => a.epocaConfirmador - b.epocaConfirmador);
  for (const inicio of porFecha) {
    // Recorrido en profundidad sin recursion: una historia larga no revienta la pila.
    const pila: { c: ConfirmacionReal; abierta: boolean }[] = [{ c: inicio, abierta: false }];
    while (pila.length > 0) {
      const tope = pila.pop();
      if (tope === undefined || vistas.has(tope.c.sha)) continue;
      if (tope.abierta) {
        vistas.add(tope.c.sha);
        salida.push(tope.c);
        continue;
      }
      pila.push({ c: tope.c, abierta: true });
      for (const padre of [...tope.c.padres].reverse()) {
        const p = confirmaciones.get(padre);
        if (p !== undefined && !vistas.has(padre)) pila.push({ c: p, abierta: false });
      }
    }
  }
  return salida;
}

export async function estadoDelMotor(
  repositorio: RepositorioReal,
  fuentes: Fuentes,
  opciones: { readonly directorio: string; readonly configuracionGlobal: ConfiguracionGlobal },
): Promise<EstadoDelMotor> {
  const { referencias, historia } = repositorio;
  const textos = new Map<string, string>();
  const texto = async (sha: string): Promise<string> => {
    const ya = textos.get(sha);
    if (ya !== undefined) return ya;
    const leido = normalizar(await fuentes.texto(sha));
    textos.set(sha, leido);
    return leido;
  };
  const arbolDeTextos = async (arbol: string): Promise<Record<string, string>> => {
    const plano = await fuentes.aplanar(arbol);
    const salida: Record<string, string> = {};
    for (const [ruta, { sha }] of plano) salida[ruta] = await texto(sha);
    return salida;
  };

  const local: Record<string, string> = {};
  for (const [clave, valores] of repositorio.configuracion) {
    const ultimo = valores.at(-1);
    if (ultimo !== undefined) local[clave] = ultimo;
  }

  let estado: EstadoRepositorio = {
    ...estadoVacio(opciones.directorio),
    iniciado: true,
    config: { local, global: { ...opciones.configuracionGlobal } },
    remotos: [...repositorio.configuracion.keys()]
      .map((clave) => /^remote\.(.+)\.url$/.exec(clave)?.[1])
      .filter((nombre): nombre is string => nombre !== undefined)
      .map((nombre) => ({ nombre, url: local[`remote.${nombre}.url`] ?? '' })),
    carriles: [],
  };

  // Las confirmaciones, con su arbol completo, como las guarda el motor.
  const arboles = new Map<string, Record<string, string>>();
  for (const c of ordenar(historia.confirmaciones)) {
    const arbol = await arbolDeTextos(c.arbol);
    arboles.set(c.sha, arbol);
    const previo = c.padres[0] === undefined ? {} : (arboles.get(c.padres[0]) ?? {});
    const archivos = Object.keys(arbol).filter((ruta) => previo[ruta] !== arbol[ruta]);
    const borrados = Object.keys(previo).filter((ruta) => !(ruta in arbol));
    estado = agregarConfirmacion(estado, {
      mensaje: c.asunto,
      archivos,
      borrados,
      padres: c.padres.filter((p) => historia.confirmaciones.has(p)).map(corto),
      carril: 0,
      contenidos: arbol,
      arbolBase: {},
      matiz: c.sha,
      idForzado: corto(c.sha),
      autor: c.autor,
      correo: c.correo,
      epoca: c.epoca,
    }).estado;
  }

  const existe = (sha: string | null): sha is string => sha !== null && historia.confirmaciones.has(sha);
  const ramas = [...referencias.ramas].filter(([, sha]) => existe(sha)).map(([nombre, sha]) => ({ nombre, id: corto(sha) }));
  const principal = referencias.cabeza.rama ?? ramas[0]?.nombre ?? 'main';

  // Los archivos, como los entiende el motor.
  const cabeza = referencias.cabeza.sha === null ? {} : (arboles.get(referencias.cabeza.sha) ?? {});
  const archivos = new Map<string, Archivo>();
  for (const entrada of repositorio.indice.entradas) {
    if (entrada.etapa === 0) archivos.set(entrada.ruta, { nombre: entrada.ruta, estado: 'limpio', contenido: null });
  }
  const borrados: string[] = [];
  const borradosSinPreparar: string[] = [];
  const conflictos: string[] = [];
  const conTexto = async (ruta: string, estadoArchivo: EstadoArchivo, extra: Partial<Archivo> = {}): Promise<void> => {
    const enDisco = await fuentes.trabajo(ruta);
    const delIndice = repositorio.indice.entradas.find((e) => e.ruta === ruta && e.etapa === 0);
    const contenido = enDisco ?? (delIndice === undefined ? null : await texto(delIndice.sha));
    archivos.set(ruta, { nombre: ruta, estado: estadoArchivo, contenido: contenido === null ? null : normalizar(contenido), ...extra });
  };
  for (const cambio of repositorio.cambios) {
    const { x, y, ruta } = cambio;
    if (x === '?') {
      const rutas = ruta.endsWith('/') ? await fuentes.archivosDe(ruta.slice(0, -1)) : [ruta];
      for (const r of rutas) await conTexto(r, 'sin-seguimiento');
    } else if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) {
      conflictos.push(ruta);
      await conTexto(ruta, 'en-conflicto');
    } else if (x === 'D') {
      borrados.push(ruta);
      archivos.delete(ruta);
    } else if (x === 'R' && cambio.origen !== undefined) {
      archivos.delete(cambio.origen);
      await conTexto(ruta, 'preparado', { renombradoDe: cambio.origen });
    } else if (x === 'A' || x === 'M') {
      await conTexto(ruta, 'preparado');
    } else if (y === 'D') {
      borradosSinPreparar.push(ruta);
      archivos.delete(ruta);
    } else if (y === 'M') {
      await conTexto(ruta, 'modificado');
    } else if (y === 'A') {
      // `git add -N`: el motor no lo modela; lo mas cercano es un archivo sin seguimiento.
      await conTexto(ruta, 'sin-seguimiento');
    }
  }
  // Lo ignorado tambien esta en el disco, y el motor lo necesita: aplica el
  // `.gitignore` por su cuenta, y sin esos archivos `rm temporal.tmp` o
  // `git add -f importante.tmp` le dirian que no existen.
  for (const ruta of await fuentes.archivosDe('')) {
    if (!archivos.has(ruta) && !borrados.includes(ruta)) await conTexto(ruta, 'sin-seguimiento');
  }
  // Un archivo limpio que no esta en HEAD (no deberia pasar) quedaria sin texto: se le pone el del indice.
  for (const [ruta, archivo] of archivos) {
    if (archivo.estado === 'limpio' && !(ruta in cabeza)) await conTexto(ruta, 'limpio');
  }

  // El guardado temporal: cada entrada es una confirmacion cuyo arbol es el
  // directorio de trabajo guardado, con el indice guardado como segundo padre.
  const guardados: EntradaGuardado[] = [];
  for (const { sha, mensaje } of referencias.guardados) {
    const guardada = await fuentes.confirmacion(sha);
    const [base, indice] = guardada.padres;
    if (base === undefined) continue;
    const enTrabajo = await fuentes.aplanar(guardada.arbol);
    const enBase = await fuentes.aplanar((await fuentes.confirmacion(base)).arbol);
    const enIndice = indice === undefined ? enBase : await fuentes.aplanar((await fuentes.confirmacion(indice)).arbol);
    const guardadosAqui: Archivo[] = [];
    for (const [ruta, { sha: blob }] of enTrabajo) {
      if (enBase.get(ruta)?.sha === blob) continue;
      guardadosAqui.push({
        nombre: ruta,
        estado: enIndice.get(ruta)?.sha !== enBase.get(ruta)?.sha ? 'preparado' : 'modificado',
        contenido: await texto(blob),
      });
    }
    guardados.push({
      mensaje,
      archivos: guardadosAqui,
      rama: /^(?:WIP on|On) (.+?):/.exec(mensaje)?.[1] ?? 'HEAD',
      idBase: corto(base),
      id: corto(sha),
    });
  }
  estado = {
    ...estado,
    ramas,
    carriles: [principal, ...ramas.map((r) => r.nombre).filter((n) => n !== principal)].map((rama, carril) => ({ rama, carril })),
    etiquetas: [...referencias.etiquetas]
      .filter(([, e]) => existe(e.confirmacion))
      .map(([nombre, e]) => ({
        nombre,
        id: corto(e.confirmacion ?? ''),
        tipo: e.anotada ? ('anotada' as const) : ('simple' as const),
        mensaje: e.mensaje,
      })),
    puntero:
      referencias.cabeza.rama !== null
        ? { tipo: 'rama', rama: referencias.cabeza.rama }
        : { tipo: 'confirmacion', id: corto(referencias.cabeza.sha ?? '') },
    archivos: [...archivos.values()].sort((a, b) => (a.nombre < b.nombre ? -1 : 1)),
    borrados,
    borradosSinPreparar,
    guardados,
    reflog: [...referencias.movimientos].reverse().map((m): EntradaReflog => {
      const dos = m.mensaje.indexOf(': ');
      return {
        ref: 'HEAD',
        id: corto(m.nuevo),
        idAnterior: /^0+$/.test(m.anterior) ? null : corto(m.anterior),
        operacion: dos < 0 ? m.mensaje : m.mensaje.slice(0, dos),
        descripcion: dos < 0 ? '' : m.mensaje.slice(dos + 2),
      };
    }),
    origHead: repositorio.origHead === null ? null : corto(repositorio.origHead),
  };

  if (repositorio.operacion === 'fusion' && repositorio.fusionando[0] !== undefined && referencias.cabeza.sha !== null) {
    const rama = /Merge (?:remote-tracking )?branch '([^']+)'/.exec(repositorio.mensajeFusion ?? '')?.[1];
    estado = {
      ...estado,
      fusion: {
        rama: rama ?? corto(repositorio.fusionando[0]),
        idOrigen: corto(repositorio.fusionando[0]),
        idDestino: corto(referencias.cabeza.sha),
        idPrevisto: reservarId(estado, `fusion:${repositorio.fusionando[0]}`),
        conflictos,
        // Lo que habia antes de la fusion, para `git merge --abort`: lo que la
        // fusion preparo o dejo en conflicto vuelve a HEAD, y lo que HEAD no
        // tenia desaparece. Lo no seguido y lo modificado quedan: Git no
        // empieza una fusion que los pise.
        archivosPrevios: estado.archivos.flatMap((a): Archivo[] => {
          if (a.estado !== 'preparado' && a.estado !== 'en-conflicto') return [a];
          return a.nombre in cabeza ? [{ nombre: a.nombre, estado: 'limpio', contenido: null }] : [];
        }),
      },
    };
  }

  const ramasRemotas = [...referencias.remotas].filter(([, sha]) => existe(sha)).map(([nombre, sha]) => ({ nombre, id: corto(sha) }));
  return { estado, ramasRemotas };
}
