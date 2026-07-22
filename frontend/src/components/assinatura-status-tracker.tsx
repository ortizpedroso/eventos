"use client";

import { useEffect } from "react";

import { StatusTrackerFromPayload } from "@/components/status-tracker";
import { useStatusPolling } from "@/hooks/use-status-polling";

type Props = {
  subscriptionId: string;
  onSuccess?: () => void;
};

export function AssinaturaStatusTracker({ subscriptionId, onSuccess }: Props) {
  const pollUrl = `/api/organizador/onboarding/assinatura/${encodeURIComponent(subscriptionId)}/status`;
  const { data, error, polling } = useStatusPolling(pollUrl, { intervalMs: 4000 });

  useEffect(() => {
    if (data?.final_state === "success" && onSuccess) {
      onSuccess();
    }
  }, [data?.final_state, onSuccess]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-indigo-800">Carregando acompanhamento do pagamento…</p>
    );
  }

  return (
    <div className="space-y-4">
      <StatusTrackerFromPayload data={data} polling={polling} />
    </div>
  );
}
