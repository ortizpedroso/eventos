"use client";

import { useMemo } from "react";

import { parseValorMonetarioInput } from "@/lib/tarifas-plataforma";
import { INGRESSO_MINIMO_PAGO_REAIS } from "@/lib/taxas-asaas-publicas";

type ChecklistInput = {
  nome: string;
  descricao: string;
  dataInicio: string;
  local: string;
  imagemUrl: string;
  modoSimples: boolean;
  eventoGratuito: boolean;
  precoSimples: string;
  loteRowsCount: number;
  publicado: boolean;
};

type Item = { id: string; label: string; ok: boolean; obrigatorio: boolean };

export function EventoPublicarChecklist(props: ChecklistInput) {
  const items = useMemo<Item[]>(() => {
    const precoOk =
      props.eventoGratuito ||
      (props.modoSimples
        ? (parseValorMonetarioInput(props.precoSimples) ?? 0) >= INGRESSO_MINIMO_PAGO_REAIS
        : props.loteRowsCount > 0);

    return [
      { id: "nome", label: "Nome do evento", ok: props.nome.trim().length >= 3, obrigatorio: true },
      {
        id: "desc",
        label: "Descrição para visitantes",
        ok: props.descricao.trim().length >= 10,
        obrigatorio: true,
      },
      {
        id: "data",
        label: "Data de início no futuro",
        ok: (() => {
          if (!props.dataInicio) return false;
          const d = new Date(props.dataInicio);
          return Number.isFinite(d.getTime()) && d.getTime() > Date.now() - 60_000;
        })(),
        obrigatorio: true,
      },
      { id: "local", label: "Local ou link do evento", ok: props.local.trim().length >= 3, obrigatorio: true },
      {
        id: "preco",
        label: "Ingresso com preço ou cortesia",
        ok: precoOk,
        obrigatorio: true,
      },
      {
        id: "img",
        label: "Imagem de capa (recomendado)",
        ok: Boolean(props.imagemUrl.trim()),
        obrigatorio: false,
      },
      {
        id: "pub",
        label: props.publicado ? "Publicar na vitrine ao criar" : "Criar pausado (revisar antes)",
        ok: true,
        obrigatorio: false,
      },
    ];
  }, [props]);

  const pronto = items.filter((i) => i.obrigatorio).every((i) => i.ok);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-sm font-semibold text-emerald-950">Checklist antes de publicar</p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                item.ok ? "bg-emerald-600 text-white" : item.obrigatorio ? "bg-red-100 text-red-700" : "bg-zinc-200 text-zinc-600"
              }`}
              aria-hidden
            >
              {item.ok ? "✓" : "!"}
            </span>
            <span className={item.ok ? "text-zinc-800" : item.obrigatorio ? "text-red-900" : "text-zinc-600"}>
              {item.label}
              {!item.obrigatorio ? <span className="text-zinc-500"> (opcional)</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {!pronto ? (
        <p className="mt-3 text-xs text-red-800" role="alert">
          Complete os itens obrigatórios em vermelho antes de criar o evento.
        </p>
      ) : (
        <p className="mt-3 text-xs text-emerald-900">Tudo pronto para criar o evento.</p>
      )}
    </div>
  );
}

export function checklistPublicacaoPronta(props: ChecklistInput): boolean {
  const precoOk =
    props.eventoGratuito ||
    (props.modoSimples
      ? (parseValorMonetarioInput(props.precoSimples) ?? 0) >= INGRESSO_MINIMO_PAGO_REAIS
      : props.loteRowsCount > 0);

  return (
    props.nome.trim().length >= 3 &&
    props.descricao.trim().length >= 10 &&
    props.local.trim().length >= 3 &&
    Boolean(props.dataInicio) &&
    Number.isFinite(new Date(props.dataInicio).getTime()) &&
    new Date(props.dataInicio).getTime() > Date.now() - 60_000 &&
    precoOk
  );
}
