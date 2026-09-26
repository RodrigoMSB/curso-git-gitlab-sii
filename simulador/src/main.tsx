/**
 * Arranque de la aplicacion.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacion } from './ui/Aplicacion';
import { ModoTaller } from './ui/ModoTaller';
import { claveDelTaller } from './vista';
import './ui/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('No se encontro el elemento con identificador "raiz" en el documento.');
}

// Servida por el programa local, con su clave en la direccion, la pagina entra
// en modo taller. Abierta con doble clic sigue en el modo de escenarios.
const clave = claveDelTaller(window.location);

createRoot(raiz).render(
  <StrictMode>{clave === null ? <Aplicacion /> : <ModoTaller clave={clave} />}</StrictMode>,
);
