/**
 * La pantalla del modo taller (SPEC 026).
 *
 * La misma pantalla del simulador —consola, tirador, grafo, áreas y paneles—
 * con otra fuente: la consola manda cada orden al programa local, que la
 * ejecuta con Git Bash, y el estado lo trae el programa, preguntándole a Git.
 * Cada medio segundo se pregunta si algo cambió, para enterarse también de lo
 * que el alumno hace fuera de la página, como editar un archivo en VS Code.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  anotarCierre,
  anotarEstado,
  anotarOrden,
  anotarResultado,
  construirPantallaTaller,
  ESCALA_RELATOR,
  type EstadoTaller,
  type Indicador,
  indicadorTaller,
  iniciarSesionTaller,
  limpiarConsola,
  navegarHistorial,
  type ResultadoOrdenTaller,
  type SesionTaller,
  seleccionarEnTaller,
} from '../vista';
import { Areas, PanelesSecundarios } from './Areas';
import { BarraTaller } from './BarraTaller';
import { Consola } from './Consola';
import { Grafo } from './Grafo';
import { Tirador } from './Tirador';
import { useMedidas } from './useMedidas';
import { useMovimientoReducido } from './useMovimientoReducido';

const CADA_MS = 500;

interface EntradaHistorial extends ResultadoOrdenTaller {
  readonly orden: string;
  readonly indicador?: Indicador;
}

export function AplicacionTaller({ clave }: { readonly clave: string }): React.ReactElement {
  const [sesion, setSesion] = useState<SesionTaller>(iniciarSesionTaller);
  const [entrada, setEntrada] = useState('');
  const [indiceHistorial, setIndiceHistorial] = useState(0);
  const [modoRelator, setModoRelator] = useState(false);
  const [temaClaro, setTemaClaro] = useState(false);
  const [reparto, setReparto] = useState<number | null>(null);
  const huella = useRef('');

  useEffect(() => {
    document.documentElement.dataset.tema = temaClaro ? 'claro' : 'oscuro';
  }, [temaClaro]);

  const cabeceras = useMemo(() => ({ 'X-Taller-Clave': clave }), [clave]);

  /** Trae el estado si cambio. Con `forzar`, aunque la huella sea la misma. */
  const consultar = useCallback(
    async (forzar: boolean): Promise<void> => {
      try {
        const desde = forzar ? '' : huella.current;
        const respuesta = await fetch(`/api/estado?huella=${encodeURIComponent(desde)}`, {
          headers: cabeceras,
          cache: 'no-store',
        });
        if (!respuesta.ok) throw new Error(String(respuesta.status));
        const datos = (await respuesta.json()) as EstadoTaller | { readonly igual: true; readonly huella: string };
        if ('igual' in datos) {
          setSesion((anterior) => (anterior.cerrado ? { ...anterior, cerrado: false } : anterior));
          return;
        }
        huella.current = datos.huella;
        setSesion((anterior) => anotarEstado(anterior, datos));
        document.documentElement.dataset.huella = datos.huella;
      } catch {
        setSesion(anotarCierre);
      }
    },
    [cabeceras],
  );

  // Al entrar (o volver a entrar, punto 2.8): lo que ya se escribio en esta
  // sesion del taller, y el estado.
  useEffect(() => {
    let vivo = true;
    fetch('/api/sesion', { headers: cabeceras, cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((datos: { historial?: EntradaHistorial[] } | null) => {
        if (!vivo || datos === null) return;
        setSesion((anterior) => {
          let actual = anterior;
          for (const paso of datos.historial ?? []) {
            actual = anotarResultado(anotarOrden(actual, paso.orden, paso.indicador), paso);
          }
          return actual;
        });
      })
      .catch(() => setSesion(anotarCierre));
    void consultar(true);
    const reloj = window.setInterval(() => void consultar(false), CADA_MS);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, [cabeceras, consultar]);

  const ejecutar = useCallback(
    (texto: string): void => {
      const orden = texto.trim();
      setEntrada('');
      setIndiceHistorial(0);
      if (sesion.ocupada) return;
      if (orden === '') {
        setSesion((anterior) => anotarResultado(anotarOrden(anterior, ''), vacio(anterior)));
        return;
      }
      if (orden === 'clear') {
        setSesion(limpiarConsola);
        return;
      }
      setSesion((anterior) => anotarOrden(anterior, orden));
      fetch('/api/orden', {
        method: 'POST',
        headers: { ...cabeceras, 'Content-Type': 'application/json' },
        // El indicador va con la orden para que, al volver a entrar, cada orden se vea con el suyo.
        body: JSON.stringify({ orden, indicador: indicadorTaller(sesion.estado) }),
      })
        .then(async (respuesta) => {
          if (respuesta.status === 409) {
            return { salida: '', error: 'Hay otra orden corriendo en el taller. Espera a que termine.', codigo: 1 };
          }
          if (!respuesta.ok) throw new Error(String(respuesta.status));
          return (await respuesta.json()) as ResultadoOrdenTaller;
        })
        .then((resultado) => {
          setSesion((anterior) => anotarResultado(anterior, { carpeta: '', carpetaAntes: '', ...resultado }));
          return consultar(true);
        })
        .catch(() => {
          setSesion((anterior) =>
            anotarCierre(
              anotarResultado(anterior, {
                salida: '',
                error: 'El taller no contestó: la ventana del taller se cerró.',
                codigo: 1,
                carpeta: '',
                carpetaAntes: '',
              }),
            ),
          );
        });
    },
    [cabeceras, consultar, sesion.ocupada, sesion.estado],
  );

  const recorrerHistorial = useCallback(
    (direccion: 'anterior' | 'siguiente'): void => {
      const paso = navegarHistorial(sesion.historial, indiceHistorial, direccion);
      setIndiceHistorial(paso.indice);
      setEntrada(paso.texto);
    },
    [sesion.historial, indiceHistorial],
  );

  const movimientoReducido = useMovimientoReducido();
  const escala = modoRelator ? ESCALA_RELATOR : 1;
  const { cuerpo, panelGrafo, consola, medidas } = useMedidas();
  const altoGrafo = medidas === null ? null : medidas.alto / escala;
  const anchoGrafo = medidas === null ? null : medidas.ancho / escala;

  const pantalla = useMemo(
    () => construirPantallaTaller(sesion, { altoGrafo, anchoGrafo, modoRelator }),
    [sesion, altoGrafo, anchoGrafo, modoRelator],
  );

  return (
    <div
      data-relator={modoRelator}
      data-modo="taller"
      style={{ '--escala': escala } as React.CSSProperties}
      className="flex min-h-[100dvh] flex-col min-[1280px]:h-[100dvh]"
    >
      <BarraTaller
        barra={pantalla.barra}
        modoRelator={modoRelator}
        temaClaro={temaClaro}
        onModoRelator={() => setModoRelator((valor) => !valor)}
        onTemaClaro={() => setTemaClaro((valor) => !valor)}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
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
            sugerencias={[]}
            aviso={null}
            previsualizacionActiva={false}
            ayuda={false}
            ocupada={sesion.ocupada || sesion.cerrado}
            onEntrada={setEntrada}
            onEjecutar={ejecutar}
            onCompletar={() => undefined}
            onHistorial={recorrerHistorial}
            onDescartar={() => setEntrada('')}
          />

          <Tirador actual={medidas?.reparto ?? 50} pedido={reparto} contenedor={cuerpo} onCambiar={setReparto} />

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
              escenario={`taller:${sesion.estado?.repositorio ? sesion.estado.raiz : ''}`}
              onSeleccionar={(id) => setSesion((anterior) => seleccionarEnTaller(anterior, id))}
              vacio={pantalla.grafoVacio}
            />
          </section>
        </div>

        <Areas columnas={pantalla.columnas} />
        <PanelesSecundarios paneles={pantalla.paneles} />
      </div>
    </div>
  );
}

/** Enter con el campo vacio: el indicador se repite, como en Git Bash. */
function vacio(_: SesionTaller): ResultadoOrdenTaller {
  return { salida: '', error: '', codigo: 0, carpeta: '', carpetaAntes: '' };
}
