/**
 * El archivo de exclusiones (punto 3.1 del SPEC 012).
 *
 * Es la razon de este spec. El laboratorio 03 enseña la distincion mas sutil
 * del taller —ignorar un archivo y sacarlo del seguimiento son cosas
 * distintas— y hasta ahora el simulador no podia mostrar la primera mitad: el
 * participante escribia las reglas, pedia el estado, y la pantalla le decia
 * que no sabia leerlas.
 *
 * ## Lo que se cubre, y lo que no
 *
 * Se cubre **lo que el guion usa**, que es lo mismo que cubre todo lo demas
 * del motor desde el SPEC 010:
 *
 * | Forma | Ejemplo del guion |
 * |---|---|
 * | comodin sobre la extension | `*.tmp`, `*.bak` |
 * | nombre literal | `credenciales.txt` |
 * | carpeta, con barra al final | `construido/` |
 * | ruta anclada a la raiz, con barra adelante | `/solo-aqui.txt` |
 * | comentarios y lineas en blanco | `# lo que no va` |
 *
 * **No se cubre el resto de la sintaxis de Git**, que tiene negaciones con
 * `!`, comodines dobles `**`, clases de caracteres `[abc]`, el comodin de un
 * solo caracter `?`, el escape con `\\` y reglas de precedencia entre patrones
 * que se contradicen. Un patron que use algo de eso se ignora, y `patronesFuera`
 * lo enumera para que la consola pueda decirlo en vez de callarse: aceptar una
 * regla y no aplicarla es justo la cuarta respuesta que el SPEC 010 elimino.
 *
 * Tampoco se cubren los `.gitignore` de las subcarpetas ni
 * `.git/info/exclude`, que vive dentro de la carpeta oculta y esa el simulador
 * no la modela a proposito.
 *
 * ## Sobre que actua
 *
 * **Solo sobre lo que no esta en seguimiento.** Un archivo ya versionado sigue
 * apareciendo aunque una regla lo nombre, y ese es exactamente el punto del
 * laboratorio: el archivo de exclusiones no toca lo que ya entro.
 */

import { textoDeTrabajo } from './contenido';
import type { EstadoRepositorio } from './tipos';

/** Una regla del archivo, ya compilada. */
interface Regla {
  readonly patron: RegExp;
  /** La regla solo alcanza carpetas: el patron terminaba en barra. */
  readonly soloCarpetas: boolean;
}

export interface Exclusiones {
  readonly reglas: readonly Regla[];
  /** Patrones que usan sintaxis que el simulador no cubre, tal como se escribieron. */
  readonly fuera: readonly string[];
}

export const SIN_EXCLUSIONES: Exclusiones = { reglas: [], fuera: [] };

/** Sintaxis de Git que el simulador declara no cubrir. */
const NO_CUBIERTO = /[!?[\]\\]|\*\*/;

/** Escapa lo que en una expresion regular significa algo, menos el comodin. */
function escapar(trozo: string): string {
  return trozo.replace(/[.+^${}()|[\]\\?]/g, '\\$&');
}

/**
 * Compila un patron del archivo de exclusiones.
 *
 * Un patron **sin barras** coincide en cualquier nivel, que es como Git trata
 * `*.tmp`: tapa tanto `notas.tmp` como `recetas/notas.tmp`. Uno **con barra**
 * queda anclado a la raiz del repositorio.
 */
function compilar(crudo: string): Regla | null {
  const soloCarpetas = crudo.endsWith('/');
  const sinBarraFinal = soloCarpetas ? crudo.slice(0, -1) : crudo;
  const anclado = sinBarraFinal.startsWith('/');
  const cuerpo = anclado ? sinBarraFinal.slice(1) : sinBarraFinal;
  if (cuerpo === '') return null;

  // El comodin de Git no cruza barras: `*.tmp` no tapa `recetas/x.tmp` por el
  // comodin, sino por no llevar barras. Se traduce a «lo que no sea barra».
  const expresion = cuerpo
    .split('*')
    .map(escapar)
    .join('[^/]*');

  // Sin barras, la regla se mide contra el nombre suelto en cualquier nivel.
  const conBarras = anclado || cuerpo.includes('/');
  const patron = conBarras
    ? new RegExp(`^${expresion}$`)
    : new RegExp(`(?:^|/)${expresion}$`);

  return { patron, soloCarpetas };
}

/** Lee las reglas de un texto de archivo de exclusiones. */
export function leerExclusiones(texto: string | null): Exclusiones {
  if (texto === null || texto === '') return SIN_EXCLUSIONES;

  const reglas: Regla[] = [];
  const fuera: string[] = [];
  for (const cruda of texto.split('\n')) {
    const linea = cruda.trim();
    if (linea === '' || linea.startsWith('#')) continue;
    if (NO_CUBIERTO.test(linea)) {
      fuera.push(linea);
      continue;
    }
    const regla = compilar(linea);
    if (regla !== null) reglas.push(regla);
  }
  return { reglas, fuera };
}

/** Las exclusiones que rigen ahora mismo, leidas del `.gitignore` del directorio. */
export function exclusionesDe(estado: EstadoRepositorio): Exclusiones {
  return leerExclusiones(textoDeTrabajo(estado, '.gitignore'));
}

/**
 * Si una ruta cae bajo alguna regla.
 *
 * Se prueba la ruta entera y cada una de sus carpetas: Git tapa todo lo que
 * cuelga de una carpeta excluida, sin mirar lo que hay dentro.
 */
export function estaExcluida(exclusiones: Exclusiones, ruta: string): boolean {
  const partes = ruta.split('/');
  for (const regla of exclusiones.reglas) {
    // Las carpetas que contienen a la ruta, de la mas alta a la mas honda.
    for (let hasta = 1; hasta < partes.length; hasta += 1) {
      if (regla.patron.test(partes.slice(0, hasta).join('/'))) return true;
    }
    if (!regla.soloCarpetas && regla.patron.test(ruta)) return true;
  }
  return false;
}

/**
 * Lo que el participante escribio y el simulador no cubre, para nombrarlo.
 *
 * Lo lee `git status`, que es el momento en que el participante espera que el
 * filtrado haya ocurrido. Decirlo ahi es la segunda respuesta del contrato del
 * SPEC 010; callarlo seria la cuarta, que es la unica que no se admite.
 */
export function patronesFuera(estado: EstadoRepositorio): readonly string[] {
  return exclusionesDe(estado).fuera;
}
