/**
 * Los repositorios de prueba del lector real, armados con el Git de la maquina:
 * los siete de la sonda del arquitecto y los de los bordes de la revision.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Cambio } from '../../src/real/trabajo';

export const DE_LA_SONDA = ['lineal', 'ramas', 'empaquetado', 'deltas', 'desde-bundle', 'desconectada', 'empates'];
export const DE_LOS_BORDES = ['latin', 'candado', 'grande64', 'cadena', 'refdelta', 'grandes', 'superficial', 'completo', 'clonado'];
/** Los que existen para probar las tres areas, no la historia. */
export const DE_LAS_AREAS = ['estados', 'conflicto', 'finales', 'finales-crlf', 'finales-tocado', 'indice3', 'indice4'];

/** Arma todo en una carpeta temporal y devuelve la ruta de cada repositorio por nombre. */
export function armarRepos(): { raiz: string; ruta: (nombre: string) => string } {
  const raiz = mkdtempSync(join(tmpdir(), 'lector-real-'));
  execFileSync('bash', [join(__dirname, 'armar-bordes.sh'), join(raiz, 'bordes')], { stdio: 'pipe' });
  execFileSync('bash', [join(__dirname, 'armar-sonda.sh')], { cwd: raiz, stdio: 'pipe' });
  return {
    raiz,
    ruta: (nombre) => join(raiz, DE_LA_SONDA.includes(nombre) ? 'pruebas' : 'bordes', nombre),
  };
}

/** El estado corto de Git, una linea por cambio, con el origen de los renombrados. */
/**
 * El `core.autocrlf` que rige en esta maquina fuera de los repositorios. En
 * Windows, Git lo deja en `true`; el lector no puede leerlo y lo supone, y las
 * pruebas se lo pasan tal cual para comparar contra el mismo Git.
 */
export function autocrlfDeLaMaquina(): 'true' | 'input' | 'false' {
  try {
    const valor = execFileSync('git', ['config', '--get', 'core.autocrlf']).toString().trim().toLowerCase();
    return valor === 'input' ? 'input' : ['true', 'yes', 'on', '1'].includes(valor) ? 'true' : 'false';
  } catch {
    return 'false';
  }
}

/**
 * El estado corto de Git. Sin `configGlobal` corre con la configuracion de la
 * maquina, que es con la que el participante ve su repositorio; con uno, con
 * esa, como en los laboratorios.
 */
export function porcelana(dir: string, configGlobal: string | null = null): string[] {
  const salida = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=normal'], {
    cwd: dir,
    // Sin el candado opcional, `git status` no reescribe el indice al
    // refrescarlo: mirar no tiene que cambiar lo que se esta mirando.
    env: {
      ...process.env,
      ...(configGlobal === null ? {} : { GIT_CONFIG_GLOBAL: configGlobal, GIT_CONFIG_SYSTEM: '/dev/null' }),
      GIT_OPTIONAL_LOCKS: '0',
    },
  }).toString();
  const partes = salida.split('\0');
  const lineas: string[] = [];
  for (let i = 0; i < partes.length; i += 1) {
    const parte = partes[i] ?? '';
    if (parte === '') continue;
    const codigo = parte.slice(0, 2);
    if (codigo[0] === 'R' || codigo[0] === 'C') {
      lineas.push(`${codigo} ${partes[i + 1] ?? ''} -> ${parte.slice(3)}`);
      i += 1;
    } else lineas.push(parte);
  }
  return lineas.sort();
}

export function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'i18n.logOutputEncoding=UTF-8', ...args], { cwd: dir, maxBuffer: 1e9 }).toString();
}

export function lineas(texto: string): string[] {
  return texto.split('\n').filter((l) => l !== '');
}

/** Los cambios del lector escritos como `git status --porcelain`. */
export function comoPorcelana(cambios: readonly Cambio[]): string[] {
  return cambios
    .map((c) => (c.origen === undefined ? `${c.x}${c.y} ${c.ruta}` : `${c.x}${c.y} ${c.origen} -> ${c.ruta}`))
    .sort();
}
