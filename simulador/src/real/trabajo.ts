/**
 * Las tres areas de un repositorio real, calculadas como las calcula
 * `git status` (SPEC 020, 2.3, 2.4 y 2.6).
 *
 * Son dos comparaciones. El arbol de HEAD contra el indice da la primera
 * columna del estado corto, lo preparado. El indice contra el disco da la
 * segunda, lo modificado sin preparar, y lo que esta en el disco sin estar en
 * el indice ni excluido es lo no seguido. Los conflictos salen del indice: una
 * ruta con entradas en etapas mayores que cero.
 *
 * El resultado tiene la forma de `git status --porcelain`, dos letras y la
 * ruta, porque contra eso se prueba. Lo que la pantalla dibuja se arma
 * despues, a partir de esto.
 *
 * ## Lo que no se ve desde el navegador
 *
 * El navegador no da el modo de los archivos. Un `chmod +x` es un cambio para
 * Git en Linux y en Mac, y aqui no se ve; en Windows Git tampoco lo ve, porque
 * ahi `core.fileMode` vale `false`. Los enlaces simbolicos y los submodulos se
 * comparan solo por su presencia.
 */

import type { Adaptador } from './adaptador';
import type { Almacen } from './almacen';
import { type Atributos, type Autocrlf, aRepositorio, tieneCrlf } from './finales';
import { excluida, type GrupoDeReglas, leerReglas } from './ignorar';
import type { EntradaIndice, Indice } from './indice';
import { leerArbol } from './objetosGit';
import { huellaDeArchivo } from './sha1';

export interface Cambio {
  /** Primera columna del estado corto: HEAD contra el indice. */
  readonly x: string;
  /** Segunda columna: el indice contra el disco. */
  readonly y: string;
  readonly ruta: string;
  /** La ruta de antes, en un renombrado. */
  readonly origen?: string;
}

interface EnArbol {
  readonly sha: string;
  readonly modo: string;
}

export interface Contexto {
  readonly indice: Indice;
  /** El arbol de la confirmacion de HEAD, o null en una rama sin confirmaciones. */
  readonly arbolCabeza: string | null;
  readonly autocrlf: Autocrlf;
  readonly atributos: Atributos;
  readonly ignorarMayusculas: boolean;
  /** Fecha del archivo `index`, para no fiarse de archivos tocados en el mismo instante. */
  readonly fechaIndice: number;
}

const CONFLICTOS: Readonly<Record<string, string>> = {
  '123': 'UU',
  '23': 'AA',
  '1': 'DD',
  '2': 'AU',
  '3': 'UA',
  '12': 'UD',
  '13': 'DU',
};

const decodificador = new TextDecoder('utf-8');

export class LectorDeTrabajo {
  /** Huellas ya calculadas, por ruta, tamaño y fecha: el sondeo repite lecturas cada medio segundo. */
  private readonly huellas = new Map<string, string>();
  private readonly arboles = new Map<string, ReadonlyMap<string, EnArbol>>();
  readonly estadistica = { huellasCalculadas: 0 };

  constructor(
    private readonly fs: Adaptador,
    private readonly gitDir: readonly string[],
    private readonly almacen: Almacen,
  ) {}

  /** Todas las rutas de un arbol, con su identificador y modo. */
  async aplanar(arbol: string): Promise<ReadonlyMap<string, EnArbol>> {
    const ya = this.arboles.get(arbol);
    if (ya !== undefined) return ya;
    const plano = new Map<string, EnArbol>();
    const recorrer = async (sha: string, prefijo: string): Promise<void> => {
      const objeto = await this.almacen.objeto(sha);
      for (const entrada of leerArbol(objeto.datos)) {
        const ruta = `${prefijo}${entrada.nombre}`;
        if (entrada.modo === '40000') await recorrer(entrada.sha, `${ruta}/`);
        else plano.set(ruta, { sha: entrada.sha, modo: entrada.modo });
      }
    };
    await recorrer(arbol, '');
    this.arboles.set(arbol, plano);
    return plano;
  }

