/** Validação client-side de cartão (espelha app/utils/cartao_validacao.py). */

function luhnOk(numero: string): boolean {
  const digits = numero.replace(/\D/g, "").split("").map(Number);
  if (digits.length < 13 || digits.length > 19) return false;
  let checksum = 0;
  const parity = digits.length % 2;
  digits.forEach((d, i) => {
    let n = d;
    if (i % 2 === parity) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    checksum += n;
  });
  return checksum % 10 === 0;
}

export type DadosCartao = {
  nome: string;
  numero: string;
  mes: string;
  ano: string;
  cvv: string;
  cpf: string;
  cep: string;
};

export function validarDadosCartao(d: DadosCartao): string | null {
  const nome = d.nome.trim();
  const numero = d.numero.replace(/\D/g, "");
  const mes = d.mes.replace(/\D/g, "");
  const anoRaw = d.ano.replace(/\D/g, "");
  const cvv = d.cvv.replace(/\D/g, "");
  const cpf = d.cpf.replace(/\D/g, "");
  const cep = d.cep.replace(/\D/g, "");

  if (nome.length < 3) return "Informe o nome impresso no cartão.";
  if (!luhnOk(numero)) return "Número do cartão inválido.";
  if (mes.length !== 2 || Number(mes) < 1 || Number(mes) > 12) {
    return "Validade do cartão inválida (mês).";
  }
  if (anoRaw.length !== 2 && anoRaw.length !== 4) {
    return "Validade do cartão inválida (ano).";
  }
  const ano = anoRaw.length === 4 ? Number(anoRaw) : 2000 + Number(anoRaw);
  const agora = new Date();
  if (ano < agora.getFullYear() || (ano === agora.getFullYear() && Number(mes) < agora.getMonth() + 1)) {
    return "Cartão expirado.";
  }
  if (cvv.length < 3 || cvv.length > 4) return "CVV inválido.";
  if (cpf.length !== 11 && cpf.length !== 14) return "CPF ou CNPJ do titular inválido.";
  if (cep.length !== 8) return "CEP inválido.";
  return null;
}
