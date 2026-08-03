"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { BrandColorPicker } from "@/components/brand-color-picker";
import { ImagemAssetField } from "@/components/imagem-asset-field";
import { TelefoneInput } from "@/components/telefone-input";
import { UPLOAD_IMAGEM_ACCEPT } from "@/lib/upload-imagem-tipos";
import { adminFetch } from "@/lib/admin-api";

export type PlatformSettingsForm = {
  site_name: string;
  site_tagline: string;
  footer_description: string;
  contact_email: string;
  contact_phone: string;
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
  meta_pixel_id: string;
  gtm_id: string;
  updated_at: string | null;
};

const EMPTY: PlatformSettingsForm = {
  site_name: "EventosBR",
  site_tagline: "",
  footer_description: "",
  contact_email: "",
  contact_phone: "",
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
  meta_pixel_id: "",
  gtm_id: "",
  updated_at: null,
};

function toForm(data: PlatformSettingsForm): PlatformSettingsForm {
  return {
    ...data,
    site_tagline: data.site_tagline ?? "",
    footer_description: data.footer_description ?? "",
    contact_email: data.contact_email ?? "",
    contact_phone: data.contact_phone ?? "",
    support_email: data.support_email ?? "",
    logo_url: data.logo_url ?? "",
    logo_light_url: data.logo_light_url ?? "",
    favicon_url: data.favicon_url ?? "",
    social_instagram_url: data.social_instagram_url ?? "",
    social_whatsapp_url: data.social_whatsapp_url ?? "",
    social_linkedin_url: data.social_linkedin_url ?? "",
    social_x_url: data.social_x_url ?? "",
    social_youtube_url: data.social_youtube_url ?? "",
    meta_pixel_id: data.meta_pixel_id ?? "",
    gtm_id: data.gtm_id ?? "",
  };
}

function payloadFromForm(form: PlatformSettingsForm): Record<string, string | null> {
  const trim = (v: string) => v.trim() || null;
  return {
    site_name: form.site_name.trim() || "EventosBR",
    site_tagline: trim(form.site_tagline),
    footer_description: trim(form.footer_description),
    contact_email: trim(form.contact_email),
    contact_phone: trim(form.contact_phone),
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
    meta_pixel_id: trim(form.meta_pixel_id),
    gtm_id: trim(form.gtm_id),
  };
}

