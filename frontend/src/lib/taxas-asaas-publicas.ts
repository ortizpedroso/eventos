/**
 * Espelho de app/services/taxas_asaas_publicas.py — uso interno e acréscimo parcelamento.
 * Tabela Asaas (jul/2026): à vista 2,99%; 2–6x 3,49%; 7–12x 3,99%; 13–21x 4,29% (+ R$ 0,49).
 * Antecipação: 1,25% a.m. à vista / 1,70% a.m. parcelado.
 * Acréscimo ao comprador = equaliza margem vs à vista (delta processamento + antecipação parcelado).
 */

export const AVISO_LEGAL_TAXAS =
  "Valores conforme tabelas públicas. A taxa EventosBR é fixa por plano; parcelamento inclui acréscimo ao comprador (processamento e antecipação).";

export const TAXA_PIX = 1.99;
export const TAXA_BOLETO = 1.99;
export const INGRESSO_MINIMO_PAGO_REAIS = 10;
export const PARCELAMENTO_MINIMO_REAIS = INGRESSO_MINIMO_PAGO_REAIS;

export const TAXA_ANTECIPACAO_AVISTA_MES = 0.0125;
export const TAXA_ANTECIPACAO_PARCELADO_MES = 0.017;

export const SYMPLA_TAXA_PERCENTUAL = 0.12;
export const SYMPLA_FONTE_URL = "https://www.sympla.com.br/organizador";

export type RepasseParcelamento = "comprador" | "organizador";
export type MetodoAsaas = "pix" | "boleto" | "cartao_avista" | "cartao_parcelado";

export function taxaCartaoPercentual(parcelas: number): { fixo: number; percentual: number } {
  if (parcelas <= 1) return { fixo: 0.49, percentual: 0.0299 };
  if (parcelas <= 6) return { fixo: 0.49, percentual: 0.0349 };
  if (parcelas <= 12) return { fixo: 0.49, percentual: 0.0399 };
  return { fixo: 0.49, percentual: 0.0429 };
}

export function calcularTaxaAsaasCartao(valorBruto: number, parcelas: number): number {
  if (valorBruto <= 0) return 0;
  const t = taxaCartaoPercentual(parcelas);
  return Math.round((t.fixo + valorBruto * t.percentual) * 100) / 100;
}

export function mesesMediosAntecipacaoParcelado(parcelas: number): number {
  const n = Math.max(1, Math.floor(parcelas));
  return (n + 1) / 2;
}

export function calcularCustoAntecipacaoCartao(valorBruto: number, parcelas: number): number {
  if (valorBruto <= 0) return 0;
  const processamento = calcularTaxaAsaasCartao(valorBruto, Math.max(1, parcelas));
  const base = Math.max(0, valorBruto - processamento);
  if (parcelas <= 1) {
    return Math.round(base * TAXA_ANTECIPACAO_AVISTA_MES * 100) / 100;
  }
  return (
    Math.round(base * TAXA_ANTECIPACAO_PARCELADO_MES * mesesMediosAntecipacaoParcelado(parcelas) * 100) /
    100
  );
}

export function liquidoAposProcessamentoEAntecipacao(valorBruto: number, parcelas: number): number {
  if (valorBruto <= 0) return 0;
  const processamento = calcularTaxaAsaasCartao(valorBruto, Math.max(1, parcelas));
  const antecipacao = calcularCustoAntecipacaoCartao(valorBruto, parcelas);
  return Math.round(Math.max(0, valorBruto - processamento - antecipacao) * 100) / 100;
}

export function calcularAcrescimoParcelamento(valorBase: number, parcelas: number): number {
  if (parcelas <= 1 || valorBase <= 0) return 0;
  const alvo = liquidoAposProcessamentoEAntecipacao(valorBase, 1);
  let lo = Math.round(valorBase * 100) / 100;
  let hi = Math.round((valorBase * 1.8 + 20) * 100) / 100;
  for (let i = 0; i < 48; i++) {
    const mid = Math.round(((lo + hi) / 2) * 100) / 100;
    if (liquidoAposProcessamentoEAntecipacao(mid, parcelas) >= alvo) hi = mid;
    else lo = Math.round((mid + 0.01) * 100) / 100;
  }
  let total = hi;
  while (liquidoAposProcessamentoEAntecipacao(total, parcelas) < alvo) {
    total = Math.round((total + 0.01) * 100) / 100;
  }
  return Math.round(Math.max(0, total - valorBase) * 100) / 100;
}

export function cotacaoCheckout(
  valorBase: number,
  parcelas: number,
  repasseParcelamento: RepasseParcelamento = "comprador",
) {
  const acrescimoBruto = calcularAcrescimoParcelamento(valorBase, parcelas);
  const repasse = repasseParcelamento === "organizador" ? "organizador" : "comprador";
  const acrescimoParcelamento = repasse === "organizador" ? 0 : acrescimoBruto;
  const total = Math.round((valorBase + acrescimoParcelamento) * 100) / 100;
  const valorParcela = parcelas > 1 ? Math.round((total / parcelas) * 100) / 100 : total;
  return {
    precoIngresso: valorBase,
    parcelas,
    acrescimoParcelamento,
    acrescimoBruto,
    repasseParcelamento: repasse,
    totalPagar: total,
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
