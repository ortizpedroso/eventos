import { PdvPresencialClient } from "./pdv-presencial-client";

export const metadata = {
  title: "PDV / Venda presencial | Organizador",
};

type Props = { params: Promise<{ id: string }> };

export default async function PdvPresencialPage({ params }: Props) {
  const { id } = await params;
  return <PdvPresencialClient eventoId={id} />;
}
