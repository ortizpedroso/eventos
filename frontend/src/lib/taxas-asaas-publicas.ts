/** Espelho de app/services/taxas_asaas_publicas.py */

export const AVISO_LEGAL_TAXAS =
  "Valores estimativos. Taxas de processamento podem variar por conta, antecipação ou promoções. Não constitui oferta fiscal.";

export const TAXA_PIX = 1.99;
export const TAXA_BOLETO = 1.99;
export const PARCELAMENTO_MINIMO_REAIS = 5;

export const SYMPLA_TAXA_PERCENTUAL = 0.12;
export const SYMPLA_FONTE_URL = "https://www.sympla.com.br/organizador";

export type MetodoAsaas = "pix" | "boleto" | "cartao_avista" | "cartao_parcelado";

export function taxaCartaoPercentual(parcelas: number): { fixo: number; percentual: number } {
  if (parcelas <= 1) return { fixo: 0.49, percentual: 0.0299 };
  if (parcelas <= 6) return { fixo: 0.49, percentual: 0.0349 };
  return { fixo: 0.49, percentual: 0.0399 };
}

export function calcularTaxaAsaas(valorBruto: number, metodo: MetodoAsaas, parcelas = 1): number {
  if (valorBruto <= 0) return 0;
  if (metodo === "pix") return TAXA_PIX;
  if (metodo === "boleto") return TAXA_BOLETO;
  const t = taxaCartaoPercentual(parcelas);
  return Math.round((t.fixo + valorBruto * t.percentual) * 100) / 100;
}

export function comparativoSympla(valorBruto: number) {
  const taxa = Math.round(valorBruto * SYMPLA_TAXA_PERCENTUAL * 100) / 100;
  return {
    taxaEstimada: taxa,
    liquidoEstimado: Math.max(0, valorBruto - taxa),
    disclaimer: "Comparativo ilustrativo. Valores podem variar — conferir nos sites oficiais.",
    fonteUrl: SYMPLA_FONTE_URL,
  };
}
