/**
 * Andamiaje minimo de interfaz.
 *
 * No es el simulador: la consola, el grafo dibujado y el diseno son materia
 * del SPEC 002. Esto existe solo para comprobar que el motor funciona dentro
 * del archivo HTML autocontenido, sin servidor y sin red.
 */

import { useMemo, useState } from 'react';
import { ejecutar, previsualizar } from '../core/motor';
import { idActual, ramaActual } from '../core/estado';
import { huerfanas } from '../core/grafo';
import { decoracionesDe } from '../core/referencias';
import type { EstadoRepositorio, LineaSalida } from '../core/tipos';
import { ESCENARIOS, escenarioPorId } from '../escenarios';

interface Renglon {
  readonly clave: number;
  readonly tipo: LineaSalida['tipo'] | 'orden';
  readonly texto: string;
}

const COLOR_POR_TIPO: Readonly<Record<Renglon['tipo'], string>> = {
  orden: 'text-sky-300',
  salida: 'text-neutral-300',
  error: 'text-rose-400',
  aviso: 'text-amber-300',
  exito: 'text-emerald-400',
};

export function ComprobacionMotor(): React.ReactElement {
  const [escenario, setEscenario] = useState('E3');
  const [estado, setEstado] = useState<EstadoRepositorio>(() => escenarioPorId('E3'));
  const [renglones, setRenglones] = useState<readonly Renglon[]>([]);
  const [entrada, setEntrada] = useState('');
  const [contador, setContador] = useState(0);

  const vista = useMemo(
    () => (entrada.trim() === '' ? null : previsualizar(estado, entrada)),
    [estado, entrada],
  );

  const cambiarEscenario = (id: string): void => {
    setEscenario(id);
    setEstado(escenarioPorId(id));
    setRenglones([]);
    setEntrada('');
  };

  const enviar = (evento: React.FormEvent): void => {
    evento.preventDefault();
    const orden = entrada.trim();
    if (orden === '') return;

    const resultado = ejecutar(estado, orden);
    const nuevos: Renglon[] = [
      { clave: contador, tipo: 'orden', texto: `$ ${orden}` },
      ...resultado.salida.map((linea, indice) => ({
        clave: contador + indice + 1,
        tipo: linea.tipo,
        texto: linea.texto,
      })),
    ];

    setContador(contador + nuevos.length + 1);
    setRenglones(resultado.limpiarConsola ? [] : [...renglones, ...nuevos]);
    setEstado(resultado.estado);
    setEntrada('');
  };

  const cabeza = idActual(estado);

  return (
    <main className="flex h-full flex-col gap-4 bg-neutral-950 p-6 text-neutral-200">
      <header className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-lg font-semibold">Simulador de Git · comprobacion del motor</h1>
        <p className="text-sm text-neutral-400">
          Andamiaje del SPEC 001. La interfaz definitiva llega con el SPEC 002.
        </p>
      </header>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-neutral-400">Escenario</span>
        <select
          className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1"
          value={escenario}
          onChange={(evento) => cambiarEscenario(evento.target.value)}
        >
          {ESCENARIOS.map((candidato) => (
            <option key={candidato.id} value={candidato.id}>
              {candidato.id} · sesion {candidato.sesion} · {candidato.titulo}
            </option>
          ))}
        </select>
      </label>

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-2">
        <section className="flex min-h-0 flex-col rounded border border-neutral-800 bg-black">
          <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
            {renglones.map((renglon) => (
              <pre key={renglon.clave} className={`whitespace-pre-wrap ${COLOR_POR_TIPO[renglon.tipo]}`}>
                {renglon.texto === '' ? ' ' : renglon.texto}
              </pre>
            ))}
          </div>
          <form onSubmit={enviar} className="flex gap-2 border-t border-neutral-800 p-2">
            <span className="font-mono text-sm text-emerald-400">$</span>
            <input
              className="flex-1 bg-transparent font-mono text-sm outline-none"
              value={entrada}
              onChange={(evento) => setEntrada(evento.target.value)}
              placeholder="git status"
              autoFocus
            />
          </form>
        </section>

        <section className="min-h-0 overflow-auto rounded border border-neutral-800 p-3 font-mono text-xs">
          <p className="text-neutral-400">
            posicion: {ramaActual(estado) ?? `desconectada en ${cabeza ?? 'nada'}`}
          </p>
          <p className="text-neutral-400">confirmaciones: {estado.confirmaciones.length}</p>
          <p className="text-neutral-400">huerfanas: {huerfanas(estado).length}</p>
          {vista !== null && (
            <p className="mt-2 text-amber-300">
              previsualizacion: {vista.confirmacionesNuevas.length} confirmacion(es) nueva(s),
              {vista.punteroMovido ? ' el puntero se mueve' : ' el puntero no se mueve'}
            </p>
          )}
          <ul className="mt-3 space-y-1">
            {[...estado.confirmaciones].reverse().map((confirmacion) => (
              <li key={confirmacion.id}>
                <span className="text-amber-400">{confirmacion.id}</span>{' '}
                <span className="text-neutral-500">carril {confirmacion.carril}</span>{' '}
                {confirmacion.mensaje}
                {decoracionesDe(estado, confirmacion.id).length > 0 && (
                  <span className="text-sky-400">
                    {' '}
                    ({decoracionesDe(estado, confirmacion.id).join(', ')})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
