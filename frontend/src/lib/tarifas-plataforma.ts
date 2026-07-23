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

/** Quantidade mínima de ingressos (neste preço) para a assinatura valer mais que o plano padrão. */
export function calcularPontoEquilibrioAssinatura(precoIngresso: number): number {
  if (!Number.isFinite(precoIngresso) || precoIngresso <= 0) return 1;
  const denom = 0.02 * precoIngresso + 1;
  return Math.floor(MENSALIDADE_ASSINATURA_MENSAL / denom) + 1;
}

export type AnaliseRecomendacaoPlano = {
  recomendado: PlanoTarifaId;
  titulo: string;
  paragrafos: string[];
};

export function analisarRecomendacaoPlano(sim: SimulacaoPlanosResult): AnaliseRecomendacaoPlano {
  const diff = Math.abs(sim.diferencaLiquido);
  const eq = calcularPontoEquilibrioAssinatura(sim.precoIngresso);
  const precoFmt = formatBrl(sim.precoIngresso);
  const mensalidadeFmt = formatBrl(MENSALIDADE_ASSINATURA_MENSAL);

  if (Math.abs(sim.diferencaLiquido) < 0.01) {
    return {
      recomendado: "padrao",
      titulo: "Os dois planos empatam neste cenário",
      paragrafos: [
        `Com ${sim.quantidade} ingressos a ${precoFmt}, o líquido estimado é o mesmo nos dois planos (${formatBrl(sim.padrao.liquido)}).`,
        `Pequenas variações de volume ou preço podem inclinar para um lado — use a assinatura se espera vender pelo menos cerca de ${eq} ingressos neste preço.`,
      ],
    };
  }

  if (sim.assinaturaValeMais) {
    return {
      recomendado: "assinatura",
      titulo: "Assinatura é mais vantajosa para você",
      paragrafos: [
        `Com ${sim.quantidade} ingressos a ${precoFmt}, o plano com assinatura deixa ${formatBrl(sim.assinatura.liquido)} líquido — ${formatBrl(diff)} a mais que sem assinatura.`,
        `A mensalidade de ${mensalidadeFmt} já é compensada pela taxa reduzida (${formatPercentual(TARIFA_ASSINATURA.percentual)} + ${formatBrl(TARIFA_ASSINATURA.fixoPorIngresso)} por ingresso).`,
      ],
    };
  }

  return {
    recomendado: "padrao",
    titulo: "Plano sem assinatura é mais vantajoso para você",
    paragrafos: [
      `Com ${sim.quantidade} ingressos a ${precoFmt}, ficar sem assinatura deixa ${formatBrl(sim.padrao.liquido)} líquido — ${formatBrl(diff)} a mais que com assinatura.`,
      `A assinatura tende a compensar a partir de cerca de ${eq} ingressos vendidos neste preço (mensalidade ${mensalidadeFmt} + taxa menor).`,
    ],
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
