/**
 * La pantalla en modo real (SPEC 020, 2.3, 2.7 a 2.9), con un repositorio en
 * disco en vez de la carpeta que elige el alumno.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  actualizarSesionReal,
  anotarOrdenReal,
  avisosReales,
  Conexion,
  construirPantallaReal,
  iniciarSesionReal,
  type SesionReal,
} from '../../src/vista';
import { adaptadorDeDisco } from './disco';

let dir = '';
const git = (...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=P', '-c', 'user.email=p@sii.cl', ...args], { cwd: dir }).toString();
const OPCIONES = { previsualizacionActiva: true, entrada: '', modoRelator: false };

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'vista-real-'));
  git('init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'a.md'), 'a\n');
  writeFileSync(join(dir, 'b.md'), 'b\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  // Corre en paralelo con los archivos que arman repositorios pesados: diez segundos no alcanzan siempre.
}, 60_000);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function abrir(): Promise<{ conexion: Conexion; sesion: SesionReal }> {
  const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
  return { conexion, sesion: iniciarSesionReal('recetario', await conexion.leer()) };
}

describe('la pantalla del repositorio real', () => {
  it('dibuja las confirmaciones de Git con sus identificadores', async () => {
    const { sesion } = await abrir();
    const pantalla = construirPantallaReal(sesion, OPCIONES);
    const deGit = git('log', '--format=%h', '--abbrev=7').trim().split('\n');
    expect(pantalla.grafo.nodos.map((n) => n.id)).toEqual(deGit);
    expect(pantalla.barra.repositorio).toBe('recetario');
    expect(pantalla.segmentos).toEqual([]);
  });

  it('un archivo preparado y despues modificado aparece en las dos areas, como en git status', async () => {
    appendFileSync(join(dir, 'a.md'), 'mas\n');
    git('add', 'a.md');
    appendFileSync(join(dir, 'a.md'), 'aun mas\n');
    const { sesion } = await abrir();
    const columnas = construirPantallaReal(sesion, OPCIONES).columnas;
    const de = (clave: string) => columnas.find((c) => c.clave === clave)?.elementos.map((e) => `${e.texto}:${e.tono}`);
    expect(git('status', '--porcelain').trim()).toBe('MM a.md');
    expect(de('trabajo')).toEqual(['a.md:modificado']);
    expect(de('preparacion')).toEqual(['a.md:preparado']);
  });

  it('la consola previsualiza sobre el estado real y no ejecuta', async () => {
    const { sesion } = await abrir();
    const previa = construirPantallaReal(sesion, { ...OPCIONES, entrada: 'git commit -m "otra"' });
    expect(previa.grafo.nodos.filter((n) => n.previsualizada)).toHaveLength(1);

    const anotada = anotarOrdenReal(sesion, 'git commit -m "otra"');
    expect(anotada.renglones.map((r) => r.texto).join('\n')).toMatch(/Git Bash/);
    // Nada cambio en el repositorio: la orden no se ejecuto.
    expect(git('log', '--format=%s').trim().split('\n')).toEqual(['base']);
    // Sigue previsualizada, sin nada escrito, hasta que Git la haga.
    expect(construirPantallaReal(anotada, OPCIONES).grafo.nodos.filter((n) => n.previsualizada)).toHaveLength(1);
  });

  it('cuando Git cambia el repositorio se relee, y la previsualizacion pendiente se borra', async () => {
    const { conexion, sesion } = await abrir();
    expect(await conexion.revisar()).toBeNull();
    const anotada = anotarOrdenReal(sesion, 'git commit -m "otra"');
    git('commit', '-qm', 'otra');
    const lectura = await conexion.revisar();
    expect(lectura).not.toBeNull();
    const nueva = actualizarSesionReal(anotada, lectura ?? { tipo: 'no-soportado', motivo: '' });
    expect(nueva.pendiente).toBeNull();
    const pantalla = construirPantallaReal(nueva, OPCIONES);
    expect(pantalla.grafo.nodos.filter((n) => n.previsualizada)).toHaveLength(0);
    expect(pantalla.grafo.nodos[0]?.id).toBe(git('rev-parse', '--short=7', 'HEAD').trim());
    expect(avisosReales(nueva).tiempos?.total).toBeGreaterThan(0);
  });

  it('lo que no se sabe dibujar se dice y no se dibuja', async () => {
    const otra = mkdtempSync(join(tmpdir(), 'vista-real-sha256-'));
    execFileSync('git', ['init', '-q', '--object-format=sha256', otra]);
    const conexion = new Conexion('otra', adaptadorDeDisco(otra), false);
    const sesion = iniciarSesionReal('otra', await conexion.leer());
    expect(avisosReales(sesion).lineas.join(' ')).toMatch(/SHA256/);
    expect(construirPantallaReal(sesion, OPCIONES).grafo.nodos).toEqual([]);
    rmSync(otra, { recursive: true, force: true });
  });
});
