import type { ReactNode } from "react";

import { ContaBanners } from "@/components/conta-banners";

export default function ContaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContaBanners />
      {children}
    </>
  );
}
