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

  if (!stats || (stats.eventos_publicados < 1 && stats.ingressos_confirmados < 1)) {
    return null;
  }

  return (
    <div className="mx-auto mt-10 max-w-2xl">
      <p className="text-center text-sm text-zinc-600">
        {stats.eventos_publicados > 0 ? (
          <>
            <strong className="text-zinc-900">{stats.eventos_publicados.toLocaleString("pt-BR")}</strong>{" "}
            eventos publicados
          </>
        ) : null}
        {stats.eventos_publicados > 0 && stats.ingressos_confirmados > 0 ? " · " : null}
        {stats.ingressos_confirmados > 0 ? (
          <>
            <strong className="text-zinc-900">
              {stats.ingressos_confirmados.toLocaleString("pt-BR")}
            </strong>{" "}
            ingressos confirmados
          </>
        ) : null}
      </p>
    </div>
  );
}
