/**
 * El modo conectado, listo para clase (SPEC 024): lo que la pagina vigila en
 * el directorio de trabajo, la carpeta sin repositorio y la carpeta que se
 * pierde.
 *
 * Aqui la carpeta es un directorio del disco leido con Node, con el mismo
 * contrato que la carpeta del navegador. Lo que la pagina hace sola en un
 * navegador de verdad se prueba en `tests/navegador/real.navegador.ts`.
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  avisosReales,
  Conexion,
  construirPantallaReal,
  estadoDeConexion,
  iniciarSesionReal,
  actualizarSesionReal,
  motivoDeFalla,
} from '../../src/vista';
import { marcaDelRepositorio } from '../../src/real/vigilancia';
import { adaptadorDeDisco } from './disco';

// Cada huella que el lector calcula pasa por aqui: la prueba cuenta cuantas.
const calculadas: string[] = [];
vi.mock('../../src/real/sha1', async (original) => {
  const modulo = await original<typeof import('../../src/real/sha1')>();
  return {
    ...modulo,
    huellaDeArchivo: (contenido: Uint8Array): string => {
      calculadas.push(new TextDecoder().decode(contenido));
      return modulo.huellaDeArchivo(contenido);
    },
  };
});

const carpetas: string[] = [];
afterEach(() => {
  for (const dir of carpetas.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function carpeta(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vigilar-'));
  carpetas.push(dir);
  return dir;
}

function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=P', '-c', 'user.email=p@sii.cl', ...args], { cwd: dir }).toString();
}

/** Un repositorio con tres archivos confirmados y un `.gitignore`. */
function repositorio(): string {
  const dir = carpeta();
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, '.gitignore'), '*.tmp\nconstruido/\n');
  for (const nombre of ['a.md', 'b.md', 'c.md']) writeFileSync(join(dir, nombre), `${nombre}\n`);
  mkdirSync(join(dir, 'construido'));
  writeFileSync(join(dir, 'construido', 'seguido.txt'), 'uno\n');
  git(dir, 'add', '.');
  git(dir, 'add', '-f', 'construido/seguido.txt');
  git(dir, 'commit', '-qm', 'base');
  return dir;
}

const OPCIONES = { previsualizacionActiva: true, entrada: '', modoRelator: false };

describe('la marca respeta el .gitignore (2.3)', () => {
  it('no cambia con un archivo ignorado', async () => {
    const dir = repositorio();
    const antes = await marcaDelRepositorio(adaptadorDeDisco(dir));
    writeFileSync(join(dir, 'borrador.tmp'), 'nadie lo sigue\n');
    expect(await marcaDelRepositorio(adaptadorDeDisco(dir))).toBe(antes);
  });

  it('no cambia con un archivo nuevo dentro de una carpeta ignorada', async () => {
    const dir = repositorio();
    const antes = await marcaDelRepositorio(adaptadorDeDisco(dir));
    writeFileSync(join(dir, 'construido', 'salida.bin'), 'x\n');
    expect(await marcaDelRepositorio(adaptadorDeDisco(dir))).toBe(antes);
  });

  it('si cambia con un archivo seguido dentro de una carpeta ignorada, porque git status si lo ve', async () => {
    const dir = repositorio();
    const antes = await marcaDelRepositorio(adaptadorDeDisco(dir));
    appendFileSync(join(dir, 'construido', 'seguido.txt'), 'dos\n');
    expect(await marcaDelRepositorio(adaptadorDeDisco(dir))).not.toBe(antes);
  });

  it('si cambia con un archivo borrado sin Git', async () => {
    const dir = repositorio();
    const antes = await marcaDelRepositorio(adaptadorDeDisco(dir));
    unlinkSync(join(dir, 'b.md'));
    expect(await marcaDelRepositorio(adaptadorDeDisco(dir))).not.toBe(antes);
  });

  it('si cambia cuando el .gitignore deja de ignorar algo que ya estaba', async () => {
    const dir = repositorio();
    writeFileSync(join(dir, 'borrador.tmp'), 'x\n');
    const antes = await marcaDelRepositorio(adaptadorDeDisco(dir));
    writeFileSync(join(dir, '.gitignore'), 'construido/\n');
    expect(await marcaDelRepositorio(adaptadorDeDisco(dir))).not.toBe(antes);
  });
});

describe('la huella de un archivo que no cambio no se vuelve a calcular (2.3)', () => {
  it('dos archivos editados uno despues del otro: cada uno se calcula una vez', async () => {
    const dir = repositorio();
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    await conexion.leer();
    calculadas.length = 0;

    appendFileSync(join(dir, 'a.md'), 'cambio en a\n');
    expect((await conexion.revisar())?.tipo).toBe('leido');
    appendFileSync(join(dir, 'b.md'), 'cambio en b\n');
    expect((await conexion.revisar())?.tipo).toBe('leido');

    const deA = calculadas.filter((texto) => texto.includes('cambio en a'));
    const deB = calculadas.filter((texto) => texto.includes('cambio en b'));
    expect({ a: deA.length, b: deB.length, total: calculadas.length }).toEqual({ a: 1, b: 1, total: 2 });
  });
});

