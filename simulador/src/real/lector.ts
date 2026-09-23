/**
 * Lee un repositorio real entero: historia, referencias, indice y las tres
 * areas (SPEC 020).
 *
 * Antes de leer se mira si el repositorio es de una forma que no se sabe
 * representar, y en ese caso se devuelve el motivo en vez de un dibujo a
 * medias (punto 2.9): identificadores SHA-256, referencias en `reftable`, un
 * arbol de trabajo enlazado cuya carpeta `.git` vive en otro lado, o un indice
 * partido o disperso.
 */

import type { Adaptador } from './adaptador';
import { Almacen } from './almacen';
import { type Configuracion, leerConfiguracion, valor, verdadero } from './config';
import { type Autocrlf, leerAtributos } from './finales';
import { type Historia, leerHistoria } from './historia';
import { type Indice, leerIndice } from './indice';
import { leerConfirmacion } from './objetosGit';
import { LectorDeReferencias, leerSuperficiales, type Referencias } from './referencias';
import { type Cambio, LectorDeTrabajo } from './trabajo';

const GIT = ['.git'];

/** Una operacion a medio hacer, que Git anuncia en `git status`. */
export type Operacion = 'fusion' | 'reversion' | 'seleccion' | 'reorganizacion' | null;

export interface RepositorioReal {
  readonly referencias: Referencias;
  readonly historia: Historia;
  readonly cambios: readonly Cambio[];
  readonly indice: Indice;
  readonly configuracion: Configuracion;
  readonly operacion: Operacion;
  /** Las confirmaciones que la fusion en curso une con HEAD (MERGE_HEAD). */
  readonly fusionando: readonly string[];
  /** Cuanto tardo cada parte, en milisegundos. */
  readonly tiempos: Readonly<Record<string, number>>;
}

export type Lectura =
  | { readonly tipo: 'leido'; readonly repositorio: RepositorioReal }
  | { readonly tipo: 'no-soportado'; readonly motivo: string };

export interface OpcionesLectura {
  /**
   * El valor de `core.autocrlf` si el repositorio no lo fija. La configuracion
   * del sistema y la del usuario no estan en la carpeta y no se pueden leer:
   * en Windows se supone `true`, que es lo que deja el instalador de Git.
   */
  readonly autocrlfPorDefecto: Autocrlf;
}

/** El archivo con los archivos que Git lee en cada vuelta del sondeo (punto 2.7). */
export const VIGILADOS: readonly (readonly string[])[] = [
  ['HEAD'],
  ['index'],
  ['packed-refs'],
  ['logs', 'HEAD'],
  ['MERGE_HEAD'],
  ['refs', 'stash'],
];

const decodificador = new TextDecoder('utf-8');

/** Lo que impide leer el repositorio, o null si se puede. */
export async function motivoParaNoLeer(fs: Adaptador): Promise<string | null> {
  const punto = await fs.datos(GIT);
  if (punto !== null) {
    // `.git` es un archivo: un arbol de trabajo enlazado o un submodulo.
    return 'esta carpeta es un arbol de trabajo enlazado (git worktree) o un submodulo: su .git apunta a otra carpeta, y la pagina solo ve la que elegiste';
  }
  if ((await fs.listar(GIT)) === null) {
    if ((await fs.datos(['HEAD'])) !== null && (await fs.listar(['objects'])) !== null) {
      return 'elegiste la carpeta .git; elige la carpeta del proyecto, la que la contiene';
    }
    return 'en esta carpeta no hay un repositorio: no tiene carpeta .git';
  }
  const config = leerConfiguracion(decodificador.decode((await fs.leer([...GIT, 'config'])) ?? new Uint8Array()));
  const formato = valor(config, 'extensions.objectformat');
  if (formato !== null && formato.toLowerCase() !== 'sha1') {
    return `el repositorio usa identificadores ${formato.toUpperCase()}, y la pagina solo sabe leer SHA-1`;
  }
  if (valor(config, 'extensions.refstorage') === 'reftable' || (await fs.listar([...GIT, 'reftable'])) !== null) {
    return 'el repositorio guarda sus referencias en formato reftable, y la pagina solo sabe leer el formato de archivos';
  }
  if (verdadero(config, 'core.bare')) return 'el repositorio es desnudo (bare): no tiene directorio de trabajo que mostrar';
  return null;
}

