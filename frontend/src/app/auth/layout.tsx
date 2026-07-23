import type { ReactNode } from "react";

/**
 * Altura estável — evita o rodapé “pular” ao vir de páginas altas (planos, home).
 * Formulário alinhado ao topo; o grid do body mantém o footer na 3ª linha.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md flex-1 py-8 sm:py-12">
      {children}
    </div>
  );
}
