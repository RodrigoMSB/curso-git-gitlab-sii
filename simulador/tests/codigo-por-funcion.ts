/**
 * El codigo del motor leido por funcion, no por archivo (seccion 59 de
 * docs/arquitectura.md).
 *
 * La prueba del contrato buscaba cada opcion en todo `src/core` junto. Asi
 * `git checkout --detach` pasaba por bueno porque `'--detach'` aparecia en la
 * funcion de `git switch`, dos pantallas mas arriba en el mismo archivo. Lo
 * que la prueba tiene que preguntar es otra cosa: si el codigo que **ese
 * subcomando** llega a ejecutar lee la opcion.
 *
 * TypeScript 7 no trae API programatica estable (seccion 1), asi que esto no
 * arma un arbol de sintaxis. Se apoya en dos convenciones que el motor cumple
 * entero: toda declaracion de primer nivel empieza en la columna cero, y los
 * modulos se importan con rutas relativas. Con eso alcanza para partir cada
 * archivo en declaraciones y seguir quien nombra a quien.
 *
 * Lo que devuelve es una cota por arriba: el codigo que el subcomando **puede**
 * ejecutar, siguiendo todo nombre que aparezca, se llame o no. Si una opcion no
 * esta ahi, con seguridad nadie la lee. Si esta, alguien la lee, aunque no se
 * sabe si con los argumentos de este subcomando: eso ya es flujo de datos.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';

/** Una declaracion de primer nivel: su nombre y su texto, sin comentarios. */
interface Declaracion {
  readonly archivo: string;
  readonly nombre: string;
  readonly cuerpo: string;
}

interface Modulo {
  readonly declaraciones: ReadonlyMap<string, Declaracion>;
  /** Nombre local importado → archivo de origen y nombre exportado alla. */
  readonly importados: ReadonlyMap<string, { readonly archivo: string; readonly nombre: string }>;
}

/**
 * Quita los comentarios y deja las cadenas.
 *
 * Los comentarios del motor citan opciones todo el tiempo —«`--detach` esta
 * declarado para checkout»— y una cita no es una lectura. Se recorre caracter
 * por caracter para no confundir un `//` dentro de una cadena con un
 * comentario. Los saltos de linea se conservan, porque la particion en
 * declaraciones se hace por linea.
 */
export function sinComentarios(texto: string): string {
  let resultado = '';
  let comilla: string | null = null;
  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i] ?? '';
    const siguiente = texto[i + 1] ?? '';
    if (comilla !== null) {
      resultado += caracter;
      if (caracter === '\\') {
        resultado += siguiente;
        i += 1;
      } else if (caracter === comilla) {
        comilla = null;
      }
      continue;
    }
    if (caracter === '/' && siguiente === '/') {
      while (i < texto.length && texto[i] !== '\n') i += 1;
      resultado += '\n';
      continue;
    }
    if (caracter === '/' && siguiente === '*') {
      i += 2;
      while (i < texto.length && !(texto[i] === '*' && texto[i + 1] === '/')) {
        if (texto[i] === '\n') resultado += '\n';
        i += 1;
      }
      i += 1;
      continue;
    }
    if (caracter === "'" || caracter === '"' || caracter === '`') comilla = caracter;
    resultado += caracter;
  }
  return resultado;
}

const INICIO = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type)\s+([A-Za-z_$][\w$]*)/;

