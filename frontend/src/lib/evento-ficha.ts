/** Opções fixas da classificação etária (ficha técnica). */
export const CLASSIFICACAO_ETARIA_OPCOES = ["livre", "12+", "16+", "18+"] as const;

export type ClassificacaoEtaria = (typeof CLASSIFICACAO_ETARIA_OPCOES)[number];

export function labelClassificacaoEtaria(valor: string): string {
  if (valor === "livre") return "Livre";
  return valor;
}

/**
 * schema.org/typicalAgeRange — Text no formato aberto "min-" (ex.: '11-').
 * `livre` → "0-" (sem limite inferior); 12+/16+/18+ → "12-" / "16-" / "18-".
 */
export function typicalAgeRangeFromClassificacao(
  valor: string | null | undefined,
): string | undefined {
  const v = valor?.trim();
  if (!v) return undefined;
  if (v === "livre") return "0-";
  if (v === "12+") return "12-";
  if (v === "16+") return "16-";
  if (v === "18+") return "18-";
  return undefined;
}
