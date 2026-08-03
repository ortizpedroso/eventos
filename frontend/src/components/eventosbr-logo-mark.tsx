type Props = {
  className?: string;
};

/** Ícone ticket EBR — cores via variáveis de marca (whitelabel). */
export function EventosBRTicketMark({ className = "h-9 w-9 sm:h-10 sm:w-10" }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-hidden
    >
      <rect width="40" height="40" rx="8" fill="var(--brand-600)" />
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
    </svg>
  );
}

type WordmarkProps = {
  className?: string;
  /** Fundo escuro — wordmark claro. */
  variant?: "default" | "light";
};

/** Wordmark EventosBR com «BR» na cor da marca. */
export function EventosBRWordmark({ className = "", variant = "default" }: WordmarkProps) {
  const eventosFill = variant === "light" ? "#f4f4f5" : "#1c2a33";
  return (
    <svg
      className={className}
      viewBox="0 0 132 28"
      fill="none"
      role="img"
      aria-label="EventosBR"
    >
      <text
        x="0"
        y="22"
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
