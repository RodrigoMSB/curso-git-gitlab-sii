/**
 * Barra de estado (zona A).
 *
 * Tres niveles de peso (SPEC 013, punto 4.1). Primero el repositorio y la rama
 * actual, que es lo que el participante mira antes que nada. Despues, callados,
 * los controles: el selector de escenario y los interruptores no compiten con
 * el nombre del repositorio. Y al final, en texto tenue, el aviso de que todo
 * ocurre en este equipo, que sigue ahi para descartar la red cuando algo falle
 * en clase.
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

function Interruptor({
  etiqueta,
  activo,
  onCambiar,
}: {
  readonly etiqueta: string;
  readonly activo: boolean;
  readonly onCambiar: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onCambiar}
      aria-pressed={activo}
      className="t-min rounded-full border px-3 py-1"
      style={{
        borderColor: activo ? 'var(--puntero)' : 'var(--borde)',
        color: activo ? 'var(--puntero)' : 'var(--texto-apagado)',
      }}
    >
      {etiqueta}: {activo ? 'sí' : 'no'}
    </button>
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
    <header className="panel flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
      <div className="flex items-baseline gap-4">
        <h1 className="t-titulo font-semibold">{barra.repositorio}</h1>
        <p className="t-medio flex items-baseline gap-2">
          <span className="t-min text-[var(--texto-apagado)]">rama </span>
          <span
            className="rounded-full border px-3 font-mono font-semibold"
            style={{ color: colorRama, borderColor: colorRama }}
          >
            {barra.rama}
          </span>
        </p>
        <p className="t-pequeno text-[var(--texto-apagado)]">
          {barra.cambiosSinConfirmar === 0
            ? 'sin cambios pendientes'
            : `${barra.cambiosSinConfirmar} cambio(s) sin confirmar`}
        </p>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="t-min flex items-center gap-2">
          <span className="text-[var(--texto-apagado)]">escenario</span>
          <select
            value={escenario}
            onChange={(evento) => onEscenario(evento.target.value)}
            className="t-pequeno rounded-md border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1 text-[var(--texto)]"
          >
            {barra.escenarios.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {`Lab ${String(opcion.laboratorio).padStart(2, '0')}`} · {opcion.titulo}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Interruptor
            etiqueta="previsualización"
            activo={previsualizacionActiva}
            onCambiar={onPrevisualizacion}
          />
          <Interruptor etiqueta="modo relator" activo={modoRelator} onCambiar={onModoRelator} />
          <Interruptor etiqueta="tema claro" activo={temaClaro} onCambiar={onTemaClaro} />
          <button
            type="button"
            onClick={onReiniciar}
            className="t-min rounded-full border border-[var(--borde)] px-3 py-1 text-[var(--texto-apagado)]"
          >
            reiniciar escenario
          </button>
        </div>

        <p className="t-min text-[var(--texto-tenue)]">
          Funciona en este equipo, sin red. Nada sale de aquí.
        </p>
      </div>
    </header>
  );
}
