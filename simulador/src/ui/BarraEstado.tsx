/**
 * Barra de estado (zona A).
 *
 * Tres niveles de peso (SPEC 013, punto 4.1). Primero el repositorio y la rama
 * actual, que es lo que el participante mira antes que nada. Despues los
 * controles: el selector de escenario, que es el que mas se usa, y los dos
 * interruptores juntos en una pieza (SPEC 017, seccion 5). Al final, en texto
 * tenue, el aviso de que todo ocurre en este equipo, que sigue ahi para
 * descartar la red cuando algo falle en clase. El tema es un boton redondo al
 * extremo derecho, que es donde la gente lo busca.
 */

import type { ResumenBarra } from '../vista';

interface Props {
  readonly barra: ResumenBarra;
  readonly escenario: string;
  readonly previsualizacionActiva: boolean;
  readonly modoRelator: boolean;
  readonly temaClaro: boolean;
  readonly onEscenario: (id: string) => void;
  readonly onPrevisualizacion: () => void;
  readonly onModoRelator: () => void;
  readonly onTemaClaro: () => void;
  readonly onReiniciar: () => void;
}

/**
 * Un interruptor: la palabra y una luz que se enciende en ambar. El estado se
 * lee sin leer la palabra (SPEC 017, CA5), y `aria-pressed` se lo dice a quien
 * no ve la luz.
 */
export function Interruptor({
  etiqueta,
  activo,
  onCambiar,
}: {
  readonly etiqueta: string;
  readonly activo: boolean;
  readonly onCambiar: () => void;
}): React.ReactElement {
  return (
    <button type="button" onClick={onCambiar} aria-pressed={activo} className="interruptor t-pequeno">
      <i className="luz" aria-hidden="true" />
      {etiqueta}
    </button>
  );
}

export function Luna(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

export function Sol(): React.ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </svg>
  );
}

export function BarraEstado({
  barra,
  escenario,
  previsualizacionActiva,
  modoRelator,
  temaClaro,
  onEscenario,
  onPrevisualizacion,
  onModoRelator,
  onTemaClaro,
  onReiniciar,
}: Props): React.ReactElement {
  const colorRama = barra.desconectado ? 'var(--puntero)' : 'var(--rama-principal)';
  return (
    // Tres bloques: el repositorio a la izquierda, los controles al medio, que
    // se parten en dos filas si no caben, y el tema siempre al extremo
    // derecho, arriba, que es donde la gente lo busca (SPEC 017, punto 5.1).
    <header className="flex items-start gap-5 border-b border-[var(--borde)] bg-[var(--fondo-panel)] px-6 py-4">
      <div className="flex min-h-10 flex-none items-center gap-3">
        <h1 className="t-titulo font-semibold">{barra.repositorio}</h1>
        <span
          className="t-pequeno rounded-full border px-3 py-0.5 font-mono font-semibold"
          style={{
            color: colorRama,
            borderColor: colorRama,
            background: `color-mix(in srgb, ${colorRama} 14%, transparent)`,
          }}
        >
          {barra.rama}
        </span>
        <p className="t-pequeno text-[var(--texto-apagado)]">
          {barra.cambiosSinConfirmar === 0
            ? 'sin cambios pendientes'
            : `${barra.cambiosSinConfirmar} cambio(s) sin confirmar`}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-x-5 gap-y-3">
        <label className="flex items-center gap-2">
          <span className="rotulo">escenario</span>
          <select
            value={escenario}
            onChange={(evento) => onEscenario(evento.target.value)}
            className="t-medio rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-3 py-2 text-[var(--texto)]"
          >
            {barra.escenarios.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {`Lab ${String(opcion.laboratorio).padStart(2, '0')}`} · {opcion.titulo}
              </option>
            ))}
          </select>
        </label>

        <div className="grupo-interruptores">
          <Interruptor
            etiqueta="previsualización"
            activo={previsualizacionActiva}
            onCambiar={onPrevisualizacion}
          />
          <Interruptor etiqueta="modo relator" activo={modoRelator} onCambiar={onModoRelator} />
        </div>

        <button
          type="button"
          onClick={onReiniciar}
          className="t-pequeno rounded-lg border border-[var(--borde)] bg-[var(--fondo)] px-3 py-2 text-[var(--texto-apagado)] hover:text-[var(--texto)]"
        >
          reiniciar escenario
        </button>

        <p className="t-min text-[var(--texto-tenue)]">Funciona en este equipo, sin red. Nada sale de aquí.</p>
      </div>

      {/* Luna en el oscuro, sol en el claro: el icono dice en que tema estas. */}
      <button
        type="button"
        onClick={onTemaClaro}
        aria-pressed={temaClaro}
        aria-label="Cambiar tema"
        title="Cambiar tema"
        data-tema-actual={temaClaro ? 'claro' : 'oscuro'}
        className="grid h-10 w-10 flex-none place-items-center rounded-full border border-[var(--borde)] bg-[var(--fondo)] p-2.5 text-[var(--texto-apagado)] hover:border-[var(--puntero)] hover:text-[var(--puntero)]"
      >
        {temaClaro ? <Sol /> : <Luna />}
      </button>
    </header>
  );
}
