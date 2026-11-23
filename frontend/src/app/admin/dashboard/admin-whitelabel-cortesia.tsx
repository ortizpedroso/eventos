"use client";

import { useEffect, useState } from "react";

import { adminFetch } from "@/lib/admin-api";

type WhitelabelAdmin = {
  dominio_proprio: string | null;
  dominio_ativo: boolean;
  cortesia_ate: string | null;
  acesso: { liberado: boolean; motivo: "assinatura" | "cortesia" | "tolerancia" | "sem_plano"; ate: string | null };
};

const MOTIVO: Record<WhitelabelAdmin["acesso"]["motivo"], string> = {
  assinatura: "Liberado pela assinatura",
  cortesia: "Liberado por cortesia",
  tolerancia: "Em tolerância (7 dias após o vencimento)",
  sem_plano: "Bloqueado: o domínio leva para a página na EventosBR",
};

export function AdminWhitelabelCortesia({ organizadorId }: { organizadorId: string }) {
  const [dados, setDados] = useState<WhitelabelAdmin | null>(null);
  const [data, setData] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    void adminFetch<WhitelabelAdmin>(`/api/admin/organizadores/${organizadorId}/whitelabel`)
      .then((r) => {
        if (cancelado) return;
        setDados(r);
        setData(r.cortesia_ate ?? "");
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Falha ao carregar white-label"));
    return () => {
      cancelado = true;
    };
  }, [organizadorId]);

  async function salvar(cortesiaAte: string | null) {
    setBusy(true);
    setErro(null);
    try {
      const r = await adminFetch<WhitelabelAdmin>(`/api/admin/organizadores/${organizadorId}/whitelabel`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cortesia_ate: cortesiaAte }),
      });
      setDados(r);
      setData(r.cortesia_ate ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar cortesia");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-5 border-t border-zinc-200 pt-4" aria-labelledby="wl-cortesia-titulo">
      <h4 id="wl-cortesia-titulo" className="text-sm font-semibold text-zinc-900">
        White-label: domínio próprio
      </h4>
      {dados ? (
        <>
          <p className="mt-1 text-xs text-zinc-600">
            {dados.dominio_proprio
              ? `${dados.dominio_proprio}${dados.dominio_ativo ? "" : " (ainda não ativado)"}`
              : "Nenhum domínio próprio cadastrado."}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-800" data-wl-motivo={dados.acesso.motivo}>
            {MOTIVO[dados.acesso.motivo]}
          </p>
          <label className="mt-3 grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">Cortesia sem mensalidade até</span>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-success px-3 py-1.5 text-xs"
              disabled={busy || !data}
              onClick={() => void salvar(data)}
            >
              Salvar cortesia
            </button>
            {dados.cortesia_ate ? (
              <button
                type="button"
                className="btn-outline px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => void salvar(null)}
              >
                Remover cortesia
              </button>
            ) : null}
          </div>
        </>
      ) : !erro ? (
        <p className="mt-1 text-xs text-zinc-500">Carregando…</p>
      ) : null}
      {erro ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
    </section>
  );
}
