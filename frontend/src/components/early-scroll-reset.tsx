/** CSS crítico do shell (grid + rodapé) antes da hidratação — sem monkey-patch de history. */
export function EarlyScrollReset({ nonce }: { nonce?: string }) {
  return (
    <style id="eventosbr-shell-layout" nonce={nonce}>
      {`
html, body { min-height: 100dvh; }
body { display: grid; grid-template-rows: auto 1fr auto; min-height: 100dvh; }
body > main#conteudo-principal { min-height: 0; }
body > footer { align-self: end; }
`.trim()}
    </style>
  );
}
