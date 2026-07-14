/** Apenas dígitos, limitado a `max`. */
export function onlyDigits(value: string, max: number): string {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Máscara visual 000.000.000-00 (não altera validade). */
export function formatCpfMask(digits: string): string {
  const d = onlyDigits(digits, 11);
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 9);
  const v = d.slice(9, 11);
  if (d.length <= 3) return a;
  if (d.length <= 6) return `${a}.${b}`;
  if (d.length <= 9) return `${a}.${b}.${c}`;
  return `${a}.${b}.${c}-${v}`;
}

/** Máscara visual 000.000.000-00 ou 00.000.000/0000-00 conforme tamanho. */
export function formatCpfCnpjMask(digits: string): string {
  const d = onlyDigits(digits, 14);
  if (d.length <= 11) return formatCpfMask(d);
  const a = d.slice(0, 2);
  const b = d.slice(2, 5);
  const c = d.slice(5, 8);
  const e = d.slice(8, 12);
  const f = d.slice(12, 14);
  if (d.length <= 2) return a;
  if (d.length <= 5) return `${a}.${b}`;
  if (d.length <= 8) return `${a}.${b}.${c}`;
  if (d.length <= 12) return `${a}.${b}.${c}/${e}`;
  return `${a}.${b}.${c}/${e}-${f}`;
}

/** Valida dígitos verificadores do CPF brasileiro. */
export function isValidCpf(digits: string): boolean {
  const d = onlyDigits(digits, 11);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const calc = (base: string, weights: number[]): number => {
    let s = 0;
    for (let i = 0; i < base.length; i++) s += parseInt(base[i]!, 10) * weights[i]!;
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const w1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
  const dv1 = calc(d.slice(0, 9), w1);
  if (dv1 !== parseInt(d[9]!, 10)) return false;
  const dv2 = calc(d.slice(0, 10), w2);
  return dv2 === parseInt(d[10]!, 10);
}
