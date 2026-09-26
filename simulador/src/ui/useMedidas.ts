/**
 * Lo que la pantalla mide para que el grafo quepa: el hueco del panel del
 * grafo y el reparto del ancho con la consola. Lo usan el simulador y el modo
 * taller (SPEC 026), que tienen la misma pantalla.
 */

import { useLayoutEffect, useRef, useState } from 'react';

export interface Medidas {
  readonly ancho: number;
  readonly alto: number;
  readonly reparto: number;
}

export function useMedidas(): {
  readonly cuerpo: React.RefObject<HTMLDivElement | null>;
  readonly panelGrafo: React.RefObject<HTMLElement | null>;
  readonly consola: React.RefObject<HTMLElement | null>;
  readonly medidas: Medidas | null;
} {
  // Lo que mide la pantalla y el calculo de posiciones necesita: el hueco del
  // panel del grafo, descontado su relleno (p-4) y sus bordes, y el reparto
  // que se ve. El grafo aprieta filas y carriles para caber en ese hueco
  // (SPEC 016 y 017); antes el panel lo cortaba sin aviso.
  const cuerpo = useRef<HTMLDivElement>(null);
  const panelGrafo = useRef<HTMLElement>(null);
  const consola = useRef<HTMLElement>(null);
  const [medidas, setMedidas] = useState<Medidas | null>(null);
  useLayoutEffect(() => {
    const medir = (): void => {
      const panel = panelGrafo.current;
      const contenedor = cuerpo.current;
      const columna = consola.current;
      if (panel === null || contenedor === null || columna === null) return;
      const hueco = 2 * 16 + 2;
      const siguiente = {
        ancho: panel.clientWidth - hueco + 2,
        alto: panel.clientHeight - hueco + 2,
        reparto: (columna.getBoundingClientRect().width / Math.max(contenedor.clientWidth, 1)) * 100,
      };
      setMedidas((anterior) =>
        anterior !== null &&
        anterior.ancho === siguiente.ancho &&
        anterior.alto === siguiente.alto &&
        Math.abs(anterior.reparto - siguiente.reparto) < 0.1
          ? anterior
          : siguiente,
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    for (const elemento of [panelGrafo.current, cuerpo.current, consola.current]) {
      if (elemento !== null) observador.observe(elemento);
    }
    return () => observador.disconnect();
  }, []);
  return { cuerpo, panelGrafo, consola, medidas };
}
