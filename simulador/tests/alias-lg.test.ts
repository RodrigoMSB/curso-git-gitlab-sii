/**
 * El alias lg del laboratorio 01 (SPEC 031, 3.8): autor, fecha relativa y
 * colores. El simulador tiene que responderlo en todos los escenarios, y su
 * fecha relativa es la de Git.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { fechaRelativa, sinColores } from '../src/core/historial';
import { ALIAS_DEL_TALLER, escenarioPorId } from '../src/escenarios';

const texto = (r: ReturnType<typeof ejecutar>): string => r.salida.map((l) => l.texto).join('\n');

describe('la fecha relativa de %ar es la de Git', () => {
  it('a distintas distancias, lo mismo que git log --format=%ar', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'fecha-relativa-'));
    try {
      const ahora = Math.floor(Date.now() / 1000);
      // Lejos de los bordes de cada tramo, para que el segundo que pasa no cambie nada.
      for (const hace of [30, 3_000, 20_000, 200_000, 2_000_000, 20_000_000, 60_000_000, 250_000_000]) {
        const repo = join(raiz, String(hace));
        execFileSync('git', ['init', '-q', repo]);
        writeFileSync(join(repo, 'a'), 'a\n');
        const fecha = `@${ahora - hace} +0000`;
        const env = { ...process.env, GIT_AUTHOR_DATE: fecha, GIT_COMMITTER_DATE: fecha, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@b', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@b' };
        execFileSync('git', ['-C', repo, 'add', 'a'], { env });
        execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'a'], { env });
        const segunGit = execFileSync('git', ['-C', repo, 'log', '-1', '--format=%ar'], { encoding: 'utf8', env: { ...env, LC_ALL: 'C' } }).trim();
        expect(fechaRelativa(ahora - hace, Math.floor(Date.now() / 1000)), `hace ${hace} s`).toBe(segunGit);
      }
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('los colores no se escriben', () => {
    expect(sinColores("%C(yellow)%h%C(reset) %C(bold blue)<%an>%C(reset)%C(auto)%d%Creset")).toBe('%h <%an>%d');
  });
});

describe('el alias lg del taller en el simulador', () => {
  it('es el del material, tal cual (SPEC 032, 1.1)', () => {
    expect(ALIAS_DEL_TALLER.lg).toBe(
      "log --graph --abbrev-commit --decorate --format=format:'%C(bold blue)%h%C(reset) - %C(bold green)(%ar)%C(reset) %C(white)%s%C(reset) %C(dim white)- %an%C(reset)%C(bold yellow)%d%C(reset)' --all",
    );
  });

  it('trae autor, fecha relativa y colores', () => {
    expect(ALIAS_DEL_TALLER.lg).toContain('%an');
    expect(ALIAS_DEL_TALLER.lg).toContain('%ar');
    expect(ALIAS_DEL_TALLER.lg).toContain('%C(');
    expect(ALIAS_DEL_TALLER.s).toBe('status --short');
  });

  it('responde en todos los escenarios, sin formato por reemplazar', () => {
    // Del 02 en adelante: el 01 es donde se configura.
    for (const id of ['lab-02', 'lab-03', 'lab-04', 'lab-05', 'lab-06', 'lab-07', 'lab-09']) {
      const r = ejecutar(escenarioPorId(id), 'git lg');
      expect(r.error, id).toBe(false);
      expect(texto(r), id).not.toMatch(/%[a-zA-Z(]/);
    }
  });

  it('una linea por confirmacion, con el grafo, el autor, la fecha y las ramas', () => {
    const r = texto(ejecutar(escenarioPorId('lab-02'), 'git lg'));
    const primera = r.split('\n')[0] ?? '';
    // El lg del material (SPEC 032): «* id - (hace cuanto) mensaje - autor (ramas)».
    expect(primera).toMatch(/^\* [0-9a-f]{7} - \(\d+ \w+.* ago\) .+ - [^(]+ \(HEAD -> main\)$/);
  });
});
