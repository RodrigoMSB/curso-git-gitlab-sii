/**
 * Dibujo del grafo de confirmaciones.
 *
 * SVG escrito a mano, sin biblioteca de grafos (punto 5.3). Este componente no
 * calcula nada: recibe la disposicion ya resuelta y la recorre.
 */

import type { Disposicion, EtiquetaGrafo, NodoGrafo } from '../grafico/tipos';

interface Props {
  readonly disposicion: Disposicion;
  readonly escala: number;
  readonly seleccion: string | null;
  readonly animar: boolean;
  readonly onSeleccionar: (id: string) => void;
}

function colorDeNodo(nodo: NodoGrafo): string {
  if (nodo.huerfana) return 'var(--huerfano)';
  return nodo.carril === 0 ? 'var(--rama-principal)' : 'var(--rama-derivada)';
}

function colorDeEtiqueta(etiqueta: EtiquetaGrafo): string {
  if (etiqueta.forma === 'puntero') return 'var(--puntero)';
  if (etiqueta.forma === 'version') return 'var(--texto-apagado)';
  return etiqueta.principal ? 'var(--rama-principal)' : 'var(--rama-derivada)';
}

/** Las etiquetas de version llevan una muesca para no confundirse con las ramas (punto 5.5). */
function trazadoDeVersion(etiqueta: EtiquetaGrafo): string {
  const { x, y, ancho, alto } = etiqueta;
  const muesca = 8;
  return [
    `M ${x + muesca} ${y}`,
    `L ${x + ancho} ${y}`,
    `L ${x + ancho} ${y + alto}`,
    `L ${x + muesca} ${y + alto}`,
    `L ${x} ${y + alto / 2}`,
    'Z',
  ].join(' ');
}

