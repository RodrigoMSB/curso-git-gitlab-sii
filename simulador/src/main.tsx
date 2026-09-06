/**
 * Arranque de la capa visual.
 *
 * Monta el andamiaje minimo del SPEC 001. El SPEC 002 reemplazara el
 * componente sin tocar nada del motor.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ComprobacionMotor } from './ui/ComprobacionMotor';
import './ui/estilos.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  throw new Error('No se encontro el elemento con identificador "raiz" en el documento.');
}

createRoot(raiz).render(
  <StrictMode>
    <ComprobacionMotor />
  </StrictMode>,
);