function leerModulo(raiz: string, archivo: string): Modulo {
  const texto = sinComentarios(readFileSync(join(raiz, archivo), 'utf8'));

  const importados = new Map<string, { archivo: string; nombre: string }>();
  for (const importacion of texto.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(\.[^']+)'/gm)) {
    const origen = normalize(join(dirname(archivo), `${importacion[2] ?? ''}.ts`));
    for (const pieza of (importacion[1] ?? '').split(',')) {
      const partes = pieza.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/);
      const exportado = partes[0]?.trim();
      const local = (partes[1] ?? partes[0])?.trim();
      if (exportado && local) importados.set(local, { archivo: origen, nombre: exportado });
    }
  }

  const declaraciones = new Map<string, Declaracion>();
  let actual: { nombre: string; lineas: string[] } | null = null;
  const cerrar = (): void => {
    if (actual === null) return;
    declaraciones.set(actual.nombre, { archivo, nombre: actual.nombre, cuerpo: actual.lineas.join('\n') });
    actual = null;
  };
  for (const linea of texto.split('\n')) {
    const inicio = INICIO.exec(linea);
    if (inicio !== null) {
      cerrar();
      actual = { nombre: inicio[1] ?? '', lineas: [linea] };
    } else if (/^(import|export\s*\{)/.test(linea)) {
      cerrar();
    } else if (actual !== null) {
      actual.lineas.push(linea);
    }
  }
  cerrar();

  return { declaraciones, importados };
}

/** El motor partido en declaraciones, listo para preguntarle que alcanza cada una. */
export class CodigoPorFuncion {
  private readonly modulos = new Map<string, Modulo>();

  constructor(private readonly raiz: string) {
    const archivos = readdirSync(raiz, { recursive: true, encoding: 'utf8' }).filter((nombre) =>
      nombre.endsWith('.ts'),
    );
    for (const archivo of archivos) this.modulos.set(normalize(archivo), leerModulo(raiz, archivo));
  }

  /** La declaracion que un nombre local de un archivo designa, siguiendo la importacion. */
  resolver(archivo: string, nombre: string): Declaracion | undefined {
    const modulo = this.modulos.get(normalize(archivo));
    if (modulo === undefined) return undefined;
    const propia = modulo.declaraciones.get(nombre);
    if (propia !== undefined) return propia;
    const importado = modulo.importados.get(nombre);
    if (importado === undefined) return undefined;
    return this.modulos.get(importado.archivo)?.declaraciones.get(importado.nombre);
  }

  /**
   * El texto de todo lo que `inicio` puede ejecutar: su cuerpo y, de forma
   * transitiva, el de cada declaracion que nombra.
   *
   * `excluir` corta el recorrido en esas declaraciones. Se usa para los
   * archivos que declaran y no ejecutan, como el contrato, y para no entrar
   * en el manejador de **otro** subcomando.
   */
  alcanzable(inicio: Declaracion, excluir: (declaracion: Declaracion) => boolean): string {
    const vistas = new Set<string>();
    const cuerpos: string[] = [];
    const pendientes: Declaracion[] = [inicio];
    while (pendientes.length > 0) {
      const declaracion = pendientes.pop();
      if (declaracion === undefined) break;
      const clave = `${declaracion.archivo}#${declaracion.nombre}`;
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      cuerpos.push(declaracion.cuerpo);
      for (const [nombre] of declaracion.cuerpo.matchAll(/[A-Za-z_$][\w$]*/g)) {
        const nombrada = this.resolver(declaracion.archivo, nombre);
        if (nombrada === undefined || nombrada === declaracion) continue;
        if (nombrada !== inicio && excluir(nombrada)) continue;
        pendientes.push(nombrada);
      }
    }
    return cuerpos.join('\n');
  }

  /**
   * Los pares `clave: identificador` de un objeto literal de primer nivel,
   * resueltos a la declaracion que cada identificador designa.
   *
   * Es como se lee la tabla del despachador: `mv: ordenMvInterprete` lleva al
   * `ordenMv` de `interprete.ts` y no al de `archivos.ts`, que se llama igual.
   */
  tabla(archivo: string, nombre: string): ReadonlyMap<string, Declaracion> {
    const declaracion = this.resolver(archivo, nombre);
    if (declaracion === undefined) throw new Error(`no existe ${nombre} en ${archivo}`);
    const entradas = new Map<string, Declaracion>();
    for (const par of declaracion.cuerpo.matchAll(/^\s*'?([\w-]+)'?\s*:\s*([A-Za-z_$][\w$]*)\s*,?\s*$/gm)) {
      const destino = this.resolver(archivo, par[2] ?? '');
      if (destino === undefined) throw new Error(`${nombre}.${par[1]} no lleva a ninguna declaracion`);
      entradas.set(par[1] ?? '', destino);
    }
    return entradas;
  }

  /** Ruta relativa, para los mensajes. */
  ruta(declaracion: Declaracion): string {
    return relative(this.raiz, join(this.raiz, declaracion.archivo));
  }
}