export function Grafo({
  disposicion,
  escala,
  seleccion,
  animar,
  onSeleccionar,
}: Props): React.ReactElement {
  const { nodos, aristas, etiquetas, enlacePuntero, rotuloHuerfanas, origenX, origenY, ancho, alto } =
    disposicion;

  if (nodos.length === 0) {
    return (
      <p className="t-normal p-6 text-[var(--texto-apagado)]">
        Todavía no hay confirmaciones. La primera aparecerá aquí en cuanto
        confirmes algo preparado.
      </p>
    );
  }

  return (
    <div className="max-h-full overflow-auto p-2">
      {disposicion.ocultas > 0 && (
        <p className="t-min mb-2 text-[var(--texto-apagado)]">
          Se dibujan las {nodos.length} confirmaciones más recientes.{' '}
          {disposicion.ocultas} quedaron fuera.
        </p>
      )}
      <svg
        viewBox={`${origenX} ${origenY} ${ancho} ${alto}`}
        width={ancho * escala}
        height={alto * escala}
        role="img"
        aria-label="Grafo de confirmaciones"
      >
        <g>
          {aristas.map((arista) => (
            <path
              key={arista.clave}
              // Las aristas van en el orden de los padres, asi que la primera
              // de cada confirmacion es su primer padre.
              data-desde={arista.desde}
              data-hasta={arista.hasta}
              data-previsualizada={arista.previsualizada ? 'si' : 'no'}
              d={arista.trazado}
              fill="none"
              stroke={arista.atenuada ? 'var(--huerfano)' : 'var(--borde)'}
              strokeWidth={2}
              strokeDasharray={arista.previsualizada ? '5 4' : undefined}
              opacity={arista.atenuada ? 0.55 : 1}
            />
          ))}
        </g>

        {enlacePuntero !== null && (
          <path
            d={enlacePuntero.trazado}
            fill="none"
            stroke="var(--puntero)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )}

        {/*
          El gris distingue a las huerfanas, pero no dice que son. El rotulo lo
          nombra sin competir con las etiquetas de rama (punto 5.6).
        */}
        {rotuloHuerfanas !== null && (
          <text
            x={rotuloHuerfanas.x}
            y={rotuloHuerfanas.y + 4}
            fontSize={11}
            fontFamily="var(--font-sans)"
            fontStyle="italic"
            fill="var(--huerfano)"
          >
            {rotuloHuerfanas.texto}
          </text>
        )}

        <g>
          {nodos.map((nodo) => {
            const color = colorDeNodo(nodo);
            const elegida = nodo.id === seleccion;
            return (
              // El nodo vive dentro del SVG, donde `<button>` no es un elemento
              // valido. El grupo lleva rol, foco, rotulo y manejador de teclas,
              // que es la forma de dar el mismo comportamiento sin salir del
              // dibujo.
              // biome-ignore lint/a11y/useSemanticElements: dentro de un SVG no hay <button>
              <g
                key={nodo.id}
                // El DOM dice lo que la pantalla esta dibujando, para que las
                // pruebas de punta a punta lean el estado mostrado y no el
                // modelo (SPEC 008).
                data-confirmacion={nodo.id}
                data-mensaje={nodo.mensaje}
                data-union={nodo.esUnion ? 'si' : 'no'}
                data-huerfana={nodo.huerfana ? 'si' : 'no'}
                data-previsualizada={nodo.previsualizada ? 'si' : 'no'}
                className={animar ? 'transicion-nodo enfocable' : 'enfocable'}
                role="button"
                tabIndex={0}
                aria-label={`Confirmación ${nodo.id}: ${nodo.mensaje}`}
                aria-pressed={elegida}
                onClick={() => onSeleccionar(nodo.id)}
                onKeyDown={(evento) => {
                  if (evento.key === 'Enter' || evento.key === ' ') {
                    evento.preventDefault();
                    onSeleccionar(nodo.id);
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                {nodo.padresOcultos && (
                  <path
                    d={`M ${nodo.x} ${nodo.y + 9} L ${nodo.x} ${nodo.y + 26}`}
                    stroke="var(--borde)"
                    strokeWidth={2}
                    strokeDasharray="3 4"
                  />
                )}
                <circle
                  cx={nodo.x}
                  cy={nodo.y}
                  r={9}
                  fill={nodo.previsualizada ? 'none' : color}
                  stroke={color}
                  strokeWidth={nodo.previsualizada ? 2 : elegida ? 3 : 1}
                  strokeDasharray={nodo.previsualizada ? '4 3' : undefined}
                  opacity={nodo.huerfana ? 0.6 : 1}
                />
                {nodo.esUnion && (
                  <circle
                    cx={nodo.x}
                    cy={nodo.y}
                    r={4}
                    fill={nodo.previsualizada ? color : 'var(--fondo-panel)'}
                    opacity={nodo.huerfana ? 0.6 : 1}
                  />
                )}
                <text
                  x={nodo.x - 16}
                  y={nodo.y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                  fill={nodo.huerfana ? 'var(--huerfano)' : 'var(--texto-apagado)'}
                >
                  {nodo.id}
                </text>
              </g>
            );
          })}
        </g>

        <g>
          {etiquetas.map((etiqueta) => {
            const color = colorDeEtiqueta(etiqueta);
            return (
              <g
                key={etiqueta.clave}
                data-etiqueta={etiqueta.texto}
                data-forma={etiqueta.forma}
                data-en={etiqueta.idConfirmacion}
                data-actual={etiqueta.actual ? 'si' : 'no'}
              >
                {etiqueta.forma === 'version' ? (
                  <path
                    d={trazadoDeVersion(etiqueta)}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                  />
                ) : (
                  <rect
                    x={etiqueta.x}
                    y={etiqueta.y}
                    width={etiqueta.ancho}
                    height={etiqueta.alto}
                    rx={3}
                    fill={etiqueta.actual && etiqueta.forma === 'rama' ? color : 'none'}
                    stroke={color}
                    strokeWidth={etiqueta.forma === 'puntero' ? 2 : 1}
                  />
                )}
                <text
                  x={etiqueta.x + etiqueta.ancho / 2}
                  y={etiqueta.y + etiqueta.alto / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="var(--font-mono)"
                  fill={
                    etiqueta.actual && etiqueta.forma === 'rama' ? 'var(--fondo)' : color
                  }
                >
                  {etiqueta.texto}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
