/**
 * Manifiesto del simulador construido (seccion 3 del SPEC 006).
 *
 * El artefacto `dist/index.html` va versionado en el repositorio, porque el
 * participante clona y abre, sin construir nada. El riesgo de esa decision es
 * que el artefacto se desincronice del codigo y nadie lo note.
 *
 * Este manifiesto lo evita con la misma idea del SPEC 003 para los paquetes de
 * semilla: se guarda una huella de las fuentes y otra del artefacto, y la suite
 * las recalcula. Si alguien toca el simulador y no reconstruye, las pruebas
 * fallan y dicen que orden correr.
 *
 *   node herramientas/manifiesto.mjs --escribir     (lo hace `npm run build`)
 *   node herramientas/manifiesto.mjs --comprobar
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIMULADOR = fileURLToPath(new URL('..', import.meta.url));
const CLON = fileURLToPath(new URL('../..', import.meta.url));

export const ARTEFACTO = join(SIMULADOR, 'dist', 'index.html');
export const MANIFIESTO = join(SIMULADOR, 'dist', 'manifiesto.txt');
/** La copia de la raiz, que es por donde entra el participante. */
export const ENTRADA = join(CLON, 'SIMULADOR.html');

/**
 * Lo que determina el contenido del artefacto. Las pruebas quedan fuera a
 * proposito: cambiarlas no cambia lo que se construye, y exigir una
 * reconstruccion por cada prueba nueva convertiria la comprobacion en ruido.
 */
const FUENTES_SUELTAS = [
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'package.json',
  'package-lock.json',
];
const FUENTES_EN_CARPETA = ['src'];

function archivosDe(carpeta) {
  const encontrados = [];
  for (const entrada of readdirSync(carpeta)) {
    const ruta = join(carpeta, entrada);
    if (statSync(ruta).isDirectory()) encontrados.push(...archivosDe(ruta));
    else encontrados.push(ruta);
  }
  return encontrados;
}

/** Todas las fuentes, en rutas relativas y ordenadas, para que la huella no dependa del sistema. */
export function fuentes() {
  const rutas = [
    ...FUENTES_SUELTAS.map((nombre) => join(SIMULADOR, nombre)),
    ...FUENTES_EN_CARPETA.flatMap((nombre) => archivosDe(join(SIMULADOR, nombre))),
  ];
  return rutas
    .map((ruta) => relative(SIMULADOR, ruta).split(sep).join('/'))
    .sort();
}

function huellaDeArchivo(relativa) {
  const contenido = readFileSync(join(SIMULADOR, relativa));
  return createHash('sha1').update(relativa).update('\0').update(contenido).digest('hex');
}

/** Huella de las fuentes: cambia si cambia cualquier archivo que entre en la construccion. */
export function huellaDeLasFuentes() {
  const resumen = createHash('sha1');
  for (const relativa of fuentes()) resumen.update(huellaDeArchivo(relativa)).update('\n');
  return resumen.digest('hex');
}

export function huellaDe(ruta) {
  return createHash('sha1').update(readFileSync(ruta)).digest('hex');
}

export function escribir() {
  const contenido = [
    '# Manifiesto del simulador construido. Lo escribe `npm run build`.',
    '#',
    '# No editar a mano. La suite recalcula estas huellas: si no calzan es que',
    '# el artefacto quedo viejo respecto del codigo, y hay que reconstruir con',
    '#',
    '#     cd simulador && npm run build',
    '#',
    `fuentes    ${huellaDeLasFuentes()}`,
    `artefacto  ${huellaDe(ARTEFACTO)}`,
    '',
  ].join('\n');
  writeFileSync(MANIFIESTO, contenido, 'utf8');
  return contenido;
}

export function leer() {
  if (!existsSync(MANIFIESTO)) return null;
  const anotado = {};
  for (const linea of readFileSync(MANIFIESTO, 'utf8').split('\n')) {
    if (linea.startsWith('#') || linea.trim() === '') continue;
    const [clave, valor] = linea.trim().split(/\s+/);
    anotado[clave] = valor;
  }
  return anotado;
}

/** Devuelve la lista de problemas. Vacia quiere decir que todo esta al dia. */
export function comprobar() {
  const problemas = [];
  const reconstruir = 'reconstruir con: cd simulador && npm run build';

  if (!existsSync(ARTEFACTO)) {
    problemas.push(`falta el artefacto dist/index.html; ${reconstruir}`);
    return problemas;
  }
  const anotado = leer();
  if (anotado === null) {
    problemas.push(`falta dist/manifiesto.txt; ${reconstruir}`);
    return problemas;
  }

  const ahora = huellaDeLasFuentes();
  if (anotado.fuentes !== ahora) {
    problemas.push(
      `el codigo del simulador cambio y el artefacto no se reconstruyo; ${reconstruir}\n` +
        `      huella anotada: ${anotado.fuentes}\n` +
        `      huella de hoy:  ${ahora}`,
    );
  }

  const delArtefacto = huellaDe(ARTEFACTO);
  if (anotado.artefacto !== delArtefacto) {
    problemas.push(
      `dist/index.html no es el que anota el manifiesto; ${reconstruir}\n` +
        `      huella anotada: ${anotado.artefacto}\n` +
        `      huella de hoy:  ${delArtefacto}`,
    );
  }

  if (!existsSync(ENTRADA)) {
    problemas.push(`falta SIMULADOR.html en la raiz del clon; ${reconstruir}`);
  } else if (huellaDe(ENTRADA) !== delArtefacto) {
    problemas.push(
      `SIMULADOR.html no es igual a dist/index.html; ${reconstruir}`,
    );
  }

  return problemas;
}

/** La copia de la raiz: es por donde entra el participante y no debe faltar. */
export function copiarALaEntrada() {
  writeFileSync(ENTRADA, readFileSync(ARTEFACTO));
}

const invocadoDirecto = process.argv[1] === fileURLToPath(import.meta.url);
if (invocadoDirecto) {
  const modo = process.argv[2] ?? '--comprobar';
  if (modo === '--escribir') {
    copiarALaEntrada();
    escribir();
    console.log('  manifiesto del simulador al dia, y SIMULADOR.html copiado a la raiz');
  } else if (modo === '--comprobar') {
    const problemas = comprobar();
    if (problemas.length > 0) {
      for (const problema of problemas) console.error(`  ✗ ${problema}`);
      process.exit(1);
    }
    console.log('  el simulador construido esta al dia');
  } else {
    console.error(`manifiesto: opcion desconocida «${modo}»`);
    process.exit(2);
  }
}
