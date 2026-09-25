/**
 * Saber si el repositorio cambio sin volver a leerlo entero (SPEC 020, 2.7, y
 * SPEC 024, 2.3).
 *
 * En cada vuelta del sondeo se arma una marca con el tamaño y la fecha de
 * modificacion de lo que puede cambiar lo que la pantalla muestra. Si la marca
 * es la misma que la anterior, no se lee nada mas. Es el mismo primer filtro
 * que usa Git para no abrir los archivos que no cambiaron.
 *
 * Entran dos cosas:
 *
 * - Dentro de `.git`, los archivos que Git toca en cada orden: HEAD, el
 *   indice, las referencias sueltas y empaquetadas y el registro de
 *   movimientos.
 * - El directorio de trabajo, **como lo mira `git status`**: lo que el
 *   `.gitignore` excluye no entra, salvo los archivos que Git sigue igual. Un
 *   `echo` sobre un archivo no toca nada dentro de `.git`, y sin esta parte la
 *   pantalla no se enteraria hasta la siguiente orden de Git.
 *
 * Para saber que archivos sigue Git hay que leer el indice, y para las reglas,
 * cada `.gitignore`. Los dos se guardan de una vuelta a otra y se vuelven a
 * leer solo si su tamaño o su fecha cambiaron.
 *
 * Si Git esta escribiendo (hay un `index.lock`), la marca es `null`: se espera
 * a la siguiente vuelta en vez de leer un indice a medio escribir.
 */

import type { Adaptador, DatosArchivo, EntradaConDatos } from './adaptador';
import { leerConfiguracion, verdadero } from './config';
import { excluida, type GrupoDeReglas, leerReglas } from './ignorar';
import { leerIndice } from './indice';

/** Lo que se mira en la raiz de `.git`, en `.git/logs` y en `.git/info`. */
const EN_GIT = ['HEAD', 'index', 'packed-refs', 'MERGE_HEAD', 'REVERT_HEAD', 'CHERRY_PICK_HEAD', 'ORIG_HEAD', 'config'];

const decodificador = new TextDecoder('utf-8');

function firma(datos: DatosArchivo | null): string {
  return datos === null ? '-' : `${datos.tamano}:${datos.modificado}`;
}

/** Lo que cuesta vigilar: se muestra en las pruebas y en el informe (CA5). */
export interface EstadisticaDeVigilancia {
  /** Archivos cuyo tamaño y fecha se miraron en la ultima vuelta, tambien los ignorados de las carpetas recorridas. */
  archivos: number;
  /** Carpetas que se listaron en la ultima vuelta. */
  carpetas: number;
  /** Milisegundos que tomo la ultima vuelta. */
  ms: number;
}

export class Vigia {
  private indice = { firma: '', seguidos: new Set<string>(), carpetas: new Set<string>() };
  private configuracion = { firma: '', ignorarMayusculas: false };
  /** Las reglas de cada `.gitignore` y de `info/exclude`, por ruta, con la firma con que se leyeron. */
  private readonly reglas = new Map<string, { firma: string; grupo: GrupoDeReglas }>();
  readonly estadistica: EstadisticaDeVigilancia = { archivos: 0, carpetas: 0, ms: 0 };

  constructor(private readonly fs: Adaptador) {}

  async marca(): Promise<string | null> {
    const inicio = performance.now();
    this.estadistica.archivos = 0;
    this.estadistica.carpetas = 0;
    const git = await this.listar(['.git']);
    const datosDe = (lista: readonly EntradaConDatos[] | null, nombre: string): string =>
      firma(lista?.find((e) => e.nombre === nombre && !e.esDirectorio)?.datos ?? null);
    if (git?.some((e) => e.nombre === 'index.lock')) return null;

    const partes: string[] = [];
    for (const nombre of EN_GIT) partes.push(`${nombre}:${datosDe(git, nombre)}`);
    const tiene = (carpeta: string): boolean => git?.some((e) => e.nombre === carpeta && e.esDirectorio) ?? false;
    const logs = tiene('logs') ? await this.listar(['.git', 'logs']) : null;
    partes.push(`logs/HEAD:${datosDe(logs, 'HEAD')}`);
    const info = tiene('info') ? await this.listar(['.git', 'info']) : null;
    const exclude = datosDe(info, 'exclude');
    partes.push(`info/exclude:${exclude}`);
    // Las ramas y etiquetas sueltas, el guardado temporal y un rebase a medio hacer.
    for (const carpeta of ['refs', 'rebase-merge', 'rebase-apply']) {
      if (tiene(carpeta)) await this.recorrerTodo(['.git', carpeta], partes);
    }

    await this.conocerIndice(datosDe(git, 'index'));
    await this.conocerConfiguracion(datosDe(git, 'config'));
    const base = await this.grupo('.git/info/exclude', ['.git', 'info', 'exclude'], '', exclude);
    await this.recorrerTrabajo([], base === null ? [] : [base], false, partes);

    this.estadistica.ms = Math.round((performance.now() - inicio) * 10) / 10;
    return partes.join('\n');
  }

