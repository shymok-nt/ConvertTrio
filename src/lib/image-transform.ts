export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export const MAX_PIXELS = 40_000_000;
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 120 * 1024 * 1024;

const SUPPORTED_OUTPUTS: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const SUPPORTED_INPUTS: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/x-ms-bmp",
  "image/avif",
]);

/**
 * Small file-header checks reject mislabeled non-images before browser decoding.
 * This is defense in depth, not a replacement for the browser image decoder.
 */
export async function inspectImageFile(file: File): Promise<void> {
  if (!(file instanceof File)) {
    throw new Error("Select a valid image file.");
  }

  if (file.size === 0 || file.size > MAX_INPUT_BYTES) {
    throw new Error("Each image must be between 1 byte and 20 MB.");
  }

  const header = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => header[index] === byte);

  const isPng = startsWith(137, 80, 78, 71, 13, 10, 26, 10);
  const isJpeg = startsWith(255, 216, 255);
  const isGif = startsWith(71, 73, 70, 56);
  const isBmp = startsWith(66, 77);
  const isWebp =
    startsWith(82, 73, 70, 70) &&
    header[8] === 87 &&
    header[9] === 69 &&
    header[10] === 66 &&
    header[11] === 80;
  const isAvif =
    header[4] === 102 &&
    header[5] === 116 &&
    header[6] === 121 &&
    header[7] === 112 &&
    Array.from({ length: Math.max(0, header.length - 11) }, (_, index) => index + 8)
      .some((index) =>
        header[index] === 97 &&
        header[index + 1] === 118 &&
        header[index + 2] === 105 &&
        header[index + 3] === 102
      );

  if (!isPng && !isJpeg && !isBmp && !isWebp && !isAvif) {
    throw new Error(
      isGif
        ? "GIF input is not supported. Use PNG, JPG, WebP, BMP or AVIF."
        : "This file does not have a supported image signature."
    );
  }

  const detectedType = isPng
    ? "image/png"
    : isJpeg
      ? "image/jpeg"
      : isBmp
        ? "image/bmp"
        : isWebp
          ? "image/webp"
          : "image/avif";

  if (file.type && SUPPORTED_INPUTS.has(file.type)) {
    const normalizedType = file.type === "image/x-ms-bmp" ? "image/bmp" : file.type;
    if (normalizedType !== detectedType) {
      throw new Error("The file content does not match its image format.");
    }
  }
}

/**
 * Conversion is entirely local. Decoding and canvas encoding may still be
 * limited by the user's browser and available device memory.
 */
export async function transformImage(
  file: File,
  format: OutputFormat,
): Promise<Blob> {
  if (!SUPPORTED_OUTPUTS.has(format)) {
    throw new Error("Unsupported output format.");
  }

  await inspectImageFile(file);

  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const width = image.naturalWidth;
    const height = image.naturalHeight;

    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_PIXELS ||
      height > MAX_PIXELS ||
      width * height > MAX_PIXELS
    ) {
      throw new Error("This image exceeds the 40-megapixel safety limit.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    try {
      const context = canvas.getContext("2d", {
        alpha: format !== "image/jpeg",
      });

      if (!context) {
        throw new Error("Your browser cannot process this image.");
      }

      if (format === "image/jpeg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
      }

      context.drawImage(image, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, format, 0.92);
      });

      if (!blob || blob.type !== format) {
        throw new Error("Your browser does not support this output format.");
      }

      if (blob.size === 0 || blob.size > MAX_OUTPUT_BYTES) {
        throw new Error("The converted image is too large to download safely.");
      }

      return blob;
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "EncodingError") {
      throw new Error("Your browser could not decode this image.");
    }

    throw error;
  } finally {
    URL.revokeObjectURL(url);
  }
}
