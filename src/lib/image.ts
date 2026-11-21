import { MAX_PHOTO_BYTES } from "./photos";

/** Erreur de lecture d'image côté navigateur (format illisible, ex. HEIC hors Safari) */
export class ImageReadError extends Error {}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // L'orientation EXIF des photos de téléphone est appliquée (comportement par défaut)
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* repli sur <img> ci-dessous */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageReadError("unreadable");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Réduit une photo avant l'envoi : 1280 px au plus sur le grand côté, WebP (ou JPEG si le navigateur
 * ne sait pas encoder le WebP). Une photo de téléphone de 4 à 8 Mo passe ainsi sous 300 Ko environ.
 */
export async function compressImage(file: Blob, maxSide = 1280): Promise<Blob> {
  const img = await decode(file);
  try {
    for (const [side, quality] of [[maxSide, 0.82], [1024, 0.72], [800, 0.65]] as const) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageReadError("no-canvas");
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
      let blob = await toBlob(canvas, "image/webp", quality);
      if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
      if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
    }
    throw new ImageReadError("too-large");
  } finally {
    img.close();
  }
}
