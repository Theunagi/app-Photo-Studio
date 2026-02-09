/**
 * Step 6: Smart Shadow Composer
 *
 * Extracts the natural contact shadow from the white-background retouched image
 * and composites it under the cutout product for photorealistic grounding.
 *
 * Algorithm:
 * 1. Luma Keying: Scan white-bg image. Pixels with luminance < 245 are shadow.
 * 2. Extraction: Alpha = (255 - Luminance) * Opacity (0.8)
 * 3. Masking: Use cutout bounding box to limit shadow region (avoid edge artifacts).
 * 4. Blur: Gaussian blur 8px on shadow mask.
 * 5. Composite: Shadow layer (Multiply) + Product layer (Normal).
 */

import { getLuminance, getImageData, canvasToBlob, canvasToDataUrl } from './utils';

export interface ShadowComposerResult {
  imageBlob: Blob;
  imageDataUrl: string;
}

/**
 * Find the bounding box of non-transparent pixels in an RGBA ImageData.
 */
function findBoundingBox(imageData: ImageData): { minX: number; minY: number; maxX: number; maxY: number } {
  const { data, width, height } = imageData;
  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Apply a fast box blur approximation of Gaussian blur to a single-channel buffer.
 * 3 passes of box blur approximates Gaussian.
 */
function boxBlur(buffer: Float32Array, width: number, height: number, radius: number): Float32Array {
  const passes = 3;
  let src: Float32Array = buffer;
  let dst: Float32Array = new Float32Array(width * height);

  for (let pass = 0; pass < passes; pass++) {
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      let sum = 0;
      const size = radius * 2 + 1;

      // Initialize window
      for (let x = -radius; x <= radius; x++) {
        const cx = Math.max(0, Math.min(width - 1, x));
        sum += src[y * width + cx];
      }
      dst[y * width] = sum / size;

      for (let x = 1; x < width; x++) {
        const addIdx = Math.min(width - 1, x + radius);
        const removeIdx = Math.max(0, x - radius - 1);
        sum += src[y * width + addIdx] - src[y * width + removeIdx];
        dst[y * width + x] = sum / size;
      }
    }

    // Swap for vertical pass
    const tmpH = src;
    src = dst;
    dst = tmpH;

    // Vertical pass
    for (let x = 0; x < width; x++) {
      let sum = 0;
      const size = radius * 2 + 1;

      for (let y = -radius; y <= radius; y++) {
        const cy = Math.max(0, Math.min(height - 1, y));
        sum += src[cy * width + x];
      }
      dst[x] = sum / size;

      for (let y = 1; y < height; y++) {
        const addIdx = Math.min(height - 1, y + radius);
        const removeIdx = Math.max(0, y - radius - 1);
        sum += src[addIdx * width + x] - src[removeIdx * width + x];
        dst[y * width + x] = sum / size;
      }
    }

    const tmpV = src;
    src = dst;
    dst = tmpV;
  }

  return src;
}

/**
 * Compose the final image: shadow layer (Multiply blend) + cutout product (Normal blend).
 *
 * @param whiteBgDataUrl - Retouched image on white background (Step 4 output)
 * @param cutoutDataUrl - Cutout product with transparency (Step 5 output)
 * @param shadowOpacity - Shadow opacity multiplier (default 0.8)
 * @param blurRadius - Gaussian blur radius for shadow (default 8)
 */
export async function composeShadow(
  whiteBgDataUrl: string,
  cutoutDataUrl: string,
  shadowOpacity = 0.8,
  blurRadius = 8
): Promise<ShadowComposerResult> {
  // Load both images
  const { imageData: whiteBgData } = await getImageData(whiteBgDataUrl);
  const { imageData: cutoutData } = await getImageData(cutoutDataUrl);

  const width = whiteBgData.width;
  const height = whiteBgData.height;

  // Find bounding box of cutout product
  const bbox = findBoundingBox(cutoutData);

  // Expand bbox with margin for shadow area (shadows extend below and around product)
  const margin = Math.floor(Math.max(width, height) * 0.05); // 5% margin
  const shadowMinX = Math.max(0, bbox.minX - margin);
  const shadowMinY = Math.max(0, bbox.minY - margin);
  const shadowMaxX = Math.min(width - 1, bbox.maxX + margin);
  const shadowMaxY = Math.min(height - 1, bbox.maxY + margin);

  // Step 1 & 2: Extract shadow alpha from white background
  // Shadow is anywhere the background is darker than pure white
  const shadowAlpha = new Float32Array(width * height);
  const SHADOW_THRESHOLD = 245;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = whiteBgData.data[idx];
      const g = whiteBgData.data[idx + 1];
      const b = whiteBgData.data[idx + 2];
      const lum = getLuminance(r, g, b);

      // Only extract shadow within the masked region (around product)
      if (x >= shadowMinX && x <= shadowMaxX && y >= shadowMinY && y <= shadowMaxY) {
        if (lum < SHADOW_THRESHOLD) {
          // Alpha = (255 - Luminance) * Opacity
          shadowAlpha[y * width + x] = ((255 - lum) / 255) * shadowOpacity;
        }
      }
    }
  }

  // Step 4: Blur the shadow mask
  const blurredShadow = boxBlur(shadowAlpha, width, height, blurRadius);

  // Step 5: Composite
  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext('2d')!;

  // Start with transparent background
  const outputData = outCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const sIdx = y * width + x;

      // Shadow layer: dark gray multiplied by shadow alpha
      const sAlpha = blurredShadow[sIdx];

      // Cutout layer
      const cR = cutoutData.data[idx];
      const cG = cutoutData.data[idx + 1];
      const cB = cutoutData.data[idx + 2];
      const cA = cutoutData.data[idx + 3] / 255;

      // Composite: shadow underneath, product on top (premultiplied alpha compositing)
      // Shadow color is dark gray (#333) with sAlpha
      const shadowR = 51 * sAlpha;
      const shadowG = 51 * sAlpha;
      const shadowB = 51 * sAlpha;

      // Normal blend: product over shadow
      const outA = cA + sAlpha * (1 - cA);
      if (outA > 0) {
        outputData.data[idx] = (cR * cA + shadowR * (1 - cA)) / outA;
        outputData.data[idx + 1] = (cG * cA + shadowG * (1 - cA)) / outA;
        outputData.data[idx + 2] = (cB * cA + shadowB * (1 - cA)) / outA;
        outputData.data[idx + 3] = Math.min(255, outA * 255);
      }
    }
  }

  outCtx.putImageData(outputData, 0, 0);

  const imageDataUrl = canvasToDataUrl(outputCanvas);
  const imageBlob = await canvasToBlob(outputCanvas);

  return { imageBlob, imageDataUrl };
}