async function medir<T>(tiempos: Record<string, number>, parte: string, trabajo: () => Promise<T>): Promise<T> {
  const inicio = performance.now();
  const resultado = await trabajo();
  tiempos[parte] = Math.round((performance.now() - inicio) * 10) / 10;
  return resultado;
}

export class LectorReal {
  readonly almacen: Almacen;
  private readonly trabajo: LectorDeTrabajo;
  private readonly referencias: LectorDeReferencias;

  constructor(
    private readonly fs: Adaptador,
    private readonly opciones: OpcionesLectura,
  ) {
    this.almacen = new Almacen(fs, GIT);
    this.trabajo = new LectorDeTrabajo(fs, GIT, this.almacen);
    this.referencias = new LectorDeReferencias(fs, GIT);
  }

  async leer(): Promise<Lectura> {
    const motivo = await motivoParaNoLeer(this.fs);
    if (motivo !== null) return { tipo: 'no-soportado', motivo };

    const tiempos: Record<string, number> = {};
    const inicio = performance.now();
    const fs = this.fs;
    const configuracion = leerConfiguracion(decodificador.decode((await fs.leer([...GIT, 'config'])) ?? new Uint8Array()));
    const referencias = await medir(tiempos, 'referencias', () => this.referencias.leer(this.almacen));
    const historia = await medir(tiempos, 'historia', async () =>
      leerHistoria(this.almacen, referencias, await leerSuperficiales(fs, GIT)),
    );

    const bytesIndice = await fs.leer([...GIT, 'index']);
    const indice: Indice = bytesIndice === null ? { version: 2, entradas: [], noSoportado: null } : leerIndice(bytesIndice);
    if (indice.noSoportado !== null) return { tipo: 'no-soportado', motivo: indice.noSoportado };

    const autocrlfLocal = valor(configuracion, 'core.autocrlf')?.toLowerCase();
    const autocrlf: Autocrlf =
      autocrlfLocal === 'input'
        ? 'input'
        : autocrlfLocal === undefined
          ? this.opciones.autocrlfPorDefecto
          : verdadero(configuracion, 'core.autocrlf')
            ? 'true'
            : 'false';

    const texto = async (ruta: readonly string[]): Promise<string | null> => {
      const b = await fs.leer(ruta);
      return b === null ? null : decodificador.decode(b);
    };
    const sha = referencias.cabeza.sha;
    const arbolCabeza = sha === null ? null : leerConfirmacion(sha, (await this.almacen.objeto(sha)).datos).arbol;
    const cambios = await medir(tiempos, 'areas', async () =>
      this.trabajo.estado({
        indice,
        arbolCabeza,
        autocrlf,
        atributos: leerAtributos(await texto(['.gitattributes'])),
        ignorarMayusculas: verdadero(configuracion, 'core.ignorecase'),
        fechaIndice: (await fs.datos([...GIT, 'index']))?.modificado ?? Number.POSITIVE_INFINITY,
      }),
    );

    const fusion = await texto([...GIT, 'MERGE_HEAD']);
    const operacion: Operacion =
      fusion !== null
        ? 'fusion'
        : (await texto([...GIT, 'REVERT_HEAD'])) !== null
          ? 'reversion'
          : (await texto([...GIT, 'CHERRY_PICK_HEAD'])) !== null
            ? 'seleccion'
            : (await fs.listar([...GIT, 'rebase-merge'])) !== null || (await fs.listar([...GIT, 'rebase-apply'])) !== null
              ? 'reorganizacion'
              : null;
    tiempos.total = Math.round((performance.now() - inicio) * 10) / 10;

    return {
      tipo: 'leido',
      repositorio: {
        referencias,
        historia,
        cambios,
        indice,
        configuracion,
        operacion,
        fusionando: (fusion ?? '').split('\n').filter((l) => /^[0-9a-f]{40}$/.test(l.trim())).map((l) => l.trim()),
        tiempos,
      },
    };
  }
}
