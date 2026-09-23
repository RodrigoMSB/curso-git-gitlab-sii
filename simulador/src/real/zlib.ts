/**
 * Descompresion de flujos zlib, sin dependencias (SPEC 020).
 *
 * Git guarda cada objeto comprimido con zlib, suelto o dentro de un paquete. El
 * navegador trae `DecompressionStream`, pero es asincrono por trozos y no dice
 * donde termina el flujo; dentro de un paquete eso importa, porque detras
 * viene el objeto siguiente. Esto lee un flujo desde una posicion y devuelve
 * los datos y el largo consumido.
 *
 * Viene del `nucleo.js` del arquitecto, revisado: la version original no
 * acotaba nada ante datos corruptos. Un codigo de Huffman incompleto o una
 * distancia hacia atras mayor que lo ya escrito producian basura o un ciclo
 * sin fin. Aqui cada una de esas situaciones es un error con su motivo.
 */

const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const DEXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const ORDEN_CL = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
const BITS_MAXIMOS = 15;

interface Huffman {
  readonly cuentas: Uint16Array;
  readonly simbolos: Uint16Array;
}

function construir(largos: readonly number[]): Huffman {
  const cuentas = new Uint16Array(BITS_MAXIMOS + 1);
  for (const largo of largos) cuentas[largo] = (cuentas[largo] ?? 0) + 1;
  cuentas[0] = 0;
  const desde = new Uint16Array(BITS_MAXIMOS + 1);
  for (let bits = 1; bits < BITS_MAXIMOS; bits += 1) desde[bits + 1] = (desde[bits] ?? 0) + (cuentas[bits] ?? 0);
  const simbolos = new Uint16Array(largos.length);
  largos.forEach((largo, simbolo) => {
    if (largo === 0) return;
    const posicion = desde[largo] ?? 0;
    simbolos[posicion] = simbolo;
    desde[largo] = posicion + 1;
  });
  return { cuentas, simbolos };
}

let fijos: readonly [Huffman, Huffman] | null = null;
function arbolesFijos(): readonly [Huffman, Huffman] {
  if (fijos === null) {
    const largos: number[] = [];
    for (let i = 0; i < 288; i += 1) largos.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
    fijos = [construir(largos), construir(new Array<number>(30).fill(5))];
  }
  return fijos;
}

export interface Inflado {
  readonly datos: Uint8Array;
  /** Posicion del primer byte que sigue al flujo, suma de verificacion incluida. */
  readonly fin: number;
}

/** Descomprime el flujo zlib que empieza en `inicio`. Tolera datos detras. */
export function inflar(entrada: Uint8Array, inicio = 0): Inflado {
  const cmf = entrada[inicio] ?? 0;
  const flg = entrada[inicio + 1] ?? 0;
  if ((cmf & 15) !== 8 || ((cmf << 8) | flg) % 31 !== 0) throw new Error(`cabecera zlib invalida en ${inicio}`);
  if (flg & 32) throw new Error('zlib con diccionario, no soportado');

  let p = inicio + 2;
  let acumulado = 0;
  let cantidad = 0;
  let salida = new Uint8Array(1024);
  let n = 0;

  const asegurar = (k: number): void => {
    if (n + k <= salida.length) return;
    let tamano = salida.length * 2;
    while (tamano < n + k) tamano *= 2;
    const nueva = new Uint8Array(tamano);
    nueva.set(salida.subarray(0, n));
    salida = nueva;
  };
  const bits = (k: number): number => {
    while (cantidad < k) {
      if (p >= entrada.length) throw new Error('flujo zlib truncado');
      acumulado |= (entrada[p] ?? 0) << cantidad;
      p += 1;
      cantidad += 8;
    }
    const valor = acumulado & ((1 << k) - 1);
    acumulado >>>= k;
    cantidad -= k;
    return valor;
  };
  const decodificar = (arbol: Huffman): number => {
    let codigo = 0;
    let primero = 0;
    let indice = 0;
    for (let largo = 1; largo <= BITS_MAXIMOS; largo += 1) {
      codigo |= bits(1);
      const cuenta = arbol.cuentas[largo] ?? 0;
      if (codigo - cuenta < primero) return arbol.simbolos[indice + (codigo - primero)] ?? 0;
      indice += cuenta;
      primero += cuenta;
      primero <<= 1;
      codigo <<= 1;
    }
    throw new Error('codigo de Huffman invalido');
  };

  let final = 0;
  do {
    final = bits(1);
    const tipo = bits(2);
    if (tipo === 0) {
      // Bloque sin comprimir: se descarta lo que quede del byte actual.
      acumulado = 0;
      cantidad = 0;
      const largo = (entrada[p] ?? 0) | ((entrada[p + 1] ?? 0) << 8);
      const complemento = (entrada[p + 2] ?? 0) | ((entrada[p + 3] ?? 0) << 8);
      if ((largo ^ 0xffff) !== complemento) throw new Error('bloque sin comprimir con largo inconsistente');
      p += 4;
      if (p + largo > entrada.length) throw new Error('flujo zlib truncado');
      asegurar(largo);
      salida.set(entrada.subarray(p, p + largo), n);
      n += largo;
      p += largo;
    } else if (tipo === 1 || tipo === 2) {
      let literales: Huffman;
      let distancias: Huffman;
      if (tipo === 1) {
        [literales, distancias] = arbolesFijos();
      } else {
        const hlit = bits(5) + 257;
        const hdist = bits(5) + 1;
        const hclen = bits(4) + 4;
        const cl = new Array<number>(19).fill(0);
        for (let i = 0; i < hclen; i += 1) cl[ORDEN_CL[i] ?? 0] = bits(3);
        const arbolCl = construir(cl);
        const largos: number[] = [];
        while (largos.length < hlit + hdist) {
          const simbolo = decodificar(arbolCl);
          if (simbolo < 16) largos.push(simbolo);
          else if (simbolo === 16) {
            const previo = largos.at(-1);
            if (previo === undefined) throw new Error('repeticion sin largo previo');
            for (let r = 3 + bits(2); r > 0; r -= 1) largos.push(previo);
          } else if (simbolo === 17) {
            for (let r = 3 + bits(3); r > 0; r -= 1) largos.push(0);
          } else {
            for (let r = 11 + bits(7); r > 0; r -= 1) largos.push(0);
          }
        }
        if (largos.length > hlit + hdist) throw new Error('demasiados largos de codigo');
        literales = construir(largos.slice(0, hlit));
        distancias = construir(largos.slice(hlit));
      }
      for (;;) {
        const simbolo = decodificar(literales);
        if (simbolo < 256) {
          asegurar(1);
          salida[n] = simbolo;
          n += 1;
        } else if (simbolo === 256) {
          break;
        } else {
          const i = simbolo - 257;
          if (i >= LBASE.length) throw new Error('simbolo de largo invalido');
          const largo = (LBASE[i] ?? 0) + bits(LEXTRA[i] ?? 0);
          const ds = decodificar(distancias);
          if (ds >= DBASE.length) throw new Error('simbolo de distancia invalido');
          const distancia = (DBASE[ds] ?? 0) + bits(DEXTRA[ds] ?? 0);
          if (distancia > n) throw new Error('distancia hacia atras mayor que lo escrito');
          asegurar(largo);
          for (let k = 0; k < largo; k += 1) {
            salida[n] = salida[n - distancia] ?? 0;
            n += 1;
          }
        }
      }
    } else {
      throw new Error('bloque deflate invalido');
    }
  } while (!final);

  return { datos: salida.subarray(0, n), fin: p + 4 };
}
