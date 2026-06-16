import { resolverMetaCategoria } from "@/lib/evento-categorias";

import { EventoCategoriaIcon } from "./evento-categoria-icon";

type Variant = "card" | "hero" | "inline";

type Props = {
  categoria: string;
  variant?: Variant;
  className?: string;
};

const SIZE: Record<Variant, string> = {
  card: "px-2 py-0.5 text-[11px] gap-1",
  hero: "px-2.5 py-0.5 text-xs gap-1.5",
  inline: "px-2.5 py-0.5 text-xs gap-1.5",
};

export function EventoCategoriaBadge({ categoria, variant = "card", className = "" }: Props) {
  const meta = resolverMetaCategoria(categoria);
  const visual =
    variant === "hero" ? meta.hero : meta.badge;

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-medium ring-1 ring-inset ${SIZE[variant]} ${visual} ${className}`}
    >
      <EventoCategoriaIcon categoria={categoria} className={variant === "card" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {categoria}
    </span>
  );
}
