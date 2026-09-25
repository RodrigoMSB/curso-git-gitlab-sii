/**
 * Pantalla del simulador.
 *
 * Reune las cinco zonas del SPEC 002 y guarda el estado de la interfaz. Toda
 * la informacion que pinta viene ya resuelta desde `src/vista`: aqui no se
 * calcula nada sobre confirmaciones, ramas ni punteros (restriccion R6).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  actualizarSesionReal,
  anotarOrdenReal,
  avisosReales,
  cambiarEscenario,
  completar,
  completarEnReal,
  type Conexion,
  conectarRepositorio,
  construirPantallaReal,
  estadoDeConexion,
  iniciarSesionReal,
  motivoDeFalla,
  navegadorPuedeConectar,
  reconectarRepositorio,
  seleccionarEnReal,
  SIN_LA_API,
  type SesionReal,
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
  carpetaRecordada,
  nombreRecordado,
  recordarCarpeta,
} from '../vista';
import { Areas, PanelesSecundarios } from './Areas';
import { AvisosDelRepositorio } from './AvisosDelRepositorio';
import { BarraEstado } from './BarraEstado';
import { Consola } from './Consola';
import { Grafo } from './Grafo';
import { LineaTiempo } from './LineaTiempo';
import { Tirador } from './Tirador';
import { useMovimientoReducido } from './useMovimientoReducido';

/**
 * Cada cuanto se mira la carpeta conectada. Un cambio se ve, a mas tardar, una
 * vuelta mas lo que tome leer: el SPEC 024 pide menos de un segundo.
 */
