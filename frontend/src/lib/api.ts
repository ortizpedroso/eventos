import { dispatchAuthSync } from "@/lib/auth-sync";

export type ApiError = {
  detail?: unknown;
};

/**
 * Origem da API sem barra final e sem sufixo `/api`.
 * Evita URLs como `http://host:8000/api` + `/api/auth/me` → 404 (path duplicado).
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
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return "";
  const normalized = normalizeApiOrigin(raw);
  if (typeof window === "undefined") return normalized;
  const pageHost = window.location.hostname;
  const pageIsLoopback = pageHost === "localhost" || pageHost === "127.0.0.1";
  const apiHost = normalized.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  const apiIsLoopback = apiHost === "localhost" || apiHost === "127.0.0.1";
  /* Em dev no PC, usar proxy /api do Next (evita CORS e liga à INTERNAL_API_URL). */
  if (process.env.NODE_ENV === "development" && pageIsLoopback) {
    return "";
  }
  /* Telemóvel em 192.168.x.x + API em localhost:8000 quebraria (localhost = o próprio telemóvel). */
  if (apiIsLoopback && !pageIsLoopback) {
    return "";
  }
  return normalized;
}

/** No servidor Next: prioriza INTERNAL (ex.: Docker `http://api:8000`). */
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

/** Base da API (sem `/api` final). Útil para `fetch` manual (ex.: download CSV). */
export function getApiBaseUrl(): string {
  return getBaseUrl();
}

function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("eventosbr_token");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");

  const token = getToken();
  if (token) headers.set("authorization", `Bearer ${token}`);

  const base = getBaseUrl();
  const url = `${base}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch {
    throw new Error(
      "Não foi possível contactar a API. Confirme que o backend está a correr (porta 8000): " +
        "com Docker use `docker compose up -d` na raiz do projeto; em local use `uvicorn app.main:app --host 127.0.0.1 --port 8000`.",
    );
  }

  if (res.status === 401 && token && typeof window !== "undefined") {
    window.localStorage.removeItem("eventosbr_token");
    dispatchAuthSync();
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

  return (await res.json()) as T;
}

