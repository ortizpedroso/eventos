import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Props = Omit<ComponentProps<typeof Link>, "prefetch" | "scroll"> & {
  active?: boolean;
  children: ReactNode;
};

/** Link de navegação interna — padrão estável (conta-shell / organizador-shell). */
export function AppNavLink({ active, children, ...props }: Props) {
  return (
    <Link prefetch scroll={false} aria-current={active ? "page" : undefined} {...props}>
      {children}
    </Link>
  );
}
