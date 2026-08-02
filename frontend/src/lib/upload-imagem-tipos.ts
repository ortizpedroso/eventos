/** Tipos de imagem aceitos no upload — alinhado a `app/services/asset_storage.py`. */

export const UPLOAD_IMAGEM_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export const UPLOAD_IMAGEM_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function uploadImagemTipoPermitido(mime: string): boolean {
  return UPLOAD_IMAGEM_MIME.has((mime || "").trim().toLowerCase());
}

export const UPLOAD_IMAGEM_REJEITADO_MSG =
  "Use JPEG, PNG, WebP ou GIF. SVG e ICO não são permitidos por segurança.";
