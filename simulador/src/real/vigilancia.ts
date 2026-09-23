/**
 * Saber si el repositorio cambio sin volver a leerlo entero (SPEC 020, 2.7).
 *
 * Cada medio segundo se arma una marca con el tamaño y la fecha de los
 * archivos que Git toca en cada orden: HEAD, el indice, las referencias
 * sueltas y empaquetadas y el registro de movimientos. Si la marca es la misma
 * que la anterior, no se lee nada mas.
 *
 * Tambien entra el directorio de trabajo. El punto 2.7 no lo nombra, pero sin
 * el la pantalla no se enteraria de un `echo "..." >> archivo` hasta la
 * siguiente orden de Git, y la mitad de los guiones es eso.
 *
 * Si Git esta escribiendo (hay un `index.lock`), la marca es `null`: se espera
 * a la siguiente vuelta en vez de leer un indice a medio escribir.
 */

import type { Adaptador } from './adaptador';

const FIJOS: readonly (readonly string[])[] = [
  ['HEAD'],
  ['index'],
  ['packed-refs'],
  ['logs', 'HEAD'],
  ['MERGE_HEAD'],
  ['REVERT_HEAD'],
  ['CHERRY_PICK_HEAD'],
  ['ORIG_HEAD'],
  ['config'],
  ['info', 'exclude'],
];

async function recorrer(fs: Adaptador, carpeta: readonly string[], omitir: string | null, partes: string[]): Promise<void> {
  const lista = await fs.listar(carpeta);
  if (lista === null) return;
  for (const entrada of [...lista].sort((a, b) => (a.nombre < b.nombre ? -1 : 1))) {
    if (entrada.nombre === omitir) continue;
    const ruta = [...carpeta, entrada.nombre];
    if (entrada.esDirectorio) {
      partes.push(`${ruta.join('/')}/`);
      await recorrer(fs, ruta, null, partes);
    } else {
      const datos = await fs.datos(ruta);
      partes.push(`${ruta.join('/')}:${datos?.tamano ?? '-'}:${datos?.modificado ?? '-'}`);
    }
  }
}

export async function marcaDelRepositorio(fs: Adaptador): Promise<string | null> {
  if ((await fs.datos(['.git', 'index.lock'])) !== null) return null;
  const partes: string[] = [];
  for (const ruta of FIJOS) {
    const datos = await fs.datos(['.git', ...ruta]);
    partes.push(`${ruta.join('/')}:${datos?.tamano ?? '-'}:${datos?.modificado ?? '-'}`);
  }
  // Las ramas y etiquetas sueltas, y el guardado temporal.
  await recorrer(fs, ['.git', 'refs'], null, partes);
  await recorrer(fs, ['.git', 'rebase-merge'], null, partes);
  // El directorio de trabajo, sin la carpeta .git.
  await recorrer(fs, [], '.git', partes);
  return partes.join('\n');
}
