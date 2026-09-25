/**
 * Zona D: las tres areas fijas y los paneles que aparecen segun el estado.
 *
 * Los paneles que no aplican no se muestran, y no se muestran vacios: la
 * pantalla debe respirar en los escenarios simples de la sesion 1.
 */

import {
  FILAS_VISIBLES,
  type ColumnaArea,
  type Paneles,
  type Renglon,
  type TonoElemento,
} from '../vista';

const COLOR_POR_TONO: Readonly<Record<TonoElemento, string>> = {
  nuevo: 'var(--consola-rojo)',
  modificado: 'var(--consola-rojo)',
  preparado: 'var(--consola-verde)',
  conflicto: 'var(--consola-amarillo)',
  neutro: 'var(--texto-apagado)',
  'borrado-preparado': 'var(--consola-verde)',
  'borrado-pendiente': 'var(--consola-rojo)',
  suelto: 'var(--texto)',
};

export function Areas({
  columnas,
}: {
  readonly columnas: readonly ColumnaArea[];
}): React.ReactElement {
  return (
    // Un solo flujo, no cuatro cajas: el archivo viaja de izquierda a derecha
    // (SPEC 013, seccion 3). La forma la pone la hoja de estilos.
    <div className="flujo">
      {columnas.map((columna) => (
        <section key={columna.clave} className="area px-6 py-4" data-columna={columna.clave}>
          <span className="flecha-flujo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12 H18 M12.5 6.5 L18 12 L12.5 17.5"
                stroke="currentColor"
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="rotulo">{columna.titulo}</h2>
            <p className="t-min font-mono text-[var(--texto-tenue)]">{columna.orden}</p>
          </div>
          {columna.elementos.length === 0 ? (
            <p className="t-pequeno text-[var(--texto-apagado)]">{columna.vacio}</p>
          ) : (
            <ul
              className="lista-archivos t-normal font-mono font-medium"
              // Cuando la lista se desplaza pasa a ser alcanzable con el
              // teclado; si cabe entera no agrega una parada de tabulacion que
              // no lleva a ninguna parte (CA8).
              tabIndex={columna.elementos.length > FILAS_VISIBLES ? 0 : undefined}
              style={{ '--filas-visibles': FILAS_VISIBLES } as React.CSSProperties}
            >
              {columna.elementos.map((elemento) => (
                <li
                  key={elemento.texto}
                  data-archivo={elemento.texto}
                  data-tono={elemento.tono}
                  style={{ color: COLOR_POR_TONO[elemento.tono] }}
                >
                  {elemento.tono.startsWith('borrado-') ? <s>{elemento.texto}</s> : elemento.texto}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function PanelesSecundarios({
  paneles,
}: {
  readonly paneles: Paneles;
}): React.ReactElement | null {
  const hayAlguno =
    paneles.guardado !== null || paneles.diferencias !== null || paneles.objetos !== null;
  if (!hayAlguno) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {paneles.guardado !== null && (
        <section className="panel px-5 py-4">
          <h2 className="rotulo mb-3">Pila de guardado temporal</h2>
          <ol className="t-min space-y-1 font-mono">
            {paneles.guardado.map((entrada) => (
              <li key={entrada.clave} data-guardado={entrada.texto}>
                <span className="text-[var(--puntero)]">{entrada.texto}</span>
                <span className="text-[var(--texto-apagado)]">
                  {' '}
                  · {entrada.archivos.join(', ')}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {paneles.diferencias !== null && (
        <section className="panel px-5 py-4">
          <h2 className="rotulo mb-3">Diferencias</h2>
          <div className="t-min max-h-48 overflow-auto font-mono">
            {paneles.diferencias.map((renglon: Renglon) => (
              <pre
                key={renglon.clave}
                className="whitespace-pre-wrap"
                style={{
                  color:
                    renglon.color === 'exito'
                      ? 'var(--consola-verde)'
                      : renglon.color === 'error'
                        ? 'var(--consola-rojo)'
                        : 'var(--texto-apagado)',
                }}
              >
                {renglon.texto === '' ? ' ' : renglon.texto}
              </pre>
            ))}
          </div>
        </section>
      )}

      {paneles.objetos !== null && (
        <section className="panel px-5 py-4">
          <h2 className="rotulo mb-3">Objetos internos</h2>
          <div className="t-min space-y-2 font-mono">
            <ObjetoDibujado
              titulo="confirmación"
              id={paneles.objetos.confirmacion.id}
              campos={paneles.objetos.confirmacion.campos}
            />
            <ObjetoDibujado
              titulo="árbol"
              id={paneles.objetos.arbol.id}
              campos={paneles.objetos.arbol.campos}
            />
            {paneles.objetos.elementos.map((elemento) => (
              <ObjetoDibujado
                key={elemento.id}
                titulo="elemento"
                id={elemento.id}
                campos={elemento.campos}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ObjetoDibujado({
  titulo,
  id,
  campos,
}: {
  readonly titulo: string;
  readonly id: string;
  readonly campos: readonly { readonly clave: string; readonly valor: string }[];
}): React.ReactElement {
  return (
    <div className="rounded border border-[var(--borde-suave)] p-2">
      <p>
        <span className="text-[var(--texto-apagado)]">{titulo} </span>
        <span className="text-[var(--rama-derivada)]">{id}</span>
      </p>
      {campos.map((campo) => (
        <p key={`${campo.clave}:${campo.valor}`} className="text-[var(--texto-apagado)]">
          {campo.clave} <span className="text-[var(--texto)]">{campo.valor}</span>
        </p>
      ))}
    </div>
  );
}
