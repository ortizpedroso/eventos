"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";

type SetupData = {
  secret: string;
  otpauth_uri: string;
  qr_base64: string;
};

type SegurancaDoisFatoresProps = {
  ativado: boolean;
  onChanged: () => void;
};

export function SegurancaDoisFatores({ ativado, onChanged }: SegurancaDoisFatoresProps) {
  const [passo, setPasso] = useState<"idle" | "setup" | "recovery" | "desativar">("idle");
  const [setup, setSetup] = useState<SetupData | null>(null);
  const [codigo, setCodigo] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function iniciar() {
    setErro(null);
    setCarregando(true);
    try {
      const data = await apiFetch<SetupData>("/api/auth/2fa/iniciar", { method: "POST" });
      setSetup(data);
      setPasso("setup");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar o 2FA.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar() {
    setErro(null);
    setCarregando(true);
    try {
      const data = await apiFetch<{ recovery_codes: string[] }>("/api/auth/2fa/ativar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      setRecoveryCodes(data.recovery_codes);
      setPasso("recovery");
      setCodigo("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Código inválido.");
    } finally {
      setCarregando(false);
    }
  }

  async function desativar() {
    setErro(null);
    setCarregando(true);
    try {
      await apiFetch("/api/auth/2fa/desativar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codigo: codigo.trim() }),
      });
      setPasso("idle");
      setCodigo("");
      onChanged();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Código inválido.");
    } finally {
      setCarregando(false);
    }
  }

  function finalizarAtivacao() {
    setPasso("idle");
    setSetup(null);
    setRecoveryCodes(null);
    onChanged();
  }

  return (
    <div className="space-y-4 border-t border-zinc-100 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-800">Verificação em duas etapas (2FA)</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Exige um código do seu app autenticador (Google Authenticator, Authy, etc.) além da senha ao entrar.
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            ativado ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600"
          }`}
        >
          {ativado ? "Ativado" : "Desativado"}
        </span>
      </div>

      {erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>
      ) : null}

      {passo === "idle" && !ativado ? (
        <button type="button" onClick={() => void iniciar()} disabled={carregando} className="btn-success">
          {carregando ? "Aguarde…" : "Ativar 2FA"}
        </button>
      ) : null}

      {passo === "idle" && ativado ? (
        <button
          type="button"
          onClick={() => setPasso("desativar")}
          className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
        >
          Desativar 2FA
        </button>
      ) : null}

      {passo === "setup" && setup ? (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-sm text-zinc-700">
            1. Escaneie o QR Code com seu app autenticador (ou digite o código manualmente).
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR gerado dinamicamente (data URI), sem ganho de next/image */}
          <img
            src={`data:image/png;base64,${setup.qr_base64}`}
            alt="QR Code para configurar o 2FA"
            className="mx-auto h-44 w-44 rounded-lg border border-zinc-200 bg-white p-2"
          />
          <p className="break-all rounded bg-white p-2 text-center font-mono text-xs text-zinc-600">
            {setup.secret}
          </p>
          <p className="text-sm text-zinc-700">2. Digite o código de 6 dígitos gerado pelo app:</p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center text-lg tracking-widest focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => void confirmar()} disabled={carregando} className="btn-success">
              {carregando ? "Verificando…" : "Confirmar e ativar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasso("idle");
                setSetup(null);
                setCodigo("");
                setErro(null);
              }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {passo === "recovery" && recoveryCodes ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-950">
            2FA ativado! Guarde estes códigos de recuperação em um lugar seguro — cada um só pode ser usado uma vez,
            caso você perca acesso ao seu app autenticador.
          </p>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <div key={c} className="rounded bg-white p-2 text-center">
                {c}
              </div>
            ))}
          </div>
          <button type="button" onClick={finalizarAtivacao} className="btn-success">
            Já guardei meus códigos
          </button>
        </div>
      ) : null}

      {passo === "desativar" ? (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-900">
            Digite um código do app autenticador (ou um código de recuperação) para confirmar a desativação.
          </p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="000000 ou XXXX-XXXX"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-center focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void desativar()}
              disabled={carregando}
              className="rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
            >
              {carregando ? "Aguarde…" : "Confirmar desativação"}
            </button>
            <button
              type="button"
              onClick={() => {
                setPasso("idle");
                setCodigo("");
                setErro(null);
              }}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
