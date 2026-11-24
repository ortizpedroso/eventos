"use client";

import { useState } from "react";

import { apiFetch } from "@/lib/api";

type Apontamento = {
  dominio: string;
  correto: boolean;
  alvo_cname: string;
  ips_plataforma: string[];
  ips_encontrados: string[];
};

export type RespostaDominio = {
  dominio_proprio: string | null;
  dominio_proprio_cadastrado: string | null;
  apontamento: Apontamento | null;
};

type Props = {
  cadastrado: string | null;
  ativo: string | null;
  liberado: boolean;
  onAtualizado: (r: RespostaDominio) => void;
};

function ehDominioRaiz(dominio: string): boolean {
  const partes = dominio.split(".");
  const sufixoBr = partes.length >= 3 && partes.at(-1) === "br" && partes.at(-2)!.length <= 3;
  return partes.length === (sufixoBr ? 3 : 2);
}

export function DominioProprioAssistente({ cadastrado, ativo, liberado, onAtualizado }: Props) {
  const [valor, setValor] = useState(cadastrado ?? "");
  const [apontamento, setApontamento] = useState<Apontamento | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function chamar(caminho: string, init: RequestInit) {
    setBusy(true);
    setErro(null);
    try {
      const r = await apiFetch<RespostaDominio>(caminho, init);
      setApontamento(r.apontamento);
      setValor(r.dominio_proprio_cadastrado ?? "");
      onAtualizado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  }

  const salvar = (dominio: string | null) =>
    chamar("/api/produtor/meu-perfil/dominio-proprio", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dominio }),
    });
  const verificar = () => chamar("/api/produtor/meu-perfil/dominio-proprio/verificar", { method: "POST" });

  if (!liberado && !cadastrado) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700" data-dominio-assistente="bloqueado">
        <h3 className="text-sm font-semibold text-zinc-900">Domínio próprio</h3>
        <p className="mt-1">
          Use seu próprio endereço (ex.: eventos.suamarca.com.br) com o plano com mensalidade. Enquanto isso, seu
          subdomínio na EventosBR já mostra sua página com a sua marca.
        </p>
      </div>
    );
  }

  const alvo = apontamento?.alvo_cname ?? "eventosbr.app.br";
  const raiz = cadastrado ? ehDominioRaiz(cadastrado) : false;
  const nomeRegistro = cadastrado && !raiz ? cadastrado.split(".")[0] : "@";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm" data-dominio-assistente={ativo ? "ativo" : "pendente"}>
      <h3 className="text-sm font-semibold text-zinc-900">Domínio próprio</h3>
      <p className="mt-1 text-xs text-zinc-600">
        Seus compradores veem só o seu endereço, e a página continua com a sua marca.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          aria-label="Domínio próprio"
          value={valor}
          onChange={(e) => setValor(e.target.value.trim().toLowerCase())}
          placeholder="eventos.suamarca.com.br"
          className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm"
        />
        <button
          type="button"
          className="btn-success px-4 py-2 text-sm"
          disabled={busy || !valor || valor === cadastrado}
          onClick={() => void salvar(valor)}
        >
          Salvar domínio
        </button>
        {cadastrado ? (
          <button type="button" className="btn-outline px-4 py-2 text-sm" disabled={busy} onClick={() => void salvar(null)}>
            Remover
          </button>
        ) : null}
      </div>

      {cadastrado && ativo ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-950" role="status">
          <p>
            <strong>{cadastrado}</strong> está ativo na EventosBR.
          </p>
          <button type="button" className="btn-outline mt-2 px-3 py-1.5 text-xs" disabled={busy} onClick={() => void verificar()}>
            {busy ? "Conferindo…" : "Conferir DNS"}
          </button>
          {apontamento ? (
            <p className="mt-2 text-xs" data-dominio-verificacao={apontamento.correto ? "ok" : "pendente"}>
              {apontamento.correto
                ? "O DNS aponta para a EventosBR. Sua página já abre nesse endereço."
                : `O DNS ainda não aponta para a EventosBR (CNAME para ${alvo}). Sua página só abre nesse endereço depois disso.`}
            </p>
          ) : null}
        </div>
      ) : null}

      {cadastrado && !ativo ? (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <p className="font-semibold">Falta apontar {cadastrado} para a EventosBR</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Entre no painel onde você comprou o domínio (Hostinger, Registro.br, GoDaddy…), na parte de DNS.</li>
            <li>Apague qualquer redirecionamento que exista para esse endereço.</li>
            {raiz ? (
              <li>
                Crie um registro <strong>A</strong> com nome <code>@</code> e valor{" "}
                <code>{apontamento?.ips_plataforma[0] ?? "(clique em Verificar para ver o IP)"}</code>.
              </li>
            ) : (
              <li>
                Crie um registro <strong>CNAME</strong> com nome <code>{nomeRegistro}</code> e valor <code>{alvo}</code>.
              </li>
            )}
            <li>Espere alguns minutos (às vezes até algumas horas) e clique em Verificar agora.</li>
          </ol>
          <button type="button" className="btn-success mt-3 px-4 py-2 text-sm" disabled={busy} onClick={() => void verificar()}>
            {busy ? "Verificando…" : "Verificar agora"}
          </button>
          {apontamento && !apontamento.correto ? (
            <p className="mt-2 text-xs" role="alert" data-dominio-verificacao="pendente">
              {apontamento.ips_encontrados.length
                ? `Ainda não aponta para nós: o endereço responde em ${apontamento.ips_encontrados.join(", ")}.`
                : "Ainda não encontramos nenhum registro para esse endereço."}{" "}
              Se acabou de mudar, aguarde e tente de novo.
            </p>
          ) : null}
        </div>
      ) : null}

      {erro ? (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
