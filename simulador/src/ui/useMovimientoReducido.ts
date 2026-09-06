/**
 * Preferencia del sistema de movimiento reducido.
 *
 * El punto 5.7 exige respetarla. La hoja de estilos ya anula animaciones y
 * transiciones; esto ademas evita montarlas, para que no quede ni el trabajo
 * de calcularlas.
 */

import { useEffect, useState } from 'react';

const CONSULTA = '(prefers-reduced-motion: reduce)';

export function useMovimientoReducido(): boolean {
  const [reducido, setReducido] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches,
  );

  useEffect(() => {
    const medio = window.matchMedia(CONSULTA);
    const alCambiar = (): void => setReducido(medio.matches);
    medio.addEventListener('change', alCambiar);
    return () => medio.removeEventListener('change', alCambiar);
  }, []);

  return reducido;
}
