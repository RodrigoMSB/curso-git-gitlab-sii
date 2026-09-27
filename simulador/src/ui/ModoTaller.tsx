/**
 * Pantalla del modo taller (SPEC 026).
 *
 * La misma pantalla del simulador, con la consola conectada al programa local:
 * cada orden corre con Git de verdad en la carpeta del participante, y el
 * grafo y las areas se dibujan con lo que Git dice. No hay previsualizacion,
 * selector de escenario ni linea de tiempo: nada de eso aplica cuando la
 * orden ya ocurrio en el disco.
 *
 * El estado se pide cada medio segundo y el programa responde de memoria; si
 * nada cambio responde sin cuerpo y aqui no se redibuja. Si el programa deja
 * de responder se dice en una franja. Se sigue intentando cada cinco segundos,
 * por si solo tardo, pero un taller cerrado vuelve con otro puerto y otra
 * clave, y esta pestaña ya no lo alcanza: la franja manda a cerrarla y seguir
 * en la que abre el arranque nuevo (SPEC 029).
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  barraDelTaller,
  columnasDelTaller,
  completarEnTaller,
  grafoDelTaller,
  guardadosDelTaller,
  indicadorDelTaller,
  navegarHistorial,
  presentacion,
  renglonDelPrograma,
  renglonesDeAyuda,
  renglonesDeOrden,
  ESCALA_RELATOR,
  type DocumentoTaller,
  type Indicador,
  type Renglon,
} from '../vista';
import { Areas, PanelesSecundarios } from './Areas';
import { BarraModoTaller } from './BarraModoTaller';
import { mandarOrden, pedirEstado, TallerCaido, type Conexion } from './clienteTaller';
import { Consola } from './Consola';
import { Grafo } from './Grafo';
import { Tirador } from './Tirador';
import { useMovimientoReducido } from './useMovimientoReducido';

const CADA = 500;
const CADA_SI_CAIDO = 5000;

const INDICADOR_INICIAL: Indicador = { usuario: '', ruta: '', rama: null };

export function ModoTaller({ clave }: { readonly clave: string }): React.ReactElement {
  const [documento, setDocumento] = useState<DocumentoTaller | null>(null);
  const [conexion, setConexion] = useState<Conexion>('bien');
  const [renglones, setRenglones] = useState<readonly Renglon[]>([]);
  const [historial, setHistorial] = useState<readonly string[]>([]);
  const [indiceHistorial, setIndiceHistorial] = useState(0);
  const [entrada, setEntrada] = useState('');
  const [sugerencias, setSugerencias] = useState<readonly string[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [modoRelator, setModoRelator] = useState(false);
  const [temaClaro, setTemaClaro] = useState(false);
  const [reparto, setReparto] = useState<number | null>(null);
  const contador = useRef(0);
  const version = useRef(-1);

  useEffect(() => {
    document.documentElement.dataset.tema = temaClaro ? 'claro' : 'oscuro';
  }, [temaClaro]);
  useEffect(() => {
    document.title = 'Taller Git · modo taller';
  }, []);

  const movimientoReducido = useMovimientoReducido();
  const escala = modoRelator ? ESCALA_RELATOR : 1;

  // --- El estado, cada medio segundo --------------------------------------

  const preguntar = useCallback(async (): Promise<Conexion> => {
    try {
      const nuevo = await pedirEstado(clave, version.current);
      // Una pregunta que salio antes de terminar una orden puede volver
      // despues de la que siguio a la orden: solo se acepta lo mas nuevo.
      if (nuevo !== null && nuevo.version > version.current) {
        version.current = nuevo.version;
        setDocumento(nuevo);
      }
      setConexion('bien');
      return 'bien';
    } catch (error) {
      const c = error instanceof TallerCaido ? error.conexion : 'caida';
      setConexion(c);
      return c;
    }
  }, [clave]);

  useEffect(() => {
    let vivo = true;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const ciclo = async (): Promise<void> => {
      const c = await preguntar();
      if (!vivo) return;
      espera = setTimeout(ciclo, c === 'bien' ? CADA : CADA_SI_CAIDO);
    };
    void ciclo();
    return () => {
      vivo = false;
      if (espera !== undefined) clearTimeout(espera);
    };
  }, [preguntar]);

  // La unica linea fija: la presentacion, cuando llega el primer estado.
  const presentado = useRef(false);
  useEffect(() => {
    if (documento === null || presentado.current) return;
    presentado.current = true;
    const lineas = [presentacion(documento), ...documento.sesion.avisos];
    setRenglones(lineas.map((texto, i) => renglonDelPrograma(texto, `presentacion:${i}`)));
  }, [documento]);

  // --- Las medidas del grafo, como en el modo de escenarios ----------------

  const cuerpo = useRef<HTMLDivElement>(null);
  const panelGrafo = useRef<HTMLElement>(null);
  const consola = useRef<HTMLElement>(null);
  const [medidas, setMedidas] = useState<{ readonly ancho: number; readonly alto: number; readonly reparto: number } | null>(
    null,
  );
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
  const grafo = useMemo(
    () => (documento === null ? null : grafoDelTaller(documento.estado, { altoGrafo, anchoGrafo })),
    [documento, altoGrafo, anchoGrafo],
  );
  const indicador = documento === null ? INDICADOR_INICIAL : indicadorDelTaller(documento);
  const columnas = documento === null ? [] : columnasDelTaller(documento.estado);
  const guardado = documento === null || modoRelator ? null : guardadosDelTaller(documento.estado);

  // --- La consola ------------------------------------------------------------

  const ejecutar = useCallback(
    async (texto: string): Promise<void> => {
      const orden = texto.trim();
      setEntrada('');
      setSugerencias([]);
      setIndiceHistorial(0);
      if (orden === '') return;
      setHistorial((anterior) => [...anterior, orden]);
      // clear limpia la pantalla y no se manda: no hay nada que ejecutar.
      if (orden === 'clear') {
        setRenglones([]);
        return;
      }
      const n = ++contador.current;
      if (orden === 'ayuda') {
        setRenglones((anterior) => [...anterior, ...renglonesDeAyuda(`o${n}`, indicador)]);
        return;
      }
      const donde = indicador;
      setOcupado(orden);
      try {
        const respuesta = await mandarOrden(clave, orden);
        setRenglones((anterior) => [...anterior, ...renglonesDeOrden(orden, respuesta, `o${n}`, donde)]);
        await preguntar();
      } catch (error) {
        const c = error instanceof TallerCaido ? error.conexion : 'caida';
        setConexion(c);
        setRenglones((anterior) => [
          ...anterior,
          { clave: `o${n}:orden`, texto: orden, color: 'orden', indicador: donde },
          renglonDelPrograma(
            c === 'otra-clave'
              ? 'El taller se volvió a abrir y esta pestaña quedó vieja. Usa la pestaña nueva.'
              : 'El taller no responde. La orden no se sabe si corrió; revisa la ventana del taller.',
            `o${n}:caida`,
          ),
        ]);
      } finally {
        setOcupado(null);
      }
    },
    [clave, indicador, preguntar],
  );

  const completarOrden = useCallback(
    (texto: string): void => {
      if (documento === null) return;
      const resultado = completarEnTaller(texto, documento.estado);
      if (resultado.texto !== null) {
        setEntrada(resultado.texto);
        setSugerencias([]);
        return;
      }
      setSugerencias(resultado.sugerencias);
    },
    [documento],
  );

  const recorrerHistorial = useCallback(
    (direccion: 'anterior' | 'siguiente'): void => {
      const paso = navegarHistorial(historial, indiceHistorial, direccion);
      setIndiceHistorial(paso.indice);
      setEntrada(paso.texto);
    },
    [historial, indiceHistorial],
  );

  const sinRepositorio = documento !== null && !documento.estado.repositorio;

  return (
    <div
      data-relator={modoRelator}
      data-modo="taller"
      style={{ '--escala': escala } as React.CSSProperties}
      className="flex min-h-[100dvh] flex-col min-[900px]:h-[100dvh]"
    >
      <BarraModoTaller
        barra={documento === null ? null : barraDelTaller(documento)}
        modoRelator={modoRelator}
        temaClaro={temaClaro}
        onModoRelator={() => setModoRelator((valor) => !valor)}
        onTemaClaro={() => setTemaClaro((valor) => !valor)}
      />

      {conexion !== 'bien' && (
        <p
          role="alert"
          data-prueba="franja-caida"
          className="t-normal border-b border-[var(--consola-rojo)] px-6 py-3 font-semibold text-[var(--consola-rojo)]"
          style={{ background: 'color-mix(in srgb, var(--consola-rojo) 12%, transparent)' }}
        >
          {conexion === 'otra-clave'
            ? 'El taller se volvió a abrir y esta pestaña quedó vieja. Cierra esta pestaña y usa la que se abrió nueva.'
            : 'El taller se cerró. Esta pestaña ya no puede volver a conectarse: ciérrala, abre el taller con el mismo doble clic y sigue en la pestaña nueva que se abre.'}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
        <div
          ref={cuerpo}
          className="flex min-h-[26rem] flex-1 flex-col gap-4 min-[900px]:flex-row min-[900px]:gap-0"
        >
          <Consola
            ref={consola}
            reparto={reparto}
            indicador={indicador}
            renglones={renglones}
            entrada={entrada}
            sugerencias={sugerencias}
            aviso={null}
            previsualizacionActiva={false}
            ocupado={
              ocupado !== null
                ? `${ocupado}   · corriendo, la consola espera a que termine`
                : conexion !== 'bien'
                  ? 'sin conexión con el taller'
                  : documento === null
                    ? 'conectando con el taller…'
                    : null
            }
            ayuda={false}
            corte={900}
            salidasDesdeElPrincipio
            onEntrada={(texto) => {
              setEntrada(texto);
              setSugerencias([]);
            }}
            onEjecutar={(texto) => void ejecutar(texto)}
            onCompletar={completarOrden}
            onHistorial={recorrerHistorial}
            onDescartar={() => {
              setEntrada('');
              setSugerencias([]);
            }}
          />

          <Tirador
            actual={medidas?.reparto ?? 50}
            pedido={reparto}
            contenedor={cuerpo}
            onCambiar={setReparto}
            corte={900}
          />

          <section
            ref={panelGrafo}
            className="panel flex min-h-[26rem] min-w-0 flex-1 flex-col overflow-hidden min-[900px]:min-h-0"
            aria-label="Grafo de confirmaciones"
          >
            {sinRepositorio ? (
              <p className="t-normal p-6 text-[var(--texto-apagado)]" data-prueba="sin-repositorio">
                La consola está en una carpeta que no es un repositorio de Git. Entra a uno con cd, o crea uno con
                git init, y aquí aparece su historia.
              </p>
            ) : grafo === null ? (
              <p className="t-normal p-6 text-[var(--texto-apagado)]">Conectando con el taller…</p>
            ) : (
              <Grafo
                disposicion={grafo}
                escala={escala}
                seleccion={null}
                animar={!movimientoReducido}
                escenario={documento?.estado.repositorio ? documento.estado.raiz : 'taller'}
                onSeleccionar={() => {}}
              />
            )}
          </section>
        </div>

        {columnas.length > 0 && <Areas columnas={columnas} />}
        <PanelesSecundarios paneles={{ guardado, diferencias: null, objetos: null }} />
      </div>
    </div>
  );
}
