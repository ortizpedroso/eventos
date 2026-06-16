"use client";



import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";



import { ITENS_TERMO_COMPRA, TERMO_COMPRA_VERSAO } from "@/lib/termo-compra";



type Props = {

  eventoNome: string;

  aceito: boolean;

  onAceitoChange: (valor: boolean) => void;

  disabled?: boolean;

};



export function CheckoutTermoResponsabilidade({

  eventoNome,

  aceito,

  onAceitoChange,

  disabled,

}: Props) {

  const scrollRef = useRef<HTMLDivElement>(null);

  const [rolouAteOFim, setRolouAteOFim] = useState(false);



  const verificarScroll = useCallback(() => {

    const el = scrollRef.current;

    if (!el) return;

    const restante = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (restante <= 24 || el.scrollHeight <= el.clientHeight + 1) {

      setRolouAteOFim(true);

    }

  }, []);



  useEffect(() => {

    verificarScroll();

    const el = scrollRef.current;

    if (!el || typeof ResizeObserver === "undefined") return;

    const obs = new ResizeObserver(() => verificarScroll());

    obs.observe(el);

    return () => obs.disconnect();

  }, [verificarScroll]);



  const podeMarcar = rolouAteOFim && !disabled;



  return (

    <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-950 shadow-sm">

      <p className="font-semibold text-amber-950">Termo de responsabilidade</p>

      <p className="mt-1 text-xs leading-relaxed text-amber-900/90">

        Leia os termos de compra de <strong>{eventoNome}</strong>. Role até o final ou use o botão

        abaixo para confirmar a leitura.

      </p>



      <div

        ref={scrollRef}

        onScroll={verificarScroll}

        className="mt-3 max-h-36 overflow-y-auto rounded-md border border-amber-200/80 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 sm:max-h-44"

        tabIndex={0}

        aria-label="Texto do termo de compra"

      >

        <p className="mb-2 font-medium text-zinc-900">Declaro que:</p>

        <ol className="list-decimal space-y-2 pl-4">

          {ITENS_TERMO_COMPRA.map((item) => (

            <li key={item.id} className="text-justify">

              {item.texto}

            </li>

          ))}

        </ol>

        <p className="mt-3 border-t border-zinc-100 pt-2 text-[11px] text-zinc-500">

          Versão {TERMO_COMPRA_VERSAO}. Dúvidas: consulte{" "}

          <Link href="/termos" className="text-emerald-800 underline">

            Termos de uso

          </Link>{" "}

          e{" "}

          <Link href="/privacidade" className="text-emerald-800 underline">

            Privacidade

          </Link>

          .

        </p>

      </div>



      {!rolouAteOFim ? (

        <button

          type="button"

          onClick={() => {

            setRolouAteOFim(true);

            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });

          }}

          className="mt-2 text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"

        >

          Li o termo — ir para confirmação

        </button>

      ) : null}



      <label

        className={`mt-3 flex cursor-pointer items-start gap-2 text-xs ${podeMarcar ? "text-amber-950" : "text-amber-900/60"}`}

      >

        <input

          type="checkbox"

          checked={aceito}

          disabled={!podeMarcar}

          onChange={(e) => onAceitoChange(e.target.checked)}

          className="mt-0.5 rounded border-amber-300 disabled:opacity-50"

        />

        <span>

          Li e aceito o Termo de Compra, o regulamento deste evento e os documentos legais da

          EventosBR.

        </span>

      </label>

    </div>

  );

}



export { TERMO_COMPRA_VERSAO };


