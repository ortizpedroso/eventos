import Link from "next/link";

const links = [
  { href: "/ajuda", label: "Índice" },
  { href: "/ajuda/como-comprar", label: "Como comprar" },
  { href: "/ajuda/como-criar-evento", label: "Como criar evento" },
  { href: "/ajuda/reembolsos", label: "Reembolsos" },
  { href: "/ajuda/parcelamento-e-taxas", label: "Parcelamento e taxas" },
  { href: "/ajuda/pagamentos-e-seguranca", label: "Pagamentos e segurança" },
] as const;

/** Mesma formatação de texto do Índice em todos os botões da nav. */
const navLinkClass = (active: boolean) =>
  [
    "ajuda-nav-link rounded-full px-3 py-1 text-sm font-medium no-underline",
    active ? "bg-emerald-100 text-emerald-900" : "bg-zinc-100 text-zinc-700",
  ].join(" ");

export function AjudaNav({ current }: { current?: string }) {
  return (
    <nav className="ajuda-nav mb-8 flex flex-wrap gap-2" aria-label="Central de ajuda">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={navLinkClass(current === l.href)}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
