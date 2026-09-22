/**
 * Chrome conducido por su protocolo de depuracion, sin bibliotecas.
 *
 * Lo comparten las herramientas de capturas. Abre el archivo unico ya
 * construido desde el sistema de archivos, que es como lo abre el
 * participante, y ofrece las pocas ordenes que hacen falta: escribir en la
 * consola, cambiar de escenario, pulsar un boton, evaluar y capturar.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

export { esperar };

/**
 * Abre Chrome sobre `pagina` y devuelve las ordenes para conducirlo.
 *
 * `perfil` es una carpeta de datos propia, para no tocar el Chrome de nadie.
 */
export async function abrirChrome({ pagina, perfil, puerto, ancho, alto, ver = false }) {
  const ruta = CHROMES.find((candidata) => existsSync(candidata));
  if (ruta === undefined) throw new Error(`No se encontro Chrome. Se busco en:\n  ${CHROMES.join('\n  ')}`);

  const chrome = spawn(
    ruta,
    [
      ...(ver ? [] : ['--headless=new']),
      `--remote-debugging-port=${puerto}`,
      `--user-data-dir=${perfil}`,
      '--allow-file-access-from-files',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${ancho},${alto}`,
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    // En su propio grupo de procesos, para poder cerrarlo entero: matar solo
    // el principal deja vivos a sus ayudantes, que retienen el perfil.
    { stdio: ['ignore', 'ignore', 'pipe'], detached: true },
  );
  chrome.stderr.on('data', () => {});
  const matar = () => {
    try {
      process.kill(-chrome.pid, 'SIGTERM');
    } catch {
      chrome.kill();
    }
  };

  let ficha;
  // Un perfil nuevo tarda en arrancar la primera vez: se espera hasta un minuto.
  for (let intento = 0; intento < 240 && ficha === undefined; intento += 1) {
    try {
      const fichas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
      ficha = fichas.find((candidata) => candidata.type === 'page' && candidata.webSocketDebuggerUrl);
    } catch {
      // Todavia no responde.
    }
    if (ficha === undefined) await esperar(250);
  }
  if (ficha === undefined) {
    // Un Chrome que queda vivo retiene el perfil, y el siguiente le entrega el
    // control a el y se cierra: la proxima corrida fallaria igual.
    matar();
    throw new Error('Chrome no expuso ninguna pagina');
  }

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

  async function ventana(anchoNuevo, altoNuevo) {
    await pedir('Emulation.setDeviceMetricsOverride', {
      width: anchoNuevo,
      height: altoNuevo,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await esperar(150);
  }

  async function movimientoReducido(activo) {
    await pedir('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: activo ? 'reduce' : 'no-preference' }],
    });
  }

  async function navegar(url) {
    await pedir('Page.navigate', { url });
    await esperar(900);
  }

  async function escribir(texto) {
    await evaluar(`document.querySelector('input[aria-label="Orden de Git"]').focus(); true`);
    for (const caracter of texto) {
      await pedir('Input.dispatchKeyEvent', { type: 'keyDown', text: caracter });
      await pedir('Input.dispatchKeyEvent', { type: 'keyUp' });
    }
    await esperar(150);
  }

  async function entrar() {
    const tecla = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await pedir('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...tecla });
    await pedir('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', text: '\r', unmodifiedText: '\r' });
    await pedir('Input.dispatchKeyEvent', { type: 'keyUp', ...tecla });
    await esperar(400);
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
    await esperar(400);
  }

  /** Pulsa el boton cuyo texto empieza por `inicio`. Devuelve si lo encontro. */
  async function pulsar(inicio) {
    const hallado = await evaluar(`
      (() => {
        const boton = [...document.querySelectorAll('button')]
          .find((candidato) => candidato.textContent.trim().startsWith(${JSON.stringify(inicio)}));
        if (boton === undefined) return false;
        boton.click();
        return true;
      })()
    `);
    await esperar(300);
    return hallado;
  }

  async function capturar() {
    const { data } = await pedir('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    return Buffer.from(data, 'base64');
  }

  function cerrar() {
    socket.close();
    matar();
  }

  await ventana(ancho, alto);
  return { pedir, evaluar, ventana, movimientoReducido, navegar, escribir, entrar, ejecutar, escenario, pulsar, capturar, cerrar };
}