describe('una carpeta sin repositorio (3)', () => {
  it('se acepta, dice que todavia no hay repositorio y muestra los archivos como sueltos', async () => {
    const dir = carpeta();
    writeFileSync(join(dir, 'notas.txt'), 'antes de git init\n');
    mkdirSync(join(dir, 'recetas'));
    writeFileSync(join(dir, 'recetas', 'pebre.md'), 'pebre\n');
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    const sesion = iniciarSesionReal('recetario', await conexion.leer());

    expect(estadoDeConexion(sesion).estado).toBe('sin-repositorio');
    expect(avisosReales(sesion).lineas.join(' ')).toMatch(/todavía no es un repositorio/);
    const pantalla = construirPantallaReal(sesion, OPCIONES);
    const trabajo = pantalla.columnas.find((c) => c.clave === 'trabajo');
    expect(trabajo?.elementos.map((e) => `${e.texto}:${e.tono}`)).toEqual(['notas.txt:suelto', 'recetas/pebre.md:suelto']);
    expect(pantalla.grafo.nodos).toEqual([]);
  });

  it('en cuanto aparece .git, la siguiente revision dibuja el repositorio', async () => {
    const dir = carpeta();
    writeFileSync(join(dir, 'notas.txt'), 'antes de git init\n');
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    let sesion = iniciarSesionReal('recetario', await conexion.leer());
    expect(await conexion.revisar()).toBeNull();

    git(dir, 'init', '-q', '-b', 'main');
    const lectura = await conexion.revisar();
    expect(lectura?.tipo).toBe('leido');
    if (lectura === null) return;
    sesion = actualizarSesionReal(sesion, lectura);
    expect(estadoDeConexion(sesion).estado).toBe('en-vivo');
    const trabajo = construirPantallaReal(sesion, OPCIONES).columnas.find((c) => c.clave === 'trabajo');
    expect(trabajo?.elementos.map((e) => `${e.texto}:${e.tono}`)).toEqual(['notas.txt:nuevo']);
  });

  it('un archivo nuevo en la carpeta sin repositorio tambien se ve', async () => {
    const dir = carpeta();
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    await conexion.leer();
    writeFileSync(join(dir, 'README.md'), '# Recetario\n');
    const lectura = await conexion.revisar();
    expect(lectura?.tipo).toBe('sin-repositorio');
  });
});

describe('la carpeta que se pierde (5.1)', () => {
  it('si la carpeta deja de existir, la sesion lo dice y no se queda con el dibujo viejo', async () => {
    const dir = repositorio();
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    let sesion = iniciarSesionReal('recetario', await conexion.leer());
    expect(estadoDeConexion(sesion).estado).toBe('en-vivo');

    rmSync(dir, { recursive: true, force: true });
    const lectura = await conexion.revisar();
    expect(lectura?.tipo).toBe('perdida');
    if (lectura === null) return;
    sesion = actualizarSesionReal(sesion, lectura);
    const indicador = estadoDeConexion(sesion);
    expect(indicador.estado).toBe('perdida');
    expect(indicador.texto).toMatch(/ya no existe/);
  });
});

describe('cuando el navegador no deja abrir la carpeta (1.4)', () => {
  it('una politica que bloquea la API se dice en una linea, y los escenarios siguen', () => {
    for (const nombre of ['SecurityError', 'NotAllowedError']) {
      const linea = motivoDeFalla(new DOMException('blocked by policy', nombre));
      expect(linea).toMatch(/no permite que el navegador abra carpetas/);
      expect(linea).toMatch(/escenarios siguen funcionando/);
      expect(linea).not.toMatch(/blocked by policy/);
    }
  });

  it('otra falla dice cual fue, en la misma linea', () => {
    expect(motivoDeFalla(new Error('algo raro'))).toMatch(/^No se pudo abrir la carpeta: algo raro\. Los escenarios siguen funcionando\.$/);
  });
});

describe('la consola en modo conectado (5.2)', () => {
  it('antes de escribir nada, dice que previsualiza y no ejecuta', async () => {
    const dir = repositorio();
    const conexion = new Conexion('recetario', adaptadorDeDisco(dir), false);
    const sesion = iniciarSesionReal('recetario', await conexion.leer());
    const texto = construirPantallaReal(sesion, OPCIONES).renglones.map((r) => r.texto).join(' ');
    expect(texto).toMatch(/previsualiza/);
    expect(texto).toMatch(/no ejecuta/);
    expect(texto).toMatch(/Git Bash/);
  });
});
