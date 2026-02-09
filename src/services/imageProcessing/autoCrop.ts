/**
 * Step 7: Auto Crop & Center
 *
 * Scans the alpha channel to find the bounding box of non-transparent pixels,
 * adds a configurable margin, and crops the image.
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

/**
 * Auto-crop a transparent PNG to its content bounds + margin.
 *
 * @param inputDataUrl - PNG image data URL with alpha channel
 * @param margin - Pixel margin to add around the content (default 10)
 */
export async function autoCrop(inputDataUrl: string, margin = 10): Promise<AutoCropResult> {
  const { imageData } = await getImageData(inputDataUrl);
  const { data, width, height } = imageData;

  // Scan alpha channel to find content bounds
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasContent = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 5) { // threshold to ignore near-zero alpha noise
        hasContent = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no content found, return original
  if (!hasContent) {
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

  // Apply margin
  const cropX = Math.max(0, minX - margin);
  const cropY = Math.max(0, minY - margin);
  const cropMaxX = Math.min(width, maxX + 1 + margin);
  const cropMaxY = Math.min(height, maxY + 1 + margin);
  const cropWidth = cropMaxX - cropX;
  const cropHeight = cropMaxY - cropY;

  // Create cropped canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d')!;

  // Source canvas to draw from
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = width;
  srcCanvas.height = height;
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);

  // Draw cropped region
  croppedCtx.drawImage(
    srcCanvas,
    cropX, cropY, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );

  const imageDataUrl = canvasToDataUrl(croppedCanvas);
  const imageBlob = await canvasToBlob(croppedCanvas);

  return {
    imageBlob,
    imageDataUrl,
    cropBounds: { x: cropX, y: cropY, width: cropWidth, height: cropHeight },
  };
}
