export type OrganizerTenant = {
  slug: string;
  subdomain: string;
  nome: string;
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_primary_color_dark: string | null;
};

function apiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

export async function fetchTenantBySubdomain(subdomain: string): Promise<OrganizerTenant | null> {
  try {
    const res = await fetch(
      `${apiOrigin()}/api/public/tenant?subdomain=${encodeURIComponent(subdomain)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as OrganizerTenant;
  } catch {
    return null;
  }
}

export function extractSubdomain(host: string, baseDomain: string): string | null {
  const h = host.split(":")[0]?.toLowerCase() ?? "";
  const base = baseDomain.split(":")[0]?.toLowerCase() ?? "";
  if (!h || !base || h === base || h === `www.${base}`) return null;
  if (!h.endsWith(`.${base}`)) return null;
  const sub = h.slice(0, -(base.length + 1));
  if (!sub || sub.includes(".")) return null;
  return sub;
}
