import { EventoPublicClient } from "./evento-public-client";

export default async function EventoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ atualizado?: string | string[] }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const raw = sp?.atualizado;
  const alteracaoGuardada =
    raw === "1" || (Array.isArray(raw) && raw.includes("1"));
  return <EventoPublicClient slug={slug} alteracaoGuardada={alteracaoGuardada} />;
}
