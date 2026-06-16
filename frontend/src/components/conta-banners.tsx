"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchSession } from "@/lib/api";

export function ContaBanners() {
  const pathname = usePathname();
  const [semSenha, setSemSenha] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const u = await fetchSession();
      if (!cancelled) setSemSenha(Boolean(u && u.tem_senha === false));
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (!semSenha) return null;

  const perfilHref = pathname.startsWith("/organizador") ? "/organizador/perfil" : "/conta/perfil";

  return (
    <div
      className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Proteja sua conta</p>
      <p className="mt-1 text-amber-900">
        Sua conta foi criada na compra rápida sem senha. Defina uma senha no perfil para acessar com
        segurança em outros dispositivos.
      </p>
      <Link
        href={perfilHref}
        className="mt-2 inline-flex text-sm font-medium text-amber-950 underline underline-offset-2"
      >
        Definir senha agora →
      </Link>
    </div>
  );
}
