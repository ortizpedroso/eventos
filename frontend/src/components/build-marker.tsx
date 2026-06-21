/** Marcador de versão do build (verificação de deploy no VPS). */
export function BuildMarker() {
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA?.trim() || "dev";
  return (
    <span className="sr-only" data-eventosbr-build={sha} aria-hidden>
      build-{sha}
    </span>
  );
}
