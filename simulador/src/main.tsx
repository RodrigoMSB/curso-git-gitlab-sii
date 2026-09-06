/**
 * Arranque de la aplicacion.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacion } from './ui/Aplicacion';
import './ui/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('No se encontro el elemento con identificador "raiz" en el documento.');
}

createRoot(raiz).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
);
