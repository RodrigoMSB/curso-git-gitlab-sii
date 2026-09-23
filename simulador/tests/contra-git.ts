/**
 * Las mismas ordenes en un repositorio real y en el simulador, para comparar
 * lo que imprime cada una (SPEC 022 y 023). Solo se normalizan los
 * identificadores, que el simulador genera con su propia huella.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, expect } from 'vitest';
import { estadoVacio } from '../src/core/estado';
import { ejecutar } from '../src/core/motor';
import type { EstadoRepositorio } from '../src/core/tipos';

const carpetas: string[] = [];
afterAll(() => {
  for (const carpeta of carpetas) rmSync(carpeta, { recursive: true, force: true });
});

export function normalizar(salida: string): string {
  return salida
    .replace(/\r/g, '')
    // La linea en blanco que el simulador deja tras «On branch» es una
    // diferencia conocida de `git status`, que el product owner decidio dejar
    // como esta; el SPEC 022 no toca `git status` (punto 3.2).
    .replace(/^(On branch \S+)\n\n/, '$1\n')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<id>')
    // La fecha de una enmienda es la de la confirmacion original, que en
    // cada lado es otra.
    .replace(/^ Date: .*$/gm, ' Date: <fecha>')
    .trimEnd();
}

export function enGit(ordenes: readonly string[]): string[] {
  const carpeta = mkdtempSync(join(tmpdir(), 'defectos-'));
  carpetas.push(carpeta);
  const configuracion = join(carpeta, '.gitconfig-prueba');
  writeFileSync(configuracion, '[user]\n\tname = Participante\n\temail = p@sii.cl\n[init]\n\tdefaultBranch = main\n');
  const repo = join(carpeta, 'r');
  const entorno = { ...process.env, GIT_CONFIG_GLOBAL: configuracion, GIT_CONFIG_NOSYSTEM: '1', LANG: 'C', LC_ALL: 'C' };
  spawnSync('git', ['init', '-q', repo], { env: entorno });
  return ordenes.map((orden) => {
    const corrida = spawnSync('bash', ['-c', orden], { cwd: repo, env: entorno, encoding: 'utf8' });
    return `${corrida.stdout ?? ''}${corrida.stderr ?? ''}`;
  });
}

export function enSimulador(ordenes: readonly string[]): string[] {
  let estado: EstadoRepositorio = ejecutar(estadoVacio(), 'git init').estado;
  return ordenes.map((orden) => {
    const resultado = ejecutar(estado, orden);
    estado = resultado.estado;
    return resultado.salida.map((linea) => linea.texto).join('\n');
  });
}

/** Corre todo en los dos lados y compara la salida de las ordenes marcadas con `?`. */
export function comparar(ordenes: readonly string[]): void {
  const limpias = ordenes.map((orden) => orden.replace(/^\? /, ''));
  const git = enGit(limpias);
  const simulador = enSimulador(limpias);
  ordenes.forEach((orden, indice) => {
    if (!orden.startsWith('? ')) return;
    expect(normalizar(simulador[indice] ?? ''), `salida de «${limpias[indice]}»`).toBe(normalizar(git[indice] ?? ''));
  });
}

