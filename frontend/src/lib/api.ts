import { dispatchAuthSync } from "@/lib/auth-sync";
import { mensagemErroHttp } from "@/lib/api-errors";
import type { Usuario } from "@/lib/types";

/** Cache em memória — evita skeleton ao navegar no painel após /me já ter carregado. */
let sessionCache: Usuario | null | undefined;

export function peekSessionCache(): Usuario | null | undefined {
  return sessionCache;
}

export function clearSessionCache(): void {
  sessionCache = undefined;
}

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const user = await apiFetch<Usuario>("/api/auth/me", {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);
    sessionCache = user;
    return user;
  } catch {
    sessionCache = null;
    return null;
  }
}

export async function logoutSession(): Promise<void> {
  try {
    await apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  sessionCache = null;
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
  // Corpo string (ex. JSON.stringify) sem Content-Type explícito: o fetch do browser
  // assume "text/plain;charset=UTF-8", e o FastAPI só faz parse como JSON quando o
  // Content-Type é ausente ou application/json — caso contrário o Pydantic recebe os
  // bytes crus e falha com "Input should be a valid dictionary or object...".
  if (init.body !== undefined && init.body !== null && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

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
    if (pathOnly !== "/api/auth/me") {
      dispatchAuthSync();
      const here = window.location.pathname + window.location.search;
      if (
        (here.startsWith("/conta") || here.startsWith("/organizador")) &&
        !here.startsWith("/auth")
      ) {
        const login = new URL("/auth", window.location.origin);
        login.searchParams.set("next", here);
        login.searchParams.set("expirado", "1");
        window.location.assign(login.toString());
      }
    }
  }

  if (!res.ok) {
    let data: ApiError | null = null;
    try {
      data = (await res.json()) as ApiError;
    } catch {
      // ignore
    }
    throw new Error(mensagemErroHttp(res.status, data?.detail));
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