  /** La huella que tendria el archivo del disco si se preparara, o null si no esta. */
  private async huellaEnDisco(entrada: EntradaIndice, contexto: Contexto): Promise<string | null> {
    const partes = entrada.ruta.split('/');
    const datos = await this.fs.datos(partes);
    if (datos === null) return null;
    const modificado = Math.floor(datos.modificado);
    const anotado = entrada.mtimeSegundos * 1000 + Math.floor(entrada.mtimeNanos / 1e6);
    // Mismo tamaño y misma fecha que Git anoto: no cambio, salvo que se haya
    // tocado en el mismo instante en que se escribio el indice. Git mira ese
    // instante en nanosegundos; el navegador solo da milisegundos, asi que
    // todo el milisegundo en que se escribio el indice cuenta como dudoso.
    if (datos.tamano === entrada.tamano && modificado === anotado && modificado < Math.floor(contexto.fechaIndice)) {
      return entrada.sha;
    }
    const clave = `${entrada.ruta}\0${datos.tamano}\0${modificado}\0${entrada.sha}`;
    const guardada = this.huellas.get(clave);
    if (guardada !== undefined) return guardada;
    const contenido = await this.fs.leer(partes);
    if (contenido === null) return null;
    const convertido = await aRepositorio(contenido, entrada.ruta, contexto.autocrlf, contexto.atributos, async () =>
      tieneCrlf((await this.almacen.objeto(entrada.sha)).datos),
    );
    const huella = huellaDeArchivo(convertido);
    this.estadistica.huellasCalculadas += 1;
    this.huellas.set(clave, huella);
    return huella;
  }

  async estado(contexto: Contexto): Promise<readonly Cambio[]> {
    const cabeza = contexto.arbolCabeza === null ? new Map<string, EnArbol>() : await this.aplanar(contexto.arbolCabeza);
    const preparadas = new Map<string, EntradaIndice>();
    const etapas = new Map<string, string>();
    for (const entrada of contexto.indice.entradas) {
      if (entrada.etapa === 0) preparadas.set(entrada.ruta, entrada);
      else etapas.set(entrada.ruta, `${etapas.get(entrada.ruta) ?? ''}${entrada.etapa}`);
    }

    const cambios: Cambio[] = [];
    const agregadas: string[] = [];
    const quitadas: string[] = [];
    const segunda = new Map<string, string>();

    for (const [ruta, entrada] of preparadas) {
      let y = ' ';
      if (entrada.intencion) y = 'A';
      else if (!entrada.suponerIgual && entrada.modo !== 0o160000) {
        const huella = await this.huellaEnDisco(entrada, contexto);
        if (huella === null) y = 'D';
        else if (huella !== entrada.sha) y = 'M';
      }
      segunda.set(ruta, y);
      const enCabeza = cabeza.get(ruta);
      if (entrada.intencion) continue;
      if (enCabeza === undefined) agregadas.push(ruta);
    }
    for (const ruta of cabeza.keys()) if (!preparadas.has(ruta) && !etapas.has(ruta)) quitadas.push(ruta);

    // Renombrados exactos: lo que se quito y lo que se agrego con el mismo contenido.
    const renombradas = new Map<string, string>();
    const libres = new Map<string, string[]>();
    for (const ruta of quitadas) {
      const sha = cabeza.get(ruta)?.sha ?? '';
      libres.set(sha, [...(libres.get(sha) ?? []), ruta]);
    }
    for (const ruta of agregadas) {
      const sha = preparadas.get(ruta)?.sha ?? '';
      const candidatas = libres.get(sha);
      if (candidatas === undefined || candidatas.length === 0) continue;
      // Si hay varias, la del mismo nombre suelto, como prefiere Git.
      const nombre = ruta.slice(ruta.lastIndexOf('/') + 1);
      const k = Math.max(0, candidatas.findIndex((c) => c.slice(c.lastIndexOf('/') + 1) === nombre));
      const [origen] = candidatas.splice(k, 1);
      if (origen !== undefined) renombradas.set(ruta, origen);
    }
    const origenes = new Set(renombradas.values());

    for (const [ruta, entrada] of preparadas) {
      const y = segunda.get(ruta) ?? ' ';
      const enCabeza = cabeza.get(ruta);
      let x = ' ';
      const origen = renombradas.get(ruta);
      if (entrada.intencion) x = ' ';
      else if (origen !== undefined) x = 'R';
      else if (enCabeza === undefined) x = 'A';
      else if (enCabeza.sha !== entrada.sha || Number.parseInt(enCabeza.modo, 8) !== entrada.modo) x = 'M';
      if (x !== ' ' || y !== ' ') cambios.push(origen === undefined ? { x, y, ruta } : { x, y, ruta, origen });
    }
    for (const ruta of quitadas) if (!origenes.has(ruta)) cambios.push({ x: 'D', y: ' ', ruta });
    for (const [ruta, cuales] of etapas) {
      const codigo = CONFLICTOS[[...cuales].sort().join('')] ?? 'UU';
      cambios.push({ x: codigo[0] ?? 'U', y: codigo[1] ?? 'U', ruta });
    }

    const seguidas = new Set([...preparadas.keys(), ...etapas.keys()]);
    for (const ruta of await this.noSeguidas(seguidas, contexto.ignorarMayusculas)) cambios.push({ x: '?', y: '?', ruta });
    return cambios;
  }

