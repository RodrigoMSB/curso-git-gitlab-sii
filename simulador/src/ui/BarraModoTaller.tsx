/**
 * Barra del modo taller (punto 4.5 del SPEC 026).
 *
 * Dice que la pagina esta en modo taller, en que carpeta esta la consola y en
 * que rama. Sin repositorio lo dice y no muestra rama ni contador, que es lo
 * que la barra del modo conectado mostraba sin tener de donde sacarlo. No lleva
 * selector de escenario ni previsualizacion: en este modo no aplican.
 */

import type { BarraTaller } from '../vista';
import { Interruptor, Luna, Sol } from './BarraEstado';

interface Props {
  readonly barra: BarraTaller | null;
  readonly modoRelator: boolean;
  readonly temaClaro: boolean;
  readonly onModoRelator: () => void;
  readonly onTemaClaro: () => void;
}

export function BarraModoTaller({ barra, modoRelator, temaClaro, onModoRelator, onTemaClaro }: Props): React.ReactElement {
  const colorRama = barra?.desconectado ? 'var(--puntero)' : 'var(--rama-principal)';
  return (
    <header
      className="flex items-start gap-5 border-b border-[var(--borde)] bg-[var(--fondo-panel)] px-6 py-4"
      data-prueba="barra-taller"
    >
      <div className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rotulo rounded-full border border-[var(--borde)] px-3 py-0.5">modo taller</span>
        {barra === null ? (
          <p className="t-pequeno text-[var(--texto-apagado)]">conectando con el taller…</p>
        ) : barra.repositorio === null ? (
          <>
            <h1 className="t-titulo truncate font-semibold" data-prueba="barra-carpeta">
              {barra.carpeta}
            </h1>
            <p className="t-pequeno text-[var(--texto-apagado)]" data-prueba="barra-sin-repositorio">
              esta carpeta no es un repositorio
            </p>
          </>
        ) : (
          <>
            <h1 className="t-titulo font-semibold" data-prueba="barra-repositorio">
              {barra.repositorio}
            </h1>
            {barra.rama !== null && (
              <span
                className="t-pequeno rounded-full border px-3 py-0.5 font-mono font-semibold"
                data-prueba="barra-rama"
                style={{
                  color: colorRama,
                  borderColor: colorRama,
                  background: `color-mix(in srgb, ${colorRama} 14%, transparent)`,
                }}
              >
                {barra.desconectado ? `posición desconectada · ${barra.rama}` : barra.rama}
              </span>
            )}
            {barra.operacion !== null && (
              <span className="t-pequeno font-semibold text-[var(--consola-amarillo)]">{barra.operacion}</span>
            )}
            <p className="t-pequeno text-[var(--texto-apagado)]" data-prueba="barra-cambios">
              {barra.cambios === 0 ? 'sin cambios pendientes' : `${barra.cambios} cambio(s) sin confirmar`}
            </p>
            <p className="t-min w-full truncate font-mono text-[var(--texto-tenue)]" data-prueba="barra-carpeta">
              {barra.carpeta}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-none items-center gap-5">
        <div className="grupo-interruptores">
          <Interruptor etiqueta="modo relator" activo={modoRelator} onCambiar={onModoRelator} />
        </div>
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
      </div>
    </header>
  );
}
