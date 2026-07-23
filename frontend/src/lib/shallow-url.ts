/** Atualiza a URL sem disparar navegação RSC (evita flash ao filtrar). */
export function replaceUrlShallow(url: string): void {
  if (typeof window === "undefined") return;
  window.history.replaceState(window.history.state, "", url);
}