  /**
   * Lo que esta en el disco sin estar en el indice ni excluido, agrupado como
   * lo agrupa `git status`: una carpeta sin nada seguido adentro se nombra
   * entera, con barra al final, y no se abre.
   */
  private async noSeguidas(seguidas: ReadonlySet<string>, ignorarMayusculas: boolean): Promise<string[]> {
    const carpetasSeguidas = new Set<string>();
    for (const ruta of seguidas) {
      const partes = ruta.split('/');
      for (let k = 1; k < partes.length; k += 1) carpetasSeguidas.add(partes.slice(0, k).join('/'));
    }
    const excluir = await this.fs.leer([...this.gitDir, 'info', 'exclude']);
    const base: GrupoDeReglas[] =
      excluir === null ? [] : [leerReglas(decodificador.decode(excluir), '', ignorarMayusculas)];

    const salida: string[] = [];

    /** Si en la carpeta hay algo no seguido y no excluido, a cualquier profundidad. */
    const tieneAlgo = async (carpeta: string, grupos: readonly GrupoDeReglas[]): Promise<boolean> => {
      const propios = await this.gruposDe(carpeta, grupos, ignorarMayusculas);
      for (const entrada of (await this.fs.listar(carpeta.split('/'))) ?? []) {
        const ruta = `${carpeta}/${entrada.nombre}`;
        if (entrada.nombre === '.git') return true;
        if (excluida(propios, ruta, entrada.esDirectorio) === true) continue;
        if (!entrada.esDirectorio || (await tieneAlgo(ruta, propios))) return true;
      }
      return false;
    };

    // `dentroDeExcluida`: una carpeta excluida que igual tiene archivos seguidos
    // se recorre por ellos, pero lo no seguido de adentro sigue excluido.
    const recorrer = async (carpeta: string, grupos: readonly GrupoDeReglas[], dentroDeExcluida: boolean): Promise<void> => {
      const propios = await this.gruposDe(carpeta, grupos, ignorarMayusculas);
      const lista = (await this.fs.listar(carpeta === '' ? [] : carpeta.split('/'))) ?? [];
      for (const entrada of [...lista].sort((a, b) => (a.nombre < b.nombre ? -1 : 1))) {
        if (carpeta === '' && entrada.nombre === '.git') continue;
        const ruta = carpeta === '' ? entrada.nombre : `${carpeta}/${entrada.nombre}`;
        if (!entrada.esDirectorio) {
          if (!seguidas.has(ruta) && !dentroDeExcluida && excluida(propios, ruta, false) !== true) salida.push(ruta);
          continue;
        }
        const esExcluida = dentroDeExcluida || excluida(propios, ruta, true) === true;
        if (carpetasSeguidas.has(ruta)) {
          await recorrer(ruta, propios, esExcluida);
          continue;
        }
        if (esExcluida) continue;
        // Otro repositorio adentro: Git lo muestra como una carpeta no seguida.
        const anidado = (await this.fs.listar([...ruta.split('/'), '.git'])) !== null;
        if (anidado || (await tieneAlgo(ruta, propios))) salida.push(`${ruta}/`);
      }
    };

    await recorrer('', base, false);
    return salida;
  }

  /** Las reglas que rigen dentro de una carpeta: su `.gitignore` primero, despues las de afuera. */
  private async gruposDe(
    carpeta: string,
    grupos: readonly GrupoDeReglas[],
    ignorarMayusculas: boolean,
  ): Promise<readonly GrupoDeReglas[]> {
    const texto = await this.fs.leer([...(carpeta === '' ? [] : carpeta.split('/')), '.gitignore']);
    if (texto === null) return grupos;
    return [leerReglas(decodificador.decode(texto), carpeta, ignorarMayusculas), ...grupos];
  }
}
