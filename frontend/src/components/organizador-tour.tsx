"use client";

import { useEffect, useState } from "react";

const TOUR_KEY = "eventosbr_tour_v1";

type Step = {
  title: string;
  body: string;
  selector: string;
};

const STEPS: Step[] = [
  {
    title: "Meus eventos",
    body: "Aqui você vê tudo que criou, publica ou pausa na vitrine e acompanha vendas.",
    selector: '[data-tour="org-eventos"]',
  },
  {
    title: "Criar evento",
    body: "Use o assistente em 3 passos: básico, ingresso e publicação.",
    selector: '[data-tour="org-novo"]',
  },
  {
    title: "Check-in",
    body: "No dia do evento, valide QR codes. Ative o Modo festa para tela cheia.",
    selector: '[data-tour="org-checkin"]',
  },
  {
    title: "Relatórios",
    body: "Veja receita, ingressos vendidos e exporte participantes.",
    selector: '[data-tour="org-relatorios"]',
  },
];

export function OrganizadorTour() {
  const [ativo, setAtivo] = useState(false);
  const [passo, setPasso] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(TOUR_KEY)) {
      setAtivo(true);
    }
  }, []);

  useEffect(() => {
    if (!ativo) return;
    const step = STEPS[passo];
    const el = document.querySelector(step.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [ativo, passo]);

  function fechar() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TOUR_KEY, "1");
    }
    setAtivo(false);
  }

  if (!ativo) return null;

  const step = STEPS[passo];
  const ultimo = passo >= STEPS.length - 1;

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40" aria-hidden onClick={fechar} />
      <div
        className="fixed bottom-24 left-4 right-4 z-[80] mx-auto max-w-md rounded-2xl border border-emerald-200 bg-white p-5 shadow-xl lg:bottom-8 lg:left-auto lg:right-8"
        role="dialog"
        aria-labelledby="tour-title"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Tour rápido · {passo + 1}/{STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-1 text-lg font-bold text-zinc-900">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-zinc-600">{step.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {passo > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm"
              onClick={() => setPasso((p) => p - 1)}
            >
              Anterior
            </button>
          ) : null}
          {!ultimo ? (
            <button
              type="button"
              className="btn-success px-4 py-2 text-sm"
              onClick={() => setPasso((p) => p + 1)}
            >
              Próximo
            </button>
          ) : (
            <button type="button" className="btn-success px-4 py-2 text-sm" onClick={fechar}>
              Começar a usar
            </button>
          )}
          <button type="button" className="ml-auto text-sm text-zinc-500 underline" onClick={fechar}>
            Pular tour
          </button>
        </div>
      </div>
    </>
  );
}
