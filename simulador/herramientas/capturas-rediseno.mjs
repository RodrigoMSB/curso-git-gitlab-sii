/**
 * Capturas y mediciones del rediseño visual (SPEC 013).
 *
 *   node herramientas/capturas-rediseno.mjs capturar <salida> [pagina.html]
 *   node herramientas/capturas-rediseno.mjs comparar <antes> <despues> <salida>
 *
 * `capturar` recorre los ocho escenarios en modo normal y en modo relator, en
 * cada tema que la pantalla ofrezca, mas dos estados que dependen del
 * contraste: confirmaciones huerfanas tras un rebase y una fusion
 * previsualizada sin ejecutar. De cada una guarda la imagen, y ademas mide lo
 * que no conviene afirmar a ojo: si la pagina se desborda a lo ancho en tres
 * anchos de ventana, y la letra mas chica que el navegador llego a pintar.
 *
 * `comparar` cruza cada imagen con la del mismo nombre de otra corrida,
 * contando pixeles distintos dentro de Chrome, sin bibliotecas. Las
 * instrucciones permanentes del proyecto piden no revisar capturas una por
 * una: esto dice cuales cambiaron y cuanto, y arma pares lado a lado de las
 * que representan el cambio.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirChrome, esperar } from './cdp.mjs';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const SIMULADOR = resolve(AQUI, '..');
const PERFIL = join(SIMULADOR, 'node_modules', '.cache', 'chrome-rediseno');

const ESCENARIOS = ['01', '02', '03', '04', '05', '06', '07', '09'];
const ANCHO = 1600;
const ALTO = 1000;
/** Anchos donde se mide el desborde: el minimo del punto 10.5, el de trabajo y uno de proyector. */
const ANCHOS = [1280, 1600, 1920];

const [accion, ...resto] = process.argv.slice(2);

/** La letra mas chica pintada, en pixeles de pantalla. En el SVG se corrige por su escala. */
const MEDIR_LETRA = `
  (() => {
    let minimo = Infinity;
    let donde = '';
    for (const elemento of document.querySelectorAll('body *')) {
      const conTexto = [...elemento.childNodes].some(
        (nodo) => nodo.nodeType === 3 && nodo.textContent.trim() !== '',
      );
      if (!conTexto) continue;
      const caja = elemento.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      const estilo = getComputedStyle(elemento);
      if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
      let tamano = parseFloat(estilo.fontSize);
      const svg = elemento.closest('svg');
      if (svg !== null && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
        tamano *= svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      }
      if (tamano < minimo) {
        minimo = tamano;
        donde = elemento.tagName.toLowerCase() + ' · ' + elemento.textContent.trim().slice(0, 40);
      }
    }
    return { minimo: Math.round(minimo * 100) / 100, donde };
  })()
`;

const MEDIR_DESBORDE = `
  (() => ({
    desborde: document.documentElement.scrollWidth - window.innerWidth,
    alto: document.documentElement.scrollHeight,
  }))()
`;

