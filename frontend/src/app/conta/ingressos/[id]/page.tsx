"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { apiFetch, getApiBaseUrl } from "@/lib/api";
import type { IngressoListItem } from "@/lib/types";

type RepasseForm = {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  data_nascimento: string;
};

const REPASSE_EMPTY: RepasseForm = {
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  data_nascimento: "",
};

function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatarTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export default function IngressoDetalhePage() {
  const params = useParams();
  const ingressoId =
    typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [ingresso, setIngresso] = useState<IngressoListItem | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const [showRepasseForm, setShowRepasseForm] = useState(false);
  const [repasseForm, setRepasseForm] = useState<RepasseForm>(REPASSE_EMPTY);
  const [repasseSending, setRepasseSending] = useState(false);
  const [repasseMessage, setRepasseMessage] = useState("");
  const [repasseError, setRepasseError] = useState("");

  useEffect(() => {
    if (!ingressoId) return;
    let cancelled = false;

    void (async () => {
      try {
        const lista = await apiFetch<IngressoListItem[]>("/api/ingressos/meus", {
          cache: "no-store",
        });
        const found = lista.find((i) => i.id === ingressoId) ?? null;
        if (!cancelled) setIngresso(found);
      } catch {
        if (!cancelled) setIngresso(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ingressoId]);

  useEffect(() => {
    if (!ingressoId) return;
    const st = (ingresso?.status || "").toLowerCase();
    if (st !== "pago" && st !== "usado") {
      setQrUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const base = getApiBaseUrl();
        const res = await fetch(`${base}/api/ingressos/${ingressoId}/qr`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setQrUrl(objectUrl);
      } catch {
        if (!cancelled) setQrUrl(null);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ingressoId, ingresso?.status]);

  async function openDownloadPdf() {
    if (!ingressoId) return;
    const base = getApiBaseUrl();
    const path = `${base}/api/ingressos/${ingressoId}/download`;
    const res = await fetch(path, { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      setMessage("Não foi possível abrir o ingresso para impressão.");
      return;
    }
    const html = await res.text();
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      setMessage("Permita pop-ups para abrir o ingresso numa nova janela.");
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const handleSendEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!ingressoId) return;
    setSending(true);
    setMessage("");

    try {
      const data = await apiFetch<{ message?: string }>(
        `/api/ingressos/${ingressoId}/enviar-email`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: email.trim() || null }),
        },
      );
      setMessage(data.message ?? "Ingresso enviado com sucesso!");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Ocorreu um erro ao enviar o ingresso.");
    } finally {
      setSending(false);
    }
  };

  const handleRepasse = async (e: FormEvent) => {
    e.preventDefault();
    if (!ingressoId) return;
    setRepasseSending(true);
    setRepasseMessage("");
    setRepasseError("");

    const cpfDigits = repasseForm.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) {
      setRepasseError("CPF inválido. Informe os 11 dígitos.");
      setRepasseSending(false);
      return;
    }

    try {
      const data = await apiFetch<{ message?: string; repassado_para_nome?: string }>(
        `/api/ingressos/${ingressoId}/repassar`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            nome: repasseForm.nome.trim(),
            cpf: cpfDigits,
            email: repasseForm.email.trim(),
            telefone: repasseForm.telefone.replace(/\D/g, ""),
            data_nascimento: repasseForm.data_nascimento,
          }),
        },
      );
      setRepasseMessage(data.message ?? "Repasse concluído com sucesso!");
      setRepasseForm(REPASSE_EMPTY);
      setShowRepasseForm(false);

      // Reload ticket data to reflect changes
      const lista = await apiFetch<IngressoListItem[]>("/api/ingressos/meus", {
        cache: "no-store",
      });
      const found = lista.find((i) => i.id === ingressoId) ?? null;
      setIngresso(found);
    } catch (err) {
      setRepasseError(err instanceof Error ? err.message : "Erro ao realizar o repasse.");
    } finally {
      setRepasseSending(false);
    }
  };

  if (!ingressoId) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-sm text-zinc-600">Ingresso inválido.</p>
        <Link href="/conta/ingressos" className="mt-4 inline-block text-sm text-emerald-800 underline">
          Voltar aos meus ingressos
        </Link>
      </div>
    );
  }

  const foiRepassado = !!ingresso?.repassado_em;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link href="/conta/ingressos" className="text-sm text-zinc-600 hover:underline">
          ← Meus ingressos
        </Link>
      </div>
      <h1 className="mb-2 text-3xl font-extrabold text-zinc-900">Seu ingresso</h1>
      {ingresso ? (
        <p className="mb-4 text-sm text-zinc-600">
          <strong>{ingresso.evento.nome}</strong>
          {ingresso.participante_nome ? ` · ${ingresso.participante_nome}` : ""}
          {" · "}
          <span className="capitalize">{ingresso.status}</span>
        </p>
      ) : (
        <p className="mb-4 text-sm text-zinc-600">Apresente o QR Code abaixo na entrada do evento.</p>
      )}

      {foiRepassado && ingresso ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
          </svg>
          <div>
            <span className="font-semibold">Ingresso repassado</span> — este ingresso foi transferido para{" "}
            <strong>{ingresso.repassado_para_nome}</strong>
            {ingresso.repassado_para_email ? ` (${ingresso.repassado_para_email})` : ""}.{" "}
            {ingresso.repassado_em
              ? `Em ${new Date(ingresso.repassado_em).toLocaleString("pt-BR")}.`
              : ""}
          </div>
        </div>
      ) : null}

      {repasseMessage ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          {repasseMessage}
        </div>
      ) : null}

      {(ingresso?.status === "pago" || ingresso?.status === "usado") && (
        <section className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-950">QR Code único deste ingresso</h2>
          <p className="mt-1 text-sm text-emerald-900/80">
            Cada ingresso tem um código diferente. Na portaria, o organizador valida uma única vez.
          </p>
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="QR Code do ingresso para entrada"
              width={220}
              height={220}
              className="mx-auto mt-4 rounded-lg border border-white bg-white p-2 shadow-sm"
            />
          ) : (
            <p className="mt-4 text-sm text-zinc-600">A carregar QR Code…</p>
          )}
          <p className="mt-3 font-mono text-[11px] text-zinc-500 break-all">{ingressoId}</p>
        </section>
      )}

      <h2 className="mb-4 text-lg font-semibold text-zinc-900">Outras opções</h2>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="flex flex-col items-start rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Baixar / imprimir</h2>
          <p className="mt-2 mb-6 text-justify text-sm text-zinc-600">
            Abre o ingresso numa nova janela para imprimir ou guardar como PDF (função do
            navegador).
          </p>

          <button
            type="button"
            onClick={() => void openDownloadPdf()}
            className="mt-auto w-full rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Gerar vista para impressão / PDF
          </button>
        </div>

        <div className="flex flex-col items-start rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-zinc-900">Enviar por e-mail</h2>
          <p className="mt-2 mb-6 text-justify text-sm text-zinc-600">
            Deixe o campo em branco para o seu e-mail de conta ou indique outro destinatário.
          </p>

          <form onSubmit={(e) => void handleSendEmail(e)} className="mt-auto flex w-full flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Outro e-mail (opcional)"
              className="w-full rounded-lg border-0 px-3 py-2.5 text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-emerald-600 sm:text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:bg-zinc-400"
            >
              {sending ? "A enviar…" : "Enviar ingresso"}
            </button>
            {message ? (
              <p
                className={`text-sm font-medium ${
                  message.toLowerCase().includes("erro") || message.includes("Não foi")
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {message}
              </p>
            ) : null}
          </form>
        </div>
      </div>

      {ingresso?.status === "pago" ? (
        <div className="mt-8 rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 3M21 7.5H7.5" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900">
                {foiRepassado ? "Repassar novamente" : "Vender / repassar ingresso"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {foiRepassado
                  ? "Você já repassou este ingresso. Pode transferir novamente caso necessário."
                  : "Transfira a titularidade deste ingresso para outra pessoa. Os dados do participante serão atualizados."}
              </p>

              {!showRepasseForm ? (
                <button
                  type="button"
                  onClick={() => setShowRepasseForm(true)}
                  className="mt-4 rounded-lg border border-amber-400 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
                >
                  {foiRepassado ? "Transferir novamente" : "Iniciar repasse"}
                </button>
              ) : (
                <form onSubmit={(e) => void handleRepasse(e)} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700">
                        Nome completo <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={repasseForm.nome}
                        onChange={(e) => setRepasseForm((f) => ({ ...f, nome: e.target.value }))}
                        placeholder="Nome do novo participante"
                        className="w-full rounded-lg border-0 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700">
                        CPF <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={repasseForm.cpf}
                        onChange={(e) =>
                          setRepasseForm((f) => ({ ...f, cpf: formatarCpf(e.target.value) }))
                        }
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        className="w-full rounded-lg border-0 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700">
                        E-mail <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={repasseForm.email}
                        onChange={(e) => setRepasseForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="email@exemplo.com"
                        className="w-full rounded-lg border-0 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-700">
                        Telefone <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={repasseForm.telefone}
                        onChange={(e) =>
                          setRepasseForm((f) => ({
                            ...f,
                            telefone: formatarTelefone(e.target.value),
                          }))
                        }
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                        className="w-full rounded-lg border-0 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-zinc-700">
                        Data de nascimento <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={repasseForm.data_nascimento}
                        onChange={(e) =>
                          setRepasseForm((f) => ({ ...f, data_nascimento: e.target.value }))
                        }
                        className="w-full rounded-lg border-0 px-3 py-2.5 text-sm text-zinc-900 ring-1 ring-inset ring-zinc-300 focus:ring-2 focus:ring-inset focus:ring-amber-500 sm:w-1/2"
                      />
                    </div>
                  </div>

                  {repasseError ? (
                    <p className="text-sm font-medium text-red-600">{repasseError}</p>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={repasseSending}
                      className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:bg-amber-300"
                    >
                      {repasseSending ? "Processando…" : "Confirmar repasse"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRepasseForm(false);
                        setRepasseForm(REPASSE_EMPTY);
                        setRepasseError("");
                      }}
                      className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
