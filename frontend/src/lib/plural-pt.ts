/** Rótulo com concordância singular/plural em português. */
export function rotuloContagem(n: number, singular: string, plural: string): string {
  const fmt = n.toLocaleString("pt-BR");
  return n === 1 ? `${fmt} ${singular}` : `${fmt} ${plural}`;
}
