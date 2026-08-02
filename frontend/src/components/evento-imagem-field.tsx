"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { getApiBaseUrl } from "@/lib/api";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { UPLOAD_IMAGEM_ACCEPT } from "@/lib/upload-imagem-tipos";
import { EVENTO_BANNER_MEDIDAS_RESUMO, EVENTO_BANNER_RECOMMENDED } from "@/lib/evento-imagem-spec";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

/** Alinhado ao backend (app/services/r2_storage.py::MAX_UPLOAD_BYTES). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
};

export function EventoImagemField({ id = "imagem_url", value, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [dimWarning, setDimWarning] = useState<string | null>(null);
  // Não dá mais pra inferir a origem pelo formato do valor (upload e URL colada geram
  // ambos uma URL http normal agora) — rastreamos explicitamente.
  const [viaArquivo, setViaArquivo] = useState(false);

  const urlModo = !viaArquivo;
  const displaySrc = resolveEventoImagemSrc(value);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setHint("Escolha um arquivo de imagem (JPEG, PNG, WebP ou GIF).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setHint("Arquivo muito grande (máx. 5 MB). Comprima a imagem ou use a opção URL.");
      return;
    }
    setBusy(true);
    setHint(null);
    setDimWarning(null);

    void (async () => {
      let dimWarn: string | null = null;
      try {
        const bmp = await createImageBitmap(file);
        const w = bmp.width;
        const h = bmp.height;
        bmp.close();
        const minW = EVENTO_BANNER_RECOMMENDED.widthMin;
        const minH = EVENTO_BANNER_RECOMMENDED.heightMin;
        const ratio = w / h;
        const target = EVENTO_BANNER_RECOMMENDED.widthIdeal / EVENTO_BANNER_RECOMMENDED.heightIdeal;
        const parts: string[] = [];
        if (w < minW || h < minH) {
          parts.push(
            `Imagem ${w}×${h}px — para o banner nítido use pelo menos ${minW}×${minH}px (${EVENTO_BANNER_RECOMMENDED.ratioLabel}).`,
          );
        }
        if (Math.abs(ratio - target) > 0.28) {
          parts.push(
            `Proporção ~${ratio.toFixed(2)}:1; o layout do banner segue melhor em ${EVENTO_BANNER_RECOMMENDED.ratioLabel} (ex.: ${EVENTO_BANNER_RECOMMENDED.widthIdeal}×${EVENTO_BANNER_RECOMMENDED.heightIdeal}px).`,
          );
        }
        dimWarn = parts.length ? parts.join(" ") : null;
      } catch {
        // GIF animado ou formato que createImageBitmap não lê
      }

      try {
        const arquivoComprimido = await comprimirImagem(file, {
          maxWidth: EVENTO_BANNER_RECOMMENDED.widthIdeal,
          maxHeight: EVENTO_BANNER_RECOMMENDED.heightIdeal,
        });
        const form = new FormData();
        form.append("file", arquivoComprimido);
        const res = await fetch(`${getApiBaseUrl()}/api/organizador/eventos/upload-imagem`, {
          method: "POST",
          body: form,
          credentials: "include",
        });
        if (!res.ok) {
          let msg = `Erro ${res.status} ao enviar imagem`;
          try {
            const j = (await res.json()) as { detail?: string };
            if (j.detail) msg = String(j.detail);
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const data = (await res.json()) as { url?: string };
        if (!data.url) throw new Error("Resposta inválida do servidor ao enviar imagem.");
        onChange(data.url);
        setViaArquivo(true);
        setDimWarning(dimWarn);
      } catch (err) {
        setHint(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
      } finally {
        setBusy(false);
      }
    })();
  }

  function limparImagem() {
    setHint(null);
    setDimWarning(null);
    setViaArquivo(false);
    onChange("");
  }

  return (
    <div className="grid gap-4">
      <div>
        <label className="text-sm font-medium text-zinc-800" htmlFor={id}>
          Imagem / banner do evento <span className="font-normal text-zinc-500">(opcional)</span>
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          Escolha <strong className="font-medium text-zinc-700">uma</strong> das duas formas abaixo. A mesma imagem
          aparece na vitrine <Link href="/eventos" className="font-medium text-emerald-700 underline-offset-2 hover:underline">/eventos</Link> e no topo da página pública do evento.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-xs leading-relaxed text-emerald-950 ring-1 ring-emerald-200/70 sm:text-sm">
        <p className="font-semibold text-emerald-700">Medidas para o banner e para a vitrine</p>
        <ul className="mt-2 list-inside list-disc space-y-0.5 marker:text-emerald-700">
          {EVENTO_BANNER_MEDIDAS_RESUMO.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>Ficheiro local: até 5 MB (JPG, PNG, WebP ou GIF).</li>
          <li>URL: ligação direta a um ficheiro de imagem (ex.: já hospedado em outro serviço).</li>
        </ul>
      </div>

      <div className="grid gap-6 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Opção 1 — Colar URL da imagem</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Use um endereço que comece por <code className="rounded bg-white px-1 py-0.5 text-[11px]">https://</code>{" "}
            (ou <code className="rounded bg-white px-1 py-0.5 text-[11px]">http://</code>). A imagem tem de ser
            pública (sem login).
          </p>
          {urlModo ? (
            <input
              id={id}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://exemplo.com/banner-do-evento.jpg"
              value={value}
              onChange={(e) => {
                setHint(null);
                setDimWarning(null);
                onChange(e.target.value);
              }}
              disabled={busy}
              className="mt-2 min-h-10 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm transition-colors hover:border-emerald-300 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-60"
            />
          ) : (
            <div className="mt-2 rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-3 text-sm text-zinc-700">
              <p>De momento a imagem veio de um <strong>ficheiro</strong> carregado.</p>
              <button
                type="button"
                className="mt-2 text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
                onClick={limparImagem}
              >
                Remover ficheiro para voltar a colar uma URL
              </button>
            </div>
          )}
        </div>

        <div className="relative flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" aria-hidden />
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">ou</span>
          <div className="h-px flex-1 bg-zinc-200" aria-hidden />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Opção 2 — Enviar ficheiro do computador</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Respeite as medidas acima para o melhor resultado. O ficheiro é enviado e hospedado automaticamente.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="btn-outline mt-2 px-4 py-2.5 text-sm disabled:opacity-60"
          >
            {busy ? "A processar…" : "Escolher imagem no computador"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_IMAGEM_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={onPickFile}
          />
        </div>
      </div>

      {hint ? (
        <p className="text-xs text-amber-800" role="status">
          {hint}
        </p>
      ) : null}
      {dimWarning && !hint ? (
        <p className="text-xs text-amber-900/90" role="status">
          {dimWarning}
        </p>
      ) : null}

      {displaySrc ? (
        <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/40 ring-1 ring-emerald-200/60">
          <p className="border-b border-emerald-100 bg-white/90 px-3 py-2 text-xs font-medium text-zinc-700">
            Pré-visualização
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displaySrc}
            alt="Pré-visualização da imagem do evento"
            className="mx-auto aspect-video max-h-64 w-full object-cover"
          />
          <div className="flex justify-end border-t border-emerald-100 bg-white/90 px-2 py-2">
            <button
              type="button"
              className="text-xs font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
              onClick={limparImagem}
            >
              Remover imagem
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
