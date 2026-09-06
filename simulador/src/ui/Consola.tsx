/**
 * Consola simulada.
 *
 * Imita Git Bash sobre Windows, que es el entorno donde los participantes
 * trabajaran (punto 4.1). Este componente no interpreta ordenes: las entrega.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { AvisoPrevisualizacion, ColorConsola, Indicador, Renglon } from '../vista';

interface Props {
  readonly indicador: Indicador;
  readonly renglones: readonly Renglon[];
  readonly entrada: string;
  readonly sugerencias: readonly string[];
  readonly aviso: AvisoPrevisualizacion | null;
  readonly previsualizacionActiva: boolean;
  readonly onEntrada: (texto: string) => void;
  readonly onEjecutar: (texto: string) => void;
  readonly onCompletar: (texto: string) => void;
  readonly onHistorial: (direccion: 'anterior' | 'siguiente') => void;
  readonly onDescartar: () => void;
}

const CLASE_POR_COLOR: Readonly<Record<ColorConsola, string>> = {
  normal: 'text-[var(--texto)]',
  exito: 'text-[var(--consola-verde)]',
  error: 'text-[var(--consola-rojo)]',
  aviso: 'text-[var(--consola-amarillo)]',
  orden: 'text-[var(--texto)]',
  apagado: 'text-[var(--texto-apagado)]',
};

export function Consola({
  indicador,
  renglones,
  entrada,
  sugerencias,
  aviso,
  previsualizacionActiva,
  onEntrada,
  onEjecutar,
  onCompletar,
  onHistorial,
  onDescartar,
}: Props): React.ReactElement {
  const campo = useRef<HTMLInputElement>(null);
  const desplazable = useRef<HTMLDivElement>(null);
  const pegadoAlFinal = useRef(true);

  // El cursor recibe el foco al cargar la pagina (punto 4.3).
  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Se baja solo al agregar contenido, salvo que el participante haya subido
  // a mano, en cuyo caso se respeta su posicion (punto 4.6).
  useLayoutEffect(() => {
    const caja = desplazable.current;
    if (caja === null || !pegadoAlFinal.current) return;
    caja.scrollTop = caja.scrollHeight;
  }, [renglones]);

  const alDesplazar = (): void => {
    const caja = desplazable.current;
    if (caja === null) return;
    const distancia = caja.scrollHeight - caja.scrollTop - caja.clientHeight;
    pegadoAlFinal.current = distancia < 24;
  };

  const alTeclear = (evento: React.KeyboardEvent<HTMLInputElement>): void => {
    // Se toma el valor del campo, no el del estado de React: con escritura
    // rapida la pulsacion de entrada puede llegar antes del redibujado, y el
    // estado todavia no tendria el ultimo caracter.
    const valor = evento.currentTarget.value;

    if (evento.key === 'Enter') {
      evento.preventDefault();
      pegadoAlFinal.current = true;
      onEjecutar(valor);
      return;
    }
    // La tabulacion completa la orden (punto 4.4), pero solo cuando hay algo
    // que completar. Con el campo vacio, y siempre con mayusculas, se deja
    // pasar para que el foco pueda salir de la consola con el teclado (CA8).
    if (evento.key === 'Tab' && !evento.shiftKey && valor.trim() !== '') {
      evento.preventDefault();
      onCompletar(valor);
      return;
    }
    if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      onHistorial('anterior');
      return;
    }
    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      onHistorial('siguiente');
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      onDescartar();
    }
  };

  return (
    <section
      className="panel flex min-h-0 flex-col"
      style={{ background: 'var(--fondo-consola)' }}
      aria-label="Consola"
      onClick={() => campo.current?.focus()}
    >
      <div
        ref={desplazable}
        onScroll={alDesplazar}
        className="t-normal flex-1 overflow-auto p-3 font-mono leading-relaxed"
      >
        {renglones.map((renglon) =>
          renglon.color === 'orden' ? (
            <div key={renglon.clave} className="mt-2 first:mt-0">
              <LineaIndicador indicador={indicador} />
              <div className="text-[var(--texto)]">
                <span className="text-[var(--consola-verde)]">$ </span>
                {renglon.texto}
              </div>
            </div>
          ) : (
            <pre
              key={renglon.clave}
              className={`whitespace-pre-wrap font-mono ${CLASE_POR_COLOR[renglon.color]}`}
            >
              {renglon.texto === '' ? ' ' : renglon.texto}
            </pre>
          ),
        )}

        {sugerencias.length > 0 && (
          <pre className="whitespace-pre-wrap font-mono text-[var(--texto-apagado)]">
            {sugerencias.join('   ')}
          </pre>
        )}
      </div>

      {aviso !== null && (
        <p
          className="t-min border-t border-[var(--borde-suave)] px-3 py-1 text-[var(--puntero)]"
          role="status"
        >
          Previsualizacion:{' '}
          {aviso.confirmacionesNuevas > 0
            ? `${aviso.confirmacionesNuevas} confirmacion(es) en trazo discontinuo`
            : 'sin confirmaciones nuevas'}
          {aviso.punteroMovido ? ', el puntero se movera' : ', el puntero no se mueve'}. Entrar
          ejecuta, Escape descarta.
        </p>
      )}

      <div className="border-t border-[var(--borde-suave)] p-3">
        <LineaIndicador indicador={indicador} />
        <div className="t-normal flex items-baseline gap-2 font-mono">
          <span className="text-[var(--consola-verde)]">$</span>
          <input
            ref={campo}
            value={entrada}
            onChange={(evento) => onEntrada(evento.target.value)}
            onKeyDown={alTeclear}
            className="t-normal min-w-0 flex-1 bg-transparent font-mono text-[var(--texto)] outline-none"
            aria-label="Orden de Git"
            aria-describedby={previsualizacionActiva ? 'aviso-previsualizacion' : undefined}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <p className="t-min mt-1 text-[var(--texto-apagado)]">
          Tabulacion completa la orden. Con el campo vacio, tabulacion sale de la consola.
        </p>
        {previsualizacionActiva && (
          <p id="aviso-previsualizacion" className="t-min mt-1 text-[var(--texto-apagado)]">
            Previsualizacion activa: lo que la orden haria se dibuja discontinuo antes de
            ejecutarla.
          </p>
        )}
      </div>
    </section>
  );
}

function LineaIndicador({ indicador }: { readonly indicador: Indicador }): React.ReactElement {
  return (
    <div className="t-min font-mono">
      <span className="text-[var(--consola-verde)]">{indicador.usuario}</span>{' '}
      <span className="text-[var(--consola-amarillo)]">{indicador.ruta}</span>
      {indicador.rama !== null && (
        <span className="text-[color:#48c4d3]"> ({indicador.rama})</span>
      )}
    </div>
  );
}
