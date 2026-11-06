export type ImageOptions = {
  format: "image/png" | "image/jpeg" | "image/webp";
  maxDimension: number;
  cropAspect: "none" | "1:1" | "4:3" | "16:9" | "9:16";
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
};

export const MAX_PIXELS = 40_000_000;

/** Decode and convert one image without uploading it. */
export async function transformImage(file: File, options: ImageOptions): Promise<Blob> {
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
    const aspectRatios: Record<Exclude<ImageOptions["cropAspect"], "none">, number> = {
      "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9, "9:16": 9 / 16,
    };
    let cropWidth = width;
    let cropHeight = height;
    if (options.cropAspect !== "none") {
      const target = aspectRatios[options.cropAspect];
      if (width / height > target) cropWidth = Math.min(width, Math.round(height * target));
      else cropHeight = Math.min(height, Math.round(width / target));
    }
    const cropX = Math.floor((width - cropWidth) / 2);
    const cropY = Math.floor((height - cropHeight) / 2);
    const ratio = options.maxDimension > 0 ? Math.min(1, options.maxDimension / Math.max(cropWidth, cropHeight)) : 1;
    const scaledWidth = Math.max(1, Math.round(cropWidth * ratio));
    const scaledHeight = Math.max(1, Math.round(cropHeight * ratio));
    const swap = options.rotation === 90 || options.rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? scaledHeight : scaledWidth;
    canvas.height = swap ? scaledWidth : scaledHeight;
    try {
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser cannot process this image.");
      if (options.format === "image/jpeg") {
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((options.rotation * Math.PI) / 180);
      context.scale(options.flipHorizontal ? -1 : 1, options.flipVertical ? -1 : 1);
      context.drawImage(image, cropX, cropY, cropWidth, cropHeight, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, options.format, 1));
      if (!blob || blob.type !== options.format) {
        throw new Error("Your browser does not support this output format.");
      }
      return blob;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}
