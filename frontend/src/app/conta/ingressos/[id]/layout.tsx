import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Detalhe do ingresso",
};

export default function IngressoDetalheLayout({ children }: { children: ReactNode }) {
  return children;
}
