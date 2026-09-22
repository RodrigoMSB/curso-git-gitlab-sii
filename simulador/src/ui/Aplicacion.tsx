/**
 * Pantalla del simulador.
 *
 * Reune las cinco zonas del SPEC 002 y guarda el estado de la interfaz. Toda
 * la informacion que pinta viene ya resuelta desde `src/vista`: aqui no se
 * calcula nada sobre confirmaciones, ramas ni punteros (restriccion R6).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  cambiarEscenario,
  completar,
  construirPantalla,
  ejecutarOrden,
  estadoDe,
  escenarioDeArranque,
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
import { Tirador } from './Tirador';
import { useMovimientoReducido } from './useMovimientoReducido';

export function Aplicacion(): React.ReactElement {
  const [sesion, setSesion] = useState<Sesion>(() => iniciarSesion(escenarioDeArranque(window.location)));
  const [entrada, setEntrada] = useState('');
  const [sugerencias, setSugerencias] = useState<readonly string[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState(0);
  const [previsualizacionActiva, setPrevisualizacionActiva] = useState(true);
  const [modoRelator, setModoRelator] = useState(false);
  // El tema no se guarda: recargar vuelve al oscuro, como todo lo demas de la
  // interfaz vuelve a su estado inicial (decision 7.12).
  const [temaClaro, setTemaClaro] = useState(false);

  // Los colores viven en la raiz del documento, porque el fondo de la pagina
  // tambien cambia con el tema y no solo lo que esta dentro de la aplicacion.
  useEffect(() => {
    document.documentElement.dataset.tema = temaClaro ? 'claro' : 'oscuro';
  }, [temaClaro]);

  const movimientoReducido = useMovimientoReducido();
  const escala = modoRelator ? ESCALA_RELATOR : 1;

  // El reparto del ancho que eligio el relator, en porcentaje para la
  // consola, o `null` mientras no haya movido el tirador: entonces manda el de
  // partida, que es el que deja entrar la linea mas larga del guion (SPEC 017,
  // punto 3.2). Vive aqui y no se toca al cambiar de escenario (punto 3.6).
  const [reparto, setReparto] = useState<number | null>(null);

  // Lo que mide la pantalla y el calculo de posiciones necesita: el hueco del
  // panel del grafo, descontado su relleno (p-4) y sus bordes, y el reparto
  // que se ve. El grafo aprieta filas y carriles para caber en ese hueco
  // (SPEC 016 y 017); antes el panel lo cortaba sin aviso.
  const cuerpo = useRef<HTMLDivElement>(null);
  const panelGrafo = useRef<HTMLElement>(null);
  const consola = useRef<HTMLElement>(null);
  const [medidas, setMedidas] = useState<{
    readonly ancho: number;
    readonly alto: number;
    readonly reparto: number;
  } | null>(null);
  useLayoutEffect(() => {
    const medir = (): void => {
      const panel = panelGrafo.current;
      const contenedor = cuerpo.current;
      const columna = consola.current;
      if (panel === null || contenedor === null || columna === null) return;
      const hueco = 2 * 16 + 2;
      const siguiente = {
        ancho: panel.clientWidth - hueco + 2,
        alto: panel.clientHeight - hueco + 2,
        reparto: (columna.getBoundingClientRect().width / Math.max(contenedor.clientWidth, 1)) * 100,
      };
      setMedidas((anterior) =>
        anterior !== null &&
        anterior.ancho === siguiente.ancho &&
        anterior.alto === siguiente.alto &&
        Math.abs(anterior.reparto - siguiente.reparto) < 0.1
          ? anterior
          : siguiente,
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    for (const elemento of [panelGrafo.current, cuerpo.current, consola.current]) {
      if (elemento !== null) observador.observe(elemento);
    }
    return () => observador.disconnect();
  }, []);
  const altoGrafo = medidas === null ? null : medidas.alto / escala;
  const anchoGrafo = medidas === null ? null : medidas.ancho / escala;

  const pantalla = useMemo(
    () =>
      construirPantalla(sesion, { previsualizacionActiva, entrada, modoRelator, altoGrafo, anchoGrafo }),
    [sesion, previsualizacionActiva, entrada, modoRelator, altoGrafo, anchoGrafo],
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
    // En escritorio la pantalla mide exactamente la ventana, y la consola y el
    // grafo se quedan con lo que las demas zonas no usan (SPEC 017, seccion
    // 2). Tiene que ser un alto y no un minimo: con un minimo, el grafo sin
    // apretar del primer dibujo estiraba la pagina, la medicion veia un panel
    // alto y ya no apretaba nada. Bajo mil doscientos ochenta, apilada, la
    // pantalla crece con su contenido.
    <div
      data-relator={modoRelator}
      style={{ '--escala': escala } as React.CSSProperties}
      className="flex min-h-[100dvh] flex-col min-[1280px]:h-[100dvh]"
    >
      <BarraEstado
        barra={pantalla.barra}
        escenario={sesion.escenario}
        previsualizacionActiva={previsualizacionActiva}
        modoRelator={modoRelator}
        temaClaro={temaClaro}
        onEscenario={elegirEscenario}
        onTemaClaro={() => setTemaClaro((valor) => !valor)}
        onPrevisualizacion={() => setPrevisualizacionActiva((valor) => !valor)}
        onModoRelator={() => setModoRelator((valor) => !valor)}
        onReiniciar={() => elegirEscenario(sesion.escenario)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
        {/*
          La consola ocupa la columna izquierda entera, de arriba abajo, y el
          grafo la derecha, con el tirador entre medio (SPEC 017). El bloque
          crece hasta llenar lo que dejan las demas zonas, con un minimo: si
          aparecen los paneles secundarios, la pagina se desplaza en vez de
          aplastarlo. Bajo mil doscientos ochenta pixeles se apilan (punto 10.5
          del SPEC 002) y el tirador no tiene sentido.
        */}
        <div
          ref={cuerpo}
          className="flex min-h-[26rem] flex-1 flex-col gap-4 min-[1280px]:flex-row min-[1280px]:gap-0"
        >
          <Consola
            ref={consola}
            reparto={reparto}
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

          <Tirador
            actual={medidas?.reparto ?? 50}
            pedido={reparto}
            contenedor={cuerpo}
            onCambiar={setReparto}
          />

          <section
            ref={panelGrafo}
            className="panel flex min-h-[26rem] min-w-0 flex-1 flex-col overflow-hidden min-[1280px]:min-h-0"
            aria-label="Grafo de confirmaciones"
          >
            <Grafo
              disposicion={pantalla.grafo}
              escala={escala}
              seleccion={pantalla.seleccion}
              animar={!movimientoReducido}
              escenario={sesion.escenario}
              onSeleccionar={(id) => setSesion((anterior) => seleccionarConfirmacion(anterior, id))}
            />
          </section>
        </div>

        <Areas columnas={pantalla.columnas} />
        <PanelesSecundarios paneles={pantalla.paneles} />

        <LineaTiempo
          segmentos={pantalla.segmentos}
          onIr={(indice) => setSesion((anterior) => irAPaso(anterior, indice))}
        />
      </div>
    </div>
  );
}
