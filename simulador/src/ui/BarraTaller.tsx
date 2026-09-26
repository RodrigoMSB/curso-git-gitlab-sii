/**
 * Barra del modo taller (SPEC 026, 4.6).
 *
 * Dice que la consola ejecuta Git de verdad y en que carpeta esta parada. Sin
 * selector de escenario, sin previsualizacion y sin reiniciar: aqui no hay
 * escenario, hay un repositorio. Si el programa local se cerro, lo dice en
 * una linea.
 */

import type { BarraTaller as DatosBarra } from '../vista';
import { Interruptor, Luna, Sol } from './BarraEstado';

interface Props {
  readonly barra: DatosBarra;
  readonly modoRelator: boolean;
  readonly temaClaro: boolean;
  readonly onModoRelator: () => void;
  readonly onTemaClaro: () => void;
}

export function BarraTaller({ barra, modoRelator, temaClaro, onModoRelator, onTemaClaro }: Props): React.ReactElement {
  return (
    <header
      className="flex items-start gap-5 border-b border-[var(--borde)] bg-[var(--fondo-panel)] px-6 py-4"
      data-prueba="barra-taller"
    >
      <div className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rotulo rounded-full border border-[var(--puntero)] px-3 py-0.5 text-[var(--puntero)]">
          modo taller · Git real
        </span>
        <h1 className="t-medio min-w-0 truncate font-mono font-semibold" data-prueba="carpeta-taller" title={barra.carpeta}>
          {barra.carpeta}
        </h1>
        {barra.repositorio && barra.rama !== null && (
          <span
            data-prueba="rama-actual"
            className="t-pequeno rounded-full border border-[var(--rama-principal)] px-3 py-0.5 font-mono font-semibold text-[var(--rama-principal)]"
          >
            {barra.rama}
          </span>
        )}
        <p className="t-pequeno text-[var(--texto-apagado)]">
          {!barra.repositorio
            ? 'no es un repositorio'
            : barra.cambios === 0
              ? 'sin cambios pendientes'
              : `${barra.cambios} cambio(s) sin confirmar`}
        </p>
        {barra.cerrado && (
          <p className="t-pequeno w-full text-[var(--consola-rojo)]" role="alert" data-prueba="taller-cerrado">
            El taller se cerró. Vuelve a abrirlo con TALLER.cmd y recarga esta página.
          </p>
        )}
      </div>

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
    </header>
  );
}
