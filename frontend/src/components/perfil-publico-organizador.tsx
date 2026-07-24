"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { ImagemAssetField } from "@/components/imagem-asset-field";
import { apiFetch } from "@/lib/api";

type PerfilPublico = {
  slug_publico: string | null;
  bio: string | null;
  foto_url: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_site: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_primary_color_dark: string | null;
  brand_subdomain: string | null;
};

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim() || "eventosbr.app.br";

export function PerfilPublicoOrganizador() {
  const [perfil, setPerfil] = useState<PerfilPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [bio, setBio] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [instagram, setInstagram] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [site, setSite] = useState("");
  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [brandColorDark, setBrandColorDark] = useState("");
  const [brandSubdomain, setBrandSubdomain] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await apiFetch<PerfilPublico>("/api/produtor/meu-perfil", { cache: "no-store" });
      setPerfil(p);
      setBio(p.bio ?? "");
      setFotoUrl(p.foto_url ?? "");
      setInstagram(p.social_instagram ?? "");
      setWhatsapp(p.social_whatsapp ?? "");
      setSite(p.social_site ?? "");
      setBrandName(p.brand_name ?? "");
      setBrandLogoUrl(p.brand_logo_url ?? "");
      setBrandColor(p.brand_primary_color ?? "");
      setBrandColorDark(p.brand_primary_color_dark ?? "");
      setBrandSubdomain(p.brand_subdomain ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o perfil público.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const r = await apiFetch<{ ok: boolean; slug_publico: string }>("/api/produtor/meu-perfil", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bio: bio.trim() || null,
          foto_url: fotoUrl.trim() || null,
          social_instagram: instagram.trim() || null,
          social_whatsapp: whatsapp.trim() || null,
          social_site: site.trim() || null,
          brand_name: brandName.trim() || null,
          brand_logo_url: brandLogoUrl.trim() || null,
          brand_primary_color: brandColor.trim() || null,
          brand_primary_color_dark: brandColorDark.trim() || null,
          brand_subdomain: brandSubdomain.trim().toLowerCase() || null,
        }),
      });
      setPerfil((prev) => (prev ? { ...prev, slug_publico: r.slug_publico } : prev));
      setSaved(true);
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil público.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Carregando perfil público…</p>;
  }

  const slug = perfil?.slug_publico;

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
      <h2 className="text-lg font-semibold text-zinc-900">Página pública do organizador</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Bio, foto, marca e redes exibidas em <code className="text-xs">/produtor/seu-slug</code>.
      </p>

      {slug ? (
        <p className="mt-2 text-sm">
          <Link href={`/produtor/${slug}`} className="font-medium text-emerald-800 underline">
            Ver página pública
          </Link>
          {brandSubdomain ? (
            <>
              {" · "}
              <span className="text-zinc-600">
                Subdomínio: <strong>{brandSubdomain}.{PLATFORM_DOMAIN}</strong>
              </span>
            </>
          ) : null}
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-sm text-emerald-800" role="status">
          Perfil público salvo.
        </p>
      ) : null}

      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="bio_publica">
            Bio curta
          </label>
          <textarea
            id="bio_publica"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={2000}
            rows={3}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Conte sobre você ou sua produtora"
          />
        </div>

        <ImagemAssetField
          id="foto_url_publica"
          label="Foto ou logo do perfil"
          value={fotoUrl}
          onChange={setFotoUrl}
          uploadUrl="/api/organizador/assets/upload"
        />

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Marca (white-label)</h3>
          <p className="mt-1 text-xs text-zinc-600">
            Personalize cores e subdomínio na sua página pública.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="brand_name">
                Nome da marca
              </label>
              <input
                id="brand_name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Nome exibido na página pública"
              />
            </div>
            <div className="sm:col-span-2">
              <ImagemAssetField
                id="brand_logo_url"
                label="Logo da marca"
                value={brandLogoUrl}
                onChange={setBrandLogoUrl}
                uploadUrl="/api/organizador/assets/upload"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-800" htmlFor="brand_color">
                Cor principal
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="brand_color"
                  type="color"
                  value={brandColor || "#10b981"}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-zinc-300"
                />
                <input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  placeholder="#10b981"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-800" htmlFor="brand_color_dark">
                Cor escura (links)
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="brand_color_dark"
                  type="color"
                  value={brandColorDark || "#047857"}
                  onChange={(e) => setBrandColorDark(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-zinc-300"
                />
                <input
                  value={brandColorDark}
                  onChange={(e) => setBrandColorDark(e.target.value)}
                  placeholder="#047857"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-zinc-800" htmlFor="brand_subdomain">
                Subdomínio
              </label>
              <div className="mt-1 flex items-center gap-1 text-sm">
                <input
                  id="brand_subdomain"
                  value={brandSubdomain}
                  onChange={(e) => setBrandSubdomain(e.target.value.toLowerCase())}
                  className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 font-mono"
                  placeholder="minha-produtora"
                />
                <span className="text-zinc-500">.{PLATFORM_DOMAIN}</span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Visitantes em <strong>{brandSubdomain || "sub"}.{PLATFORM_DOMAIN}</strong> verão sua página pública.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="social_instagram">
              Instagram
            </label>
            <input
              id="social_instagram"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="https://instagram.com/..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-800" htmlFor="social_whatsapp">
              WhatsApp
            </label>
            <input
              id="social_whatsapp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              placeholder="https://wa.me/55..."
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="social_site">
            Site
          </label>
          <input
            id="social_site"
            value={site}
            onChange={(e) => setSite(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="https://..."
          />
        </div>
        <button type="submit" disabled={saving} className="btn-success px-6 py-2 text-sm">
          {saving ? "Salvando…" : "Salvar perfil público"}
        </button>
      </form>
    </section>
  );
}
