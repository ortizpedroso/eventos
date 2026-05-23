export async function validateAdminKey(key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) throw new Error("Informe a chave de administrador.");
  const res = await fetch("/api/admin/session", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ key: trimmed }),
    credentials: "include",
  });
  if (res.status === 401) {
    throw new Error("Chave de administrador inválida. Confira PLATFORM_ADMIN_API_KEY no .env da API.");
  }
  if (!res.ok) {
    let msg = `API respondeu ${res.status}.`;
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) msg = String(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}

export async function clearAdminSession(): Promise<void> {
  await fetch("/api/admin/session", { method: "DELETE", credentials: "include" });
}

export async function adminSessionActive(): Promise<boolean> {
  const res = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
  if (!res.ok) return false;
  const j = (await res.json()) as { unlocked?: boolean };
  return Boolean(j.unlocked);
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const clean = path.startsWith("/api/admin/") ? path.slice("/api/admin/".length) : path.replace(/^\//, "");
  const res = await fetch(`/api/admin/proxy/${clean}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
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
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
