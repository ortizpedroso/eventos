"use client";

import type { Evento } from "@/lib/types";

type Props = {
  evento?: Evento | null;
  onParcelamentoChange?: (habilitado: boolean, max: number) => void;
};

export function EventoConfigAvancadaFields({ evento, onParcelamentoChange }: Props) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-zinc-200 p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-900">Vendas avançadas</legend>

      <div className="grid gap-2">
        <label className="text-sm font-medium text-zinc-800" htmlFor="urgencia_modo">
          Badge de urgência (página do evento)
        </label>
        <select
          id="urgencia_modo"
          name="urgencia_modo"
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          defaultValue={evento?.urgencia_modo ?? "desligado"}
        >
          <option value="desligado">Desligado</option>
          <option value="exato">Exato (ex.: Restam 7 ingressos)</option>
          <option value="faixa">Faixa (ex.: Últimos ingressos)</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="parcelamento_habilitado"
            value="true"
            defaultChecked={evento?.parcelamento_habilitado ?? false}
            onChange={(e) =>
              onParcelamentoChange?.(
                e.target.checked,
                Number(
                  (e.target.form?.elements.namedItem("parcelamento_max") as HTMLSelectElement | null)
                    ?.value ?? evento?.parcelamento_max ?? 2,
                ),
              )
            }
          />
          Parcelamento no cartão
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          Máximo:
          <select
            name="parcelamento_max"
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
            defaultValue={String(evento?.parcelamento_max ?? 2)}
            onChange={(e) => {
              const hab =
                (
                  e.target.form?.elements.namedItem("parcelamento_habilitado") as
                    | HTMLInputElement
                    | null
                )?.checked ?? false;
              onParcelamentoChange?.(hab, Number(e.target.value));
            }}
          >
            <option value="2">2x</option>
            <option value="3">3x</option>
            <option value="6">6x</option>
            <option value="12">12x</option>
          </select>
        </label>
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-800">
        <input
          type="checkbox"
          name="aceita_interesse"
          value="true"
          defaultChecked={evento?.aceita_interesse !== false}
          className="mt-1"
        />
        <span>
          Lista de interesse (pré-venda) — captar e-mails antes da abertura das vendas
        </span>
      </label>

      <div className="space-y-2">
        <label className="flex items-start gap-2 text-sm text-zinc-800">
          <input
            type="checkbox"
            name="lista_espera_habilitada"
            value="true"
            defaultChecked={evento?.lista_espera_habilitada ?? false}
            className="mt-1"
          />
          <span>Lista de espera quando esgotado</span>
        </label>
        <label className="ml-6 flex items-center gap-2 text-sm text-zinc-700">
          Prazo para comprar após liberar vaga:
          <select
            name="lista_espera_prazo_horas"
            className="rounded border border-zinc-300 px-2 py-1 text-sm"
            defaultValue={String(evento?.lista_espera_prazo_horas ?? 24)}
          >
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
            <option value="48">48 horas</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
