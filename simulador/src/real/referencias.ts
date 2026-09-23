/**
 * Las referencias de un repositorio real: HEAD, ramas, etiquetas, ramas
 * remotas, el guardado temporal y el registro de movimientos de HEAD
 * (SPEC 020).
 *
 * Viene del `nucleo.js` del arquitecto. Lo que cambio en la revision:
 *
 * - Una referencia simbolica que apunta a otra en ciclo dejaba la pagina
 *   colgada para siempre. Git corta a los cinco saltos; aqui tambien, y la
 *   referencia rota se informa en vez de dibujarse.
 * - Un `main.lock` que Git deja mientras escribe aparecia como una rama mas.
 *   Ningun nombre de referencia puede terminar en `.lock`: se ignoran.
 * - El original solo leia ramas locales. Aqui entran las etiquetas, con las
 *   anotadas resueltas hasta su confirmacion, las ramas remotas y `refs/stash`.
 */

import type { Adaptador } from './adaptador';
import type { Almacen } from './almacen';
import { leerEtiqueta } from './objetosGit';

/**
 * Git da por rota una referencia que necesita cinco saltos simbolicos para
 * llegar a un identificador (SYMREF_MAXDEPTH); HEAD cuenta como uno.
 */
const PROFUNDIDAD_MAXIMA = 5;

const SHA = /^[0-9a-f]{40}$/;

export interface Cabeza {
  /** La rama a la que esta pegada HEAD, sin `refs/heads/`; null si esta separada. */
  readonly rama: string | null;
  /** La confirmacion; null en una rama sin confirmaciones todavia. */
  readonly sha: string | null;
}

export interface Etiqueta {
  /** El objeto al que apunta la referencia: la etiqueta anotada o la confirmacion. */
  readonly objeto: string;
  /** La confirmacion a la que se llega pelando las etiquetas anotadas. */
  readonly confirmacion: string | null;
  readonly anotada: boolean;
  readonly mensaje: string | null;
}

export interface Movimiento {
  readonly anterior: string;
  readonly nuevo: string;
  readonly mensaje: string;
}

export interface Referencias {
  readonly cabeza: Cabeza;
  readonly ramas: ReadonlyMap<string, string>;
  readonly etiquetas: ReadonlyMap<string, Etiqueta>;
  /** `origin/main` y compania, sin las `HEAD` simbolicas de cada remoto. */
  readonly remotas: ReadonlyMap<string, string>;
  /** Las entradas del guardado temporal, la mas nueva primero, como `stash@{n}`. */
  readonly guardados: readonly string[];
  /** El registro de movimientos de HEAD, en el orden del archivo: el mas viejo primero. */
  readonly movimientos: readonly Movimiento[];
  /** Referencias que no se pudieron resolver, con su motivo. */
  readonly rotas: readonly string[];
}

export class ReferenciaRota extends Error {}

const decodificador = new TextDecoder('utf-8');

export class LectorDeReferencias {
  private empaquetadas: Map<string, string> | null = null;

  constructor(
    private readonly fs: Adaptador,
    private readonly gitDir: readonly string[],
  ) {}

  private async texto(ruta: readonly string[]): Promise<string | null> {
    const bytes = await this.fs.leer([...this.gitDir, ...ruta]);
    return bytes === null ? null : decodificador.decode(bytes);
  }

  private async referenciasEmpaquetadas(): Promise<Map<string, string>> {
    if (this.empaquetadas !== null) return this.empaquetadas;
    const m = new Map<string, string>();
    const t = await this.texto(['packed-refs']);
    for (const linea of (t ?? '').split('\n')) {
      if (linea === '' || linea.startsWith('#') || linea.startsWith('^')) continue;
      const [sha, nombre] = linea.trim().split(' ');
      if (sha !== undefined && nombre !== undefined && SHA.test(sha)) m.set(nombre, sha);
    }
    this.empaquetadas = m;
    return m;
  }

  /**
   * Sigue una referencia hasta un identificador. Devuelve null si la rama no
   * existe (una rama recien creada sin confirmaciones) y lanza si el ciclo o la
   * profundidad pasan del limite de Git.
   */
  async resolver(nombre: string, profundidad = 0): Promise<string | null> {
    if (profundidad >= PROFUNDIDAD_MAXIMA) {
      throw new ReferenciaRota(`referencia simbolica con ${PROFUNDIDAD_MAXIMA} saltos o mas, o en ciclo`);
    }
    const suelta = await this.texto(nombre.split('/'));
    if (suelta !== null) {
      const v = suelta.trim();
      if (v.startsWith('ref: ')) return this.resolver(v.slice(5).trim(), profundidad + 1);
      if (!SHA.test(v)) throw new ReferenciaRota(`${nombre} no contiene un identificador`);
      return v;
    }
    return (await this.referenciasEmpaquetadas()).get(nombre) ?? null;
  }

