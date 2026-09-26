/**
 * Un numero con su palabra, en singular cuando es uno (SPEC 027, punto 2.5).
 *
 * Todos los contadores de la pagina pasan por aqui: «1 confirmaciones» y
 * «1 cambio(s)» se veian en clase.
 */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
