#!/usr/bin/env node
/**
 * El editor que simula a Visual Studio Code en el recorrido del modo taller
 * (punto 7.2 del SPEC 026).
 *
 * El laboratorio 01 deja `core.editor` en `code --wait`. En las maquinas de
 * prueba no hay Visual Studio Code, asi que el arnes pone primero en el PATH un
 * `code` que llama a este archivo. Escribe lo que el enunciado le pide al
 * participante hacer en el editor y sale, como quien guarda y cierra la
 * pestaña.
 *
 * Que hacer en cada apertura lo dice un plan, un archivo con una accion por
 * linea que el arnes deja antes de la orden. Cada apertura consume la primera.
 * Sin plan, acepta lo que Git propuso, y si el mensaje esta vacio escribe uno.
 *
 *   aceptar                  deja el archivo como esta
 *   mensaje <texto>          reemplaza el mensaje por el texto
 *   reword-primera           en la lista del rebase, la primera pasa a reword
 *   squash-del-medio         en la lista del rebase, las del medio pasan a squash
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const archivo = process.argv.filter((a) => !a.startsWith('--')).at(-1);
const plan = process.env.TALLER_EDITOR_PLAN;

function siguienteAccion() {
  if (plan === undefined || !existsSync(plan)) return 'aceptar';
  const lineas = readFileSync(plan, 'utf8').split('\n').filter((l) => l.trim() !== '');
  if (lineas.length === 0) return 'aceptar';
  writeFileSync(plan, lineas.slice(1).join('\n'));
  return lineas[0];
}

const texto = readFileSync(archivo, 'utf8');
const lineas = texto.split('\n');
const util = (l) => l.trim() !== '' && !l.startsWith('#');
const accion = siguienteAccion();

let nuevo = texto;
if (accion.startsWith('mensaje ')) {
  nuevo = `${accion.slice('mensaje '.length)}\n`;
} else if (accion === 'reword-primera') {
  const i = lineas.findIndex(util);
  lineas[i] = lineas[i].replace(/^pick /, 'reword ');
  nuevo = lineas.join('\n');
} else if (accion === 'squash-del-medio') {
  const indices = lineas.map((l, i) => (util(l) ? i : -1)).filter((i) => i >= 0);
  for (const i of indices.slice(1, -1)) lineas[i] = lineas[i].replace(/^pick /, 'squash ');
  nuevo = lineas.join('\n');
} else if (!lineas.some(util)) {
  nuevo = `mensaje escrito en el editor\n${texto}`;
}
writeFileSync(archivo, nuevo);
