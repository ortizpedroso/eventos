type Props = {
  src: string;
  alt: string;
  /** ring-* Tailwind class for the frame */
  ringClass?: string;
  priority?: boolean;
};

/**
 * Screenshots estáticos em /public/marketing — servidos direto, sem next/image,
 * para evitar caixas vazias quando o otimizador falha ou o asset no deploy é antigo.
 */
export function MarketingScreenshot({
  src,
  alt,
  ringClass = "ring-emerald-200",
  priority = false,
}: Props) {
  return (
    <div
      className={`relative aspect-[8/5] w-full overflow-hidden rounded-2xl shadow-xl ring-1 ${ringClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={800}
        height={500}
        className="h-full w-full object-cover"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
      />
    </div>
  );
}
