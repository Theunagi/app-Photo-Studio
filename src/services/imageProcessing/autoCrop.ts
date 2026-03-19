/**
 * Step 7: Auto Crop & Center
 *
 * Dual-strategy cropping:
 * 1. Alpha-based: scans alpha channel for non-transparent pixels (works on transparent PNGs)
 * 2. Brightness-based fallback: if alpha yields no meaningful crop (e.g. white background),
 *    detects near-white/near-black edge pixels as background
 */

import { getImageData, canvasToBlob, canvasToDataUrl } from './utils';

export interface AutoCropBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AutoCropResult {
  imageBlob: Blob;
  imageDataUrl: string;
  cropBounds: AutoCropBounds;
}

/** Check if a pixel at offset i is "background" based on brightness */
function isBackgroundPixel(data: Uint8ClampedArray, i: number, threshold: number): boolean {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const a = data[i + 3];
  // Transparent = background
  if (a < 10) return true;
  // Near-white = background (covers white bg images)
  const brightness = (r + g + b) / 3;
  return brightness > threshold;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  found: boolean;
}

/** Scan alpha channel to find content bounding box */
function scanAlpha(data: Uint8ClampedArray, width: number, height: number): Bounds {
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, found };
}

/** Scan brightness to find content bounding box (for opaque images with white/light bg) */
function scanBrightness(data: Uint8ClampedArray, width: number, height: number): Bounds {
  // Sample corner pixels to determine background color/threshold
  const corners = [
    0,                                  // top-left
    (width - 1) * 4,                    // top-right
    ((height - 1) * width) * 4,         // bottom-left
    ((height - 1) * width + width - 1) * 4, // bottom-right
  ];

  let avgBrightness = 0;
  for (const i of corners) {
    avgBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  avgBrightness /= corners.length;

  // If corners are bright (white-ish bg), use a threshold slightly below
  // If corners are dark, use a low threshold
  const threshold = avgBrightness > 200 ? avgBrightness - 20 : 30;
  const isDarkBg = avgBrightness <= 200;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isBg = isDarkBg
        ? (data[i] + data[i + 1] + data[i + 2]) / 3 < threshold
        : isBackgroundPixel(data, i, threshold);

      if (!isBg) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY, found };
}

/**
 * Auto-crop an image to its content bounds + margin.
 * Works with both transparent and opaque (white bg) images.
 * Adds a white safety zone so shadows never touch the frame edges.
 *
 * @param inputDataUrl - PNG image data URL
 * @param margin - Pixel margin inside the source to include (default 10)
 * @param safetyZone - Extra white/transparent padding added outside the crop (default 10)
 */
export async function autoCrop(inputDataUrl: string, margin = 10, safetyZone = 10): Promise<AutoCropResult> {
  const { imageData } = await getImageData(inputDataUrl);
  const { data, width, height } = imageData;

  // Strategy 1: Alpha-based scan
  let bounds = scanAlpha(data, width, height);

  // Check if alpha scan produced a meaningful crop (at least 5% trimmed from any edge)
  const minTrim = Math.min(width, height) * 0.05;
  const alphaCropMeaningful = bounds.found &&
    (bounds.minX > minTrim || bounds.minY > minTrim ||
     (width - bounds.maxX - 1) > minTrim || (height - bounds.maxY - 1) > minTrim);

  // Strategy 2: If alpha didn't crop anything useful, try brightness-based
  if (!alphaCropMeaningful) {
    const brightBounds = scanBrightness(data, width, height);
    if (brightBounds.found) {
      bounds = brightBounds;
    }
  }

  // If still no content found, return original
  if (!bounds.found) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return {
      imageBlob: await canvasToBlob(canvas),
      imageDataUrl: canvasToDataUrl(canvas),
      cropBounds: { x: 0, y: 0, width, height },
    };
  }

  // Crop region (with inner margin, clamped to source bounds)
  const cropX = Math.max(0, bounds.minX - margin);
  const cropY = Math.max(0, bounds.minY - margin);
  const cropMaxX = Math.min(width, bounds.maxX + 1 + margin);
  const cropMaxY = Math.min(height, bounds.maxY + 1 + margin);
  const cropWidth = cropMaxX - cropX;
  const cropHeight = cropMaxY - cropY;

  // Detect if image is opaque (white bg) to decide safety zone fill color
  const isOpaque = !alphaCropMeaningful;

  // Source canvas
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Failed to get canvas 2D context');
  srcCtx.putImageData(imageData, 0, 0);

  // Asymmetric safety zone: more at bottom for drop shadow
  const safetyTop = safetyZone;
  const safetySide = safetyZone;
  const safetyBottom = safetyZone * 3; // 30px bottom for shadow fade

  // Final canvas with safety zone padding
  const finalWidth = cropWidth + safetySide * 2;
  const finalHeight = cropHeight + safetyTop + safetyBottom;
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Failed to get canvas 2D context');

  // Fill safety zone with white for opaque images (keeps shadow realistic)
  if (isOpaque) {
    finalCtx.fillStyle = '#FFFFFF';
    finalCtx.fillRect(0, 0, finalWidth, finalHeight);
  }

  // Draw cropped content centered horizontally, offset from top
  finalCtx.drawImage(
    srcCanvas,
    cropX, cropY, cropWidth, cropHeight,
    safetySide, safetyTop, cropWidth, cropHeight
  );

  const imageDataUrl = canvasToDataUrl(finalCanvas);
  const imageBlob = await canvasToBlob(finalCanvas);

  return {
    imageBlob,
    imageDataUrl,
    cropBounds: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
  };
}
