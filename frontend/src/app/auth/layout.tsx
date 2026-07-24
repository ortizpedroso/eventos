import type { ReactNode } from "react";

/** Mesmo padrão da coluna de conteúdo em conta-shell — altura mínima estável, sem centralizar (evita salto do rodapé). */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[60vh] min-w-0 flex-1">
      <div className="mx-auto w-full max-w-md py-8 sm:py-12">{children}</div>
    </div>
  );
}
