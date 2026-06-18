/** Tarifas divulgadas em /planos (taxa absorvida no preço do ingresso). */

import { calcularTaxaAsaas, type MetodoAsaas } from "./taxas-asaas-publicas";

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
  percentual: 0.06,
  fixoPorIngresso: 0.3,
};

/** Mensalidade do plano com taxa reduzida (divulgada em /planos). */
export const MENSALIDADE_ASSINATURA_MENSAL = 500;

export const TARIFAS_PLATAFORMA: PlanoTarifa[] = [TARIFA_PADRAO, TARIFA_ASSINATURA];

export type SimulacaoCenarioPlanos = {
  taxaPercentualValor: number;
  taxaFixaTotal: number;
  mensalidade: number;
  taxaTotal: number;
  /** Após taxas EventosBR (antes do gateway). */
  liquidoAntesAsaas: number;
  taxaAsaasEstimada: number;
  /** Líquido final estimado (EventosBR + Asaas). */
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

export type SimuladorPlanosOpcoes = {
  metodoAsaas?: MetodoAsaas;
  parcelas?: number;
};

function _cenarioPlanos(
  taxaPerc: number,
  taxaFixa: number,
  mensalidade: number,
  arrecadacao: number,
  quantidade: number,
  precoIngresso: number,
  metodoAsaas: MetodoAsaas,
  parcelas: number,
): SimulacaoCenarioPlanos {
  const taxaPercentualValor = taxaPerc;
  const taxaFixaTotal = taxaFixa;
  const taxaTotal = mensalidade + taxaPercentualValor + taxaFixaTotal;
  const liquidoAntesAsaas = arrecadacao - taxaTotal;
  const taxaAsaasUnit = calcularTaxaAsaas(precoIngresso, metodoAsaas, parcelas);
  const taxaAsaasEstimada = Math.round(taxaAsaasUnit * quantidade * 100) / 100;
  const liquido = Math.round(Math.max(0, liquidoAntesAsaas - taxaAsaasEstimada) * 100) / 100;
  return {
    taxaPercentualValor,
    taxaFixaTotal,
    mensalidade,
    taxaTotal,
    liquidoAntesAsaas,
    taxaAsaasEstimada,
    liquido,
  };
}

/** Simula arrecadação e lucro líquido (EventosBR + Asaas estimado) nos dois planos. */
export function simularLucroPlanos(
  precoIngresso: number,
  quantidade: number,
  opcoes: SimuladorPlanosOpcoes = {},
): SimulacaoPlanosResult | null {
  if (!Number.isFinite(precoIngresso) || precoIngresso <= 0) return null;
  if (!Number.isFinite(quantidade) || quantidade <= 0 || !Number.isInteger(quantidade)) return null;

  const metodoAsaas = opcoes.metodoAsaas ?? "pix";
  const parcelas = Math.max(1, Math.min(12, opcoes.parcelas ?? 1));

  const arrecadacao = precoIngresso * quantidade;

  const taxaPercPadrao = arrecadacao * TARIFA_PADRAO.percentual;
  const taxaFixaPadrao = TARIFA_PADRAO.fixoPorIngresso * quantidade;

  const mensalidade = MENSALIDADE_ASSINATURA_MENSAL;
  const taxaPercAss = arrecadacao * TARIFA_ASSINATURA.percentual;
  const taxaFixaAss = TARIFA_ASSINATURA.fixoPorIngresso * quantidade;

  const padrao = _cenarioPlanos(
    taxaPercPadrao,
    taxaFixaPadrao,
    0,
    arrecadacao,
    quantidade,
    precoIngresso,
    metodoAsaas,
    parcelas,
  );
  const assinatura = _cenarioPlanos(
    taxaPercAss,
    taxaFixaAss,
    mensalidade,
    arrecadacao,
    quantidade,
    precoIngresso,
    metodoAsaas,
    parcelas,
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
