type AcessoDominio = {
  liberado: boolean;
  motivo: "assinatura" | "cortesia" | "tolerancia" | "sem_plano";
  ate: string | null;
};

function dataBr(iso: string | null): string {
  return iso ? new Date(`${iso}Z`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
}

const TEXTOS: Record<AcessoDominio["motivo"], { tom: string; texto: (ate: string) => string }> = {
  assinatura: {
    tom: "border-emerald-200 bg-emerald-50 text-emerald-950",
    texto: (ate) => `Incluído na sua assinatura, válida até ${ate}.`,
  },
  cortesia: {
    tom: "border-sky-200 bg-sky-50 text-sky-950",
    texto: (ate) =>
      `Cortesia da EventosBR até ${ate}. Depois dessa data, assine o plano mensal para manter seu domínio.`,
  },
  tolerancia: {
    tom: "border-amber-300 bg-amber-50 text-amber-950",
    texto: (ate) =>
      `Seu plano venceu. O domínio continua funcionando até ${ate}; depois, ele passa a levar para sua página na EventosBR. Assine o plano mensal para manter.`,
  },
  sem_plano: {
    tom: "border-red-200 bg-red-50 text-red-950",
    texto: () =>
      "Seu domínio está levando os compradores para sua página na EventosBR. Assine o plano mensal para voltar a usar seu próprio endereço.",
  },
};

export function DominioProprioStatus({ dominio, acesso }: { dominio: string; acesso: AcessoDominio }) {
  const { tom, texto } = TEXTOS[acesso.motivo];
  return (
    <div className={`mt-3 rounded-md border p-3 text-sm ${tom}`} role="status" data-dominio-proprio-status={acesso.motivo}>
      <p className="font-semibold">Domínio próprio: {dominio}</p>
      <p className="mt-1">{texto(dataBr(acesso.ate))}</p>
    </div>
  );
}

export type { AcessoDominio };