const INTERVALO_MS = 300;

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

  // El repositorio del alumno, cuando se conecto uno (SPEC 020). Mientras hay
  // uno, la pantalla lo muestra a el y no al escenario.
  const [real, setReal] = useState<SesionReal | null>(null);
  const conexion = useRef<Conexion | null>(null);
  const [avisoConexion, setAvisoConexion] = useState<string | null>(null);
  // La ultima carpeta, que el navegador recuerda entre recargas (SPEC 024, 4).
  // Al cargar se lee solo su nombre; el manejador, al apretar «reconectar»
  // (ver src/real/recordar.ts).
  const [recordada, setRecordada] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    nombreRecordado().then((nombre) => {
      if (vivo) setRecordada(nombre);
    });
    return () => {
      vivo = false;
    };
  }, []);

  // Cada vuelta se mira si algo cambio, en Git o en los archivos; si cambio,
  // se relee y la previsualizacion que estaba escrita se borra, porque ya paso
  // (punto 2.8 del SPEC 020 y 2.3 del SPEC 024).
  const conectado = real !== null;
  useEffect(() => {
    if (!conectado) return;
    let vivo = true;
    let ocupado = false;
    let vueltas = 0;
    const reloj = window.setInterval(() => {
      const actual = conexion.current;
      if (ocupado || actual === null) return;
      ocupado = true;
      actual
        .revisar()
        .then((lectura) => {
          if (!vivo || lectura === null || conexion.current !== actual) return;
          setReal((anterior) => (anterior === null ? anterior : actualizarSesionReal(anterior, lectura)));
          setEntrada('');
          setSugerencias([]);
        })
        .catch(() => undefined)
        .finally(() => {
          ocupado = false;
          // Cuantas vueltas del sondeo terminaron, y cuanto costo la ultima:
          // la prueba en el navegador lo usa para saber que la pagina ya miro
          // despues de un cambio, y para medir (CA5 del SPEC 024).
          vueltas += 1;
          document.documentElement.dataset.vueltas = String(vueltas);
          document.documentElement.dataset.vigilancia = JSON.stringify(actual.vigilancia);
        });
    }, INTERVALO_MS);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [conectado]);

  const empezar = useCallback(async (nueva: Conexion): Promise<void> => {
    const lectura = await nueva.leer();
    conexion.current = nueva;
    setReal(iniciarSesionReal(nueva.nombre, lectura));
    setEntrada('');
    setSugerencias([]);
    setIndiceHistorial(0);
    if (nueva.carpeta !== null) {
      const carpeta = nueva.carpeta;
      void recordarCarpeta(carpeta).then((guardada) => setRecordada(guardada ? carpeta.name : null));
    }
  }, []);

  const conectar = useCallback((): void => {
    if (!navegadorPuedeConectar()) {
      setAvisoConexion(SIN_LA_API);
      return;
    }
    setAvisoConexion(null);
    conectarRepositorio()
      .then((nueva) => (nueva === null ? undefined : empezar(nueva)))
      .catch((error: unknown) => setAvisoConexion(motivoDeFalla(error)));
  }, [empezar]);

  // Un solo clic: es el que el navegador exige para devolver el permiso (4.1).
  const reconectar = useCallback((): void => {
    if (recordada === null) return;
    setAvisoConexion(null);
    // Si el permiso se perdio con la pagina abierta, el manejador sigue en
    // memoria: no hace falta leerlo del almacenamiento.
    const enMemoria = conexion.current?.carpeta ?? null;
    (enMemoria === null ? carpetaRecordada() : Promise.resolve(enMemoria))
      .then((carpeta) => (carpeta === null ? null : reconectarRepositorio(carpeta)))
      .then((nueva) => {
        if (nueva === null) {
          setAvisoConexion(`No se pudo volver a abrir ${recordada}. Elige la carpeta de nuevo.`);
          return undefined;
        }
        return empezar(nueva);
      })
      .catch((error: unknown) => setAvisoConexion(motivoDeFalla(error)));
  }, [recordada, empezar]);

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

  const pantalla = useMemo(() => {
    const opciones = { previsualizacionActiva, entrada, modoRelator, altoGrafo, anchoGrafo };
    return real === null ? construirPantalla(sesion, opciones) : construirPantallaReal(real, opciones);
  }, [sesion, real, previsualizacionActiva, entrada, modoRelator, altoGrafo, anchoGrafo]);

  const ejecutar = useCallback(
    (texto: string): void => {
      // Con el repositorio real la orden no se ejecuta: se anota y se dice donde escribirla.
      if (real !== null) setReal((anterior) => (anterior === null ? anterior : anotarOrdenReal(anterior, texto)));
      else setSesion((anterior) => ejecutarOrden(anterior, texto));
      setEntrada('');
      setSugerencias([]);
      setIndiceHistorial(0);
    },
    [real],
  );

  const historial = real === null ? sesion.historial : real.historial;

  const completarOrden = useCallback(
    (texto: string): void => {
      const resultado = real === null ? completar(texto, estadoDe(sesion)) : completarEnReal(texto, real);
      if (resultado.texto !== null) {
        setEntrada(resultado.texto);
        setSugerencias([]);
        return;
      }
      setSugerencias(resultado.sugerencias);
    },
    [sesion, real],
  );

  const recorrerHistorial = useCallback(
    (direccion: 'anterior' | 'siguiente'): void => {
      const paso = navegarHistorial(historial, indiceHistorial, direccion);
      setIndiceHistorial(paso.indice);
      setEntrada(paso.texto);
    },
    [historial, indiceHistorial],
  );

  const descartar = useCallback((): void => {
    setEntrada('');
    setSugerencias([]);
  }, []);

  const elegirEscenario = useCallback((id: string): void => {
    // Elegir un escenario deja de mirar el repositorio real.
    conexion.current = null;
    setReal(null);
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
        conexion={real === null ? null : estadoDeConexion(real)}
        avisoConexion={avisoConexion}
        recordada={recordada}
        onConectar={conectar}
        onReconectar={reconectar}
      />

      {real !== null && <AvisosDelRepositorio avisos={avisosReales(real)} nombre={real.nombre} lecturas={real.lecturas} />}

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
              escenario={real === null ? sesion.escenario : `real:${real.nombre}`}
              onSeleccionar={(id) =>
                real === null
                  ? setSesion((anterior) => seleccionarConfirmacion(anterior, id))
                  : setReal((anterior) => (anterior === null ? anterior : seleccionarEnReal(anterior, id)))
              }
            />
          </section>
        </div>

        <Areas columnas={pantalla.columnas} />
        <PanelesSecundarios paneles={pantalla.paneles} />

        {/* Con el repositorio real no hay pasos que recorrer: el pasado lo guarda Git. */}
        {real === null && (
          <LineaTiempo
            segmentos={pantalla.segmentos}
            onIr={(indice) => setSesion((anterior) => irAPaso(anterior, indice))}
          />
        )}
      </div>
    </div>
  );
}
