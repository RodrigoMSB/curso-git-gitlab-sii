/**
 * Barra de estado (zona A).
 *
 * Deja a la vista que la aplicacion trabaja localmente y sin red: cuando algo
 * falle en clase, eso permite descartar de inmediato que el problema sea la
 * conectividad.
 */

import type { ResumenBarra } from '../vista';

interface Props {
  readonly barra: ResumenBarra;
  readonly escenario: string;
  readonly previsualizacionActiva: boolean;
  readonly modoRelator: boolean;
  readonly onEscenario: (id: string) => void;
  readonly onPrevisualizacion: () => void;
  readonly onModoRelator: () => void;
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
      className="t-pequeno rounded border px-2 py-1"
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
  onEscenario,
  onPrevisualizacion,
  onModoRelator,
  onReiniciar,
}: Props): React.ReactElement {
  return (
    <header className="panel flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2">
      <h1 className="t-medio font-semibold">{barra.repositorio}</h1>

      <p className="t-pequeno">
        <span className="text-[var(--texto-apagado)]">rama </span>
        <span
          className="font-mono"
          style={{ color: barra.desconectado ? 'var(--puntero)' : 'var(--rama-principal)' }}
        >
          {barra.rama}
        </span>
      </p>

      <p className="t-pequeno text-[var(--texto-apagado)]">
        {barra.cambiosSinConfirmar === 0
          ? 'sin cambios pendientes'
          : `${barra.cambiosSinConfirmar} cambio(s) sin confirmar`}
      </p>

      <label className="t-pequeno flex items-center gap-2">
        <span className="text-[var(--texto-apagado)]">escenario</span>
        <select
          value={escenario}
          onChange={(evento) => onEscenario(evento.target.value)}
          className="t-pequeno rounded border border-[var(--borde)] bg-[var(--fondo)] px-2 py-1"
        >
          {barra.escenarios.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>
              {`Lab ${String(opcion.laboratorio).padStart(2, '0')}`} · {opcion.titulo}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <Interruptor
          etiqueta="previsualización"
          activo={previsualizacionActiva}
          onCambiar={onPrevisualizacion}
        />
        <Interruptor etiqueta="modo relator" activo={modoRelator} onCambiar={onModoRelator} />
        <button
          type="button"
          onClick={onReiniciar}
          className="t-pequeno rounded border border-[var(--borde)] px-2 py-1 text-[var(--texto-apagado)]"
        >
          reiniciar escenario
        </button>
      </div>

      <p className="t-min ml-auto text-[var(--texto-apagado)]">
        Funciona en este equipo, sin red. Nada sale de aquí.
      </p>
    </header>
  );
}
