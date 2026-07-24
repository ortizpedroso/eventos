import type { ReactNode } from "react";

import { AuthScrollReset } from "@/components/auth-scroll-reset";

export default function CadastroLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[60vh] min-w-0 flex-1">
      <AuthScrollReset />
      <div className="mx-auto w-full max-w-md py-8 sm:py-12">{children}</div>
    </div>
  );
}
