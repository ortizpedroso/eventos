import type { Metadata } from "next";
import { ProdutorPublicClient } from "./produtor-public-client";

type Props = { params: Promise<{ slug: string }> };

export const metadata: Metadata = { title: "Produtor | EventosBR" };

export default async function ProdutorPage({ params }: Props) {
  const { slug } = await params;
  return <ProdutorPublicClient slug={slug} />;
}
