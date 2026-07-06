import { apiFetch } from "@/lib/api";

type Stats = {
  eventos_publicados: number;
  ingressos_confirmados: number;
};

export async function HomeProvaSocial() {
  let stats: Stats | null = null;
  try {
    stats = await apiFetch<Stats>("/api/eventos/stats-publicas", { cache: "no-store" });
  } catch {
    stats = null;
  }

  const temStats =
    stats && (stats.eventos_publicados > 0 || stats.ingressos_confirmados > 0);

  return (
    <div className="mx-auto mt-10 max-w-2xl" role="status" aria-label="Números da plataforma">
      {temStats ? (
        <p className="text-center text-sm text-zinc-700">
          {stats!.eventos_publicados > 0 ? (
            <>
              <strong className="text-zinc-900">
                {stats!.eventos_publicados.toLocaleString("pt-BR")}
              </strong>{" "}
              eventos publicados
            </>
          ) : null}
          {stats!.eventos_publicados > 0 && stats!.ingressos_confirmados > 0 ? " · " : null}
          {stats!.ingressos_confirmados > 0 ? (
            <>
              <strong className="text-zinc-900">
                {stats!.ingressos_confirmados.toLocaleString("pt-BR")}
              </strong>{" "}
              ingressos confirmados
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-center text-sm text-zinc-700">
          Plataforma segura com <strong className="text-zinc-900">HTTPS</strong>, pagamentos via{" "}
          <strong className="text-zinc-900">PIX e cartão</strong> e check-in por QR Code.
        </p>
      )}

      <ul
        className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium uppercase tracking-wide text-zinc-500"
        aria-label="Diferenciais da plataforma"
      >
        <li>Repasse direto</li>
        <li>Reembolso automático</li>
        <li>Sem mensalidade obrigatória</li>
      </ul>
    </div>
  );
}
