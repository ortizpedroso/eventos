type Props = {
  className?: string;
  /** Fundo escuro — wordmark clara. */
  variant?: "default" | "light";
};

/**
 * Logo padrão EventosBR (viewBox 180×44 — mesma proporção de `/logo.svg`).
 * Cores via `--brand-600` (whitelabel).
 */
export function EventosBRDefaultLogo({
  className = "h-9 w-auto max-w-full sm:h-10",
  variant = "default",
}: Props) {
  const eventosFill = variant === "light" ? "#f4f4f5" : "#1c2a33";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 180 44"
      fill="none"
      className={className}
      role="img"
      aria-label="EventosBR"
    >
      <rect width="40" height="40" x="0" y="2" rx="8" fill="var(--brand-600)" />
      <line
        x1="11"
        y1="10"
        x2="11"
        y2="34"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.2"
        strokeDasharray="2.5 2.5"
        strokeLinecap="round"
      />
      <circle cx="1.5" cy="22" r="3.5" fill="#fff" fillOpacity="0.92" />
      <circle cx="38.5" cy="22" r="3.5" fill="#fff" fillOpacity="0.92" />
      <text
        x="20"
        y="26.5"
        textAnchor="middle"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        fontSize="11.5"
        fontWeight="800"
        fill="#fff"
        letterSpacing="0.4"
      >
        EBR
      </text>
      <text
        x="48"
        y="28"
        fontFamily="system-ui,-apple-system,BlinkMacSystemFont,sans-serif"
        fontSize="20"
        fontWeight="700"
      >
        <tspan fill={eventosFill}>Eventos</tspan>
        <tspan fill="var(--brand-600)">BR</tspan>
      </text>
    </svg>
  );
}
