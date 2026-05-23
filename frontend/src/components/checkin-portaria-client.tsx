"use client";

import { FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";

export type CheckinResult = {
  ok: boolean;
  ja_utilizado: boolean;
  ingresso_id: string;
  participante_nome: string | null;
  evento_nome: string;
  checkin_em: string | null;
  mensagem: string;
};

type Modo = "organizador" | "portaria";

type Props = {
  modo: Modo;
  eventoId?: string;
  token?: string;
  tituloEvento?: string;
};

function loadHtml5Qrcode(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof Html5QrcodeScanner !== "undefined") {
      resolve();
      return;
    }
    const id = "html5-qrcode-cdn";
    if (document.getElementById(id)) {
      const t = setInterval(() => {
        if (typeof Html5QrcodeScanner !== "undefined") {
          clearInterval(t);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(t);
        reject(new Error("Timeout ao carregar leitor QR"));
      }, 15000);
      return;
    }
    const el = document.createElement("script");
    el.id = id;
    el.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js";
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Falha ao carregar leitor de câmera"));
    document.head.appendChild(el);
  });
}

export function CheckinPortariaClient({ modo, eventoId, token, tituloEvento }: Props) {
  const scannerDivId = useId().replace(/:/g, "");
  const [aba, setAba] = useState<"camera" | "digitar">("camera");
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CheckinResult | null>(null);
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const cooldownRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const validarCodigo = useCallback(
    async (raw: string) => {
      const texto = raw.trim();
      if (!texto) {
        setError("Informe ou leia um código de ingresso.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        let r: CheckinResult;
        if (modo === "portaria") {
          if (!eventoId || !token) {
            throw new Error("Link da portaria incompleto.");
          }
          r = await apiFetch<CheckinResult>("/api/portaria/validar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ evento_id: eventoId, token, codigo: texto }),
          });
        } else {
          r = await apiFetch<CheckinResult>("/api/checkin/validar", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ codigo: texto }),
          });
        }
        setLast(r);
        setCodigo("");
        inputRef.current?.focus();
      } catch (err) {
        setLast(null);
        setError(err instanceof Error ? err.message : "Não foi possível validar.");
      } finally {
        setBusy(false);
      }
    },
    [modo, eventoId, token],
  );

  const onScanSuccess = useCallback(
    (decoded: string) => {
      if (cooldownRef.current || busy) return;
      cooldownRef.current = true;
      void validarCodigo(decoded).finally(() => {
        window.setTimeout(() => {
          cooldownRef.current = false;
        }, 2000);
      });
    },
    [busy, validarCodigo],
  );

  useEffect(() => {
    if (aba !== "camera") {
      void scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
      setCameraReady(false);
      return;
    }

    let cancelled = false;
    setCameraErro(null);

    void (async () => {
      try {
        await loadHtml5Qrcode();
        if (cancelled) return;
        const scanner = new Html5QrcodeScanner(
          scannerDivId,
          { fps: 10, qrbox: { width: 240, height: 240 }, rememberLastUsedCamera: true },
          false,
        );
        scannerRef.current = scanner;
        scanner.render(onScanSuccess, () => {});
        if (!cancelled) setCameraReady(true);
      } catch (e) {
        if (!cancelled) {
          setCameraErro(
            e instanceof Error ? e.message : "Câmera indisponível. Use a aba Digitar ou código de barras USB.",
          );
          setAba("digitar");
        }
      }
    })();

    return () => {
      cancelled = true;
      void scannerRef.current?.clear().catch(() => {});
      scannerRef.current = null;
    };
  }, [aba, scannerDivId, onScanSuccess]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void validarCodigo(codigo);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Validação na entrada
        </h1>
        {tituloEvento ? (
          <p className="mt-1 text-base font-medium text-emerald-800">{tituloEvento}</p>
        ) : null}
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
          Use a <strong>câmera do celular</strong>, um <strong>leitor USB</strong> (o código cai no campo
          Digitar) ou cole o código <strong>EBR1:…</strong> / o ID do ingresso. Cada QR é único e só
          entra uma vez.
        </p>
      </header>

      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            aba === "camera" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
          }`}
          onClick={() => setAba("camera")}
        >
          Câmera
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
            aba === "digitar" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600"
          }`}
          onClick={() => setAba("digitar")}
        >
          Digitar / leitor USB
        </button>
      </div>

      {aba === "camera" ? (
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          {cameraErro ? (
            <p className="mb-3 text-sm text-amber-800" role="alert">
              {cameraErro}
            </p>
          ) : null}
          <div id={scannerDivId} className="min-h-[280px] w-full overflow-hidden rounded-lg" />
          {!cameraReady && !cameraErro ? (
            <p className="mt-2 text-center text-sm text-zinc-500">A iniciar câmera…</p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-500">
            Aponte para o QR do ingresso (e-mail ou tela do participante). Validação automática ao
            detectar.
          </p>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <label htmlFor="checkin-codigo" className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            Código do ingresso
          </label>
          <input
            id="checkin-codigo"
            ref={inputRef}
            type="text"
            autoComplete="off"
            className="mt-2 w-full rounded-lg border border-emerald-200 px-3 py-3 font-mono text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
            placeholder="EBR1:… ou UUID do ingresso (leitor USB preenche aqui)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          {error ? (
            <p className="mt-3 text-sm text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-4 h-11 w-full rounded-lg bg-emerald-700 text-sm font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-60 sm:w-auto sm:px-8"
          >
            {busy ? "Validando…" : "Validar entrada"}
          </button>
        </form>
      )}

      {last ? (
        <aside
          className={`rounded-2xl border p-5 sm:p-6 ${
            last.ja_utilizado
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
          role="status"
        >
          <p className="text-lg font-semibold text-zinc-900">{last.mensagem}</p>
          <ul className="mt-3 space-y-1 text-sm text-zinc-700">
            <li>
              <span className="font-medium">Participante:</span> {last.participante_nome || "—"}
            </li>
            <li>
              <span className="font-medium">Evento:</span> {last.evento_nome}
            </li>
            {last.checkin_em ? (
              <li>
                <span className="font-medium">Horário:</span>{" "}
                {new Date(last.checkin_em).toLocaleString("pt-BR")}
              </li>
            ) : null}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
