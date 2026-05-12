import { EventoPublicClient } from "./evento-public-client";

export default async function EventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EventoPublicClient slug={slug} />;
}
