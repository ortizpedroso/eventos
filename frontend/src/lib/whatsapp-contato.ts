import type { PlatformSettings } from "@/lib/platform-settings";

/** Resolve link wa.me a partir das configurações da plataforma (sem hardcode). */
export function resolveWhatsappHref(
  settings: Pick<PlatformSettings, "social_whatsapp_url" | "contact_phone">,
): string | null {
  const social = settings.social_whatsapp_url?.trim();
  if (social && social !== "#") return social;

  const digits = settings.contact_phone?.replace(/\D/g, "").trim() ?? "";
  if (!digits) return null;

  if (digits.length === 10 || digits.length === 11) {
    return `https://wa.me/55${digits}`;
  }
  if (digits.startsWith("55") && digits.length >= 12) {
    return `https://wa.me/${digits}`;
  }
  return null;
}
