"use client";

import { useRef, useState } from "react";

const MAX_FILE_BYTES = 900 * 1024;
const MAX_DATA_URL_CHARS = 1_800_000;

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
};

export function EventoImagemField({ id = "imagem_url", value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setHint("Escolha um arquivo de imagem (JPEG, PNG, WebP ou GIF).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setHint("Arquivo muito grande (máx. ~900 KB). Comprima a imagem ou cole uma URL pública.");
      return;
    }
    setBusy(true);
    setHint(null);
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      if (res.length > MAX_DATA_URL_CHARS) {
        setHint("A imagem ficou muito grande após codificação. Use uma URL pública.");
        setBusy(false);
        return;
      }
      onChange(res);
      setBusy(false);
    };
    reader.onerror = () => {
      setHint("Não foi possível ler o arquivo.");
      setBusy(false);
    };
    reader.readAsDataURL(file);
  }

  const showPreview = Boolean(value && (value.startsWith("http") || value.startsWith("data:image")));

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor={id}>
          Imagem do evento <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
      </div>
      <p className="text-xs text-zinc-500">
        Cole o endereço (URL) de uma imagem já hospedada na internet, ou use o botão para escolher um
        arquivo do seu computador.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <input
          id={id}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://exemplo.com/banner-do-evento.jpg"
          value={value}
          onChange={(e) => {
            setHint(null);
            onChange(e.target.value);
          }}
          className="min-h-10 flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors hover:border-emerald-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="btn-outline shrink-0 px-4 py-2.5 text-sm whitespace-nowrap disabled:opacity-60"
        >
          {busy ? "Carregando…" : "Escolher arquivo"}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onPickFile}
      />
      {hint ? (
        <p className="text-xs text-amber-800" role="status">
          {hint}
        </p>
      ) : null}
      {showPreview ? (
        <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-200/60">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Pré-visualização da imagem do evento"
            className="mx-auto max-h-52 w-full object-contain"
          />
          <div className="flex justify-end border-t border-emerald-100 bg-white/90 px-2 py-2">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
              onClick={() => {
                setHint(null);
                onChange("");
              }}
            >
              Remover imagem
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
