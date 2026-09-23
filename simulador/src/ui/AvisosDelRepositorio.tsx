/**
 * Lo que el participante tiene que saber del repositorio que esta mirando
 * (SPEC 020, 2.8 y 2.9).
 *
 * Una franja bajo la barra, solo en el modo real: de donde sale lo que ve, que
 * la consola no ejecuta, lo que no se sabe dibujar, y cuanto tardo la ultima
 * lectura.
 */

import type { AvisosReales } from '../vista';

export function AvisosDelRepositorio({
  avisos,
  nombre,
}: {
  readonly avisos: AvisosReales;
  readonly nombre: string;
}): React.ReactElement {
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-[var(--borde)] px-6 py-2"
      data-prueba="avisos-repositorio"
    >
      <p className="t-pequeno">
        Mirando <span className="font-mono font-semibold">{nombre}</span> en modo lectura. Las órdenes se escriben
        en Git Bash; aquí solo se previsualizan.
      </p>
      {avisos.lineas.map((linea) => (
        <p key={linea} className="t-pequeno text-[var(--consola-amarillo)]" data-prueba="aviso-real">
          {linea}
        </p>
      ))}
      {avisos.tiempos !== null && (
        <p className="t-min text-[var(--texto-tenue)]" data-prueba="tiempo-lectura" data-ms={avisos.tiempos.total ?? 0}>
          leído en {Math.round((avisos.tiempos.total ?? 0) + (avisos.tiempos.motor ?? 0))} ms
        </p>
      )}
    </div>
  );
}
