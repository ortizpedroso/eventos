"use client";

import type { TrackerPayload, TrackerStep } from "@/hooks/use-status-polling";

type Props = {
  steps: TrackerStep[];
  currentStep: string;
  finalState?: "success" | "error" | null;
  title?: string | null;
  description?: string | null;
  reasons?: string[];
  polling?: boolean;
  pollHint?: string;
};

function stepIndex(steps: TrackerStep[], key: string): number {
  return steps.findIndex((s) => s.key === key);
}

export function StatusTracker({
  steps,
  currentStep,
  finalState = null,
  title,
  description,
  reasons = [],
  polling = false,
  pollHint = "Atualizamos automaticamente a cada poucos segundos.",
}: Props) {
  const currentIdx = Math.max(0, stepIndex(steps, currentStep));

  return (
    <div className="space-y-5">
      <ol className="space-y-4">
        {steps.map((step, idx) => {
          const concluido = idx < currentIdx || (finalState === "success" && idx <= currentIdx);
          const ativo = idx === currentIdx && !finalState;
          const erro = finalState === "error" && idx === currentIdx;
          return (
            <li key={step.key} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  erro
                    ? "bg-red-100 text-red-700"
                    : concluido
                      ? "bg-emerald-600 text-white"
                      : ativo
                        ? "bg-amber-400 text-amber-950"
                        : "bg-zinc-200 text-zinc-600"
                }`}
                aria-hidden
              >
                {erro ? "!" : concluido ? "✓" : ativo ? "…" : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{step.label}</p>
                {ativo && polling ? (
                  <p className="mt-1 text-xs text-zinc-600">{pollHint}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {title ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            finalState === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : finalState === "error"
                ? "border-red-200 bg-red-50 text-red-950"
                : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
          role="status"
        >
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-2 leading-relaxed">{description}</p> : null}
          {reasons.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {reasons.map((motivo) => (
                <li key={motivo}>{motivo}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StatusTrackerFromPayload({
  data,
  polling,
}: {
  data: TrackerPayload;
  polling?: boolean;
}) {
  const reasons = data.mostrar_motivos_na_tela === false ? [] : data.reasons ?? [];
  return (
    <StatusTracker
      steps={data.steps}
      currentStep={data.current_step}
      finalState={data.final_state}
      title={data.titulo_final}
      description={data.mensagem_final}
      reasons={reasons}
      polling={polling && !data.final}
    />
  );
}
