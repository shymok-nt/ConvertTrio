export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export const MAX_PIXELS = 40_000_000;

/** Converts locally at the original dimensions; no crop, resize or rotation. */
export async function transformImage(file: File, format: OutputFormat): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height || width * height > MAX_PIXELS) {
      throw new Error(`Cannot convert ${file.name}: maximum image size is 40 megapixels.`);
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot process this image.");
      if (format === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
      }
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, 1));
      if (!blob || blob.type !== format) throw new Error("Your browser does not support this output format.");
      return blob;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
