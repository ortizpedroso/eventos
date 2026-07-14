import type { ReactNode } from "react";

/** Mantém o rodapé no fim da viewport enquanto centraliza o formulário de login. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8 sm:py-12">
        {children}
      </div>
    </div>
  );
}
