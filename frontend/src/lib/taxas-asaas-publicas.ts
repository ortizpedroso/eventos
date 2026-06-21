/** Espelho de app/services/taxas_asaas_publicas.py — uso interno e acréscimo parcelamento. */

export const AVISO_LEGAL_TAXAS =
  "Valores conforme tabelas públicas. A taxa EventosBR é fixa por plano; parcelamento pode incluir acréscimo explícito.";

export const TAXA_PIX = 1.99;
export const TAXA_BOLETO = 1.99;
export const PARCELAMENTO_MINIMO_REAIS = 5;

export const SYMPLA_TAXA_PERCENTUAL = 0.12;
export const SYMPLA_FONTE_URL = "https://www.sympla.com.br/organizador";

export type MetodoAsaas = "pix" | "boleto" | "cartao_avista" | "cartao_parcelado";

export function taxaCartaoPercentual(parcelas: number): { fixo: number; percentual: number } {
  if (parcelas <= 1) return { fixo: 0.49, percentual: 0.0299 };
  if (parcelas <= 6) return { fixo: 0.49, percentual: 0.0349 };
  if (parcelas <= 12) return { fixo: 0.49, percentual: 0.0399 };
  return { fixo: 0.49, percentual: 0.0429 };
}

export function calcularAcrescimoParcelamento(valorBase: number, parcelas: number): number {
  if (parcelas <= 1 || valorBase <= 0) return 0;
  const avista = 0.0299;
  const parcelado = taxaCartaoPercentual(parcelas).percentual;
  return Math.round(valorBase * Math.max(0, parcelado - avista) * 100) / 100;
}

export function cotacaoCheckout(valorBase: number, parcelas: number) {
  const acrescimo = calcularAcrescimoParcelamento(valorBase, parcelas);
  const total = Math.round((valorBase + acrescimo) * 100) / 100;
  const valorParcela = parcelas > 1 ? Math.round((total / parcelas) * 100) / 100 : total;
  const totalParcelas = parcelas > 1 ? Math.round(valorParcela * parcelas * 100) / 100 : total;
  return {
    precoIngresso: valorBase,
    parcelas,
    acrescimoParcelamento: acrescimo,
    totalPagar: totalParcelas,
    valorParcela: parcelas > 1 ? valorParcela : null,
  };
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
