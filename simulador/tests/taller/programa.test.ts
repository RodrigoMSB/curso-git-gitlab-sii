/**
 * El programa local del taller (SPEC 026, puntos 2 y 3, y 5.4 y 5.5).
 *
 * Se arranca como lo arranca el alumno y se le habla por HTTP, como le habla
 * la pagina. Lo que la pagina hace con las respuestas se prueba en el
 * navegador, en `tests/navegador/taller.navegador.ts`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirTaller, orden, pedir, type Taller, WINDOWS } from './instalacion';

let taller: Taller;
let antes: string[] = [];

/** Cada archivo del clon con su tamaño y fecha: el taller no puede escribir ahi (3.11). */
function fotoDelClon(clon: string): string[] {
  const salida: string[] = [];
  const recorrer = (carpeta: string): void => {
    for (const entrada of readdirSync(carpeta, { withFileTypes: true })) {
      const ruta = join(carpeta, entrada.name);
      if (entrada.isDirectory()) recorrer(ruta);
      else salida.push(`${relative(clon, ruta)}:${statSync(ruta).size}:${statSync(ruta).mtimeMs}`);
    }
  };
  recorrer(clon);
  return salida.sort();
}


beforeAll(async () => {
  taller = await abrirTaller({ extra: { TALLER_LIMITE: '8' } });
  antes = fotoDelClon(taller.clon);
}, 180_000);

afterAll(() => {
  taller?.cerrar();
  if (taller !== undefined) rmSync(taller.raiz, { recursive: true, force: true });
});

describe('el arranque, como lo hace el alumno (2.2 a 2.4)', () => {
  it('la ventana dice en dos lineas que el taller esta listo y que no se cierre, y abre el navegador', () => {
    const lineas = taller.ventana().trim().split(/\r?\n/);
    expect(lineas).toHaveLength(2);
    expect(lineas[0]).toMatch(/listo/);
    expect(lineas[0]).toMatch(/No cierres esta ventana/);
    expect(lineas[1]).toContain(taller.direccion);
    expect(taller.direccion).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/\?clave=[\w-]{20,}$/);
  });

  it('la consola parte en taller-git-trabajo, hermana del clon, que el programa creo', async () => {
    expect(existsSync(taller.trabajo)).toBe(true);
    const r = await orden(taller, 'pwd');
    expect(r.codigo).toBe(0);
    expect(r.salida.trim()).toMatch(/taller-git-trabajo$/);
  });

  it('la pagina que sirve es SIMULADOR.html', async () => {
    const r = await pedir(taller, `/?clave=${taller.clave}`, { clave: null, origen: null });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toBe(readFileSync(join(taller.clon, 'SIMULADOR.html'), 'utf8'));
  });
});

describe('solo la pagina propia puede mandar ordenes (3.1, 3.2 y 5.4)', () => {
  const marca = (): string => join(taller.trabajo, 'hackeo.txt');
  const intentos: [string, Parameters<typeof pedir>[2]][] = [
    ['sin clave', { clave: null }],
    ['con clave equivocada', { clave: 'no-es-la-clave' }],
    ['con otro Origin', { origen: 'https://example.com' }],
    ['con Origin null', { origen: 'null' }],
    ['con otro Host, como un dominio que se hace pasar por 127.0.0.1', { host: 'malicioso.example:80' }],
  ];
  for (const [nombre, opciones] of intentos) {
    it(`una orden ${nombre} recibe 403 y no se ejecuta`, async () => {
      rmSync(marca(), { force: true });
      const r = await pedir(taller, '/api/orden', { ...opciones, cuerpo: { orden: 'echo si > hackeo.txt' } });
      expect(r.estado).toBe(403);
      expect(r.cabeceras['access-control-allow-origin']).toBeUndefined();
      await new Promise((ok) => setTimeout(ok, 300));
      expect(existsSync(marca())).toBe(false);
    });
  }

  it('el estado tampoco se entrega sin clave', async () => {
    expect((await pedir(taller, '/api/estado', { clave: null })).estado).toBe(403);
    expect((await pedir(taller, '/api/sesion', { clave: 'otra' })).estado).toBe(403);
  });

  it('la pagina no se entrega sin la clave en la direccion', async () => {
    expect((await pedir(taller, '/', { clave: null, origen: null })).estado).toBe(403);
    expect((await pedir(taller, '/?clave=otra', { clave: null, origen: null })).estado).toBe(403);
  });

  it('la consulta previa de CORS recibe 403 y ninguna cabecera CORS', async () => {
    const r = await pedir(taller, '/api/orden', { metodo: 'OPTIONS', origen: 'https://example.com', clave: null });
    expect(r.estado).toBe(403);
    expect(Object.keys(r.cabeceras).filter((c) => c.startsWith('access-control'))).toEqual([]);
  });

  it('con la clave y el origen propios, la orden si se ejecuta', async () => {
    rmSync(marca(), { force: true });
    expect((await orden(taller, 'echo si > hackeo.txt')).codigo).toBe(0);
    expect(existsSync(marca())).toBe(true);
    rmSync(marca(), { force: true });
  });

  it('escucha solo en 127.0.0.1', async () => {
    const r = await fetch(`http://localhost:${taller.puerto}/`).catch(() => null);
    // localhost puede resolverse a ::1, donde no hay nadie escuchando; si llega a 127.0.0.1, sin clave es 403.
    expect(r === null || r.status === 403).toBe(true);
  });
});

