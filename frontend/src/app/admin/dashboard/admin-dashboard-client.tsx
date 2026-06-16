"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { adminFetch, adminSessionActive, clearAdminSession, validateAdminKey } from "@/lib/admin-api";

type Contato = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  aceita_comunicacao_email: boolean;
  aceita_comunicacao_whatsapp: boolean;
};

type ContatosResp = {
  total: number;
  contatos: Contato[];
};

type Campanha = {
  id: string;
  nome: string;
  assunto: string;
  mensagem: string;
  canal: string;
  status: string;
  total_destinatarios: number;
  enviados_ok: number;
  enviados_erro: number;
  criado_em: string;
  disparado_em: string | null;
};

type Tab = "setup" | "eventos" | "usuarios" | "contatos" | "campanhas";

type UsuarioAdmin = {
  id: string;
  email: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  telefone: string | null;
  data_criacao: string | null;
};

type SetupStatus = {
  environment: string;
  ready_for_production: boolean;
  checks: Record<string, string>;
};

type EventoAdmin = {
  id: string;
  slug: string;
  nome: string;
  publicado: boolean;
  data_inicio: string | null;
  organizador_nome: string | null;
  organizador_email: string | null;
};

export function AdminDashboardClient() {
  const [keyInput, setKeyInput] = useState("");
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("setup");
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [eventos, setEventos] = useState<EventoAdmin[]>([]);
  const [filtroPublicado, setFiltroPublicado] = useState<"" | "true" | "false">("");
  const [buscaEvento, setBuscaEvento] = useState("");
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [filtroUsuarioAtivo, setFiltroUsuarioAtivo] = useState<"" | "true" | "false">("");
  const [filtroUsuarioTipo, setFiltroUsuarioTipo] = useState<"" | "cliente" | "organizador">("");

  const [busca, setBusca] = useState("");
  const [filtroCanal, setFiltroCanal] = useState<"qualquer" | "email" | "whatsapp">("qualquer");
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [totalContatos, setTotalContatos] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [nomeCamp, setNomeCamp] = useState("");
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [canalCamp, setCanalCamp] = useState<"email" | "whatsapp" | "ambos">("email");
  const [usarSelecao, setUsarSelecao] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupUnavailable, setSetupUnavailable] = useState(false);

  useEffect(() => {
    void adminSessionActive().then((active) => {
      if (active) setAuthed(true);
    });
  }, []);

  const entrar = async () => {
    const key = keyInput.trim();
    if (!key) {
      setError("Informe a chave de administrador.");
      return;
    }
    setLoginBusy(true);
    setError(null);
    try {
      await validateAdminKey(key);
      setAuthed(true);
    } catch (e) {
      await clearAdminSession();
      setError(e instanceof Error ? e.message : "Não foi possível validar a chave.");
    } finally {
      setLoginBusy(false);
    }
  };

  const carregarContatos = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const p = new URLSearchParams({
        canal: filtroCanal,
        limit: "100",
        offset: "0",
        formato: "json",
      });
      if (busca.trim()) p.set("q", busca.trim());
      const r = await adminFetch<ContatosResp>(`/api/admin/marketing/contatos?${p}`);
      setContatos(r.contatos);
      setTotalContatos(r.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar");
    } finally {
      setBusy(false);
    }
  }, [busca, filtroCanal]);

  const carregarCampanhas = useCallback(async () => {
    try {
      const rows = await adminFetch<Campanha[]>("/api/admin/marketing/campanhas?limit=20");
      setCampanhas(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar campanhas");
    }
  }, []);

  const carregarSetup = useCallback(async () => {
    setSetupLoading(true);
    setSetupUnavailable(false);
    try {
      const r = await adminFetch<SetupStatus>("/api/admin/setup");
      setSetup(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao carregar setup";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setSetupUnavailable(true);
        setSetup(null);
      } else {
        setError(msg);
      }
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const carregarEventos = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: "50", offset: "0" });
      if (filtroPublicado) p.set("publicado", filtroPublicado);
      if (buscaEvento.trim()) p.set("q", buscaEvento.trim());
      const r = await adminFetch<{ eventos: EventoAdmin[]; total: number }>(
        `/api/admin/eventos?${p}`,
      );
      setEventos(r.eventos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar eventos");
    } finally {
      setBusy(false);
    }
  }, [buscaEvento, filtroPublicado]);

  const carregarUsuarios = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: "50", offset: "0" });
      if (filtroUsuarioAtivo) p.set("ativo", filtroUsuarioAtivo);
      if (filtroUsuarioTipo) p.set("tipo", filtroUsuarioTipo);
      if (buscaUsuario.trim()) p.set("q", buscaUsuario.trim());
      const r = await adminFetch<{ usuarios: UsuarioAdmin[]; total: number }>(
        `/api/admin/usuarios?${p}`,
      );
      setUsuarios(r.usuarios);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar usuários");
    } finally {
      setBusy(false);
    }
  }, [buscaUsuario, filtroUsuarioAtivo, filtroUsuarioTipo]);

  async function alternarPublicacao(ev: EventoAdmin) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/eventos/${ev.id}/publicado`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicado: !ev.publicado }),
      });
      setMsg(ev.publicado ? "Evento ocultado da vitrine." : "Evento publicado na vitrine.");
      await carregarEventos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar evento");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!authed) return;
    void carregarSetup();
    void carregarContatos();
    void carregarCampanhas();
  }, [authed, carregarSetup, carregarContatos, carregarCampanhas]);

  useEffect(() => {
    if (!authed || tab !== "eventos") return;
    void carregarEventos();
  }, [authed, tab, carregarEventos]);

  useEffect(() => {
    if (!authed || tab !== "usuarios") return;
    void carregarUsuarios();
  }, [authed, tab, carregarUsuarios]);

  async function alternarUsuarioAtivo(u: UsuarioAdmin) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/usuarios/${u.id}/ativo`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ativo: !u.ativo }),
      });
      setMsg(u.ativo ? "Conta desativada." : "Conta reativada.");
      await carregarUsuarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao atualizar usuário");
    } finally {
      setBusy(false);
    }
  }

  const todosSelecionados = useMemo(
    () => contatos.length > 0 && contatos.every((c) => selecionados.has(c.id)),
    [contatos, selecionados],
  );

  function toggleTodos() {
    if (todosSelecionados) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(contatos.map((c) => c.id)));
    }
  }

  async function criarEDisparar(disparar: boolean) {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        nome: nomeCamp.trim(),
        assunto: assunto.trim(),
        mensagem: mensagem.trim(),
        canal: canalCamp,
        filtro_canal: filtroCanal,
        disparar_agora: disparar,
      };
      if (usarSelecao && selecionados.size > 0) {
        body.usuario_ids = Array.from(selecionados);
      } else if (busca.trim()) {
        body.busca = busca.trim();
      }
      const c = await adminFetch<Campanha>("/api/admin/marketing/campanhas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      setMsg(
        disparar
          ? `Campanha "${c.nome}" criada e envio iniciado (${c.total_destinatarios} destinatário(s)).`
          : `Campanha "${c.nome}" salva (${c.total_destinatarios} destinatário(s)). Dispare quando quiser.`,
      );
      setNomeCamp("");
      setAssunto("");
      setMensagem("");
      await carregarCampanhas();
      setTab("campanhas");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar campanha");
    } finally {
      setBusy(false);
    }
  }

  async function dispararExistente(id: string) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch<Campanha>(`/api/admin/marketing/campanhas/${id}/disparar`, { method: "POST" });
      setMsg("Disparo iniciado.");
      await carregarCampanhas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao disparar");
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-bold text-zinc-900">Painel admin</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use o mesmo valor de <code className="rounded bg-zinc-100 px-1">PLATFORM_ADMIN_API_KEY</code> no{" "}
          <code className="rounded bg-zinc-100 px-1">.env</code> da API (Docker: reinicie o container{" "}
          <code className="rounded bg-zinc-100 px-1">api</code> após alterar).
        </p>
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void entrar();
          }}
          disabled={loginBusy}
          className="mt-4 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
          placeholder="Chave de administrador"
          autoComplete="off"
        />
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          className="btn-primary mt-3 w-full disabled:opacity-60"
          disabled={loginBusy || !keyInput.trim()}
          onClick={() => void entrar()}
        >
          {loginBusy ? "Validando…" : "Entrar"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Painel EventosBR</h1>
        <button
          type="button"
          className="text-xs text-zinc-500 underline"
          onClick={() => {
            clearAdminSession();
            setAuthed(false);
            setSetup(null);
            setError(null);
          }}
        >
          Sair do painel
        </button>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {(
          [
            ["setup", "Produção"],
            ["eventos", "Eventos"],
            ["usuarios", "Usuários"],
            ["contatos", "Contatos"],
            ["campanhas", "Campanhas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === id ? "bg-emerald-100 text-emerald-900" : "text-zinc-600"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}

      {tab === "setup" && setupLoading ? (
        <p className="text-sm text-zinc-500">Carregando checklist de produção…</p>
      ) : null}

      {tab === "setup" && setupUnavailable ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Checklist indisponível nesta versão da API</p>
          <p className="mt-2">
            Atualize o container Docker:{" "}
            <code className="rounded bg-white px-1">docker compose up -d --build api</code>
          </p>
          <p className="mt-2 text-xs">Enquanto isso, use as abas Contatos, Campanhas e Eventos.</p>
        </section>
      ) : null}

      {tab === "setup" && setup ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-zinc-900">
            Ambiente: <span className="font-mono">{setup.environment}</span>
            {setup.ready_for_production ? (
              <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                Pronto para produção
              </span>
            ) : (
              <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                Ajustes pendentes
              </span>
            )}
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {Object.entries(setup.checks).map(([k, v]) => (
              <li
                key={k}
                className={`flex justify-between rounded-md border px-3 py-2 text-sm ${
                  v === "ok" || v === "desativado" || v === "desativado_stripe" || v === "desativado_asaas" || v === "dev_sem_assinatura" || v === "dev_sem_token"
                    ? "border-emerald-100 bg-emerald-50/50"
                    : "border-amber-100 bg-amber-50/50"
                }`}
              >
                <span className="text-zinc-700">{k.replace(/_/g, " ")}</span>
                <span className="font-mono text-xs text-zinc-600">{v}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-outline mt-4 text-sm" onClick={() => void carregarSetup()}>
            Atualizar checklist
          </button>
        </section>
      ) : null}

      {tab === "eventos" ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              value={buscaEvento}
              onChange={(e) => setBuscaEvento(e.target.value)}
              placeholder="Buscar nome ou slug…"
              className="min-w-[200px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={filtroPublicado}
              onChange={(e) => setFiltroPublicado(e.target.value as typeof filtroPublicado)}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Publicados</option>
              <option value="false">Ocultos</option>
            </select>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void carregarEventos()}>
              Pesquisar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-2">Evento</th>
                  <th className="py-2 pr-2">Organizador</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((ev) => (
                  <tr key={ev.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-zinc-900">{ev.nome}</p>
                      <p className="text-zinc-500">/eventos/{ev.slug}</p>
                    </td>
                    <td className="py-2 pr-2 text-zinc-600">
                      {ev.organizador_nome}
                      <br />
                      {ev.organizador_email}
                    </td>
                    <td className="py-2 pr-2">
                      {ev.publicado ? (
                        <span className="text-emerald-700">Na vitrine</span>
                      ) : (
                        <span className="text-amber-700">Oculto</span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className="text-emerald-700 underline"
                        disabled={busy}
                        onClick={() => void alternarPublicacao(ev)}
                      >
                        {ev.publicado ? "Ocultar" : "Publicar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "usuarios" ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              placeholder="Buscar nome, e-mail ou telefone…"
              className="min-w-[200px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={filtroUsuarioTipo}
              onChange={(e) => setFiltroUsuarioTipo(e.target.value as typeof filtroUsuarioTipo)}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">Todos os tipos</option>
              <option value="cliente">Cliente</option>
              <option value="organizador">Organizador</option>
            </select>
            <select
              value={filtroUsuarioAtivo}
              onChange={(e) => setFiltroUsuarioAtivo(e.target.value as typeof filtroUsuarioAtivo)}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Desativados</option>
            </select>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void carregarUsuarios()}>
              Pesquisar
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-2">Usuário</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2">Ação</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-zinc-900">{u.nome}</p>
                      <p className="text-zinc-500">{u.email}</p>
                    </td>
                    <td className="py-2 pr-2 capitalize text-zinc-600">{u.tipo}</td>
                    <td className="py-2 pr-2">
                      {u.ativo ? (
                        <span className="text-emerald-700">Ativo</span>
                      ) : (
                        <span className="text-red-700">Desativado</span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        className={u.ativo ? "text-red-700 underline" : "text-emerald-700 underline"}
                        disabled={busy}
                        onClick={() => void alternarUsuarioAtivo(u)}
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === "contatos" ? (
        <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, e-mail ou telefone…"
              className="min-w-[200px] flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={filtroCanal}
              onChange={(e) => setFiltroCanal(e.target.value as typeof filtroCanal)}
              className="rounded-md border border-zinc-300 px-2 py-2 text-sm"
            >
              <option value="qualquer">Opt-in: qualquer</option>
              <option value="email">Só e-mail</option>
              <option value="whatsapp">Só WhatsApp</option>
            </select>
            <button type="button" className="btn-outline" disabled={busy} onClick={() => void carregarContatos()}>
              Pesquisar
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            {totalContatos} contacto(s) com consentimento · {selecionados.size} selecionado(s)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-2">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                  </th>
                  <th className="py-2 pr-2">Nome</th>
                  <th className="py-2 pr-2">E-mail</th>
                  <th className="py-2 pr-2">Telefone</th>
                  <th className="py-2">E-mail</th>
                  <th className="py-2">WApp</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => (
                  <tr key={c.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={selecionados.has(c.id)}
                        onChange={() => {
                          const n = new Set(selecionados);
                          if (n.has(c.id)) n.delete(c.id);
                          else n.add(c.id);
                          setSelecionados(n);
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2 font-medium">{c.nome}</td>
                    <td className="break-all py-2 pr-2">{c.email}</td>
                    <td className="py-2 pr-2">{c.telefone ?? "—"}</td>
                    <td className="py-2">{c.aceita_comunicacao_email ? "sim" : "—"}</td>
                    <td className="py-2">{c.aceita_comunicacao_whatsapp ? "sim" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-zinc-900">Nova campanha</h2>
            <label className="block text-xs font-medium text-zinc-700">
              Nome interno
              <input
                value={nomeCamp}
                onChange={(e) => setNomeCamp(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Assunto (e-mail)
              <input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Mensagem
              <textarea
                rows={6}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Canal de envio
              <select
                value={canalCamp}
                onChange={(e) => setCanalCamp(e.target.value as typeof canalCamp)}
                className="mt-0.5 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="email">E-mail (SMTP)</option>
                <option value="whatsapp">WhatsApp (webhook)</option>
                <option value="ambos">E-mail + WhatsApp</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                checked={usarSelecao}
                onChange={(e) => setUsarSelecao(e.target.checked)}
              />
              Usar {selecionados.size} contacto(s) selecionado(s) na aba Contatos
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={busy}
                className="btn-primary"
                onClick={() => void criarEDisparar(true)}
              >
                Criar e disparar
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-outline"
                onClick={() => void criarEDisparar(false)}
              >
                Só salvar rascunho
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-zinc-900">Histórico</h2>
            <ul className="mt-3 max-h-[480px] space-y-3 overflow-y-auto text-sm">
              {campanhas.map((c) => (
                <li key={c.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
                  <p className="font-medium text-zinc-900">{c.nome}</p>
                  <p className="text-xs text-zinc-500">
                    {c.status} · {c.enviados_ok}/{c.total_destinatarios} ok · {c.canal}
                  </p>
                  {c.status === "rascunho" || c.status === "concluida" || c.status === "erro" ? (
                    <button
                      type="button"
                      className="mt-2 text-xs font-medium text-emerald-800 underline"
                      disabled={busy}
                      onClick={() => void dispararExistente(c.id)}
                    >
                      Disparar / reenviar
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
