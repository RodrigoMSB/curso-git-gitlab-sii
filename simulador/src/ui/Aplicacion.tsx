/**
 * Pantalla del simulador.
 *
 * Reune las cinco zonas del SPEC 002 y guarda el estado de la interfaz. Toda
 * la informacion que pinta viene ya resuelta desde `src/vista`: aqui no se
 * calcula nada sobre confirmaciones, ramas ni punteros (restriccion R6).
 */

import { useCallback, useMemo, useState } from 'react';
import {
  cambiarEscenario,
  completar,
  construirPantalla,
  ejecutarOrden,
  estadoDe,
  iniciarSesion,
  irAPaso,
  navegarHistorial,
  seleccionarConfirmacion,
  ESCALA_RELATOR,
  type Sesion,
} from '../vista';
import { Areas, PanelesSecundarios } from './Areas';
import { BarraEstado } from './BarraEstado';
import { Consola } from './Consola';
import { Grafo } from './Grafo';
import { LineaTiempo } from './LineaTiempo';
import { useMovimientoReducido } from './useMovimientoReducido';

const ESCENARIO_INICIAL = 'E1';

export function Aplicacion(): React.ReactElement {
  const [sesion, setSesion] = useState<Sesion>(() => iniciarSesion(ESCENARIO_INICIAL));
  const [entrada, setEntrada] = useState('');
  const [sugerencias, setSugerencias] = useState<readonly string[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState(0);
  const [previsualizacionActiva, setPrevisualizacionActiva] = useState(true);
  const [modoRelator, setModoRelator] = useState(false);

  const movimientoReducido = useMovimientoReducido();
  const escala = modoRelator ? ESCALA_RELATOR : 1;

  const pantalla = useMemo(
    () => construirPantalla(sesion, { previsualizacionActiva, entrada, modoRelator }),
    [sesion, previsualizacionActiva, entrada, modoRelator],
  );

  const ejecutar = useCallback((texto: string): void => {
    setSesion((anterior) => ejecutarOrden(anterior, texto));
    setEntrada('');
    setSugerencias([]);
    setIndiceHistorial(0);
  }, []);

  const completarOrden = useCallback(
    (texto: string): void => {
      const resultado = completar(texto, estadoDe(sesion));
      if (resultado.texto !== null) {
        setEntrada(resultado.texto);
        setSugerencias([]);
        return;
      }
      setSugerencias(resultado.sugerencias);
    },
    [sesion],
  );

  const recorrerHistorial = useCallback(
    (direccion: 'anterior' | 'siguiente'): void => {
      const paso = navegarHistorial(sesion.historial, indiceHistorial, direccion);
      setIndiceHistorial(paso.indice);
      setEntrada(paso.texto);
    },
    [sesion.historial, indiceHistorial],
  );

  const descartar = useCallback((): void => {
    setEntrada('');
    setSugerencias([]);
  }, []);

  const elegirEscenario = useCallback((id: string): void => {
    setSesion(cambiarEscenario(id));
    setEntrada('');
    setSugerencias([]);
    setIndiceHistorial(0);
  }, []);

  return (
    // La pantalla ocupa al menos el alto de la ventana, pero no lo impone: si
    // el contenido no llega, las zonas no se estiran para rellenarlo.
    <div
      data-relator={modoRelator}
      style={{ '--escala': escala } as React.CSSProperties}
      className="flex min-h-[100dvh] flex-col gap-3 p-3"
    >
      <BarraEstado
        barra={pantalla.barra}
        escenario={sesion.escenario}
        previsualizacionActiva={previsualizacionActiva}
        modoRelator={modoRelator}
        onEscenario={elegirEscenario}
        onPrevisualizacion={() => setPrevisualizacionActiva((valor) => !valor)}
        onModoRelator={() => setModoRelator((valor) => !valor)}
        onReiniciar={() => elegirEscenario(sesion.escenario)}
      />

      {/*
        Por debajo de mil doscientos ochenta pixeles las zonas se apilan en
        vertical en lugar de comprimirse (punto 10.5).

        `items-start` es lo que deja que la consola y el grafo midan lo que su
        contenido pide. Sin eso, ambos se estiraban a la altura de la fila y en
        los escenarios de la sesion 1 la pantalla mostraba mil pixeles vacios.
        El tope los mantiene dentro de la ventana junto con el resto de zonas.
      */}
      <div className="grid grid-cols-1 items-start gap-3 [--alto-central:calc(100dvh-20rem)] min-[1280px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Consola
          indicador={pantalla.indicador}
          renglones={pantalla.renglones}
          entrada={entrada}
          sugerencias={sugerencias}
          aviso={pantalla.aviso}
          previsualizacionActiva={previsualizacionActiva}
          onEntrada={(texto) => {
            setEntrada(texto);
            setSugerencias([]);
          }}
          onEjecutar={ejecutar}
          onCompletar={completarOrden}
          onHistorial={recorrerHistorial}
          onDescartar={descartar}
        />

        <section
          className="panel max-h-[var(--alto-central)] min-h-0 overflow-hidden"
          aria-label="Grafo de confirmaciones"
        >
          <Grafo
            disposicion={pantalla.grafo}
            escala={escala}
            seleccion={pantalla.seleccion}
            animar={!movimientoReducido}
            onSeleccionar={(id) => setSesion((anterior) => seleccionarConfirmacion(anterior, id))}
          />
        </section>
      </div>

      {/*
        `mt-auto` deja la franja de areas y la linea de tiempo apoyadas en el
        borde inferior. Asi el hueco que sobra en los escenarios chicos queda
        entre el grafo y las areas, que es justo donde el grafo va a crecer, y
        las dos zonas de abajo no se deslizan por la pantalla a medida que
        aparecen confirmaciones.
      */}
      <div className="mt-auto shrink-0 space-y-3">
        <Areas columnas={pantalla.columnas} />
        <PanelesSecundarios paneles={pantalla.paneles} />
      </div>

      <div className="shrink-0">
        <LineaTiempo
          segmentos={pantalla.segmentos}
          onIr={(indice) => setSesion((anterior) => irAPaso(anterior, indice))}
        />
      </div>
    </div>
  );
}
