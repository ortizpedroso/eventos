"use client";

import { useRef, useState } from "react";

import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

const MAX_FILE_BYTES = Math.floor(1.25 * 1024 * 1024);

type Props = {
  id?: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
  accept?: string;
};

export function ImagemAssetField({
  id = "imagem_asset",
  label,
  hint,
  value,
  onChange,
  uploadUrl,
  uploadHeaders,
  accept = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon",
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDataUrl = value.trim().toLowerCase().startsWith("data:image/");
  const urlModo = !isDataUrl;
  const displaySrc = resolveEventoImagemSrc(value);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Escolha um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Arquivo muito grande (máx. 1,25 MB).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: uploadHeaders,
      });
      if (!res.ok) {
        let msg = `Erro ${res.status}`;
        try {
          const j = (await res.json()) as { detail?: string };
          if (j.detail) msg = String(j.detail);
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Resposta inválida do servidor");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no upload");
    } finally {
      setBusy(false);
    }
  }

  function limpar() {
    setError(null);
    onChange("");
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-zinc-800" htmlFor={id}>
        {label}
      </label>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      {urlModo ? (
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://… ou envie um arquivo abaixo"
          value={value}
          onChange={(e) => {
            setError(null);
            onChange(e.target.value);
          }}
          disabled={busy}
          className="input font-mono text-xs"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          Imagem carregada localmente.{" "}
          <button type="button" className="font-medium text-emerald-800 underline" onClick={limpar}>
            Remover
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="btn-outline px-3 py-2 text-sm disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Enviar arquivo"}
        </button>
        {value ? (
          <button type="button" className="text-sm text-zinc-600 underline" onClick={limpar}>
            Limpar
          </button>
        ) : null}
      </div>
      <input ref={fileRef} type="file" accept={accept} className="sr-only" onChange={(e) => void onPickFile(e)} />
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {displaySrc ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} alt="Pré-visualização" className="mx-auto max-h-24 object-contain" />
        </div>
      ) : null}
    </div>
  );
}