type Props = {
  onMsg: (msg: string | null) => void;
  onError: (err: string | null) => void;
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function AdminPlatformSettingsPanel({ onMsg, onError }: Props) {
  const [form, setForm] = useState<PlatformSettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localMsg, setLocalMsg] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    onError(null);
    setLocalError(null);
    try {
      const data = await adminFetch<PlatformSettingsForm>("/api/admin/settings");
      setForm(toForm(data));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao carregar configurações";
      onError(msg);
      setLocalError(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function setField<K extends keyof PlatformSettingsForm>(key: K, value: PlatformSettingsForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setLocalMsg(null);
  }

  async function salvar() {
    setSaving(true);
    onError(null);
    onMsg(null);
    setLocalError(null);
    setLocalMsg(null);
    try {
      const data = await adminFetch<PlatformSettingsForm>("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadFromForm(form)),
      });
      setForm(toForm(data));
      try {
        await fetch("/api/admin/revalidate-platform", { method: "POST", credentials: "include" });
      } catch {
        /* cache do Next pode demorar um pouco a limpar */
      }
      const ok = "Configurações salvas. Atualize o site público para ver as mudanças.";
      onMsg(ok);
      setLocalMsg(ok);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao salvar";
      onError(msg);
      setLocalError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600">Carregando configurações…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Configurações da plataforma</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Marca, contato, redes e anúncios. Salve ao final da página.
        </p>
      </div>

      <Section title="Identidade">
        <label className="grid gap-1.5 text-sm sm:col-span-1">
          <span className="font-medium text-zinc-800">Nome do site</span>
          <input className="input" value={form.site_name} onChange={(e) => setField("site_name", e.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-1">
          <span className="font-medium text-zinc-800">Tagline</span>
          <input
            className="input"
            value={form.site_tagline}
            onChange={(e) => setField("site_tagline", e.target.value)}
            placeholder="INGRESSOS · SHOWS · TRANSPARÊNCIA"
          />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">Texto do rodapé</span>
          <textarea
            className="input min-h-[72px]"
            value={form.footer_description}
            onChange={(e) => setField("footer_description", e.target.value)}
          />
        </label>
      </Section>

      <Section title="Contato">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">E-mail de contato</span>
          <input
            type="email"
            className="input"
            value={form.contact_email}
            onChange={(e) => setField("contact_email", e.target.value)}
            placeholder="contato@seudominio.com.br"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">E-mail denúncias / suporte</span>
          <input
            type="email"
            className="input"
            value={form.support_email}
            onChange={(e) => setField("support_email", e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium text-zinc-800">Telefone</span>
          <TelefoneInput
            value={form.contact_phone.replace(/\D/g, "")}
            onChange={(digits) => setField("contact_phone", digits)}
          />
        </label>
      </Section>

      <Section title="Marca visual" hint="URL ou envio de arquivo. Logo clara é opcional (rodapé escuro).">
        <ImagemAssetField
          id="logo_url"
          label="Logo (menu)"
          value={form.logo_url}
          onChange={(v) => setField("logo_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
          larguraAlvo={480}
          alturaAlvo={120}
          compact
        />
        <ImagemAssetField
          id="logo_light_url"
          label="Logo clara (opcional)"
          value={form.logo_light_url}
          onChange={(v) => setField("logo_light_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
          larguraAlvo={480}
          alturaAlvo={120}
          compact
        />
        <ImagemAssetField
          id="favicon_url"
          label="Favicon"
          value={form.favicon_url}
          onChange={(v) => setField("favicon_url", v)}
          uploadUrl="/api/admin/proxy/assets/upload"
          accept={UPLOAD_IMAGEM_ACCEPT}
          larguraAlvo={256}
          alturaAlvo={256}
          compact
        />
        <BrandColorPicker
          primary={form.primary_color}
          primaryDark={form.primary_color_dark}
          onChange={(primary, dark) => {
            setField("primary_color", primary);
            setField("primary_color_dark", dark);
          }}
        />
      </Section>

      <Section title="Redes sociais" hint="Instagram e WhatsApp aparecem no rodapé.">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">Instagram</span>
          <input
            className="input"
            value={form.social_instagram_url}
            onChange={(e) => setField("social_instagram_url", e.target.value)}
            placeholder="@perfil ou link"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">WhatsApp</span>
          <TelefoneInput
            value={form.social_whatsapp_url.replace(/\D/g, "")}
            onChange={(digits) => setField("social_whatsapp_url", digits)}
            placeholder="(11) 99999-9999"
            className="input"
          />
        </label>
        {(
          [
            ["social_linkedin_url", "LinkedIn"],
            ["social_x_url", "X"],
            ["social_youtube_url", "YouTube"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="grid gap-1.5 text-sm">
            <span className="font-medium text-zinc-800">{label}</span>
            <input className="input" value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder="https://…" />
          </label>
        ))}
      </Section>

      <Section
        title="Marketing / anúncios"
        hint="Scripts só em produção. Se vazio, usa variáveis do servidor (.env)."
      >
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">Meta Pixel ID</span>
          <input
            className="input font-mono"
            value={form.meta_pixel_id}
            onChange={(e) => setField("meta_pixel_id", e.target.value)}
            placeholder="123456789012345"
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium text-zinc-800">Google Tag Manager</span>
          <input
            className="input font-mono"
            value={form.gtm_id}
            onChange={(e) => setField("gtm_id", e.target.value)}
            placeholder="GTM-XXXXXXX"
          />
        </label>
      </Section>

      {localError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {localError}
        </p>
      ) : null}
      {localMsg ? (
        <p
          className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          role="status"
        >
          {localMsg}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4">
        <button
          type="button"
          className="btn-success px-5 py-2.5 text-sm"
          disabled={saving}
          onClick={() => void salvar()}
        >
          {saving ? "Salvando…" : "Salvar configurações"}
        </button>
        {form.updated_at ? (
          <p className="text-xs text-zinc-500">
            Última alteração: {new Date(form.updated_at).toLocaleString("pt-BR")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
