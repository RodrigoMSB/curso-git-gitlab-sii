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

  return (
    <nav className="panel px-3 py-2" aria-label="Linea de tiempo">
      <div className="mb-1 flex items-baseline gap-3">
        <h2 className="t-pequeno font-semibold">Linea de tiempo</h2>
        <p className="t-min text-[var(--texto-apagado)]">
          paso {(actual?.indice ?? 0) + 1} de {segmentos.length}
          {actual?.etiqueta !== undefined && ` · ${actual.etiqueta}`}
        </p>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            className="t-min rounded border border-[var(--borde)] px-2 py-0.5 text-[var(--texto-apagado)]"
            onClick={() => onIr((actual?.indice ?? 0) - 1)}
            disabled={(actual?.indice ?? 0) === 0}
          >
            retroceder
          </button>
          <button
            type="button"
            className="t-min rounded border border-[var(--borde)] px-2 py-0.5 text-[var(--texto-apagado)]"
            onClick={() => onIr((actual?.indice ?? 0) + 1)}
            disabled={(actual?.indice ?? 0) === segmentos.length - 1}
          >
            avanzar
          </button>
        </div>
      </div>

      <div ref={contenedor} className="flex flex-wrap gap-1">
        {segmentos.map((segmento) => (
          <button
            key={segmento.indice}
            type="button"
            title={segmento.etiqueta}
            aria-label={`Paso ${segmento.indice + 1}: ${segmento.etiqueta}`}
            aria-current={segmento.actual ? 'step' : undefined}
            onClick={() => onIr(segmento.indice)}
            onKeyDown={(evento) => alTeclear(evento, segmento.indice)}
            className="h-4 rounded-sm border"
            style={{
              width: 'calc(var(--escala) * 26px)',
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
    </nav>
  );
}
