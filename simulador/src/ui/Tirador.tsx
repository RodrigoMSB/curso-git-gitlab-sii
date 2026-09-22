/**
 * Redimensionador entre la consola y el grafo (SPEC 017, seccion 3).
 *
 * El relator reparte el ancho en vivo segun lo que este mostrando. Se arrastra
 * con el raton o con el dedo —son eventos de puntero, que cubren los dos— y se
 * mueve tambien con el teclado, con las flechas y con Inicio y Fin. Este
 * componente no guarda nada: informa el reparto pedido y lo guarda la
 * aplicacion, que es la que lo conserva al cambiar de escenario.
 */

import { useRef, useState } from 'react';

/** Limites del reparto, en porcentaje del ancho para la consola (punto 3.3). */
export const REPARTO_MINIMO = 24;
export const REPARTO_MAXIMO = 72;

const PASO_TECLADO = 2;

function acotar(valor: number): number {
  return Math.min(REPARTO_MAXIMO, Math.max(REPARTO_MINIMO, valor));
}

interface Props {
  /** El reparto que se ve, medido, para anunciarlo. */
  readonly actual: number;
  /**
   * El ultimo reparto pedido, o `null` si todavia es el de partida. El teclado
   * suma desde aqui y no desde lo medido: la medicion llega despues del
   * redibujado, y dos flechas seguidas sumaban una sola vez.
   */
  readonly pedido: number | null;
  /** El contenedor de la consola, el tirador y el grafo: contra su ancho se mide. */
  readonly contenedor: React.RefObject<HTMLElement | null>;
  readonly onCambiar: (porcentaje: number) => void;
}

export function Tirador({ actual, pedido, contenedor, onCambiar }: Props): React.ReactElement {
  const [arrastrando, setArrastrando] = useState(false);
  // El arrastre se sigue en una referencia y no en el estado: el primer
  // movimiento puede llegar antes de que React redibuje, y con el estado
  // todavia decia que no se estaba arrastrando.
  const identificador = useRef<number | null>(null);

  const repartoEn = (x: number): number | null => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (caja === undefined || caja.width === 0) return null;
    return acotar(((x - caja.left) / caja.width) * 100);
  };

  return (
    // Un separador que se puede mover es un control, y es la forma que tiene
    // ARIA de decirlo: rol, orientacion, valor y limites.
    // biome-ignore lint/a11y/useSemanticElements: <hr> no puede tomar el foco ni arrastrarse
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Repartir el ancho entre la consola y el grafo"
      aria-valuemin={REPARTO_MINIMO}
      aria-valuemax={REPARTO_MAXIMO}
      aria-valuenow={Math.round(actual)}
      tabIndex={0}
      title="Arrastra para repartir el espacio"
      data-arrastrando={arrastrando ? 'si' : 'no'}
      className="tirador hidden min-[1280px]:grid"
      onPointerDown={(evento) => {
        evento.preventDefault();
        identificador.current = evento.pointerId;
        // Capturar el puntero deja seguir arrastrando aunque el dedo o el
        // raton se salgan de la barrita. Si el navegador no lo admite, se
        // arrastra igual mientras el puntero siga encima.
        try {
          evento.currentTarget.setPointerCapture(evento.pointerId);
        } catch {
          // Sin captura.
        }
        setArrastrando(true);
      }}
      onPointerMove={(evento) => {
        if (evento.pointerId !== identificador.current) return;
        const reparto = repartoEn(evento.clientX);
        if (reparto !== null) onCambiar(reparto);
      }}
      onPointerUp={(evento) => {
        if (evento.pointerId !== identificador.current) return;
        if (evento.currentTarget.hasPointerCapture(evento.pointerId)) {
          evento.currentTarget.releasePointerCapture(evento.pointerId);
        }
        identificador.current = null;
        setArrastrando(false);
      }}
      onPointerCancel={() => {
        identificador.current = null;
        setArrastrando(false);
      }}
      onKeyDown={(evento) => {
        const base = pedido ?? actual;
        const destino =
          evento.key === 'ArrowLeft'
            ? base - PASO_TECLADO
            : evento.key === 'ArrowRight'
              ? base + PASO_TECLADO
              : evento.key === 'Home'
                ? REPARTO_MINIMO
                : evento.key === 'End'
                  ? REPARTO_MAXIMO
                  : null;
        if (destino === null) return;
        evento.preventDefault();
        onCambiar(acotar(destino));
      }}
    >
      <i />
    </div>
  );
}
