"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  className?: string;
  showWordmark?: boolean;
  /** "light" para fundos escuros (footer). */
  variant?: "default" | "light";
};

export function EventosBRLogo({ className = "", showWordmark = true, variant = "default" }: Props) {
  const pathname = usePathname();
  const customUrl = process.env.NEXT_PUBLIC_LOGO_URL?.trim();
  const src = customUrl || (variant === "light" ? "/logo-light.svg" : "/logo.svg");

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    }
  }

  return (
    <Link
      href="/"
      scroll
      onClick={onClick}
      aria-label="EventosBR — início"
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <Image
        src={src}
        alt="EventosBR"
        width={248}
        height={52}
        className="h-9 w-auto sm:h-10"
        priority
        unoptimized={src.startsWith("http")}
      />
      {!showWordmark ? <span className="sr-only">EventosBR — início</span> : null}
    </Link>
  );
}