async function capturarTodo(salida, pagina) {
  mkdirSync(salida, { recursive: true });
  const url = `file://${resolve(pagina)}`;
  const navegador = await abrirChrome({ pagina: url, perfil: PERFIL, puerto: 9334, ancho: ANCHO, alto: ALTO });
  const mediciones = [];

  // Hay tema claro si la barra ofrece el interruptor. La corrida de antes del
  // rediseño no lo tiene, y se captura solo en oscuro.
  await navegador.navegar(`${url}?lab=02`);
  // Desde el SPEC 017 el tema es un boton redondo con sol y luna; antes era
  // un interruptor con texto. Se reconocen los dos para poder capturar una
  // corrida anterior como base.
  const BOTON_TEMA = `(document.querySelector('button[aria-label="Cambiar tema"]') ?? [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('tema claro')))`;
  const hayTemaClaro = await navegador.evaluar(`Boolean(${BOTON_TEMA})`);
  const hayTirador = await navegador.evaluar(`document.querySelector('[role="separator"]') !== null`);
  const temas = hayTemaClaro ? ['oscuro', 'claro'] : ['oscuro'];

  /** Deja la pantalla en el tema y el modo pedidos, recien abierta sobre un escenario. */
  async function preparar(lab, tema, modo, reparto = 'partida') {
    await navegador.navegar(`${url}?lab=${lab}`);
    if (tema === 'claro') {
      await navegador.evaluar(`${BOTON_TEMA}.click(); true`);
      await esperar(200);
    }
    // A veces el clic llega antes de que la pantalla termine de montarse y no
    // enciende nada; una captura de «relator» que en verdad es normal mide la
    // letra de otro modo. Se reintenta hasta confirmarlo en el documento.
    if (modo === 'relator') {
      for (let intento = 0; intento < 5; intento += 1) {
        await navegador.pulsar('modo relator');
        if (await navegador.evaluar(`document.querySelector('[data-relator]').dataset.relator === 'true'`)) break;
      }
      if (!(await navegador.evaluar(`document.querySelector('[data-relator]').dataset.relator === 'true'`))) {
        throw new Error(`el modo relator no se encendio en ${lab}`);
      }
    }
    // El reparto de la consola se lleva con el teclado, que es exacto: Inicio
    // al minimo y Fin al maximo (SPEC 017, punto 8.3).
    if (reparto !== 'partida') {
      await navegador.evaluar(`document.querySelector('[role="separator"]').focus(); true`);
      const tecla = reparto === 'minimo' ? { key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 } : { key: 'End', code: 'End', windowsVirtualKeyCode: 35 };
      await navegador.pedir('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...tecla });
      await navegador.pedir('Input.dispatchKeyEvent', { type: 'keyUp', ...tecla });
      await esperar(200);
    }
    // Sin foco en la consola no aparecen las lineas de ayuda, que dependen de
    // si el cursor esta ahi; se deja como al cargar, con el foco puesto.
    await esperar(350);
  }

  async function guardar(nombre, lab, tema, modo) {
    const letra = await navegador.evaluar(MEDIR_LETRA);
    const desbordes = {};
    for (const ancho of ANCHOS) {
      await navegador.ventana(ancho, ALTO);
      desbordes[ancho] = (await navegador.evaluar(MEDIR_DESBORDE)).desborde;
    }
    await navegador.ventana(ANCHO, ALTO);
    await esperar(200);
    writeFileSync(join(salida, `${nombre}.png`), await navegador.capturar());
    mediciones.push({ nombre, lab, tema, modo, letra, desbordes });
    console.log(
      `  ${nombre.padEnd(34)} letra ${String(letra.minimo).padStart(5)} px   desborde ${ANCHOS.map((ancho) => `${ancho}:${desbordes[ancho]}`).join(' ')}`,
    );
  }

  for (const tema of temas) {
    for (const modo of ['normal', 'relator']) {
      for (const lab of ESCENARIOS) {
        await preparar(lab, tema, modo);
        await guardar(`${tema}-${modo}-lab-${lab}`, lab, tema, modo);
      }
      // Huerfanas: el rebase del 07 deja las cuatro originales sin referencia.
      await preparar('07', tema, modo);
      await navegador.ejecutar('git rebase main');
      await guardar(`${tema}-${modo}-huerfanas`, '07', tema, modo);
      // Previsualizacion: la fusion que choca, escrita y sin ejecutar.
      await preparar('05', tema, modo);
      await navegador.escribir('git merge andina');
      await esperar(300);
      await guardar(`${tema}-${modo}-previsualizacion`, '05', tema, modo);
      // Los dos repartos extremos de la consola, sobre los dos grafos que mas
      // piden: el 05, el mas ancho, y el 07 tras el rebase, el mas alto.
      if (hayTirador) {
        for (const reparto of ['minimo', 'maximo']) {
          await preparar('05', tema, modo, reparto);
          await guardar(`${tema}-${modo}-lab-05-consola-${reparto}`, '05', tema, modo);
          await preparar('07', tema, modo, reparto);
          await navegador.ejecutar('git rebase main');
          await guardar(`${tema}-${modo}-huerfanas-consola-${reparto}`, '07', tema, modo);
        }
      }
    }
  }

  writeFileSync(join(salida, 'mediciones.json'), `${JSON.stringify(mediciones, null, 2)}\n`);
  navegador.cerrar();
}

/** Cuenta los pixeles distintos entre dos imagenes, dentro de Chrome, y arma el par lado a lado. */
const COMPARAR_EN_CHROME = (antes, despues) => `
  (async () => {
    const cargar = (datos) => new Promise((listo, falla) => {
      const imagen = new Image();
      imagen.onload = () => listo(imagen);
      imagen.onerror = falla;
      imagen.src = 'data:image/png;base64,' + datos;
    });
    const [a, b] = await Promise.all([cargar(${JSON.stringify(antes)}), cargar(${JSON.stringify(despues)})]);
    const ancho = Math.max(a.width, b.width);
    const alto = Math.max(a.height, b.height);
    const pixeles = (imagen) => {
      const lienzo = new OffscreenCanvas(ancho, alto);
      const contexto = lienzo.getContext('2d');
      contexto.drawImage(imagen, 0, 0);
      return contexto.getImageData(0, 0, ancho, alto).data;
    };
    const pa = pixeles(a);
    const pb = pixeles(b);
    let distintos = 0;
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 30) distintos += 1;
    }
    const par = new OffscreenCanvas(ancho * 2 + 24, alto);
    const contexto = par.getContext('2d');
    contexto.fillStyle = '#808080';
    contexto.fillRect(0, 0, par.width, par.height);
    contexto.drawImage(a, 0, 0);
    contexto.drawImage(b, ancho + 24, 0);
    const blob = await par.convertToBlob({ type: 'image/png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binario = '';
    for (let i = 0; i < bytes.length; i += 32768) binario += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return { proporcion: distintos / (ancho * alto), par: btoa(binario) };
  })()
`;

async function compararTodo(dirAntes, dirDespues, salida) {
  mkdirSync(salida, { recursive: true });
  const navegador = await abrirChrome({ pagina: 'about:blank', perfil: PERFIL, puerto: 9335, ancho: 800, alto: 600 });
  const resultados = [];
  const despues = readdirSync(dirDespues).filter((nombre) => nombre.endsWith('.png'));
  for (const nombre of despues) {
    // La pareja de una captura del tema claro es la misma en oscuro de antes:
    // antes no habia tema claro, y lo que se compara es contra que se reemplazo.
    const pareja = nombre.replace(/^claro-/, 'oscuro-');
    let antes;
    try {
      antes = readFileSync(join(dirAntes, pareja));
    } catch {
      resultados.push({ nombre, pareja: null, proporcion: null });
      continue;
    }
    const { proporcion, par } = await navegador.evaluar(
      COMPARAR_EN_CHROME(antes.toString('base64'), readFileSync(join(dirDespues, nombre)).toString('base64')),
    );
    writeFileSync(join(salida, `par-${nombre}`), Buffer.from(par, 'base64'));
    resultados.push({ nombre, pareja, proporcion: Math.round(proporcion * 1000) / 10 });
    console.log(`  ${nombre.padEnd(38)} ${String(Math.round(proporcion * 1000) / 10).padStart(5)} % distinto`);
  }
  writeFileSync(join(salida, 'comparacion.json'), `${JSON.stringify(resultados, null, 2)}\n`);
  navegador.cerrar();
}

/**
 * Comprueba el movimiento midiendo lo que el navegador pinta a mitad de camino
 * (SPEC 013, CA5). Una transicion que ocurre deja, cincuenta milisegundos
 * despues de la orden, un valor intermedio entre el de antes y el de despues;
 * con movimiento reducido, el valor ya es el final.
 */
async function medirMovimiento(pagina) {
  const url = `file://${resolve(pagina)}`;
  const navegador = await abrirChrome({ pagina: url, perfil: PERFIL, puerto: 9336, ancho: ANCHO, alto: ALTO });

  const leer = `
    (() => {
      const puntero = document.querySelector('g[data-forma="puntero"]');
      const caja = puntero === null ? null : puntero.getBoundingClientRect();
      const nodos = [...document.querySelectorAll('g[data-confirmacion][data-previsualizada="no"]')];
      return {
        punteroX: caja === null ? null : Math.round(caja.x),
        punteroY: caja === null ? null : Math.round(caja.y),
        creciendo: nodos.filter((nodo) => getComputedStyle(nodo).animationName === 'aparecer').length,
        opacidadHuerfanas: nodos
          .filter((nodo) => nodo.dataset.huerfana === 'si')
          .map((nodo) => Number(getComputedStyle(nodo.querySelector('circle:not([r="16"])')).opacity).toFixed(2)),
      };
    })()
  `;

  /** Escribe la orden, pulsa entrar y lee a los cincuenta milisegundos y al final. */
  async function durante(orden) {
    await navegador.escribir(orden);
    const antes = await navegador.evaluar(leer);
    const tecla = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    await navegador.pedir('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...tecla });
    await navegador.pedir('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', text: '\r', unmodifiedText: '\r' });
    await navegador.pedir('Input.dispatchKeyEvent', { type: 'keyUp', ...tecla });
    await esperar(60);
    const medio = await navegador.evaluar(leer);
    await esperar(600);
    const despues = await navegador.evaluar(leer);
    return { antes, medio, despues };
  }

  const informe = {};
  for (const reducido of [false, true]) {
    await navegador.movimientoReducido(reducido);
    const clave = reducido ? 'reducido' : 'normal';
    informe[clave] = {};

    // Al cargar no se mueve nada: ningun nodo esta creciendo.
    await navegador.navegar(`${url}?lab=05`);
    informe[clave].alCargar = await navegador.evaluar(leer);
    // Sin previsualizacion: con ella el cambio ya se dibuja mientras se
    // escribe, y lo que se quiere medir es el que produce la orden.
    await navegador.pulsar('previsualización');

    // 6.1 · el puntero se desliza al cambiar de rama.
    informe[clave].cambiarDeRama = await durante('git switch azteca');

    // 6.2 · la confirmacion nueva aparece creciendo.
    await navegador.ejecutar('echo "x" >> platos.md');
    await navegador.ejecutar('git add platos.md');
    informe[clave].confirmar = await durante('git commit -m "prueba"');

    // 6.3 · lo que queda huerfano se apaga con transicion.
    informe[clave].retroceder = await durante('git reset --hard HEAD~1');
  }
  navegador.cerrar();
  console.log(JSON.stringify(informe, null, 2));
}

if (accion === 'movimiento') {
  await medirMovimiento(resto[0] ?? join(SIMULADOR, 'dist', 'index.html'));
} else if (accion === 'capturar') {
  await capturarTodo(resto[0], resto[1] ?? join(SIMULADOR, 'dist', 'index.html'));
} else if (accion === 'comparar') {
  await compararTodo(resto[0], resto[1], resto[2]);
} else {
  console.error('uso: capturar <salida> [pagina.html] | comparar <antes> <despues> <salida>');
  process.exit(1);
}
