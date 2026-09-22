/**
 * Zona E: linea de tiempo.
 *
 * Un segmento por orden ejecutada. Navegable con el raton y con el teclado
 * (punto 7.3). No persiste entre recargas (punto 7.4).
 */

import { useRef } from 'react';
import type { SegmentoTiempo } from '../vista';

interface Props {
  readonly segmentos: readonly SegmentoTiempo[];
  readonly onIr: (indice: number) => void;
}

export function LineaTiempo({ segmentos, onIr }: Props): React.ReactElement {
  const contenedor = useRef<HTMLDivElement>(null);

  const alTeclear = (evento: React.KeyboardEvent<HTMLButtonElement>, indice: number): void => {
    const salto = evento.key === 'ArrowLeft' ? -1 : evento.key === 'ArrowRight' ? 1 : 0;
    if (salto === 0) return;
    evento.preventDefault();
    const destino = Math.min(Math.max(indice + salto, 0), segmentos.length - 1);
    onIr(destino);
    const botones = contenedor.current?.querySelectorAll('button');
    botones?.[destino]?.focus();
  };

  const actual = segmentos.find((segmento) => segmento.actual);

  // Una sola linea, sin panel propio: es informacion secundaria (SPEC 013,
  // punto 4.3). El titulo se queda para quien navega con lector de pantalla.
  return (
    <nav className="flex items-center gap-4 px-1" aria-label="Línea de tiempo">
      <h2 className="sr-only">Línea de tiempo</h2>
      <p className="t-min shrink-0 text-[var(--texto-apagado)]">
        paso {(actual?.indice ?? 0) + 1} de {segmentos.length}
      </p>

      <div ref={contenedor} className="flex min-w-0 flex-1 flex-wrap gap-1">
        {segmentos.map((segmento) => (
          <button
            key={segmento.indice}
            type="button"
            title={segmento.etiqueta}
            aria-label={`Paso ${segmento.indice + 1}: ${segmento.etiqueta}`}
            aria-current={segmento.actual ? 'step' : undefined}
            onClick={() => onIr(segmento.indice)}
            onKeyDown={(evento) => alTeclear(evento, segmento.indice)}
            className="rounded-full border"
            style={{
              width: 'calc(var(--escala) * 22px)',
              height: 'calc(var(--escala) * 8px)',
              borderColor: segmento.actual ? 'var(--puntero)' : 'var(--borde)',
              background: segmento.actual
                ? 'var(--puntero)'
                : segmento.futuro
                  ? 'transparent'
                  : 'var(--borde)',
              opacity: segmento.futuro ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      <p className="t-min min-w-0 max-w-[40%] shrink truncate text-[var(--texto-tenue)]">
        {actual?.etiqueta}
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="t-min rounded-full border border-[var(--borde)] px-3 py-0.5 text-[var(--texto-apagado)]"
          onClick={() => onIr((actual?.indice ?? 0) - 1)}
          disabled={(actual?.indice ?? 0) === 0}
        >
          retroceder
        </button>
        <button
          type="button"
          className="t-min rounded-full border border-[var(--borde)] px-3 py-0.5 text-[var(--texto-apagado)]"
          onClick={() => onIr((actual?.indice ?? 0) + 1)}
          disabled={(actual?.indice ?? 0) === segmentos.length - 1}
        >
          avanzar
        </button>
      </div>
    </nav>
  );
}
