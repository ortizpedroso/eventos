/** Tarifas divulgadas em /planos (taxa absorvida no preço do ingresso). */

export type PlanoTarifaId = "padrao" | "assinatura";

export type PlanoTarifa = {
  id: PlanoTarifaId;
  label: string;
  percentual: number;
  fixoPorIngresso: number;
};

export const TARIFA_PADRAO: PlanoTarifa = {
  id: "padrao",
  label: "Por ingresso vendido (sem assinatura)",
  percentual: 0.1,
  fixoPorIngresso: 2,
};

export const TARIFA_ASSINATURA: PlanoTarifa = {
  id: "assinatura",
  label: "Com assinatura mensal",
  percentual: 0.08,
  fixoPorIngresso: 1.5,
};

/** Mensalidade do plano com taxa reduzida (divulgada em /planos). */
export const MENSALIDADE_ASSINATURA_MENSAL = 500;

export const TARIFAS_PLATAFORMA: PlanoTarifa[] = [TARIFA_PADRAO, TARIFA_ASSINATURA];

export type SimulacaoCenarioPlanos = {
  taxaPercentualValor: number;
  taxaFixaTotal: number;
  mensalidade: number;
  taxaTotal: number;
  liquido: number;
};

export type SimulacaoPlanosResult = {
  precoIngresso: number;
  quantidade: number;
  arrecadacao: number;
  padrao: SimulacaoCenarioPlanos;
  assinatura: SimulacaoCenarioPlanos;
  /** Líquido com assinatura menos líquido sem assinatura. */
  diferencaLiquido: number;
  assinaturaValeMais: boolean;
};

export function parseQuantidadeInput(raw: string): number | null {
  const s = raw.trim().replace(/\D/g, "");
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Simula arrecadação e lucro líquido (após taxas EventosBR) nos dois planos. */
export function simularLucroPlanos(
  precoIngresso: number,
  quantidade: number,
): SimulacaoPlanosResult | null {
  if (!Number.isFinite(precoIngresso) || precoIngresso <= 0) return null;
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) return null;

  const arrecadacao = precoIngresso * quantidade;

  const taxaPercPadrao = arrecadacao * TARIFA_PADRAO.percentual;
  const taxaFixaPadrao = TARIFA_PADRAO.fixoPorIngresso * quantidade;
  const taxaTotalPadrao = taxaPercPadrao + taxaFixaPadrao;

  const mensalidade = MENSALIDADE_ASSINATURA_MENSAL;
  const taxaPercAss = arrecadacao * TARIFA_ASSINATURA.percentual;
  const taxaFixaAss = TARIFA_ASSINATURA.fixoPorIngresso * quantidade;
  const taxaTotalAss = mensalidade + taxaPercAss + taxaFixaAss;

  const liquidoPadrao = arrecadacao - taxaTotalPadrao;
  const liquidoAssinatura = arrecadacao - taxaTotalAss;

  return {
    precoIngresso,
    quantidade,
    arrecadacao,
    padrao: {
      taxaPercentualValor: taxaPercPadrao,
      taxaFixaTotal: taxaFixaPadrao,
      mensalidade: 0,
      taxaTotal: taxaTotalPadrao,
      liquido: liquidoPadrao,
    },
    assinatura: {
      taxaPercentualValor: taxaPercAss,
      taxaFixaTotal: taxaFixaAss,
      mensalidade,
      taxaTotal: taxaTotalAss,
      liquido: liquidoAssinatura,
    },
    diferencaLiquido: liquidoAssinatura - liquidoPadrao,
    assinaturaValeMais: liquidoAssinatura > liquidoPadrao,
  };
}

export function formatBrl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercentual(fracao: number): string {
  const pct = fracao * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Preço de venda para o organizador receber `liquidoDesejado` após as taxas. */
export function precoVendaSugerido(liquidoDesejado: number, tarifa: PlanoTarifa): number | null {
  if (!Number.isFinite(liquidoDesejado) || liquidoDesejado < 0) return null;
  if (tarifa.percentual >= 1) return null;
  return (liquidoDesejado + tarifa.fixoPorIngresso) / (1 - tarifa.percentual);
}

export type DetalheTaxaIngresso = {
  precoVenda: number;
  taxaPercentualValor: number;
  taxaFixa: number;
  taxaTotal: number;
  liquidoOrganizador: number;
};

export function detalharTaxaIngresso(precoVenda: number, tarifa: PlanoTarifa): DetalheTaxaIngresso | null {
  if (!Number.isFinite(precoVenda) || precoVenda < 0) return null;
  const taxaPercentualValor = precoVenda * tarifa.percentual;
  const taxaFixa = tarifa.fixoPorIngresso;
  const taxaTotal = taxaPercentualValor + taxaFixa;
  return {
    precoVenda,
    taxaPercentualValor,
    taxaFixa,
    taxaTotal,
    liquidoOrganizador: precoVenda - taxaTotal,
  };
}

export function parseValorMonetarioInput(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