describe('la consola es una terminal (3.4, 3.5, 3.9, 3.10)', () => {
  it('cd cambia la carpeta y se recuerda en la orden siguiente', async () => {
    await orden(taller, 'mkdir -p lab-00/recetario');
    const r = await orden(taller, 'cd lab-00/recetario');
    expect(r.carpeta.replace(/\\/g, '/')).toMatch(/taller-git-trabajo\/lab-00\/recetario$/);
    expect((await orden(taller, 'pwd')).salida.trim()).toMatch(/lab-00\/recetario$/);
    const estado = JSON.parse((await pedir(taller, '/api/estado')).cuerpo) as { indicador: string; repositorio: boolean };
    expect(estado.repositorio).toBe(false);
    // Relativa a la carpeta del usuario, con ~, como Git Bash; aqui la carpeta temporal no esta dentro de ella.
    expect(estado.indicador).toMatch(/taller-git-trabajo\/lab-00\/recetario$/);
  });

  it('git log largo no espera la tecla q', async () => {
    await orden(taller, 'git init -q -b main');
    for (let k = 0; k < 3; k += 1) await orden(taller, `git -c user.name=P -c user.email=p@sii.cl commit -q --allow-empty -m "vacia ${k}"`);
    const inicio = Date.now();
    const r = await orden(taller, 'git log');
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain('vacia 0');
    expect(Date.now() - inicio).toBeLessThan(5000);
  });

  it('tildes y eñes en nombres de archivo y en mensajes', async () => {
    await orden(taller, 'echo "ñandú y canción" > "árbol-ñ.md"');
    await orden(taller, 'git add "árbol-ñ.md"');
    const r = await orden(taller, 'git -c user.name=P -c user.email=p@sii.cl commit -m "se agrega el árbol del ñandú"');
    expect(r.codigo).toBe(0);
    expect(r.salida).toContain('se agrega el árbol del ñandú');
    expect((await orden(taller, 'cat "árbol-ñ.md"')).salida.trim()).toBe('ñandú y canción');
    const estado = JSON.parse((await pedir(taller, '/api/estado')).cuerpo) as {
      confirmaciones: { mensaje: string }[];
    };
    expect(estado.confirmaciones[0]?.mensaje).toBe('se agrega el árbol del ñandú');
    await orden(taller, 'echo mas >> "árbol-ñ.md"');
    const cambios = JSON.parse((await pedir(taller, '/api/estado')).cuerpo) as { cambios: { ruta: string }[] };
    expect(cambios.cambios.map((c) => c.ruta)).toEqual(['árbol-ñ.md']);
    await orden(taller, 'git checkout -- .');
  });

  it('una orden a la vez: la segunda, mientras corre la primera, recibe 409', async () => {
    const primera = orden(taller, 'sleep 2');
    await new Promise((ok) => setTimeout(ok, 400));
    const segunda = await pedir(taller, '/api/orden', { cuerpo: { orden: 'echo segunda' } });
    expect(segunda.estado).toBe(409);
    expect((await primera).codigo).toBe(0);
  });
});

