import Image from "next/image";
import Link from "next/link";

type Props = {
  className?: string;
  showWordmark?: boolean;
};

export function EventosBRLogo({ className = "", showWordmark = true }: Props) {
  const customUrl = process.env.NEXT_PUBLIC_LOGO_URL?.trim();
  const src = customUrl || "/logo.svg";

  return (
    <Link href="/" className={`inline-flex items-center gap-2 ${className}`} aria-label="EventosBR — início">
      <Image src={src} alt="" width={120} height={32} className="h-8 w-auto" priority unoptimized={src.startsWith("http")} />
      {!showWordmark ? <span className="sr-only">EventosBR</span> : null}
    </Link>
  );
}
