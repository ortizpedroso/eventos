/** Tarifas EventosBR — taxa de serviço fixa por ingresso (all-in). */

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
  fixoPorIngresso: 2.0,
};

export const TARIFA_ASSINATURA: PlanoTarifa = {
  id: "assinatura",
  label: "Com assinatura mensal",
  percentual: 0.08,
  fixoPorIngresso: 1.0,
};

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
  diferencaLiquido: number;
  assinaturaValeMais: boolean;
};

export function parseQuantidadeInput(raw: string): number | null {
  const s = raw.trim().replace(/\D/g, "");
  if (!s) return null;
  const n = Number.parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function _cenarioPlanos(
  taxaPerc: number,
  taxaFixa: number,
  mensalidade: number,
  arrecadacao: number,
): SimulacaoCenarioPlanos {
  const taxaTotal = mensalidade + taxaPerc + taxaFixa;
  const liquido = Math.round(Math.max(0, arrecadacao - taxaTotal) * 100) / 100;
  return {
    taxaPercentualValor: taxaPerc,
    taxaFixaTotal: taxaFixa,
    mensalidade,
    taxaTotal,
    liquido,
  };
}

export function simularLucroPlanos(precoIngresso: number, quantidade: number): SimulacaoPlanosResult | null {
  if (!Number.isFinite(precoIngresso) || precoIngresso <= 0) return null;
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) return null;

  const arrecadacao = precoIngresso * quantidade;
  const padrao = _cenarioPlanos(
    arrecadacao * TARIFA_PADRAO.percentual,
    TARIFA_PADRAO.fixoPorIngresso * quantidade,
    0,
    arrecadacao,
  );
  const assinatura = _cenarioPlanos(
    arrecadacao * TARIFA_ASSINATURA.percentual,
    TARIFA_ASSINATURA.fixoPorIngresso * quantidade,
    MENSALIDADE_ASSINATURA_MENSAL,
    arrecadacao,
  );

  return {
    precoIngresso,
    quantidade,
    arrecadacao,
    padrao,
    assinatura,
    diferencaLiquido: assinatura.liquido - padrao.liquido,
    assinaturaValeMais: assinatura.liquido > padrao.liquido,
  };
}

export function formatBrl(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercentual(fracao: number): string {
  const pct = fracao * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function rotuloTaxa(tarifa: PlanoTarifa): string {
  return `${formatPercentual(tarifa.percentual)} + ${formatBrl(tarifa.fixoPorIngresso)}`;
}

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
