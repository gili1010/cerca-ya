import { compressPhoto, type PreparedPhoto } from "./merchant-products/compress-photo";
import type { StoreAssetKind } from "./business-assets";

export type StoreImageFit = "contain" | "cover";

// Prepare the exact image shown in the preview; no framing settings need saving.
export async function prepareStoreImage(file: File, kind: StoreAssetKind, fit: StoreImageFit = "contain"): Promise<PreparedPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Usá una imagen JPEG, PNG o WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("La imagen puede pesar hasta 10 MB.");
  let sourceUrl = "";
  const image = new Image();
  try {
    sourceUrl = URL.createObjectURL(file);
    image.src = sourceUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("decode");
    const ratio = kind === "logo" ? 1 : 4;
    const crop = kind === "cover" && fit === "cover";
    // Choose a frame that never enlarges the original pixels.
    const naturalFrameWidth = crop
      ? Math.min(image.naturalWidth, image.naturalHeight * ratio)
      : Math.max(image.naturalWidth, image.naturalHeight * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(4, Math.floor(Math.min(kind === "logo" ? 640 : 1800, naturalFrameWidth)));
    canvas.height = Math.max(1, Math.round(canvas.width / ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const inset = kind === "logo" ? canvas.width * 0.08 : 0;
    const scale = crop
      ? Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight)
      : Math.min((canvas.width - inset * 2) / image.naturalWidth, (canvas.height - inset * 2) / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    const framed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("encode")), "image/png");
    });
    return await compressPhoto(new File([framed], "store-image.png", { type: "image/png" }),
      kind === "logo" ? { edges: [640, 512, 400], targetSize: 180 * 1024 } : { edges: [1800, 1500, 1200], targetSize: 650 * 1024 });
  } catch {
    throw new Error("No pudimos preparar la imagen. Probá con otra foto.");
  } finally {
    image.src = "";
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  }
}
