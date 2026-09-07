/**
 * Zona D: las cuatro areas fijas y los paneles que aparecen segun el estado.
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
};

export function Areas({
  columnas,
}: {
  readonly columnas: readonly ColumnaArea[];
}): React.ReactElement {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {columnas.map((columna) => (
        <section key={columna.clave} className="panel p-3">
          <h2 className="t-pequeno font-semibold">{columna.titulo}</h2>
          <p className="t-min mb-2 font-mono text-[var(--texto-apagado)]">{columna.orden}</p>
          {columna.elementos.length === 0 ? (
            <p className="t-min text-[var(--texto-apagado)]">{columna.vacio}</p>
          ) : (
            <ul
              className="lista-archivos t-min font-mono"
              // Cuando la lista se desplaza pasa a ser alcanzable con el
              // teclado; si cabe entera no agrega una parada de tabulacion que
              // no lleva a ninguna parte (CA8).
              tabIndex={columna.elementos.length > FILAS_VISIBLES ? 0 : undefined}
              style={{ '--filas-visibles': FILAS_VISIBLES } as React.CSSProperties}
            >
              {columna.elementos.map((elemento) => (
                <li key={elemento.texto} style={{ color: COLOR_POR_TONO[elemento.tono] }}>
                  {elemento.texto}
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {paneles.guardado !== null && (
        <section className="panel p-3">
          <h2 className="t-pequeno mb-2 font-semibold">Pila de guardado temporal</h2>
          <ol className="t-min space-y-1 font-mono">
            {paneles.guardado.map((entrada) => (
              <li key={entrada.clave}>
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
        <section className="panel p-3">
          <h2 className="t-pequeno mb-2 font-semibold">Diferencias</h2>
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
        <section className="panel p-3">
          <h2 className="t-pequeno mb-2 font-semibold">Objetos internos</h2>
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
