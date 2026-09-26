/**
 * Arranque de la aplicacion.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacion } from './ui/Aplicacion';
import { AplicacionTaller } from './ui/AplicacionTaller';
import { claveDelTaller } from './vista';
import './ui/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('No se encontro el elemento con identificador "raiz" en el documento.');
}

const clave = claveDelTaller(window.location);

createRoot(raiz).render(
  <StrictMode>
    {/* Servida por el programa local del taller, la consola ejecuta Git de verdad (SPEC 026). */}
    {clave === null ? <Aplicacion /> : <AplicacionTaller clave={clave} />}
  </StrictMode>,
);