  private async listar(carpeta: readonly string[]): Promise<readonly EntradaConDatos[] | null> {
    const lista = await this.fs.listarConDatos(carpeta);
    if (lista === null) return null;
    this.estadistica.carpetas += 1;
    this.estadistica.archivos += lista.filter((e) => !e.esDirectorio).length;
    return [...lista].sort((a, b) => (a.nombre < b.nombre ? -1 : 1));
  }

  /** Una carpeta de `.git`, entera. */
  private async recorrerTodo(carpeta: readonly string[], partes: string[]): Promise<void> {
    const lista = await this.listar(carpeta);
    if (lista === null) return;
    for (const entrada of lista) {
      const ruta = [...carpeta, entrada.nombre];
      if (entrada.esDirectorio) {
        partes.push(`${ruta.join('/')}/`);
        await this.recorrerTodo(ruta, partes);
      } else partes.push(`${ruta.join('/')}:${firma(entrada.datos)}`);
    }
  }

  /**
   * El directorio de trabajo, como lo recorre `git status`: una carpeta
   * excluida se salta entera, salvo que Git siga archivos adentro, y entonces
   * solo cuentan esos.
   */
  private async recorrerTrabajo(
    carpeta: readonly string[],
    grupos: readonly GrupoDeReglas[],
    dentroDeExcluida: boolean,
    partes: string[],
  ): Promise<void> {
    const lista = await this.listar(carpeta);
    if (lista === null) return;
    const prefijo = carpeta.join('/');
    const rutaDe = (nombre: string): string => (prefijo === '' ? nombre : `${prefijo}/${nombre}`);

    let propios = grupos;
    const ignorar = lista.find((e) => e.nombre === '.gitignore' && !e.esDirectorio);
    if (ignorar !== undefined) {
      const grupo = await this.grupo(rutaDe('.gitignore'), [...carpeta, '.gitignore'], prefijo, firma(ignorar.datos));
      if (grupo !== null) propios = [grupo, ...grupos];
    }

    for (const entrada of lista) {
      // La carpeta del repositorio va por su lado; la de un repositorio anidado no es del directorio de trabajo.
      if (entrada.nombre === '.git') continue;
      const ruta = rutaDe(entrada.nombre);
      if (entrada.esDirectorio) {
        const esExcluida = dentroDeExcluida || excluida(propios, ruta, true) === true;
        if (esExcluida && !this.indice.carpetas.has(ruta)) continue;
        partes.push(`${ruta}/`);
        await this.recorrerTrabajo([...carpeta, entrada.nombre], propios, esExcluida, partes);
        continue;
      }
      const cuenta =
        this.indice.seguidos.has(ruta) || (!dentroDeExcluida && excluida(propios, ruta, false) !== true);
      if (cuenta) partes.push(`${ruta}:${firma(entrada.datos)}`);
    }
  }

  /** Las reglas de un archivo de exclusiones, leidas de nuevo solo si el archivo cambio. */
  private async grupo(
    clave: string,
    ruta: readonly string[],
    base: string,
    firmaActual: string,
  ): Promise<GrupoDeReglas | null> {
    if (firmaActual === '-') {
      this.reglas.delete(clave);
      return null;
    }
    const guardado = this.reglas.get(clave);
    if (guardado !== undefined && guardado.firma === firmaActual) return guardado.grupo;
    const texto = await this.fs.leer(ruta);
    if (texto === null) return null;
    const grupo = leerReglas(decodificador.decode(texto), base, this.configuracion.ignorarMayusculas);
    this.reglas.set(clave, { firma: firmaActual, grupo });
    return grupo;
  }

  /** Que archivos sigue Git, del indice, releido solo si cambio. */
  private async conocerIndice(firmaActual: string): Promise<void> {
    if (firmaActual === this.indice.firma) return;
    const seguidos = new Set<string>();
    const carpetas = new Set<string>();
    const bytes = firmaActual === '-' ? null : await this.fs.leer(['.git', 'index']);
    if (bytes !== null) {
      try {
        for (const entrada of leerIndice(bytes).entradas) {
          seguidos.add(entrada.ruta);
          const partes = entrada.ruta.split('/');
          for (let k = 1; k < partes.length; k += 1) carpetas.add(partes.slice(0, k).join('/'));
        }
      } catch {
        // Un indice que no se sabe leer: el lector lo dira; aqui basta con vigilar sin el.
      }
    }
    this.indice = { firma: firmaActual, seguidos, carpetas };
  }

  /** `core.ignorecase` cambia como se leen las reglas: si cambia, se vuelven a leer todas. */
  private async conocerConfiguracion(firmaActual: string): Promise<void> {
    if (firmaActual === this.configuracion.firma) return;
    const bytes = firmaActual === '-' ? null : await this.fs.leer(['.git', 'config']);
    const ignorarMayusculas =
      bytes !== null && verdadero(leerConfiguracion(decodificador.decode(bytes)), 'core.ignorecase');
    if (ignorarMayusculas !== this.configuracion.ignorarMayusculas) this.reglas.clear();
    this.configuracion = { firma: firmaActual, ignorarMayusculas };
  }
}

/** Una marca suelta, sin recordar nada de una vuelta anterior. */
export async function marcaDelRepositorio(fs: Adaptador): Promise<string | null> {
  return new Vigia(fs).marca();
}
