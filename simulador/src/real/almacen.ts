/**
 * Los objetos de un repositorio real: sueltos y empaquetados (SPEC 020).
 *
 * Viene del `nucleo.js` del arquitecto. Lo que cambio en la revision:
 *
 * - Las cadenas de deltas se resuelven iterando, no por recursion, y cada base
 *   ya resuelta se guarda por su posicion en el paquete. La version original
 *   volvia a descomprimir la cadena entera por cada objeto: con una cadena de
 *   trescientas versiones eran cuarenta y cinco mil descompresiones.
 * - El delta comprueba que su base tenga el largo que declara, y que ninguna
 *   copia se salga de ella.
 * - El largo de un objeto suelto se comprueba contra su cabecera.
 */

import type { Adaptador } from './adaptador';
import { inflar } from './zlib';

export type TipoObjeto = 'commit' | 'tree' | 'blob' | 'tag';

export interface Objeto {
  readonly tipo: TipoObjeto;
  readonly datos: Uint8Array;
}

const TIPOS: Readonly<Record<number, TipoObjeto>> = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };

const HEX: string[] = [];
for (let i = 0; i < 256; i += 1) HEX.push(i.toString(16).padStart(2, '0'));

/** Veinte bytes desde `desde`, en hexadecimal. */
export function aHex(bytes: Uint8Array, desde = 0): string {
  let texto = '';
  for (let k = 0; k < 20; k += 1) texto += HEX[bytes[desde + k] ?? 0];
  return texto;
}

function deHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(20);
  for (let k = 0; k < 20; k += 1) bytes[k] = Number.parseInt(hex.slice(k * 2, k * 2 + 2), 16);
  return bytes;
}

function u32(bytes: Uint8Array, i: number): number {
  return (((bytes[i] ?? 0) << 24) >>> 0) + ((bytes[i + 1] ?? 0) << 16) + ((bytes[i + 2] ?? 0) << 8) + (bytes[i + 3] ?? 0);
}

/** Un entero de largo variable de los deltas: siete bits por byte, el menos significativo primero. */
function variable(d: Uint8Array, posicion: { i: number }): number {
  let valor = 0;
  let desplazamiento = 0;
  let c: number;
  do {
    c = d[posicion.i] ?? 0;
    posicion.i += 1;
    valor += (c & 0x7f) * 2 ** desplazamiento;
    desplazamiento += 7;
  } while (c & 0x80);
  return valor;
}

export function aplicarDelta(base: Uint8Array, delta: Uint8Array): Uint8Array {
  const posicion = { i: 0 };
  const largoBase = variable(delta, posicion);
  if (largoBase !== base.length) throw new Error(`delta sobre una base de ${largoBase} bytes, y la base tiene ${base.length}`);
  const largo = variable(delta, posicion);
  const salida = new Uint8Array(largo);
  let o = 0;
  while (posicion.i < delta.length) {
    const op = delta[posicion.i] ?? 0;
    posicion.i += 1;
    if (op & 0x80) {
      let desde = 0;
      let cuanto = 0;
      const leer = (): number => {
        const b = delta[posicion.i] ?? 0;
        posicion.i += 1;
        return b;
      };
      if (op & 1) desde += leer();
      if (op & 2) desde += leer() * 0x100;
      if (op & 4) desde += leer() * 0x10000;
      if (op & 8) desde += leer() * 0x1000000;
      if (op & 16) cuanto += leer();
      if (op & 32) cuanto += leer() * 0x100;
      if (op & 64) cuanto += leer() * 0x10000;
      if (cuanto === 0) cuanto = 0x10000;
      if (desde + cuanto > base.length || o + cuanto > largo) throw new Error('copia del delta fuera de rango');
      salida.set(base.subarray(desde, desde + cuanto), o);
      o += cuanto;
    } else if (op) {
      if (o + op > largo || posicion.i + op > delta.length) throw new Error('insercion del delta fuera de rango');
      salida.set(delta.subarray(posicion.i, posicion.i + op), o);
      o += op;
      posicion.i += op;
    } else {
      throw new Error('instruccion delta invalida');
    }
  }
  if (o !== largo) throw new Error('delta de tamaño inesperado');
  return salida;
}

interface Paquete {
  readonly nombre: string;
  readonly indice: Uint8Array;
  readonly datos: Uint8Array;
  readonly cantidad: number;
  /** Objetos ya resueltos, por posicion: las bases de las cadenas de deltas. */
  readonly resueltos: Map<number, Objeto>;
}

export class Almacen {
  private readonly paquetes = new Map<string, Paquete>();
  private readonly cache = new Map<string, Objeto>();
  readonly estadistica = { sueltos: 0, empaquetados: 0, deltas: 0 };

  constructor(
    private readonly fs: Adaptador,
    private readonly gitDir: readonly string[],
  ) {}

  private async cargarPaquetes(): Promise<void> {
    const lista = (await this.fs.listar([...this.gitDir, 'objects', 'pack'])) ?? [];
    for (const entrada of lista) {
      if (!entrada.nombre.endsWith('.idx') || this.paquetes.has(entrada.nombre)) continue;
      const indice = await this.fs.leer([...this.gitDir, 'objects', 'pack', entrada.nombre]);
      const datos = await this.fs.leer([...this.gitDir, 'objects', 'pack', entrada.nombre.replace(/\.idx$/, '.pack')]);
      if (indice === null || datos === null) continue;
      if (u32(indice, 0) !== 0xff744f63 || u32(indice, 4) !== 2) {
        throw new Error(`el indice de paquete ${entrada.nombre} no es de la version 2`);
      }
      this.paquetes.set(entrada.nombre, {
        nombre: entrada.nombre,
        indice,
        datos,
        cantidad: u32(indice, 8 + 255 * 4),
        resueltos: new Map(),
      });
    }
  }

