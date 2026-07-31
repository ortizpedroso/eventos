/** Opções fixas da classificação etária (ficha técnica). */
export const CLASSIFICACAO_ETARIA_OPCOES = ["livre", "12+", "16+", "18+"] as const;

export type ClassificacaoEtaria = (typeof CLASSIFICACAO_ETARIA_OPCOES)[number];

export function labelClassificacaoEtaria(valor: string): string {
  if (valor === "livre") return "Livre";
  return valor;
}
