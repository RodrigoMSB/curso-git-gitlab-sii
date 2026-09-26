/**
 * Consola simulada.
 *
 * Imita Git Bash sobre Windows, que es el entorno donde los participantes
 * trabajaran (punto 4.1). Este componente no interpreta ordenes: las entrega.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { contar, type AvisoPrevisualizacion, type ColorConsola, type Indicador, type Renglon } from '../vista';

/**
 * Ancho de partida de la consola, cuando el relator todavia no movio el
 * tirador (SPEC 017, punto 3.2): el que deja entrar la salida mas larga del
 * guion sin partirla, que son noventa caracteres —el `renamed:` del
 * laboratorio 03—, mas el relleno y los bordes. Va en `ch` de la propia letra
 * de la consola, asi que sigue a la escala del modo relator sin calcular
 * nada, acotado a los limites del tirador.
 *
 * Son noventa y uno y no noventa: con noventa justos la linea medida quedaba
 * dos centesimas de pixel mas ancha que el hueco, por redondeo, y el
 * navegador la partia igual.
 */
export const REPARTO_DE_PARTIDA = 'clamp(24%, calc(91ch + 42px), 72%)';

/**
 * El del modo taller, que va lado a lado desde novecientos pixeles (SPEC 027,
 * punto 1.2). Con el tope de setenta y dos, a ese ancho el grafo se quedaba
 * con un cuarto de la pantalla.
 */
export const REPARTO_DE_PARTIDA_TALLER = 'clamp(24%, calc(91ch + 42px), 60%)';

/**
 * Desde que ancho la consola y el grafo van lado a lado. Las clases van
 * escritas enteras para que Tailwind las encuentre.
 */
export type Corte = 1280 | 900;
const COLUMNA_POR_CORTE: Readonly<Record<Corte, string>> = {
  1280: 'min-[1280px]:h-auto min-[1280px]:basis-[var(--reparto)]',
  900: 'min-[900px]:h-auto min-[900px]:basis-[var(--reparto)]',
};

interface Props {
  readonly ref?: React.Ref<HTMLElement>;
  /** Porcentaje del ancho que eligio el relator, o `null` para el de partida. */
  readonly reparto: number | null;
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
  /**
   * La consola no acepta ordenes en el modo taller: una esta corriendo, o no
   * hay conexion. La entrada se deshabilita y en su lugar se muestra este
   * texto (punto 4.3 del SPEC 026).
   */
  readonly ocupado?: string | null;
  /** Las lineas de ayuda bajo la entrada. El modo taller no las lleva (punto 4.7). */
  readonly ayuda?: boolean;
  /** Desde que ancho va lado a lado con el grafo. */
  readonly corte?: Corte;
  /**
   * Una salida mas larga que la consola se muestra desde su principio, no
   * desde su final (SPEC 027, punto 3.2). En clase, quedar mirando el final
   * de la salida de preparar.sh confundia.
   */
  readonly salidasDesdeElPrincipio?: boolean;
}

const CLASE_POR_COLOR: Readonly<Record<ColorConsola, string>> = {
  normal: 'text-[var(--texto)]',
  exito: 'text-[var(--consola-verde)]',
  error: 'text-[var(--consola-rojo)]',
  aviso: 'text-[var(--consola-amarillo)]',
  limite: 'text-[var(--consola-azul)] italic',
  orden: 'text-[var(--texto)]',
  apagado: 'text-[var(--texto-apagado)]',
  programa: 'text-[var(--consola-azul)] font-sans',
};

