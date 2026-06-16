import { resolverMetaCategoria } from "@/lib/evento-categorias";

type Props = {
  categoria: string;
  className?: string;
};

export function EventoCategoriaIcon({ categoria, className = "h-3.5 w-3.5" }: Props) {
  const { icon } = resolverMetaCategoria(categoria);
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
    </svg>
  );
}
