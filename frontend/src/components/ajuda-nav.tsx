import Link from "next/link";

const links = [
  { href: "/ajuda/como-comprar", label: "Como comprar" },
  { href: "/ajuda/como-criar-evento", label: "Como criar evento" },
  { href: "/ajuda/reembolsos", label: "Reembolsos" },
  { href: "/ajuda/parcelamento-e-taxas", label: "Parcelamento e taxas" },
] as const;

export function AjudaNav({ current }: { current?: string }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2" aria-label="Central de ajuda">
      <Link
        href="/ajuda"
        className={`rounded-full px-3 py-1 text-sm ${current === "/ajuda" ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-700"}`}
      >
        Índice
      </Link>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`rounded-full px-3 py-1 text-sm ${current === l.href ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-700"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
