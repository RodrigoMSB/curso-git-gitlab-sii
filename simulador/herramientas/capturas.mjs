/**
 * Capturas de la pantalla real.
 *
 * Abre en Chrome el archivo unico ya construido y lo conduce como lo haria un
 * participante: escribiendo en la consola y cambiando de escenario con el
 * selector de la barra. De cada estado guarda un PNG en `docs/capturas`.
 *
 * No usa ninguna biblioteca: habla el protocolo de depuracion de Chrome por
 * un socket, que es lo unico que hace falta y no agrega dependencias al
 * proyecto.
 *
 *   npm run build && node herramientas/capturas.mjs
 *
 * Con `--ver` abre la ventana en vez de trabajar en segundo plano, que sirve
 * para mirar por que una captura no salio como se esperaba.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as esperar } from 'node:timers/promises';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIMULADOR = resolve(AQUI, '..');
const RAIZ = resolve(SIMULADOR, '..');
const PAGINA = `file://${join(SIMULADOR, 'dist', 'index.html')}`;
const DESTINO = join(RAIZ, 'docs', 'capturas');
const PERFIL = join(SIMULADOR, 'node_modules', '.cache', 'chrome-capturas');
const PUERTO = 9333;

/** Ventana de trabajo. Es el ancho minimo que el punto 10.5 exige sostener. */
const ANCHO = 1600;
const ALTO = 1000;

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function rutaDeChrome() {
  const encontrado = CHROMES.find((ruta) => existsSync(ruta));
  if (encontrado === undefined) {
    throw new Error(`No se encontro Chrome. Se busco en:\n  ${CHROMES.join('\n  ')}`);
  }
  return encontrado;
}

if (!existsSync(join(SIMULADOR, 'dist', 'index.html'))) {
  console.error('Falta dist/index.html. Hay que construir primero: npm run build');
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });

