"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";

type PerfilPublico = {
  slug_publico: string | null;
  bio: string | null;
  foto_url: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_site: string | null;
};

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
        Bio, foto e redes exibidas em <code className="text-xs">/produtor/seu-slug</code>.
      </p>

      {slug ? (
        <p className="mt-2 text-sm">
          <Link href={`/produtor/${slug}`} className="font-medium text-emerald-800 underline">
            Ver página pública
          </Link>
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

      <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
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
        <div>
          <label className="text-sm font-medium text-zinc-800" htmlFor="foto_url_publica">
            URL da foto ou logo
          </label>
          <input
            id="foto_url_publica"
            value={fotoUrl}
            onChange={(e) => setFotoUrl(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            placeholder="https://..."
          />
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