  /** Todos los nombres de referencia bajo `refs/<carpeta>`, sueltos y empaquetados, sin los `.lock`. */
  private async nombres(carpeta: string): Promise<string[]> {
    const nombres = new Set<string>();
    const prefijo = `refs/${carpeta}/`;
    for (const nombre of (await this.referenciasEmpaquetadas()).keys()) if (nombre.startsWith(prefijo)) nombres.add(nombre);
    const recorrer = async (partes: string[]): Promise<void> => {
      for (const entrada of (await this.fs.listar([...this.gitDir, ...partes])) ?? []) {
        if (entrada.nombre.endsWith('.lock')) continue;
        const ruta = [...partes, entrada.nombre];
        if (entrada.esDirectorio) await recorrer(ruta);
        else nombres.add(ruta.join('/'));
      }
    };
    await recorrer(['refs', ...carpeta.split('/')]);
    return [...nombres].sort();
  }

  private async todas(carpeta: string, rotas: string[]): Promise<Map<string, string>> {
    const m = new Map<string, string>();
    for (const nombre of await this.nombres(carpeta)) {
      try {
        const sha = await this.resolver(nombre);
        if (sha !== null) m.set(nombre.slice(`refs/${carpeta}/`.length), sha);
      } catch (e) {
        if (!(e instanceof ReferenciaRota)) throw e;
        rotas.push(`${nombre}: ${e.message}`);
      }
    }
    return m;
  }

  async cabeza(): Promise<Cabeza> {
    const h = await this.texto(['HEAD']);
    if (h === null) throw new Error('no encuentro .git/HEAD. ¿Elegiste la carpeta de un repositorio?');
    const v = h.trim();
    if (!v.startsWith('ref: ')) return { rama: null, sha: v };
    const destino = v.slice(5).trim();
    return { rama: destino.replace(/^refs\/heads\//, ''), sha: await this.resolver(destino, 1) };
  }

  /** El mensaje de cada linea del registro, despues del tabulador. */
  private async registro(ruta: readonly string[]): Promise<Movimiento[]> {
    const t = await this.texto(['logs', ...ruta]);
    const movimientos: Movimiento[] = [];
    for (const linea of (t ?? '').split('\n')) {
      const m = /^([0-9a-f]{40}) ([0-9a-f]{40}) [^\t]*(?:\t(.*))?$/.exec(linea);
      if (m !== null) movimientos.push({ anterior: m[1] ?? '', nuevo: m[2] ?? '', mensaje: m[3] ?? '' });
    }
    return movimientos;
  }

  async leer(almacen: Almacen): Promise<Referencias> {
    this.empaquetadas = null;
    const rotas: string[] = [];
    const cabeza = await this.cabeza();
    const ramas = await this.todas('heads', rotas);
    const remotasCrudas = await this.todas('remotes', rotas);
    const remotas = new Map([...remotasCrudas].filter(([nombre]) => !nombre.endsWith('/HEAD')));

    const etiquetas = new Map<string, Etiqueta>();
    for (const [nombre, objeto] of await this.todas('tags', rotas)) {
      let actual = objeto;
      let anotada = false;
      let mensaje: string | null = null;
      let confirmacion: string | null = null;
      // Una etiqueta puede apuntar a otra etiqueta; se pela hasta llegar a algo que no lo sea.
      for (let salto = 0; salto < 16; salto += 1) {
        const obj = await almacen.objeto(actual);
        if (obj.tipo === 'tag') {
          const etiqueta = leerEtiqueta(obj.datos);
          if (!anotada) mensaje = etiqueta.mensaje;
          anotada = true;
          actual = etiqueta.objeto;
          continue;
        }
        if (obj.tipo === 'commit') confirmacion = actual;
        break;
      }
      etiquetas.set(nombre, { objeto, confirmacion, anotada, mensaje });
    }

    // `git stash list` lee el registro de refs/stash, el mas nuevo primero.
    const guardados = (await this.registro(['refs', 'stash'])).map((m) => m.nuevo).reverse();
    if (guardados.length === 0) {
      const unico = await this.resolver('refs/stash').catch(() => null);
      if (unico !== null) guardados.push(unico);
    }

    return { cabeza, ramas, etiquetas, remotas, guardados, movimientos: await this.registro(['HEAD']), rotas };
  }
}

/** Las confirmaciones de borde de un clon superficial: sus padres no estan y no se buscan. */
export async function leerSuperficiales(fs: Adaptador, gitDir: readonly string[]): Promise<ReadonlySet<string>> {
  const bytes = await fs.leer([...gitDir, 'shallow']);
  if (bytes === null) return new Set();
  return new Set(decodificador.decode(bytes).split('\n').map((l) => l.trim()).filter((l) => SHA.test(l)));
}
