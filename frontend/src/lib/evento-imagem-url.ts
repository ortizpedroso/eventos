/**
 * Normaliza e valida `imagem_url` do evento para uso em `<img src>`.
 * Aceita http(s), data:image, URLs protocolo-relativo (//…), www.…, caminhos absolutos (/…),
 * texto com URL embutida (ex.: colagem com espaços ou aspas) e remove pontuação final comum.
 */
export function resolveEventoImagemSrc(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }

  if (/https?:/i.test(s)) {
    s = s.replace(/\r?\n/g, "");
  }

  if (s.toLowerCase().includes("data:image")) {
    s = s.replace(/\r?\n/g, "").trim();
  }

  const lower = s.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("vbscript:") || lower.startsWith("data:")) {
    if (!lower.startsWith("data:image/")) return null;
  }

  if (lower.startsWith("data:image/")) return s;
  if (lower.startsWith("https://") || lower.startsWith("http://")) return stripTrailingUrlJunk(s);
  if (s.startsWith("//")) return stripTrailingUrlJunk(`https:${s}`);
  if (/^www\./i.test(s)) return stripTrailingUrlJunk(`https://${s}`);

  if (s.startsWith("/") && !s.startsWith("//")) {
    const pathOnly = (s.split(/[\s"'<>]/)[0] ?? s).trim();
    return pathOnly || null;
  }

  const embedded = s.match(/\bhttps?:\/\/[^\s"'<>()]+/i);
  if (embedded) {
    const u = stripTrailingUrlJunk(embedded[0]);
    const low = u.toLowerCase();
    if (!low.startsWith("javascript:") && !low.startsWith("vbscript:")) return u;
  }

  return null;
}

function stripTrailingUrlJunk(url: string): string {
  return url.replace(/["')\]]+$/g, "").replace(/[.,;]+\s*$/g, "").trim();
}
