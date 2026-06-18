/** Máscara de valores em reais (entrada do usuário). */

/** Formata dígitos digitados como moeda BRL (centavos → ex.: 4990 → "49,90"). */
export function formatMoedaBrlInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const value = parseInt(digits, 10) / 100;
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Converte número em reais para exibição mascarada no input. */
export function moedaBrlFromNumber(valor: number): string {
  if (!Number.isFinite(valor) || valor < 0) return "";
  return formatMoedaBrlInput(String(Math.round(valor * 100)));
}
