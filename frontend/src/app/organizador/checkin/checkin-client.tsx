"use client";

import { CheckinPortariaClient } from "@/components/checkin-portaria-client";

export function CheckinClient() {
  return (
    <CheckinPortariaClient
      modo="organizador"
      tituloEvento="Todos os seus eventos publicados"
    />
  );
}
