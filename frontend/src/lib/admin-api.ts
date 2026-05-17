import { getApiBaseUrl } from "@/lib/api";

export const ADMIN_KEY_STORAGE = "eventosbr_platform_admin_key";

export function getAdminKey(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(ADMIN_KEY_STORAGE)?.trim() ?? "";
}

export function setAdminKey(key: string) {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key.trim());
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error("Informe a chave de administrador.");
  const headers = new Headers(init.headers);
  headers.set("X-Platform-Admin-Key", key);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const res = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) msg = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}