  /** La posicion del objeto dentro del paquete, o -1. Con desplazamientos de 64 bits incluidos. */
  private buscar(paquete: Paquete, sha: string): number {
    const b = deHex(sha);
    const { indice, cantidad } = paquete;
    const abanico = (k: number): number => (k < 0 ? 0 : u32(indice, 8 + k * 4));
    let bajo = abanico((b[0] ?? 0) - 1);
    let alto = abanico(b[0] ?? 0);
    const nombres = 8 + 1024;
    while (bajo < alto) {
      const medio = (bajo + alto) >>> 1;
      let comparacion = 0;
      for (let k = 0; k < 20 && comparacion === 0; k += 1) {
        comparacion = (indice[nombres + medio * 20 + k] ?? 0) - (b[k] ?? 0);
      }
      if (comparacion === 0) {
        let posicion = u32(indice, nombres + cantidad * 24 + medio * 4);
        if (posicion & 0x80000000) {
          const grande = nombres + cantidad * 28 + (posicion & 0x7fffffff) * 8;
          posicion = u32(indice, grande) * 0x100000000 + u32(indice, grande + 4);
        }
        return posicion;
      }
      if (comparacion < 0) bajo = medio + 1;
      else alto = medio;
    }
    return -1;
  }

  /**
   * Lee el objeto en `posicion` resolviendo su cadena de deltas de forma
   * iterativa: primero se baja hasta una base que no sea delta, o que ya este
   * resuelta, y despues se aplican los deltas de vuelta hacia arriba.
   */
  private async leerEmpaquetado(paquete: Paquete, posicion: number): Promise<Objeto> {
    const datos = paquete.datos;
    const pendientes: { posicion: number; delta: Uint8Array }[] = [];
    let actual = posicion;
    let base: Objeto | null = null;
    while (base === null) {
      const ya = paquete.resueltos.get(actual);
      if (ya !== undefined) {
        base = ya;
        break;
      }
      let o = actual;
      let c = datos[o] ?? 0;
      o += 1;
      const tipo = (c >> 4) & 7;
      while (c & 0x80) {
        c = datos[o] ?? 0;
        o += 1;
      }
      if (tipo === 6) {
        c = datos[o] ?? 0;
        o += 1;
        let atras = c & 0x7f;
        while (c & 0x80) {
          c = datos[o] ?? 0;
          o += 1;
          atras = (atras + 1) * 128 + (c & 0x7f);
        }
        pendientes.push({ posicion: actual, delta: inflar(datos, o).datos });
        actual -= atras;
      } else if (tipo === 7) {
        const shaBase = aHex(datos, o);
        o += 20;
        pendientes.push({ posicion: actual, delta: inflar(datos, o).datos });
        base = await this.objeto(shaBase);
      } else {
        const tipoObjeto = TIPOS[tipo];
        if (tipoObjeto === undefined) throw new Error(`tipo de objeto desconocido en el paquete: ${tipo}`);
        base = { tipo: tipoObjeto, datos: inflar(datos, o).datos };
        paquete.resueltos.set(actual, base);
      }
    }
    let resultado = base;
    for (const { posicion: donde, delta } of pendientes.reverse()) {
      resultado = { tipo: resultado.tipo, datos: aplicarDelta(resultado.datos, delta) };
      paquete.resueltos.set(donde, resultado);
      this.estadistica.deltas += 1;
    }
    return resultado;
  }

  async existe(sha: string): Promise<boolean> {
    try {
      await this.objeto(sha);
      return true;
    } catch {
      return false;
    }
  }

  async objeto(sha: string): Promise<Objeto> {
    const guardado = this.cache.get(sha);
    if (guardado !== undefined) return guardado;
    let resultado: Objeto | null = null;
    const suelto = await this.fs.leer([...this.gitDir, 'objects', sha.slice(0, 2), sha.slice(2)]);
    if (suelto !== null) {
      const d = inflar(suelto, 0).datos;
      const nulo = d.indexOf(0);
      const [tipo, largo] = new TextDecoder().decode(d.subarray(0, nulo)).split(' ');
      const cuerpo = d.subarray(nulo + 1);
      if (Number(largo) !== cuerpo.length) throw new Error(`el objeto ${sha} declara ${largo} bytes y tiene ${cuerpo.length}`);
      if (tipo !== 'commit' && tipo !== 'tree' && tipo !== 'blob' && tipo !== 'tag') throw new Error(`tipo desconocido ${tipo} en ${sha}`);
      resultado = { tipo, datos: cuerpo };
      this.estadistica.sueltos += 1;
    } else {
      await this.cargarPaquetes();
      for (const paquete of this.paquetes.values()) {
        const posicion = this.buscar(paquete, sha);
        if (posicion >= 0) {
          resultado = await this.leerEmpaquetado(paquete, posicion);
          this.estadistica.empaquetados += 1;
          break;
        }
      }
    }
    if (resultado === null) throw new Error(`no encuentro el objeto ${sha}`);
    this.cache.set(sha, resultado);
    return resultado;
  }
}
