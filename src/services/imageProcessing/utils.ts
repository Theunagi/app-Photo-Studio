/**
 * Shared image processing utilities using Canvas 2D API.
 */

/**
 * Load an image from a data URL into an HTMLImageElement.
 */
export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = ''; // Cancel load
      reject(new Error('Image loading timed out after 30s'));
    }, 30_000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Failed to load image')); };
    img.src = dataUrl;
  });
}

/**
 * Create a canvas from an image data URL, returning the canvas and its 2D context.
 */
export async function imageToCanvas(dataUrl: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');
  ctx.drawImage(img, 0, 0);
  return { canvas, ctx, width: canvas.width, height: canvas.height };
}

/**
 * Get ImageData from a data URL.
 */
export async function getImageData(dataUrl: string): Promise<{
  imageData: ImageData;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}> {
  const { canvas, ctx, width, height } = await imageToCanvas(dataUrl);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { imageData, canvas, ctx };
}

/**
 * Convert a canvas to a Blob (PNG).
 */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob returned null'));
      },
      type,
      1.0
    );
  });
}

/**
 * Convert a canvas to a data URL.
 */
export function canvasToDataUrl(canvas: HTMLCanvasElement, type = 'image/png'): string {
  return canvas.toDataURL(type, 1.0);
}

/**
 * Convert a Blob to a data URL.
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader returned non-string result'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert a data URL to a Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error('Invalid data URL: missing comma separator');
  const header = dataUrl.slice(0, commaIdx);
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  try {
    const bstr = atob(dataUrl.slice(commaIdx + 1));
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  } catch (err) {
    throw new Error(`Failed to decode data URL: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Rebuild a cutout using Bria's alpha mask but the original retouched RGB.
 * Bria can degrade white product colors during background removal;
 * this preserves exact pixel colors from the retouched image.
 */
export async function rebuildCutoutWithOriginalRgb(
  cutoutDataUrl: string,
  retouchedDataUrl: string,
): Promise<{ imageDataUrl: string; imageBlob: Blob }> {
  const { imageData: cutoutData } = await getImageData(cutoutDataUrl);
  const { imageData: retouchData } = await getImageData(retouchedDataUrl);
  const { width, height } = cutoutData;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const output = ctx.createImageData(width, height);

  for (let i = 0; i < cutoutData.data.length; i += 4) {
    // Alpha from Bria (shape of the product)
    const alpha = cutoutData.data[i + 3];
    // RGB from the retouched image (untouched colors)
    output.data[i]     = retouchData.data[i];
    output.data[i + 1] = retouchData.data[i + 1];
    output.data[i + 2] = retouchData.data[i + 2];
    output.data[i + 3] = alpha;
  }

  ctx.putImageData(output, 0, 0);
  const imageDataUrl = canvasToDataUrl(canvas);
  const imageBlob = await canvasToBlob(canvas);
  return { imageDataUrl, imageBlob };
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the luminance (0-255) of an RGB pixel.
 * Uses ITU-R BT.601 weights.
 */
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
