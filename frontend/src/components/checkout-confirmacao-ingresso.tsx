"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getApiBaseUrl } from "@/lib/api";
import {
  compartilharTextoEvento,
  urlGoogleCalendar,
  urlIcsDownload,
} from "@/lib/calendario-evento";

type Props = {
  ingressoId: string;
  eventoNome: string;
  emailParticipante: string;
  mensagemConfirmacao?: string | null;
  quantidade?: number;
  eventoDataInicio?: string;
  eventoDataFim?: string;
  eventoLocal?: string;
  eventoUrl?: string;
};

export function CheckoutConfirmacaoIngresso({
  ingressoId,
  eventoNome,
  emailParticipante,
  mensagemConfirmacao,
  quantidade = 1,
  eventoDataInicio,
  eventoDataFim,
  eventoLocal,
  eventoUrl,
}: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [codigoCheckin, setCodigoCheckin] = useState<string | null>(null);
  const [aguardando, setAguardando] = useState(true);
  const downloadHref = `${getApiBaseUrl()}/api/ingressos/${ingressoId}/download`;

  useEffect(() => {
    let cancelled = false;
    let tentativas = 0;
    const maxTentativas = 12;

    async function buscarQr() {
      try {
        const base = getApiBaseUrl();
        const [resQr, resCodigo] = await Promise.all([
          fetch(`${base}/api/ingressos/${ingressoId}/qr`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`${base}/api/ingressos/${ingressoId}/codigo-checkin`, {
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        if (cancelled) return;
        if (resQr.ok) {
          const blob = await resQr.blob();
          if (!cancelled) {
            setQrUrl(URL.createObjectURL(blob));
          }
        }
        if (resCodigo.ok) {
          const data = (await resCodigo.json()) as { codigo_checkin?: string };
          if (!cancelled && data.codigo_checkin) {
            setCodigoCheckin(data.codigo_checkin);
          }
        }
        if (!cancelled && (resQr.ok || resCodigo.ok)) {
          setAguardando(false);
          return;
        }
      } catch {
        /* retry */
      }
      tentativas += 1;
      if (tentativas < maxTentativas && !cancelled) {
        window.setTimeout(() => void buscarQr(), 2500);
      } else if (!cancelled) {
        setAguardando(false);
      }
    }

    void buscarQr();

    return () => {
      cancelled = true;
    };
  }, [ingressoId]);

  useEffect(() => {
    return () => {
      if (qrUrl) URL.revokeObjectURL(qrUrl);
    };
  }, [qrUrl]);

  return (
    <div className="space-y-4 text-center">
      <p className="text-3xl" aria-hidden>
        ✓
      </p>
      <h2 className="text-lg font-semibold text-emerald-900" data-testid="checkout-confirmacao">
        Compra confirmada{quantidade > 1 ? ` — ${quantidade} ingressos` : ""}!
      </h2>
      <p className="text-sm text-zinc-600">{eventoNome}</p>
      <p className="text-sm text-zinc-700">
        Enviamos o ingresso com QR Code para{" "}
        <strong className="text-zinc-900">{emailParticipante}</strong> (verifique o spam).
      </p>

      {mensagemConfirmacao ? (
        <div className="mx-auto max-w-md rounded-md border border-emerald-600 bg-white p-4 text-left text-sm shadow-sm ring-1 ring-emerald-600">
          <p className="font-semibold text-emerald-800">Confirmação de inscrição</p>
          <p className="mt-2 whitespace-pre-line text-zinc-800">{mensagemConfirmacao}</p>
        </div>
      ) : null}

      {aguardando && !qrUrl ? (
        <p className="text-sm text-zinc-500">Gerando seu QR Code…</p>
      ) : null}

      {qrUrl ? (
        <div className="mx-auto inline-block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="QR Code do ingresso" width={240} height={240} className="mx-auto" />
          {codigoCheckin ? (
            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                Código para digitar na portaria
              </p>
              <p className="mt-1 break-all font-mono text-xs font-medium text-zinc-900">{codigoCheckin}</p>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-zinc-500">Apresente na entrada do evento</p>
        </div>
      ) : !aguardando ? (
        <p className="text-sm text-zinc-500">
          O QR Code estará disponível em{" "}
          <Link href={`/conta/ingressos/${ingressoId}`} className="font-medium text-emerald-800 underline">
            Meus ingressos
          </Link>{" "}
          assim que o pagamento for confirmado.
        </p>
      ) : null}

      {eventoDataInicio ? (
        <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2">
          <a
            href={urlGoogleCalendar({
              titulo: eventoNome,
              inicio: eventoDataInicio,
              fim: eventoDataFim,
              local: eventoLocal,
            })}
            target="_blank"
            rel="noreferrer"
            className="btn-outline px-3 py-1.5 text-xs"
          >
            Adicionar ao Google Calendar
          </a>
          <a
            href={urlIcsDownload({
              titulo: eventoNome,
              inicio: eventoDataInicio,
              fim: eventoDataFim,
              local: eventoLocal,
            })}
            download={`${eventoNome.slice(0, 40)}.ics`}
            className="btn-outline px-3 py-1.5 text-xs"
          >
            Baixar .ics
          </a>
          {eventoUrl && typeof navigator !== "undefined" && navigator.share ? (
            <button
              type="button"
              className="btn-outline px-3 py-1.5 text-xs"
              onClick={() => {
                void navigator.share({
                  title: eventoNome,
                  text: compartilharTextoEvento({
                    nome: eventoNome,
                    url: eventoUrl,
                    dataFmt: eventoDataInicio
                      ? new Date(eventoDataInicio).toLocaleString("pt-BR")
                      : undefined,
                  }),
                  url: eventoUrl,
                });
              }}
            >
              Compartilhar evento
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={`/conta/ingressos/${ingressoId}`} className="btn-success text-white">
          Ver meu ingresso
        </Link>
        <a href={downloadHref} target="_blank" rel="noopener noreferrer" className="btn-outline">
          Baixar / imprimir
        </a>
        <Link href="/conta/ingressos" className="btn-outline">
          Meus ingressos
        </Link>
      </div>
    </div>
  );
}
