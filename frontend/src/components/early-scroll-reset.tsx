/** Reseta scroll e fixa shell do site antes da hidratação (evita flash do rodapé). */
export function EarlyScrollReset() {
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
body { display: flex; flex-direction: column; }
body > main#conteudo-principal { flex: 1 1 auto; min-height: 0; }
body > footer { flex-shrink: 0; margin-top: auto; }
`.trim();

  return (
    <>
      <style id="eventosbr-shell-layout">{shellCss}</style>
      <script
        id="eventosbr-early-scroll-reset"
        dangerouslySetInnerHTML={{ __html: script }}
      />
    </>
  );
}
