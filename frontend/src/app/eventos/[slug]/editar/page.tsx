import { EditarEventoClient } from "./editar-client";

export default async function EditarEventoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <EditarEventoClient slug={slug} />;
}
