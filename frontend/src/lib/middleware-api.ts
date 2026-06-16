/** Origem interna da API para validação de sessão no middleware (Edge). */
export function middlewareApiOrigin(): string {
  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) return internal.replace(/\/+$/, "").replace(/\/api$/, "");
  const pub = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (pub) return pub.replace(/\/+$/, "").replace(/\/api$/, "");
  return "http://127.0.0.1:8000";
}

export type MiddlewareSession = {
  ok: boolean;
  tipo?: string;
};

export async function fetchMiddlewareSession(
  sessionCookie: string,
): Promise<MiddlewareSession> {
  const base = middlewareApiOrigin();
  try {
    const res = await fetch(`${base}/api/auth/me`, {
      headers: {
        accept: "application/json",
        cookie: `eventosbr_session=${sessionCookie}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const user = (await res.json()) as { tipo?: string };
    return { ok: true, tipo: user.tipo };
  } catch {
    return { ok: false };
  }
}
