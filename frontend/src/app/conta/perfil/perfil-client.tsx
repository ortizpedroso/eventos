"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ComunicacaoMarketingOptIn } from "@/components/comunicacao-marketing-opt-in";
import { PerfilPublicoOrganizador } from "@/components/perfil-publico-organizador";
import { PerfilTabs } from "@/components/perfil-tabs";
import { apiFetch } from "@/lib/api";
import type { Usuario } from "@/lib/types";
import { onlyDigits } from "@/lib/cpf";
import { formatTelefoneBrMask } from "@/lib/telefone-br";

function normalizarEmail(s: string) {
  return s.trim().toLowerCase();
}

export function PerfilClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Usuario | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDb, setLoadingDb] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [aceitaComEmail, setAceitaComEmail] = useState(false);
  const [aceitaComWhatsapp, setAceitaComWhatsapp] = useState(false);
  const [telefonePerfil, setTelefonePerfil] = useState("");

  const carregarDoBanco = useCallback(async () => {
    setLoadError(null);
    setLoadingDb(true);
    try {
      const u = await apiFetch<Usuario>("/api/auth/me", {
        cache: "no-store",
        headers: { "cache-control": "no-cache" },
      });
      setUser(u);
      setAceitaComEmail(Boolean(u.aceita_comunicacao_email));
      setAceitaComWhatsapp(Boolean(u.aceita_comunicacao_whatsapp));
      setTelefonePerfil(u.telefone ?? "");
    } catch (e) {
      setUser(null);
      setLoadError(
        e instanceof Error ? e.message : "Não foi possível carregar o perfil",
      );
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    const isPerfil = pathname === "/conta/perfil" || pathname === "/organizador/perfil";
    if (isPerfil) {
      void carregarDoBanco();
    }
  }, [pathname, carregarDoBanco]);

  async function onSubmit(formData: FormData) {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const nome = String(formData.get("nome") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const senhaAtual = String(formData.get("senha_atual") ?? "").trim();
    const novaSenha = String(formData.get("nova_senha") ?? "").trim();
    const repita = String(formData.get("nova_senha_repita") ?? "").trim();

    if (!nome) {
      setSaveError("Informe seu nome.");
      setSaving(false);
      return;
    }
    if (!email) {
      setSaveError("Informe o email de login.");
      setSaving(false);
      return;
    }

    const emailMudou = normalizarEmail(email) !== normalizarEmail(user.email);
    const temSenha = user.tem_senha !== false;

    if (!novaSenha && repita) {
      setSaveError("Se preencher a confirmação, informe também a nova senha.");
      setSaving(false);
      return;
    }

    if (emailMudou || novaSenha) {
      if (temSenha && !senhaAtual) {
        setSaveError(
          "Para alterar o email ou a senha, informe a senha atual corretamente.",
        );
        setSaving(false);
        return;
      }
      if (!temSenha && emailMudou && !novaSenha) {
        setSaveError("Defina uma nova senha antes de alterar o email de login.");
        setSaving(false);
        return;
      }
    }

    if (novaSenha) {
      if (novaSenha.length < 8) {
        setSaveError("A nova senha deve ter pelo menos 8 caracteres.");
        setSaving(false);
        return;
      }
      if (novaSenha !== repita) {
        setSaveError("A confirmação da nova senha não confere.");
        setSaving(false);
        return;
      }
    }

    const payload: {
      nome: string;
      email: string;
      senha_atual?: string;
      nova_senha?: string;
      aceita_comunicacao_email: boolean;
      aceita_comunicacao_whatsapp: boolean;
      telefone: string | null;
    } = {
      nome,
      email,
      aceita_comunicacao_email: aceitaComEmail,
      aceita_comunicacao_whatsapp: aceitaComWhatsapp,
      telefone: telefonePerfil.trim() ? onlyDigits(telefonePerfil, 13) : null,
    };
    if (temSenha && (emailMudou || novaSenha)) {
      payload.senha_atual = senhaAtual;
    }
    if (novaSenha) {
      payload.nova_senha = novaSenha;
    }

    try {
      await apiFetch<Usuario>("/api/auth/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      await carregarDoBanco();
      setSaved(true);
      router.refresh();
      const form = document.getElementById("perfil-form") as HTMLFormElement | null;
      form?.querySelectorAll<HTMLInputElement>('input[name="senha_atual"], input[name="nova_senha"], input[name="nova_senha_repita"]').forEach((el) => {
        el.value = "";
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {loadError}
          <div className="mt-2">
            <Link href="/auth" className="underline">
              Fazer login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!user && loadingDb && !loadError) {
    return (
      <div className="text-sm text-zinc-600">Carregando seu perfil…</div>
    );
  }

  if (!user) {
    return (
      <div className="text-sm text-zinc-600">Carregando perfil…</div>
    );
  }

  const tipoLabel = user.tipo === "organizador" ? "Organizador" : "Cliente";
  const temSenha = user.tem_senha !== false;
  const dataCadastro = new Date(user.data_criacao).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Meu perfil</h1>
        <Link href="/eventos" className="text-sm text-zinc-600 hover:underline">
          ← Eventos
        </Link>
      </div>

      {pathname.startsWith("/organizador") ? <PerfilTabs base="/organizador/perfil" /> : null}

      <section className="max-w-lg rounded-2xl border border-zinc-200 bg-zinc-50/90 p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Resumo da conta
            </p>
            <p className="mt-1 text-sm text-zinc-600">
              Informações salvas na EventosBR.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregarDoBanco()}
            disabled={loadingDb}
            className="btn-outline shrink-0 px-3 py-1.5 text-xs"
          >
            {loadingDb ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-zinc-500">Nome</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{user.nome}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email de login</dt>
            <dd className="mt-0.5 font-medium text-zinc-900 break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tipo de conta</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{tipoLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Cadastro em</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">{dataCadastro}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Senha de login</dt>
            <dd className="mt-0.5 font-medium text-zinc-900">
              {temSenha ? "Definida" : "Ainda não definida (compra rápida ou login social)"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Comunicações EventosBR</dt>
            <dd className="mt-0.5 text-zinc-900">
              E-mail: {user.aceita_comunicacao_email ? "sim" : "não"} · WhatsApp:{" "}
              {user.aceita_comunicacao_whatsapp ? "sim" : "não"}
              {user.telefone ? ` · ${formatTelefoneBrMask(user.telefone)}` : ""}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold text-zinc-900">Editar informações</h2>
        <p className="mt-1 text-sm text-zinc-600">
          {temSenha ? (
            <>
              Você pode alterar o nome a qualquer momento. Para mudar o{" "}
              <strong>email de login</strong> ou a <strong>senha</strong>, é obrigatório informar a
              senha atual.
            </>
          ) : (
            <>
              Sua conta foi criada na <strong>compra rápida</strong> (ou login social) sem senha.
              Defina uma senha abaixo para entrar com e-mail no futuro — não precisa informar senha
              atual.
            </>
          )}
        </p>

        <form
          id="perfil-form"
          action={onSubmit}
          className="mt-6 space-y-6"
          key={`${user.id}-${user.email}-${user.nome}`}
        >
          {saveError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {saveError}
            </div>
          ) : null}
          {saved ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Alterações salvas com sucesso.
            </div>
          ) : null}

          <div className="space-y-5 border-b border-zinc-100 pb-6">
            <h3 className="text-sm font-semibold text-zinc-800">Perfil</h3>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="nome">
                Nome
              </label>
              <input
                id="nome"
                name="nome"
                required
                minLength={1}
                maxLength={200}
                defaultValue={user.nome}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="space-y-5">
            <h3 className="text-sm font-semibold text-zinc-800">Login e segurança</h3>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="email">
                Email (login)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={user.email}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500">
                {temSenha
                  ? "Este é o email que você usa para entrar. Se alterá-lo, use a senha atual abaixo."
                  : "Para alterar o email, defina primeiro uma nova senha nos campos abaixo."}
              </p>
            </div>

            {temSenha ? (
              <div className="grid gap-2">
                <label className="text-sm font-medium text-zinc-800" htmlFor="senha_atual">
                  Senha atual
                </label>
                <input
                  id="senha_atual"
                  name="senha_atual"
                  type="password"
                  autoComplete="current-password"
                  className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <p className="text-xs text-zinc-500">
                  Obrigatória ao mudar o email ou definir nova senha.
                </p>
              </div>
            ) : null}

            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="nova_senha">
                {temSenha ? "Nova senha" : "Criar senha"}
              </label>
              <input
                id="nova_senha"
                name="nova_senha"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="nova_senha_repita">
                Repita a nova senha
              </label>
              <input
                id="nova_senha_repita"
                name="nova_senha_repita"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <p className="text-xs text-zinc-500">
                {temSenha
                  ? "Deixe em branco para manter a senha atual."
                  : "Mínimo 8 caracteres. Depois você poderá entrar com e-mail e senha."}
              </p>
            </div>
          </div>

          <div className="space-y-4 border-t border-zinc-100 pt-6">
            <h3 className="text-sm font-semibold text-zinc-800">Preferências de comunicação</h3>
            <div className="grid gap-2 max-w-sm">
              <label className="text-sm font-medium text-zinc-800" htmlFor="telefone_perfil">
                Telefone (opcional)
              </label>
              <input
                id="telefone_perfil"
                inputMode="tel"
                value={formatTelefoneBrMask(telefonePerfil)}
                onChange={(e) => setTelefonePerfil(onlyDigits(e.target.value, 11))}
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                placeholder="(11) 99999-9999"
              />
            </div>
            <ComunicacaoMarketingOptIn
              email={aceitaComEmail}
              whatsapp={aceitaComWhatsapp}
              onEmailChange={setAceitaComEmail}
              onWhatsappChange={setAceitaComWhatsapp}
              telefoneInformado={telefonePerfil.replace(/\D/g, "").length >= 10}
            />
          </div>

          <div className="flex justify-end border-t border-zinc-100 pt-4">
            <button type="submit" disabled={saving} className="btn-success px-8">
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </section>
      {user.tipo === "organizador" ? <PerfilPublicoOrganizador /> : null}
    </div>
  );
}