describe('el editor (3.6 y 5.5)', () => {
  const preparar = async (): Promise<void> => {
    await orden(taller, 'echo x >> editor.txt && git add editor.txt');
  };

  it('sin editor configurado, git commit termina de inmediato con un mensaje en español', async () => {
    await preparar();
    const inicio = Date.now();
    const r = await orden(taller, 'git -c user.name=P -c user.email=p@sii.cl commit');
    expect(Date.now() - inicio).toBeLessThan(5000);
    expect(r.codigo).not.toBe(0);
    expect(r.error).toContain('No hay un editor que la consola del taller pueda abrir');
    expect(r.error).toContain('git config --global core.editor "code --wait"');
  });

  it('con vi configurado, que necesita teclado, tambien termina de inmediato', async () => {
    const inicio = Date.now();
    const r = await orden(taller, 'git -c core.editor=vi -c user.name=P -c user.email=p@sii.cl commit');
    expect(Date.now() - inicio).toBeLessThan(5000);
    expect(r.error).toContain('No hay un editor que la consola del taller pueda abrir');
  });

  it('con un editor que no esta instalado, igual', async () => {
    const r = await orden(taller, 'git -c "core.editor=code-que-no-existe --wait" -c user.name=P -c user.email=p@sii.cl commit');
    expect(r.error).toContain('No hay un editor que la consola del taller pueda abrir');
  });

  it('con un editor que espera, como code --wait, la orden espera a que se cierre y usa el mensaje', async () => {
    // El editor de mentira tarda tres segundos y escribe el mensaje, como el alumno en VS Code.
    const editor = join(taller.raiz, 'editor-que-espera.sh');
    writeFileSync(editor, '#!/bin/sh\nsleep 3\nprintf "mensaje escrito en el editor\\n" > "$1"\n');
    if (!WINDOWS) execFileSync('chmod', ['+x', editor]);
    const ruta = editor.replace(/\\/g, '/');
    const inicio = Date.now();
    const r = await orden(taller, `git -c "core.editor=sh '${ruta}'" -c user.name=P -c user.email=p@sii.cl commit`);
    expect(Date.now() - inicio, JSON.stringify(r)).toBeGreaterThanOrEqual(3000);
    expect(r.codigo).toBe(0);
    expect((await orden(taller, 'git log -1 --format=%s')).salida.trim()).toBe('mensaje escrito en el editor');
  });
});

describe('ordenes interactivas y limite de tiempo (3.7 y 3.8)', () => {
  for (const texto of ['git add -p', 'git add -i', 'git add --patch editor.txt', 'git checkout -p', 'git clean -i', 'vi README.md']) {
    it(`«${texto}» termina de inmediato y sugiere Git Bash`, async () => {
      const inicio = Date.now();
      const r = await orden(taller, texto);
      expect(Date.now() - inicio).toBeLessThan(3000);
      expect(r.codigo).not.toBe(0);
      expect(r.error).toMatch(/espera respuestas por teclado/);
      expect(r.error).toMatch(/Git Bash/);
    });
  }

  it('una orden que pasa el limite se detiene, lo explica, y la consola sigue sirviendo', async () => {
    const inicio = Date.now();
    const r = await orden(taller, 'sleep 30');
    expect(Date.now() - inicio).toBeLessThan(20_000);
    expect(r.detenida).toBe(true);
    expect(r.error).toMatch(/no terminó en .* y se detuvo/);
    expect((await orden(taller, 'echo sigo')).salida.trim()).toBe('sigo');
  }, 40_000);

  it('Git no pide usuario ni clave', async () => {
    const inicio = Date.now();
    const r = await orden(taller, 'git ls-remote https://gitlab.invalid/grupo/proyecto.git');
    expect(Date.now() - inicio).toBeLessThan(15_000);
    expect(r.codigo).not.toBe(0);
  }, 30_000);
});

describe('el estado y la vuelta a la pagina (2.7, 2.8, 4.3)', () => {
  it('la huella no cambia si no se hizo nada, y cambia con un archivo editado por fuera', async () => {
    const primero = JSON.parse((await pedir(taller, '/api/estado')).cuerpo) as { huella: string };
    const igual = JSON.parse((await pedir(taller, `/api/estado?huella=${primero.huella}`)).cuerpo) as { igual?: boolean };
    expect(igual.igual).toBe(true);
    writeFileSync(join(taller.trabajo, 'lab-00', 'recetario', 'editor.txt'), 'editado en VS Code\n');
    const despues = JSON.parse((await pedir(taller, `/api/estado?huella=${primero.huella}`)).cuerpo) as {
      igual?: boolean;
      cambios?: { ruta: string }[];
    };
    expect(despues.igual).toBeUndefined();
    expect(despues.cambios?.map((c) => c.ruta)).toContain('editor.txt');
  });

  it('otro doble clic no abre un segundo taller: vuelve al mismo, en la misma carpeta', async () => {
    const otro = await abrirTaller({ raiz: taller.raiz });
    try {
      expect(otro.direccion).toBe(taller.direccion);
      expect(otro.ventana()).toMatch(/ya estaba abierto/);
      const sesion = JSON.parse((await pedir(taller, '/api/sesion')).cuerpo) as { carpeta: string; historial: unknown[] };
      expect(sesion.carpeta.replace(/\\/g, '/')).toMatch(/lab-00\/recetario$/);
      expect(sesion.historial.length).toBeGreaterThan(5);
    } finally {
      otro.cerrar();
    }
  }, 180_000);

  it('no escribio nada dentro del clon ni en la configuracion global de Git (3.11)', () => {
    expect(fotoDelClon(taller.clon)).toEqual(antes);
    expect(existsSync(join(taller.casa, '.gitconfig'))).toBe(false);
  });
});
