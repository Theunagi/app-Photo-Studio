/**
 * Step 6: Smart Shadow Composer
 *
 * Extracts the natural contact shadow from the white-background retouched image
 * and composites it under the cutout product for photorealistic grounding.
 *
 * Algorithm:
 * 1. Use cutout alpha to identify product pixels (exclude from shadow).
 * 2. Luma Keying: Scan white-bg image. Non-product pixels with luminance < 245 are shadow.
 * 3. Restrict shadow zone to BELOW the product bottom (contact shadow area).
 * 4. Blur: Gaussian blur on shadow mask.
 * 5. Composite: Shadow layer + Product layer (Normal).
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
 * Compose the final image: shadow layer + cutout product.
 *
 * Key fix: Use cutout alpha to EXCLUDE product pixels from shadow extraction.
 * Shadow is only extracted from areas OUTSIDE the product, primarily BELOW it.
 *
 * @param whiteBgDataUrl - Retouched image on white background (Step 4 output)
 * @param cutoutDataUrl - Cutout product with transparency (Step 5 output)
 * @param shadowOpacity - Shadow opacity multiplier (default 0.8)
 * @param blurRadius - Gaussian blur radius for shadow (default 8)
 * @param whiteBackground - If true, fill background with white instead of transparent
 */
export async function composeShadow(
  whiteBgDataUrl: string,
  cutoutDataUrl: string,
  shadowOpacity = 0.8,
  blurRadius = 8,
  whiteBackground = false
): Promise<ShadowComposerResult> {
  // Load both images
  const { imageData: whiteBgData } = await getImageData(whiteBgDataUrl);
  const { imageData: cutoutData } = await getImageData(cutoutDataUrl);

  const width = whiteBgData.width;
  const height = whiteBgData.height;

  // Find bounding box of cutout product
  const bbox = findBoundingBox(cutoutData);

  // Shadow zone: primarily BELOW the product bottom, with slight side extension
  // Contact shadow lives at the base of the product and extends downward
  const productBottom = bbox.maxY;
  const productHeight = bbox.maxY - bbox.minY;
  const shadowDepth = Math.floor(productHeight * 0.15); // shadow extends 15% of product height below
  const sideMargin = Math.floor((bbox.maxX - bbox.minX) * 0.1); // 10% side extension

  const shadowMinX = Math.max(0, bbox.minX - sideMargin);
  const shadowMaxX = Math.min(width - 1, bbox.maxX + sideMargin);
  // Shadow starts slightly above product bottom (to catch contact area) and extends below
  const shadowMinY = Math.max(0, productBottom - Math.floor(productHeight * 0.05));
  const shadowMaxY = Math.min(height - 1, productBottom + shadowDepth);

  // Extract shadow alpha from white background
  // ONLY from pixels that are NOT part of the product (cutout alpha < 128)
  const shadowAlpha = new Float32Array(width * height);
  const SHADOW_THRESHOLD = 245;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Skip pixels that are part of the product (use cutout alpha to mask)
      const cutoutAlpha = cutoutData.data[idx + 3];
      if (cutoutAlpha > 128) continue;

      // Only extract shadow in the contact shadow zone (below product)
      if (x >= shadowMinX && x <= shadowMaxX && y >= shadowMinY && y <= shadowMaxY) {
        const r = whiteBgData.data[idx];
        const g = whiteBgData.data[idx + 1];
        const b = whiteBgData.data[idx + 2];
        const lum = getLuminance(r, g, b);

        if (lum < SHADOW_THRESHOLD) {
          // Alpha = (255 - Luminance) * Opacity
          // Fade shadow based on distance from product bottom
          const distFromBottom = Math.max(0, y - productBottom);
          const fadeFactor = 1.0 - (distFromBottom / Math.max(1, shadowDepth));
          shadowAlpha[y * width + x] = ((255 - lum) / 255) * shadowOpacity * Math.max(0, fadeFactor);
        }
      }
    }
  }

  // Blur the shadow mask
  const blurredShadow = boxBlur(shadowAlpha, width, height, blurRadius);

  // Re-mask shadow after blur: suppress shadow where the product exists.
  // The blur spreads shadow INTO the product area; multiply by inverse cutout
  // alpha so product pixels stay untouched (especially visible on white products).
  for (let i = 0; i < width * height; i++) {
    const cutoutAlpha = cutoutData.data[i * 4 + 3] / 255;
    blurredShadow[i] *= (1 - cutoutAlpha);
  }

  // Composite: transparent background + shadow + product on top
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outCtx = outputCanvas.getContext('2d');
  if (!outCtx) throw new Error('Failed to get canvas 2D context');
  const outputData = outCtx.createImageData(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const sIdx = y * width + x;

      // Shadow layer
      const sAlpha = blurredShadow[sIdx];

      // Cutout product layer
      const cR = cutoutData.data[idx];
      const cG = cutoutData.data[idx + 1];
      const cB = cutoutData.data[idx + 2];
      const cA = cutoutData.data[idx + 3] / 255;

      if (whiteBackground) {
        // White background: shadow darkens white, then product on top
        const bgR = 255 * (1 - sAlpha) + 51 * sAlpha;
        const bgG = 255 * (1 - sAlpha) + 51 * sAlpha;
        const bgB = 255 * (1 - sAlpha) + 51 * sAlpha;
        outputData.data[idx]     = bgR * (1 - cA) + cR * cA;
        outputData.data[idx + 1] = bgG * (1 - cA) + cG * cA;
        outputData.data[idx + 2] = bgB * (1 - cA) + cB * cA;
        outputData.data[idx + 3] = 255;
      } else {
        // Transparent background: shadow + product blend
        const shadowR = 51 * sAlpha;
        const shadowG = 51 * sAlpha;
        const shadowB = 51 * sAlpha;
        const outA = cA + sAlpha * (1 - cA);
        if (outA > 0) {
          outputData.data[idx]     = (cR * cA + shadowR * (1 - cA)) / outA;
          outputData.data[idx + 1] = (cG * cA + shadowG * (1 - cA)) / outA;
          outputData.data[idx + 2] = (cB * cA + shadowB * (1 - cA)) / outA;
          outputData.data[idx + 3] = Math.min(255, outA * 255);
        }
      }
    }
  }

  outCtx.putImageData(outputData, 0, 0);

  const imageDataUrl = canvasToDataUrl(outputCanvas);
  const imageBlob = await canvasToBlob(outputCanvas);

  return { imageBlob, imageDataUrl };
}
