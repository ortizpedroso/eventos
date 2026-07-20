/** Reseta scroll e fixa shell do site antes da hidratação (evita flash do rodapé). */
export function EarlyScrollReset({ nonce }: { nonce?: string }) {
  const script = `
(function () {
  if (typeof window === "undefined") return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function scrollTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  scrollTop();

  var pushState = history.pushState;
  var replaceState = history.replaceState;
  history.pushState = function () {
    pushState.apply(this, arguments);
    scrollTop();
  };
  history.replaceState = function () {
    replaceState.apply(this, arguments);
    scrollTop();
  };
  window.addEventListener("popstate", scrollTop);
})();
`.trim();

  const shellCss = `
html, body { min-height: 100dvh; }
body { display: grid; grid-template-rows: auto 1fr auto; min-height: 100dvh; }
body > main#conteudo-principal { min-height: 0; }
body > footer { align-self: end; }
`.trim();

  return (
    <>
      <style id="eventosbr-shell-layout" nonce={nonce}>
        {shellCss}
      </style>
      <script
        id="eventosbr-early-scroll-reset"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: script }}
      />
    </>
  );
}
