/** Recomendações para imagem de capa / banner na página pública do evento. */
export const EVENTO_BANNER_RECOMMENDED = {
  /** Proporção alvo (largura : altura), p.ex. hero 16:9 */
  ratioLabel: "16:9",
  widthIdeal: 1920,
  heightIdeal: 1080,
  widthMin: 1200,
  heightMin: 675,
} as const;

export const EVENTO_BANNER_HELP_SHORT = `Banner: ideal ${EVENTO_BANNER_RECOMMENDED.widthIdeal}×${EVENTO_BANNER_RECOMMENDED.heightIdeal}px (${EVENTO_BANNER_RECOMMENDED.ratioLabel}), JPG ou WebP.`;

/** Texto fixo para a caixa de requisitos na página de criar/editar evento */
export const EVENTO_BANNER_MEDIDAS_RESUMO = [
  `Proporção ${EVENTO_BANNER_RECOMMENDED.ratioLabel} (ex.: cartaz horizontal).`,
  `Ideal: ${EVENTO_BANNER_RECOMMENDED.widthIdeal}×${EVENTO_BANNER_RECOMMENDED.heightIdeal}px.`,
  `Mínimo sugerido: ${EVENTO_BANNER_RECOMMENDED.widthMin}×${EVENTO_BANNER_RECOMMENDED.heightMin}px (para não pixelizar no banner e na vitrine).`,
] as const;
