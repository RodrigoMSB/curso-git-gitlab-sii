/**
 * Dibujo del grafo de confirmaciones.
 *
 * SVG escrito a mano, sin biblioteca de grafos (punto 5.3). Este componente no
 * calcula nada: recibe la disposicion ya resuelta y la recorre.
 */

import { useLayoutEffect, useRef } from 'react';
import { MEDIDAS, type AristaGrafo, type Disposicion, type EtiquetaGrafo, type NodoGrafo } from '../grafico/tipos';

interface Props {
  readonly disposicion: Disposicion;
  readonly escala: number;
  readonly seleccion: string | null;
  readonly animar: boolean;
  /**
   * El escenario en pantalla. Al cambiarlo todo el grafo es nuevo, y eso no
   * es algo que el participante hizo: no se anima (SPEC 013, punto 6.4).
   */
  readonly escenario: string;
  readonly onSeleccionar: (id: string) => void;
  /** Lo que se dice sin confirmaciones que dibujar; el modo taller tiene otros casos (SPEC 026). */
  readonly vacio?: string;
}

/** Tamaño de la letra de identificadores y etiquetas, en unidades del dibujo. */
const LETRA = 12;

function colorDeArista(arista: AristaGrafo): string {
  if (arista.atenuada) return 'var(--huerfano)';
  return arista.derivada ? 'var(--rama-derivada)' : 'var(--rama-principal)';
}

/**
 * Las confirmaciones que aparecieron desde el dibujo anterior, para hacerlas
 * crecer (SPEC 013, punto 6.2).
 *
 * Solo cuentan las solidas: una previsualizada aparece y desaparece mientras
 * se escribe, y hacerla crecer en cada tecla seria movimiento que no muestra
 * nada. Al cambiar de escenario, o en el primer dibujo, no hay nada nuevo: es
 * la pantalla cargando, no una accion.
 */
function useNuevas(nodos: readonly NodoGrafo[], escenario: string): ReadonlySet<string> {
  const anteriores = useRef<{ escenario: string; ids: ReadonlySet<string> } | null>(null);
  const solidas = nodos.filter((nodo) => !nodo.previsualizada).map((nodo) => nodo.id);
  const previo = anteriores.current;
  const nuevas =
    previo === null || previo.escenario !== escenario
      ? new Set<string>()
      : new Set(solidas.filter((id) => !previo.ids.has(id)));
  useLayoutEffect(() => {
    anteriores.current = { escenario, ids: new Set(solidas) };
  });
  return nuevas;
}

function colorDeNodo(nodo: NodoGrafo): string {
  if (nodo.huerfana) return 'var(--huerfano)';
  return nodo.carril === 0 ? 'var(--rama-principal)' : 'var(--rama-derivada)';
}

