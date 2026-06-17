import Link from "next/link";
import type { Evento } from "@/lib/types";
import { resolveEventoImagemSrc } from "@/lib/evento-imagem-url";

type Props = {
  eventos?: Evento[] | null;
};

export function HomeHeroVisual({ eventos }: Props) {
  const imagens = (eventos ?? [])
    .map((e) => resolveEventoImagemSrc(e.imagem_url))
    .filter(Boolean)
    .slice(0, 4) as string[];

  const bg =
    imagens[0] ??
    "linear-gradient(135deg, rgba(4,120,87,0.15) 0%, rgba(24,24,27,0.05) 50%, rgba(4,120,87,0.08) 100%)";

  return (
    <div
      className="relative mx-auto mt-10 max-w-5xl overflow-hidden rounded-3xl border border-emerald-200/60 shadow-lg"
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={
          imagens[0]
            ? { backgroundImage: `url(${imagens[0]})` }
            : { background: bg }
        }
      />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-zinc-900/30 to-transparent" />
      {imagens.length > 1 ? (
        <div className="absolute bottom-4 right-4 hidden gap-2 sm:flex">
          {imagens.slice(1).map((src, i) => (
            <div
              key={src}
              className="h-16 w-24 overflow-hidden rounded-lg border-2 border-white/40 shadow-md"
              style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
      <div className="relative px-6 py-16 text-center sm:px-12 sm:py-20">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-200">Descubra experiências perto de você</p>
      </div>
    </div>
  );
}
