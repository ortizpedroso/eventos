import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Referência da API",
  description:
    "Referência das rotas da API EventosBR (OpenAPI), geradas a partir do backend FastAPI: autenticação, eventos, ingressos, pagamentos Asaas e mais.",
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
};

type OpenApiSpec = {
  info?: { title?: string; version?: string; description?: string };
  paths?: Record<string, Record<string, OpenApiOperation>>;
};

const METODOS_ORDEM = ["get", "post", "put", "patch", "delete"] as const;

const METODO_COR: Record<string, string> = {
  get: "bg-emerald-100 text-emerald-800",
  post: "bg-blue-100 text-blue-800",
  put: "bg-amber-100 text-amber-800",
  patch: "bg-amber-100 text-amber-800",
  delete: "bg-red-100 text-red-800",
};

async function carregarSpec(): Promise<OpenApiSpec | null> {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  try {
    const res = await fetch(`${site}/openapi.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as OpenApiSpec;
  } catch {
    return null;
  }
}

export default async function ApiReferenciaPage() {
  const spec = await carregarSpec();

  const porTag = new Map<string, { metodo: string; path: string; op: OpenApiOperation }[]>();
  if (spec?.paths) {
    for (const [path, metodos] of Object.entries(spec.paths)) {
      for (const metodo of METODOS_ORDEM) {
        const op = metodos[metodo];
        if (!op) continue;
        const tag = op.tags?.[0] || "Outros";
        if (!porTag.has(tag)) porTag.set(tag, []);
        porTag.get(tag)!.push({ metodo, path, op });
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
        Para integradores
      </p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl">
        Referência da API
      </h1>
      <p className="mt-4 text-base text-zinc-700">
        {spec?.info?.description ||
          "API da EventosBR: eventos, ingressos, pagamentos PIX/cartão via Asaas, repasse a organizadores e reembolsos automáticos."}
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        Versão {spec?.info?.version || "1.0.0"} · Esquema completo em{" "}
        <a href="/openapi.json" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
          /openapi.json
        </a>
        .
      </p>
      <p className="mt-4 text-sm text-zinc-600">
        <Link href="/documentacao" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
          ← Voltar à documentação
        </Link>
      </p>

      {!spec ? (
        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Não foi possível carregar o esquema OpenAPI agora. Regenere com{" "}
          <code className="rounded bg-white px-1.5 py-0.5">python3 scripts/export-openapi.py</code>.
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {[...porTag.entries()]
            .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
            .map(([tag, rotas]) => (
              <section key={tag}>
                <h2 className="text-lg font-bold text-zinc-900">{tag}</h2>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white shadow-sm">
                  {rotas.map(({ metodo, path, op }) => (
                    <li key={`${metodo}-${path}`} className="flex flex-wrap items-start gap-3 p-4">
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                          METODO_COR[metodo] || "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {metodo}
                      </span>
                      <code className="shrink-0 font-mono text-sm text-zinc-800">{path}</code>
                      {op.summary ? (
                        <span className="text-sm text-zinc-600">{op.summary}</span>
                      ) : null}
                      {op.deprecated ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                          Descontinuado
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