const chrome = spawn(
  rutaDeChrome(),
  [
    ...(process.argv.includes('--ver') ? [] : ['--headless=new']),
    `--remote-debugging-port=${PUERTO}`,
    `--user-data-dir=${PERFIL}`,
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    '--force-device-scale-factor=2',
    `--window-size=${ANCHO},${ALTO}`,
    '--no-first-run',
    '--no-default-browser-check',
    PAGINA,
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
chrome.stderr.on('data', () => {});

/** Espera a que Chrome exponga la pestana y devuelve su ficha. */
async function fichaDeLaPagina() {
  for (let intento = 0; intento < 60; intento += 1) {
    try {
      const respuesta = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
      const fichas = await respuesta.json();
      const ficha = fichas.find((candidata) => candidata.type === 'page' && candidata.webSocketDebuggerUrl);
      if (ficha !== undefined) return ficha;
    } catch {
      // Todavia no responde: se reintenta.
    }
    await esperar(250);
  }
  throw new Error('Chrome no expuso ninguna pagina');
}

const ficha = await fichaDeLaPagina();
const socket = new WebSocket(ficha.webSocketDebuggerUrl);
await new Promise((listo, falla) => {
  socket.addEventListener('open', listo, { once: true });
  socket.addEventListener('error', falla, { once: true });
});

let ultimoId = 0;
const pendientes = new Map();
socket.addEventListener('message', (evento) => {
  const mensaje = JSON.parse(evento.data);
  const pendiente = pendientes.get(mensaje.id);
  if (pendiente === undefined) return;
  pendientes.delete(mensaje.id);
  if (mensaje.error) pendiente.falla(new Error(JSON.stringify(mensaje.error)));
  else pendiente.listo(mensaje.result);
});

function pedir(metodo, parametros = {}) {
  ultimoId += 1;
  const id = ultimoId;
  socket.send(JSON.stringify({ id, method: metodo, params: parametros }));
  return new Promise((listo, falla) => pendientes.set(id, { listo, falla }));
}

async function evaluar(expresion) {
  const resultado = await pedir('Runtime.evaluate', {
    expression: expresion,
    returnByValue: true,
    awaitPromise: true,
  });
  if (resultado.exceptionDetails !== undefined) {
    throw new Error(resultado.exceptionDetails.exception?.description ?? 'fallo al evaluar');
  }
  return resultado.result.value;
}

await pedir('Page.enable');
await pedir('Runtime.enable');
await pedir('Emulation.setDeviceMetricsOverride', {
  width: ANCHO,
  height: ALTO,
  deviceScaleFactor: 2,
  mobile: false,
});
await pedir('Page.navigate', { url: PAGINA });
await esperar(1200);

async function enfocarConsola() {
  await evaluar(`document.querySelector('input[aria-label="Orden de Git"]').focus(); true`);
}

/** Escribe caracter por caracter, como una persona: son teclas de verdad. */
async function escribir(texto) {
  await enfocarConsola();
  for (const caracter of texto) {
    await pedir('Input.dispatchKeyEvent', { type: 'keyDown', text: caracter });
    await pedir('Input.dispatchKeyEvent', { type: 'keyUp' });
    await esperar(12);
  }
  await esperar(220);
}

async function entrar() {
  const tecla = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  await pedir('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...tecla });
  await pedir('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', text: '\r', unmodifiedText: '\r' });
  await pedir('Input.dispatchKeyEvent', { type: 'keyUp', ...tecla });
  await esperar(260);
}

async function ejecutar(orden) {
  await escribir(orden);
  await entrar();
}

/** El selector lo gobierna React: hay que avisarle del cambio, no basta asignar. */
async function escenario(id) {
  await evaluar(`
    (() => {
      const selector = document.querySelector('select');
      const asignar = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
      asignar.call(selector, ${JSON.stringify(id)});
      selector.dispatchEvent(new Event('change', { bubbles: true }));
      return selector.value;
    })()
  `);
  await esperar(500);
}

async function capturar(nombre) {
  const { data } = await pedir('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(DESTINO, nombre), Buffer.from(data, 'base64'));
  console.log(`  guardada ${nombre}`);
}

/** Comprueba contra el documento que lo capturado es lo que se pidio. */
async function comprobar(fragmento) {
  const presente = await evaluar(
    `document.body.innerText.includes(${JSON.stringify(fragmento)})`,
  );
  console.log(`  ${presente ? 'ok  ' : 'FALTA'} "${fragmento}"`);
  if (!presente) process.exitCode = 1;
}

console.log('lab-01 · el recetario nace');
await escenario('lab-01');
await capturar('01-lab-01-inicio.png');
await comprobar('El recetario nace');

console.log('lab-02 · leer la historia y abrir la caja');
await escenario('lab-02');
await capturar('02-lab-02-inicio.png');
await comprobar('Leer la historia y abrir la caja');

console.log('lab-05 · tres ramas con destinos distintos');
await escenario('lab-05');
await capturar('03-lab-05-inicio.png');
await comprobar('andina');

console.log('lab-05 · rama nueva y confirmacion');
await ejecutar('git switch -c postres');
await ejecutar('echo "sopaipillas" >> platos.md');
await ejecutar('git add platos.md');
await ejecutar('git commit -m "agrega sopaipillas al listado"');
await capturar('04-lab-05-rama-nueva-y-confirmacion.png');
await comprobar('postres');

console.log('lab-05 · previsualizacion de la fusion, escrita y sin ejecutar');
await escenario('lab-05');
await escribir('git merge andina');
await esperar(400);
await capturar('05-lab-05-previsualizacion-fusion.png');
await comprobar('Entrar ejecuta, Escape descarta');

console.log('lab-07 · despues del rebase');
await escenario('lab-07');
await ejecutar('git rebase main');
await capturar('06-lab-07-despues-del-rebase.png');
await comprobar('sin referencia');

socket.close();
chrome.kill();
console.log(process.exitCode === 1 ? 'listo, con comprobaciones fallidas' : 'listo');
