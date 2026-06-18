/** URLs http(s) ou tel: seguras para links públicos. */
export function resolveUrlPublicaHref(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return null;
  }
  if (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("tel:")) {
    return s.replace(/[\r\n]/g, "");
  }
  return null;
}
