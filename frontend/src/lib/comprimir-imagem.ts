"use client";

/**
 * Redimensiona e comprime uma imagem no navegador antes do upload — reduz o
 * tamanho do arquivo sem perder qualidade perceptível, e sem exigir que o
 * usuário edite a imagem manualmente antes de enviar.
 *
 * - SVG passa direto (é vetor, não faz sentido rasterizar/comprimir).
 * - Preserva transparência: usa WebP (com alpha) em vez de JPEG.
 * - Só redimensiona se a imagem for maior que o alvo — nunca aumenta.
 * - Se o resultado comprimido ficar maior que o original (raro, arquivos já
 *   pequenos), mantém o original.
 */
export async function comprimirImagem(
  file: File,
  { maxWidth, maxHeight, qualidade = 0.86 }: { maxWidth: number; maxHeight: number; qualidade?: number },
): Promise<File> {
  if (file.type === "image/svg+xml") return file;
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // formato que o navegador não consegue decodificar via bitmap — envia como está
  }

  try {
    const escala = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
    const largura = Math.max(1, Math.round(bitmap.width * escala));
    const altura = Math.max(1, Math.round(bitmap.height * escala));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", qualidade),
    );
    if (!blob) return file;
    if (blob.size >= file.size && escala === 1) return file; // já era pequena, não vale a pena trocar formato

    const novoNome = file.name.replace(/\.[^./]+$/, "") + ".webp";
    return new File([blob], novoNome, { type: "image/webp" });
  } finally {
    bitmap.close();
  }
}
