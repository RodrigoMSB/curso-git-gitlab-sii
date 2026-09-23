/**
 * SHA-1, sincronico y sin dependencias (SPEC 020).
 *
 * Git identifica cada archivo por la huella SHA-1 de `blob <largo>\0` seguido
 * del contenido. Para saber si un archivo del disco cambio respecto del indice
 * hay que calcular esa huella. El navegador trae SHA-1 en `crypto.subtle`,
 * pero es asincrono y solo existe en contextos seguros; esto funciona igual en
 * el navegador, abierto con doble clic, y en las pruebas de Node.
 */

function rotar(valor: number, cuanto: number): number {
  return (valor << cuanto) | (valor >>> (32 - cuanto));
}

/** La huella SHA-1 de unos bytes, en hexadecimal de cuarenta caracteres. */
export function sha1(datos: Uint8Array): string {
  const largoBits = datos.length * 8;
  const relleno = ((datos.length + 9 + 63) >> 6) << 6;
  const bloque = new Uint8Array(relleno);
  bloque.set(datos);
  bloque[datos.length] = 0x80;
  const vista = new DataView(bloque.buffer);
  // El largo va en los ultimos ocho bytes, en bits y de mayor a menor.
  vista.setUint32(relleno - 8, Math.floor(largoBits / 0x100000000));
  vista.setUint32(relleno - 4, largoBits >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Int32Array(80);

  for (let inicio = 0; inicio < relleno; inicio += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = vista.getInt32(inicio + i * 4);
    for (let i = 16; i < 80; i += 1) {
      w[i] = rotar((w[i - 3] ?? 0) ^ (w[i - 8] ?? 0) ^ (w[i - 14] ?? 0) ^ (w[i - 16] ?? 0), 1);
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i += 1) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (rotar(a, 5) + f + e + k + (w[i] ?? 0)) | 0;
      e = d;
      d = c;
      c = rotar(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0')).join('');
}

/** La huella con que Git guardaria estos bytes como archivo: `blob <largo>\0<contenido>`. */
export function huellaDeArchivo(contenido: Uint8Array): string {
  const cabecera = new TextEncoder().encode(`blob ${contenido.length}\0`);
  const todo = new Uint8Array(cabecera.length + contenido.length);
  todo.set(cabecera);
  todo.set(contenido, cabecera.length);
  return sha1(todo);
}
