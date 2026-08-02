/** Serializa JSON-LD para embutir em <script type="application/ld+json"> sem XSS. */
export function serializeJsonLdForScript(data: unknown): string {
  const json = JSON.stringify(data);
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/\//g, "\\u002f");
}
