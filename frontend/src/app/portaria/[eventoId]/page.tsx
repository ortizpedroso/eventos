import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ eventoId: string }>;
  searchParams: Promise<{ k?: string }>;
};

/** Compatibilidade: redireciona ?k= para /portaria/{id}/{token}. */
export default async function PortariaLegacyRedirect({ params, searchParams }: Props) {
  const { eventoId } = await params;
  const { k } = await searchParams;
  const token = k?.trim();
  if (token) {
    redirect(`/portaria/${eventoId}/${encodeURIComponent(token)}`);
  }
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-bold text-zinc-900">Portaria — acesso negado</h1>
      <p className="mt-4 text-sm text-zinc-600">
        Link incompleto. Peça ao organizador o link completo da portaria.
      </p>
    </div>
  );
}
