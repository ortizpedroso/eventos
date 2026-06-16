import { dispatchAuthSync } from "@/lib/auth-sync";
import type { Usuario } from "@/lib/types";

export type ApiError = {
  detail?: unknown;
};

/**
 * Origem da API sem barra final e sem sufixo `/api`.
 */
function normalizeApiOrigin(raw: string): string {
  let u = raw.trim().replace(/\/+$/, "");
  if (u.endsWith("/api")) {
    u = u.slice(0, -4).replace(/\/+$/, "");
  }
  return u;
}

/** No browser: vazio = mesma origem (Next reescreve `/api/*` para o backend). */
function getPublicApiUrl(): string {
  if (typeof window === "undefined") {
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
    return raw ? normalizeApiOrigin(raw) : "";
  }
  // Cliente sempre usa o proxy `/api` do Next — evita fetch direto a localhost:8000
  // ou hostnames Docker (`api`) que falham no browser.
  return "";
}

function getServerApiUrl(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return normalizeApiOrigin(internal);
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return normalizeApiOrigin(pub);
  return "http://127.0.0.1:8000";
}

function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return getPublicApiUrl();
  }
  return getServerApiUrl();
}

export function getApiBaseUrl(): string {
  return getBaseUrl();
}

export async function fetchSession(): Promise<Usuario | null> {
  try {
    return await apiFetch<Usuario>("/api/auth/me", { cache: "no-store" });
  } catch {
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    dispatchAuthSync();
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const base = getBaseUrl();
  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Não foi possível contactar a API. Confirme que o backend está a correr (porta 8000): " +
        "com Docker use `docker compose up -d` na raiz do projeto; em local use `uvicorn app.main:app --host 127.0.0.1 --port 8000`.",
    );
  }

  if (res.status === 401 && typeof window !== "undefined") {
    const pathOnly = path.split("?")[0];
    // /me retorna 401 quando não há sessão — não disparar sync em loop.
    if (pathOnly !== "/api/auth/me") {
      dispatchAuthSync();
    }
  }

  if (!res.ok) {
    let data: ApiError | null = null;
    try {
      data = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    let message: string;
    if (typeof data?.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      const items = data.detail as { loc?: unknown[]; msg?: string }[];
      message = items
        .map((e) => {
          const loc = Array.isArray(e.loc)
            ? e.loc
                .filter((x) => x !== "body" && typeof x === "string")
                .join(".")
            : "";
          const m = e.msg ?? "inválido";
          return loc ? `${loc}: ${m}` : m;
        })
        .join("; ");
    } else if (res.status >= 500) {
      message =
        "A API não respondeu corretamente. Confirme que o backend está a correr na porta 8000 " +
        "(na raiz do projeto: `docker compose up -d db redis api`).";
    } else {
      message = `Request failed: ${res.status}`;
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
