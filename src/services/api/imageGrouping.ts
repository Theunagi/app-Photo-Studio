// src/services/api/imageGrouping.ts
/**
 * AI Image Grouping — Uses GPT-4 Vision to group product images by similarity.
 * Resizes to 256px thumbnails before sending to minimize token cost.
 */

import { invokeEdgeFunction } from './edgeFunctions';

export interface ImageGroup {
  name: string;
  /** Indices into the original images array */
  imageIndices: number[];
  /** Index of the primary image (the one to use in the pipeline) */
  primaryIndex: number;
}

export interface GroupingResult {
  groups: ImageGroup[];
  ungroupedIndices: number[];
}

/** Resize an image data URL to max 256px on its longest side */
async function resizeTo256(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 256;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

/** Convert File to data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Parse filename into a readable name: "sneaker_nike_01.jpg" → "Sneaker Nike" */
export function parseFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/[-_]+/g, ' ')  // replace separators with spaces
    .replace(/\d+/g, '')     // remove numbers
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    || 'Product';
}

/**
 * Group images by product similarity using Vision AI.
 * Falls back to 1-image-per-group if the API call fails.
 */
export async function groupImagesByAI(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<GroupingResult> {
  // Single image: skip AI, return directly
  if (files.length <= 1) {
    return {
      groups: files.map((f, i) => ({
        name: parseFileName(f.name),
        imageIndices: [i],
        primaryIndex: i,
      })),
      ungroupedIndices: [],
    };
  }

  onProgress?.('Preparing thumbnails...');

  // Convert + resize all images to 256px thumbnails
  const thumbnails: string[] = [];
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const thumb = await resizeTo256(dataUrl);
    thumbnails.push(thumb);
  }

  // Batch into groups of 20 for API call
  const BATCH_SIZE = 20;
  const allGroups: ImageGroup[] = [];
  const allUngrouped: number[] = [];

  for (let i = 0; i < thumbnails.length; i += BATCH_SIZE) {
    const batch = thumbnails.slice(i, i + BATCH_SIZE);
    const batchOffset = i;

    onProgress?.(`Analyzing images ${i + 1}-${Math.min(i + BATCH_SIZE, thumbnails.length)}...`);

    try {
      const result = await invokeEdgeFunction<{
        groups: Array<{ name: string; indices: number[]; primary: number }>;
        ungrouped: number[];
      }>('studio-api', {
        action: 'group-images',
        images: batch,
        count: batch.length,
      });

      // Offset indices to match global array
      for (const g of result.groups) {
        allGroups.push({
          name: g.name,
          imageIndices: g.indices.map(idx => idx + batchOffset),
          primaryIndex: g.primary + batchOffset,
        });
      }
      allUngrouped.push(...result.ungrouped.map(idx => idx + batchOffset));
    } catch (err) {
      import.meta.env.DEV && console.warn('[Grouping] Vision API failed for batch, using fallback:', err);
      // Fallback: each image in this batch becomes its own group
      for (let j = 0; j < batch.length; j++) {
        const globalIdx = batchOffset + j;
        allGroups.push({
          name: parseFileName(files[globalIdx].name),
          imageIndices: [globalIdx],
          primaryIndex: globalIdx,
        });
      }
    }
  }

  return { groups: allGroups, ungroupedIndices: allUngrouped };
}
