/**
 * El archivo `.git/config` (SPEC 020).
 *
 * Se lee lo que el lector necesita: `core.autocrlf`, las extensiones que
 * cambian el formato del repositorio, los remotos y los alias. Las claves
 * quedan como las escribe `git config --list`: seccion, subseccion y nombre
 * separados por puntos, seccion y nombre en minusculas.
 */

export type Configuracion = ReadonlyMap<string, readonly string[]>;

/** Quita las comillas y resuelve los escapes de un valor. */
function valorDe(crudo: string): string {
  let resultado = '';
  let entreComillas = false;
  for (let i = 0; i < crudo.length; i += 1) {
    const c = crudo[i] ?? '';
    if (c === '"') {
      entreComillas = !entreComillas;
    } else if (c === '\\') {
      const siguiente = crudo[i + 1] ?? '';
      resultado += siguiente === 'n' ? '\n' : siguiente === 't' ? '\t' : siguiente;
      i += 1;
    } else if ((c === '#' || c === ';') && !entreComillas) {
      break;
    } else {
      resultado += c;
    }
  }
  return resultado.trim();
}

export function leerConfiguracion(texto: string): Configuracion {
  const valores = new Map<string, string[]>();
  let seccion = '';
  for (const lineaCruda of texto.split(/\r?\n/)) {
    const linea = lineaCruda.trim();
    if (linea === '' || linea.startsWith('#') || linea.startsWith(';')) continue;
    const encabezado = /^\[\s*([A-Za-z0-9.-]+)(?:\s+"((?:[^"\\]|\\.)*)")?\s*\]/.exec(linea);
    if (encabezado !== null) {
      const nombre = (encabezado[1] ?? '').toLowerCase();
      const sub = encabezado[2];
      seccion = sub === undefined ? nombre : `${nombre}.${sub.replace(/\\(.)/g, '$1')}`;
      continue;
    }
    const igual = linea.indexOf('=');
    const clave = (igual < 0 ? linea : linea.slice(0, igual)).trim().toLowerCase();
    // Una clave sin valor vale `true`, como en Git.
    const valor = igual < 0 ? 'true' : valorDe(linea.slice(igual + 1));
    const completa = `${seccion}.${clave}`;
    valores.set(completa, [...(valores.get(completa) ?? []), valor]);
  }
  return valores;
}

/**
 * La clave como la guarda el lector: seccion y nombre en minusculas, la
 * subseccion tal cual, porque en Git distingue mayusculas (`remote.Origen`).
 */
function normalizada(clave: string): string {
  const partes = clave.split('.');
  if (partes.length < 2) return clave.toLowerCase();
  const primera = (partes[0] ?? '').toLowerCase();
  const ultima = (partes.at(-1) ?? '').toLowerCase();
  return [primera, ...partes.slice(1, -1), ultima].join('.');
}

/** El ultimo valor de una clave, que es el que manda en Git. */
export function valor(configuracion: Configuracion, clave: string): string | null {
  return configuracion.get(normalizada(clave))?.at(-1) ?? null;
}

/** Un valor booleano con las formas que Git acepta. */
export function verdadero(configuracion: Configuracion, clave: string): boolean {
  const v = valor(configuracion, clave)?.toLowerCase();
  return v === 'true' || v === 'yes' || v === 'on' || v === '1';
}