export function Consola({
  ref,
  reparto,
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
  ocupado = null,
  ayuda = true,
  corte = 1280,
  salidasDesdeElPrincipio = false,
}: Props): React.ReactElement {
  const campo = useRef<HTMLInputElement>(null);
  const desplazable = useRef<HTMLDivElement>(null);
  const pegadoAlFinal = useRef(true);
  // Donde la dejo la propia consola la ultima vez que la movio. El evento de
  // desplazamiento de ese movimiento llega un cuadro despues, y si entretanto
  // la consola se achico (aparece el repositorio y la barra crece), medir la
  // distancia al final la daba por subida a mano y la despegaba. Un evento
  // que la encuentra donde la dejo la consola no es del participante.
  const puesta = useRef<number | null>(null);
  const mover = (caja: HTMLDivElement, arriba: number): void => {
    caja.scrollTop = arriba;
    puesta.current = caja.scrollTop;
  };
  const [enfocado, setEnfocado] = useState(true);
  const [hayMasAbajo, setHayMasAbajo] = useState(false);

  // Las dos lineas de ayuda solo tienen sentido en el momento en que sirven:
  // con el cursor puesto y todavia sin escribir nada. Permanentes se vuelven
  // ruido, sobre todo en proyeccion.
  const mostrarAyuda = enfocado && entrada === '' && ayuda;

  // Al terminar una orden larga el cursor vuelve solo a la entrada.
  const corriendo = ocupado !== null;
  useEffect(() => {
    if (!corriendo) campo.current?.focus();
  }, [corriendo]);

  // El cursor recibe el foco al cargar la pagina (punto 4.3).
  useEffect(() => {
    campo.current?.focus();
  }, []);

  // Se baja solo al agregar contenido, salvo que el participante haya subido
  // a mano, en cuyo caso se respeta su posicion (punto 4.6).
  // `renglones` no se lee dentro del efecto, se usa como disparador: cada
  // salida nueva tiene que volver a bajar la caja. Quitarlo de la lista, como
  // propone el linter, deja el desplazamiento congelado en la primera salida.
  // biome-ignore lint/correctness/useExhaustiveDependencies: es un disparador, no una lectura
  useLayoutEffect(() => {
    const caja = desplazable.current;
    if (caja === null || !pegadoAlFinal.current) return;
    mover(caja, caja.scrollHeight);
    if (!salidasDesdeElPrincipio) return;
    setHayMasAbajo(false);
    // Si lo que imprimio la ultima orden, con su eco, no cabe, se muestra
    // desde el eco hacia abajo y se avisa que sigue.
    const ecos = caja.querySelectorAll<HTMLElement>('[data-color="orden"]');
    const eco = ecos[ecos.length - 1];
    if (eco === undefined) return;
    const desdeElEco =
      eco.getBoundingClientRect().top - caja.getBoundingClientRect().top + caja.scrollTop;
    if (caja.scrollHeight - desdeElEco > caja.clientHeight) {
      mover(caja, Math.max(0, desdeElEco - 8));
      pegadoAlFinal.current = false;
      setHayMasAbajo(true);
    }
  }, [renglones]);

  // Si la consola cambia de alto con el contenido pegado al final, vuelve a
  // bajar. Al aparecer el repositorio, con git init, la barra de arriba gana
  // una linea y la consola se achica: sin esto la salida de la orden quedaba
  // debajo de lo que se ve (SPEC 027, punto 3.3).
  useEffect(() => {
    const caja = desplazable.current;
    if (caja === null || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => {
      if (pegadoAlFinal.current) mover(caja, caja.scrollHeight);
    });
    observador.observe(caja);
    return () => observador.disconnect();
  }, []);

  const alDesplazar = (): void => {
    const caja = desplazable.current;
    if (caja === null) return;
    if (puesta.current !== null && Math.abs(caja.scrollTop - puesta.current) < 1) return;
    puesta.current = null;
    const distancia = caja.scrollHeight - caja.scrollTop - caja.clientHeight;
    pegadoAlFinal.current = distancia < 24;
    if (pegadoAlFinal.current) setHayMasAbajo(false);
  };

  const irAlFinal = (): void => {
    const caja = desplazable.current;
    if (caja === null) return;
    mover(caja, caja.scrollHeight);
    pegadoAlFinal.current = true;
    setHayMasAbajo(false);
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
    // El clic solo devuelve el foco al campo (punto 4.3) y es un atajo para el
    // raton. Con teclado el campo ya se alcanza con tabulacion y ademas recibe
    // el foco al cargar, de modo que un manejador de teclas en la seccion no
    // daria acceso a nada nuevo.
    // biome-ignore lint/a11y/useKeyWithClickEvents: el teclado ya alcanza el campo sin esto
    <section
      ref={ref}
      // La columna entera, de arriba abajo (SPEC 017, punto 2.1). El ancho sale
      // del reparto; la letra de la seccion es la de la consola, para que el
      // `ch` del ancho de partida mida sus caracteres.
      className={`panel terminal t-normal flex h-[26rem] min-h-0 flex-none flex-col font-mono ${COLUMNA_POR_CORTE[corte]}`}
      style={
        {
          background: 'var(--fondo-consola)',
          '--reparto': reparto === null ? (corte === 900 ? REPARTO_DE_PARTIDA_TALLER : REPARTO_DE_PARTIDA) : `${reparto}%`,
        } as React.CSSProperties
      }
      aria-label="Consola"
      onClick={() => campo.current?.focus()}
    >
      <div
        ref={desplazable}
        onScroll={alDesplazar}
        // Mas aire entre lineas: la consola es lo que mas se lee (SPEC 013, 5.2).
        className="t-normal flex min-h-0 flex-1 flex-col overflow-auto px-5 py-4 font-mono leading-[1.8]"
      >
        {/*
          El contenido se ancla al fondo (SPEC 017, punto 2.2): este relleno se
          come el espacio que sobra arriba mientras hay poco texto, y se reduce
          a nada cuando el historial llena la caja y empieza a desplazarse.
        */}
        <div className="flex-[1_0_auto]" aria-hidden="true" />
        {renglones.map((renglon) =>
          renglon.color === 'orden' ? (
            <div key={renglon.clave} className="mt-4 first:mt-0" data-color="orden">
              <LineaIndicador indicador={renglon.indicador ?? indicador} />
              <div className="text-[var(--texto)]">
                <span className="text-[var(--consola-verde)]">$ </span>
                {renglon.propia === true ? (
                  // Las ordenes propias de la consola del taller, en el color del
                  // programa: no son de bash (SPEC 027, punto 4.5).
                  <span className="text-[var(--consola-azul)]" data-propia="si">
                    {renglon.texto}
                  </span>
                ) : (
                  renglon.texto
                )}
              </div>
            </div>
          ) : (
            <pre
              key={renglon.clave}
              // El color dice si la orden fallo, que es lo que compara la
              // prueba de punta a punta contra el codigo de salida de Git.
              data-color={renglon.color}
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
          className="t-min border-t border-[var(--borde-suave)] px-5 py-2 font-sans text-[var(--puntero)]"
          role="status"
        >
          Previsualización:{' '}
          {aviso.confirmacionesNuevas > 0
            ? `${contar(aviso.confirmacionesNuevas, 'confirmación', 'confirmaciones')} en trazo discontinuo`
            : 'sin confirmaciones nuevas'}
          {aviso.punteroMovido ? ', el puntero se moverá' : ', el puntero no se mueve'}. Entrar
          ejecuta, Escape descarta.
        </p>
      )}

      <div className="shrink-0 border-t border-[var(--borde-suave)] px-5 py-4" aria-busy={corriendo}>
        {hayMasAbajo && (
          // Discreta, sobre el indicador y fuera de la salida, para no tapar
          // ninguna linea. Un clic baja hasta el final.
          <button
            type="button"
            onClick={irAlFinal}
            data-prueba="mas-abajo"
            className="t-min mb-2 block font-sans text-[var(--texto-apagado)] hover:text-[var(--texto)]"
          >
            la salida sigue más abajo ↓
          </button>
        )}
        <LineaIndicador indicador={indicador} />
        <div className="t-normal flex items-baseline gap-2 font-mono">
          <span className="text-[var(--consola-verde)]">$</span>
          {corriendo && (
            <span className="t-normal min-w-0 flex-1 truncate font-mono text-[var(--texto-apagado)]" role="status" data-prueba="orden-corriendo">
              {ocupado}
            </span>
          )}
          <input
            hidden={corriendo}
            disabled={corriendo}
            ref={campo}
            value={entrada}
            onChange={(evento) => onEntrada(evento.target.value)}
            onKeyDown={alTeclear}
            onFocus={() => setEnfocado(true)}
            onBlur={() => setEnfocado(false)}
            className="t-normal min-w-0 flex-1 bg-transparent font-mono text-[var(--texto)] outline-none"
            aria-label="Orden de Git"
            data-prueba="entrada-consola"
            aria-describedby={
              mostrarAyuda && previsualizacionActiva ? 'aviso-previsualizacion' : undefined
            }
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        {mostrarAyuda && (
          <>
            <p className="t-min mt-1 font-sans text-[var(--texto-apagado)]">
              Tabulación completa la orden. Con el campo vacío, tabulación sale de la consola.
            </p>
            {previsualizacionActiva && (
              <p id="aviso-previsualizacion" className="t-min mt-1 font-sans text-[var(--texto-apagado)]">
                Previsualización activa: lo que la orden haría se dibuja discontinuo antes de
                ejecutarla.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function LineaIndicador({ indicador }: { readonly indicador: Indicador }): React.ReactElement {
  return (
    <div className="t-min font-mono" data-prueba="indicador">
      <span className="text-[var(--consola-verde)]">{indicador.usuario}</span>{' '}
      <span className="text-[var(--consola-amarillo)]">{indicador.ruta}</span>
      {indicador.rama !== null && (
        <span className="text-[color:#48c4d3]"> ({indicador.rama})</span>
      )}
    </div>
  );
}
