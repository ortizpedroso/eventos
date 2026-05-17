"use client";

import { useCallback, useEffect, useState } from "react";

import { getApiBaseUrl } from "@/lib/api";

const STORAGE_KEY = "eventosbr_platform_admin_key";

type ContatoRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  tipo: string;
  aceita_comunicacao_email: boolean;
  aceita_comunicacao_whatsapp: boolean;
  comunicacao_consentimento_em: string | null;
  data_criacao: string | null;
};

type ListaResponse = {
  canal: string;
  total: number;
  contatos: ContatoRow[];
  nota: string;
};

export function MarketingAdminClient() {
  const [adminKey, setAdminKey] = useState("");
  const [canal, setCanal] = useState<"qualquer" | "email" | "whatsapp">("qualquer");
  const [data, setData] = useState<ListaResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) setAdminKey(saved);
  }, []);

  const headers = useCallback(
    () => ({
      accept: "application/json",
      "X-Platform-Admin-Key": adminKey.trim(),
    }),
    [adminKey],
  );

  async function carregar() {
    const key = adminKey.trim();
    if (!key) {
      setError("Informe a chave de administrador (PLATFORM_ADMIN_API_KEY).");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, key);
    setBusy(true);
    setError(null);
    try {
      const base = getApiBaseUrl();
      const url = `${base}/api/admin/marketing/contatos?canal=${canal}&formato=json`;
      const res = await fetch(url, { headers: headers(), cache: "no-store" });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const j = (await res.json()) as { detail?: string };
          if (j.detail) msg = j.detail;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      setData((await res.json()) as ListaResponse);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
    } finally {
      setBusy(false);
    }
  }

  async function baixarCsv() {
    const key = adminKey.trim();
    if (!key) {
      setError("Informe a chave de administrador.");
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, key);
    setBusy(true);
    setError(null);
    try {
      const base = getApiBaseUrl();
      const url = `${base}/api/admin/marketing/contatos?canal=${canal}&formato=csv`;
      const res = await fetch(url, {
        headers: { "X-Platform-Admin-Key": key },
      });
      if (!res.ok) throw new Error(`Erro ${res.status} ao exportar CSV`);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `marketing_eventosbr_${canal}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no download.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 pt-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Uso interno</p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900">Exportar opt-in de marketing</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Apenas utilizadores que aceitaram comunicações da EventosBR (e-mail e/ou WhatsApp). Não inclui
          participantes que só compraram ingresso sem opt-in na conta.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="admin_key">
            Chave de administrador
          </label>
          <input
            id="admin_key"
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="PLATFORM_ADMIN_API_KEY do .env da API"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
            autoComplete="off"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Guardada só nesta sessão do navegador (sessionStorage). Não partilhe a chave.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700" htmlFor="canal">
            Canal
          </label>
          <select
            id="canal"
            value={canal}
            onChange={(e) => setCanal(e.target.value as typeof canal)}
            className="mt-1 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
          >
            <option value="qualquer">E-mail ou WhatsApp</option>
            <option value="email">Só e-mail</option>
            <option value="whatsapp">Só WhatsApp (com telefone)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="btn-primary" onClick={() => void carregar()}>
            {busy ? "A carregar…" : "Ver lista"}
          </button>
          <button type="button" disabled={busy} className="btn-outline" onClick={() => void baixarCsv()}>
            Baixar CSV
          </button>
        </div>

        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {data ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-zinc-700">
            <strong>{data.total}</strong> contacto(s) · filtro:{" "}
            <code className="text-xs">{data.canal}</code>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{data.nota}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">E-mail</th>
                  <th className="py-2 pr-3">Telefone</th>
                  <th className="py-2 pr-3">E-mail OK</th>
                  <th className="py-2">WhatsApp OK</th>
                </tr>
              </thead>
              <tbody>
                {data.contatos.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-3 font-medium text-zinc-900">{c.nome}</td>
                    <td className="break-all py-2 pr-3">{c.email}</td>
                    <td className="py-2 pr-3">{c.telefone ?? "—"}</td>
                    <td className="py-2 pr-3">{c.aceita_comunicacao_email ? "sim" : "não"}</td>
                    <td className="py-2">{c.aceita_comunicacao_whatsapp ? "sim" : "não"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