function colorDeEtiqueta(etiqueta: EtiquetaGrafo): string {
  if (etiqueta.forma === 'puntero') return 'var(--puntero)';
  if (etiqueta.forma === 'version' || etiqueta.forma === 'remota') return 'var(--texto-apagado)';
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
  escenario,
  onSeleccionar,
  vacio,
}: Props): React.ReactElement {
  const { nodos, aristas, etiquetas, enlacePuntero, rotuloHuerfanas, origenX, origenY, ancho, alto } =
    disposicion;
  const nuevas = useNuevas(nodos, escenario);

  if (nodos.length === 0) {
    return (
      <p className="t-normal p-6 text-[var(--texto-apagado)]" data-prueba="grafo-vacio">
        {vacio ??
          'Todavía no hay confirmaciones. La primera aparecerá aquí en cuanto confirmes algo preparado.'}
      </p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto p-4">
      {/*
        Si ni apretando las filas caben todas las etiquetas, se dice cuales
        quedaron abajo. Nunca una rama fuera de la vista sin aviso (SPEC 016).
      */}
      {disposicion.fueraDeVista.length > 0 && (
        <p className="t-min mb-2 text-[var(--puntero)]" role="status">
          Más abajo: {disposicion.fueraDeVista.join(', ')}. Desplaza el grafo para verlas.
        </p>
      )}
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
              className={animar ? 'transicion-color' : undefined}
              // Tres para el tronco y las ramas, dos y medio para lo
              // previsualizado, con los extremos redondeados (SPEC 013, 2.2 y 2.6).
              style={{ stroke: colorDeArista(arista), opacity: arista.atenuada ? 0.6 : 1 }}
              strokeWidth={arista.previsualizada ? 2.5 : 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={arista.previsualizada ? '6 6' : undefined}
            />
          ))}
        </g>


        {/*
          El gris distingue a las huerfanas, pero no dice que son. El rotulo lo
          nombra sin competir con las etiquetas de rama (punto 5.6).
        */}
        {rotuloHuerfanas !== null && (
          <text
            x={rotuloHuerfanas.x}
            y={rotuloHuerfanas.y + 4}
            fontSize={LETRA}
            fontFamily="var(--font-sans)"
            fontStyle="italic"
            fill="var(--texto-tenue)"
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
                className={animar && nuevas.has(nodo.id) ? 'entrada-nodo enfocable' : 'enfocable'}
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
                    d={`M ${nodo.x} ${nodo.y + MEDIDAS.radio} L ${nodo.x} ${nodo.y + MEDIDAS.radio + 18}`}
                    stroke="var(--borde)"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="1 6"
                  />
                )}
                {/* La seleccion es un anillo alrededor, no un cambio del nodo. */}
                {elegida && (
                  <circle
                    cx={nodo.x}
                    cy={nodo.y}
                    r={MEDIDAS.radio + 5}
                    fill="none"
                    stroke="var(--texto)"
                    strokeWidth={2}
                  />
                )}
                <circle
                  cx={nodo.x}
                  cy={nodo.y}
                  r={MEDIDAS.radio}
                  className={animar ? 'transicion-color' : undefined}
                  // Por estilo y no por atributo, para que el cambio a huerfana
                  // se vea como transicion (SPEC 013, punto 6.3).
                  style={{
                    fill: nodo.previsualizada ? 'var(--fondo-panel)' : color,
                    stroke: color,
                    opacity: nodo.huerfana ? 0.65 : 1,
                  }}
                  strokeWidth={nodo.previsualizada ? 2.5 : 0}
                  strokeDasharray={nodo.previsualizada ? '4 4' : undefined}
                />
                {nodo.esUnion && (
                  <circle
                    cx={nodo.x}
                    cy={nodo.y}
                    r={4.5}
                    className={animar ? 'transicion-color' : undefined}
                    style={{
                      fill: nodo.previsualizada ? color : 'var(--fondo-panel)',
                      opacity: nodo.huerfana ? 0.65 : 1,
                    }}
                  />
                )}
                {/*
                  El identificador va a la izquierda, alineado a la derecha: las
                  etiquetas de rama se quedan con el costado derecho (SPEC 013, 2.4).
                  Con la consola muy ancha es lo primero que se deja de dibujar,
                  antes que una rama (SPEC 017).
                */}
                {disposicion.identificadores && (
                <text
                  x={nodo.x - MEDIDAS.radio - 10}
                  y={nodo.y + 4}
                  textAnchor="end"
                  fontSize={LETRA}
                  fontFamily="var(--font-mono)"
                  className={animar ? 'transicion-color' : undefined}
                  // El identificador cae sobre el carril de la izquierda. Un
                  // contorno del color del panel, pintado por debajo de la
                  // letra, corta la linea que pasa detras y lo deja legible.
                  stroke="var(--fondo-panel)"
                  strokeWidth={5}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                  style={{ fill: nodo.huerfana ? 'var(--huerfano)' : 'var(--texto-apagado)' }}
                >
                  {nodo.id}
                </text>
                )}
              </g>
            );
          })}
        </g>

        <g>
          {etiquetas.map((etiqueta) => {
            const color = colorDeEtiqueta(etiqueta);
            const llena = etiqueta.actual && etiqueta.forma === 'rama';
            const esPuntero = etiqueta.forma === 'puntero';
            // Cada etiqueta se dibuja desde su esquina y se ubica con una
            // traslacion. Para el puntero eso es lo que permite deslizarlo al
            // cambiar de rama (SPEC 013, punto 6.1): la traslacion es lo unico
            // que cambia, y cambia con transicion. La clave lleva el escenario
            // para que al cambiarlo el puntero aparezca en su lugar y no viaje
            // desde el escenario anterior.
            return (
              <g
                key={esPuntero ? `${etiqueta.clave}:${escenario}` : etiqueta.clave}
                data-etiqueta={etiqueta.texto}
                data-forma={etiqueta.forma}
                data-en={etiqueta.idConfirmacion}
                data-actual={etiqueta.actual ? 'si' : 'no'}
                className={esPuntero && animar ? 'transicion-puntero' : undefined}
                style={{ transform: `translate(${etiqueta.x}px, ${etiqueta.y}px)` }}
              >
                {esPuntero && enlacePuntero !== null && (
                  <path
                    d={enlacePuntero.relativo}
                    fill="none"
                    stroke="var(--puntero)"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                )}
                {etiqueta.forma === 'version' ? (
                  <path
                    d={trazadoDeVersion({ ...etiqueta, x: 0, y: 0 })}
                    fill="var(--fondo-panel)"
                    stroke={color}
                    strokeWidth={1.5}
                    strokeLinejoin="round"
                  />
                ) : (
                  // Pildoras: las esquinas son la mitad del alto, y eso las
                  // separa de las cajas de la interfaz (SPEC 013, punto 2.5).
                  <rect
                    x={0}
                    y={0}
                    width={etiqueta.ancho}
                    height={etiqueta.alto}
                    rx={etiqueta.alto / 2}
                    // Rellenas del color del panel: una rama de otro carril que
                    // pase por detras no atraviesa el nombre.
                    fill={llena ? color : 'var(--fondo-panel)'}
                    stroke={color}
                    strokeWidth={esPuntero ? 2 : 1.5}
                    // La remota va punteada: es la ultima noticia que se tiene
                    // del remoto, no una rama sobre la que se trabaje.
                    strokeDasharray={etiqueta.forma === 'remota' ? '4 3' : undefined}
                  />
                )}
                <text
                  x={etiqueta.ancho / 2}
                  y={etiqueta.alto / 2 + 4}
                  textAnchor="middle"
                  fontSize={LETRA}
                  fontWeight={llena || esPuntero ? 600 : 400}
                  fontFamily="var(--font-mono)"
                  fill={llena ? 'var(--fondo-panel)' : color}
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
