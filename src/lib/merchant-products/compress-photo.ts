export interface PreparedPhoto { blob: Blob; extension: "webp" | "jpg" }
const originalLimit = 10 * 1024 * 1024;
const targetSize = 350 * 1024;
const uploadLimit = 2 * 1024 * 1024;

export async function compressProductPhoto(file: File): Promise<PreparedPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Formato no compatible.");
  if (file.size > originalLimit) throw new Error("La imagen es demasiado grande.");
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = sourceUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("decode");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    const encode = (type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("encode")), type, quality);
    });
    let result: Blob | null = null;
    let format = "image/webp";
    // Never upscale, use at most 1200 px; reduce dimensions before excessive quality loss.
    for (const edge of [1200, 1000, 840]) {
      const ratio = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.84, 0.76, 0.68]) {
        result = await encode(format, quality);
        if (format === "image/webp" && result.type !== format) {
          format = "image/jpeg";
          result = await encode(format, quality);
        }
        if (!["image/webp", "image/jpeg"].includes(result.type)) throw new Error("encode");
        if (result.size <= targetSize) break;
      }
      if (result && result.size <= targetSize) break;
    }
    if (!result || result.size > uploadLimit) throw new Error("No pudimos reducir suficientemente la imagen. Probá con otra foto.");
    return { blob: result, extension: result.type === "image/webp" ? "webp" : "jpg" };
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("No pudimos reducir")) throw cause;
    throw new Error("No pudimos procesar la imagen. Probá con otra foto.");
  } finally {
    image.src = "";
    URL.revokeObjectURL(sourceUrl);
  }
}
