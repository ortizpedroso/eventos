export type PlatformSettings = {
  site_name: string;
  site_tagline: string | null;
  footer_description: string | null;
  contact_email: string | null;
  support_email: string | null;
  logo_url: string | null;
  logo_light_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  primary_color_dark: string;
  social_instagram_url: string | null;
  social_whatsapp_url: string | null;
  social_linkedin_url: string | null;
  social_x_url: string | null;
  social_youtube_url: string | null;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  site_name: "EventosBR",
  site_tagline: "INGRESSOS · SHOWS · TRANSPARÊNCIA",
  footer_description:
    "Ingressos, reembolsos e repasses com transparência — do primeiro clique ao dia do evento.",
  contact_email: process.env.NEXT_PUBLIC_EMAIL_CONTATO?.trim() || null,
  support_email: process.env.NEXT_PUBLIC_EMAIL_DENUNCIAS?.trim() || null,
  logo_url: process.env.NEXT_PUBLIC_LOGO_URL?.trim() || null,
  logo_light_url: null,
  favicon_url: null,
  primary_color: "#10b981",
  primary_color_dark: "#047857",
  social_instagram_url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL?.trim() || null,
  social_whatsapp_url: process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP_URL?.trim() || null,
  social_linkedin_url: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN_URL?.trim() || null,
  social_x_url: process.env.NEXT_PUBLIC_SOCIAL_X_URL?.trim() || null,
  social_youtube_url: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE_URL?.trim() || null,
};

function apiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

/** Busca branding da plataforma (SSR / server components). */
export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  try {
    const res = await fetch(`${apiOrigin()}/api/public/platform`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return DEFAULT_PLATFORM_SETTINGS;
    return (await res.json()) as PlatformSettings;
  } catch {
    return DEFAULT_PLATFORM_SETTINGS;
  }
}
