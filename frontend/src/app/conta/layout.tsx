import type { ReactNode } from "react";

import { ContaBanners } from "@/components/conta-banners";
import { ContaShell } from "@/components/conta-shell";

export default function ContaLayout({ children }: { children: ReactNode }) {
  return (
    <ContaShell>
      <ContaBanners />
      {children}
    </ContaShell>
  );
}
