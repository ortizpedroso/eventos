"use client";

import { useCallback, useEffect, useState } from "react";

import { ImagemAssetField } from "@/components/imagem-asset-field";
import { adminFetch } from "@/lib/admin-api";

export type PlatformSettingsForm = {
  site_name: string;
  site_tagline: string;
  footer_description: string;
  contact_email: string;
  support_email: string;
  logo_url: string;
  logo_light_url: string;
  favicon_url: string;
  primary_color: string;
  primary_color_dark: string;
  social_instagram_url: string;
  social_whatsapp_url: string;
  social_linkedin_url: string;
  social_x_url: string;
  social_youtube_url: string;
  updated_at: string | null;
};

const EMPTY: PlatformSettingsForm = {
  site_name: "EventosBR",
  site_tagline: "",
  footer_description: "",
  contact_email: "",
  support_email: "",
  logo_url: "",
  logo_light_url: "",
  favicon_url: "",
  primary_color: "#10b981",
  primary_color_dark: "#047857",
  social_instagram_url: "",
  social_whatsapp_url: "",
  social_linkedin_url: "",
  social_x_url: "",
  social_youtube_url: "",
  updated_at: null,
};

function toForm(data: PlatformSettingsForm): PlatformSettingsForm {
  return {
    ...data,
    site_tagline: data.site_tagline ?? "",
    footer_description: data.footer_description ?? "",
    contact_email: data.contact_email ?? "",
    support_email: data.support_email ?? "",
    logo_url: data.logo_url ?? "",
    logo_light_url: data.logo_light_url ?? "",
    favicon_url: data.favicon_url ?? "",
    social_instagram_url: data.social_instagram_url ?? "",
    social_whatsapp_url: data.social_whatsapp_url ?? "",
    social_linkedin_url: data.social_linkedin_url ?? "",
    social_x_url: data.social_x_url ?? "",
    social_youtube_url: data.social_youtube_url ?? "",
  };
}

function payloadFromForm(form: PlatformSettingsForm): Record<string, string | null> {
  const trim = (v: string) => v.trim() || null;
  return {
    site_name: form.site_name.trim() || "EventosBR",
    site_tagline: trim(form.site_tagline),
    footer_description: trim(form.footer_description),
    contact_email: trim(form.contact_email),
    support_email: trim(form.support_email),
    logo_url: trim(form.logo_url),
    logo_light_url: trim(form.logo_light_url),
    favicon_url: trim(form.favicon_url),
    primary_color: form.primary_color,
    primary_color_dark: form.primary_color_dark,
    social_instagram_url: trim(form.social_instagram_url),
    social_whatsapp_url: trim(form.social_whatsapp_url),
    social_linkedin_url: trim(form.social_linkedin_url),
    social_x_url: trim(form.social_x_url),
    social_youtube_url: trim(form.social_youtube_url),
  };
}

type Props = {
  onMsg: (msg: string | null) => void;
  onError: (err: string | null) => void;
};

export function AdminPlatformSettingsPanel({ onMsg, onError }: Props) {
  const [form, setForm] = useState<PlatformSettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await adminFetch<PlatformSettingsForm>("/api/admin/settings");
      setForm(toForm(data));
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function setField<K extends keyof PlatformSettingsForm>(key: K, value: PlatformSettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function salvar() {
    setSaving(true);
    onError(null);
    onMsg(null);
    try {
      const data = await adminFetch<PlatformSettingsForm>("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadFromForm(form)),
      });
      setForm(toForm(data));
      onMsg("Configurações salvas. O site público atualiza em até 1 minuto.");
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Carregando configurações…</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Configurações da plataforma</h2>
        <p className="mt-1 max-w-2xl text-sm text-zinc-600">
          Personalize a marca do site (white-label): envie logo e favicon, ajuste cores, e-mail de contato e redes
          sociais. As alterações aparecem na navbar, rodapé, e-mails e botões principais.
        </p>
        <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-950">
          <strong>Onde usar:</strong> em cada campo de imagem, clique em <strong>Enviar arquivo</strong> ou cole uma
          URL <code className="rounded bg-white px-1">https://</code>. Salve ao final da página.
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Identidade
        </h3>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Nome do site</span>
          <input
            className="input"
            value={form.site_name}
            onChange={(e) => setField("site_name", e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Tagline (logo)</span>
          <input
            className="input"
            value={form.site_tagline}
            onChange={(e) => setField("site_tagline", e.target.value)}
            placeholder="INGRESSOS · SHOWS · TRANSPARÊNCIA"
          />
        </label>
        <label className="sm:col-span-2 grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Texto do rodapé</span>
          <textarea
            className="input min-h-[80px]"
            value={form.footer_description}
            onChange={(e) => setField("footer_description", e.target.value)}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Contato
        </h3>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">E-mail de contato</span>
          <input
            type="email"
            className="input"
            value={form.contact_email}
            onChange={(e) => setField("contact_email", e.target.value)}
            placeholder="contato@seudominio.com.br"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">E-mail de denúncias / suporte</span>
          <input
            type="email"
            className="input"
            value={form.support_email}
            onChange={(e) => setField("support_email", e.target.value)}
          />
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Visual (logo, favicon, cores)
        </h3>
        <ImagemAssetField
          id="logo_url"
          label="Logo (navbar)"
          hint="URL https ou envie um arquivo (máx. 1,25 MB)."
          value={form.logo_url}
          onChange={(v) => setField("logo_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
        />
        <ImagemAssetField
          id="logo_light_url"
          label="Logo clara (rodapé escuro)"
          value={form.logo_light_url}
          onChange={(v) => setField("logo_light_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
        />
        <ImagemAssetField
          id="favicon_url"
          label="Favicon"
          value={form.favicon_url}
          onChange={(v) => setField("favicon_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Cor principal</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => setField("primary_color", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-zinc-300"
            />
            <input
              className="input font-mono"
              value={form.primary_color}
              onChange={(e) => setField("primary_color", e.target.value)}
            />
          </div>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-zinc-800">Cor principal (hover / escuro)</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primary_color_dark}
              onChange={(e) => setField("primary_color_dark", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-zinc-300"
            />
            <input
              className="input font-mono"
              value={form.primary_color_dark}
              onChange={(e) => setField("primary_color_dark", e.target.value)}
            />
          </div>
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
          <span className="text-sm text-zinc-600">Pré-visualização do botão:</span>
          <button type="button" className="btn-success px-4 py-2 text-sm" style={{ pointerEvents: "none" }}>
            Botão principal
          </button>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:grid-cols-2">
        <h3 className="sm:col-span-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Redes sociais
        </h3>
        {(
          [
            ["social_instagram_url", "Instagram"],
            ["social_whatsapp_url", "WhatsApp"],
            ["social_linkedin_url", "LinkedIn"],
            ["social_x_url", "X (Twitter)"],
            ["social_youtube_url", "YouTube"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1 text-sm">
            <span className="font-medium text-zinc-800">{label}</span>
            <input
              className="input"
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder="https://"
            />
          </label>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-success px-5 py-2.5 text-sm" disabled={saving} onClick={() => void salvar()}>
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
        {form.updated_at ? (
          <p className="text-xs text-zinc-500">Última alteração: {new Date(form.updated_at).toLocaleString("pt-BR")}</p>
        ) : null}
      </div>
    </div>
  );
}
