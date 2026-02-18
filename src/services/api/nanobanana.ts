/**
 * Kie.ai Nano Banana Pro API Integration
 * Used for Step 2: Studio Generation (replaces Gemini for testing)
 *
 * Async workflow: createTask → poll recordInfo → download result
 * Requires image URLs (not base64), so we upload temp images to Supabase Storage.
 */

import { supabase } from '../db/supabase';

const API_BASE = 'https://api.kie.ai/api/v1/jobs';
const BUCKET = 'project-images';
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

// --- Temp image upload helpers (NanoBanana needs URLs, not base64) ---

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
}

async function uploadTempImage(tempId: string, slot: string, dataUrl: string): Promise<string> {
  const path = `temp-nb/${tempId}/${slot}.png`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Temp upload failed (${slot}): ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function cleanupTempImages(tempId: string): Promise<void> {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(`temp-nb/${tempId}`);
    if (data?.length) {
      const paths = data.map(f => `temp-nb/${tempId}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    console.warn('[NanoBanana] Temp cleanup failed (non-critical)');
  }
}

// --- API calls ---

async function createTask(
  apiKey: string,
  prompt: string,
  imageUrls: string[],
  aspectRatio: string,
  resolution: string,
): Promise<string> {
  const response = await fetch(`${API_BASE}/createTask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'nano-banana-pro',
      input: {
        prompt,
        image_input: imageUrls,
        aspect_ratio: aspectRatio,
        resolution,
        output_format: 'png',
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`NanoBanana createTask error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  if (data.code !== 200) throw new Error(`NanoBanana createTask: ${data.message}`);

  console.log('[NanoBanana] Task created:', data.data.taskId);
  return data.data.taskId;
}

async function pollTaskResult(apiKey: string, taskId: string): Promise<string[]> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const response = await fetch(`${API_BASE}/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      console.warn(`[NanoBanana] Poll attempt ${i + 1} failed: ${response.status}`);
      continue;
    }

    const data = await response.json();
    const state = data.data?.state;

    if (state === 'success') {
      const resultJson = JSON.parse(data.data.resultJson);
      console.log('[NanoBanana] Task completed, result URLs:', resultJson.resultUrls);
      return resultJson.resultUrls;
    }

    if (state === 'fail') {
      throw new Error(`NanoBanana task failed: ${data.data.failMsg ?? 'Unknown error'}`);
    }

    console.log(`[NanoBanana] Poll ${i + 1}/${MAX_POLL_ATTEMPTS} — state: ${state ?? 'processing'}`);
  }

  throw new Error('NanoBanana task timed out after 5 minutes');
}

async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download result image: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Public API (same interface shape as Gemini) ---

export interface NanoBananaImageGenRequest {
  apiKey: string;
  imageDataUrl: string;
  referenceImageDataUrls?: string[];
  prompt: string;
  imageSize?: string;
  aspectRatio?: string;
}

export interface NanoBananaImageGenResponse {
  imageDataUrl: string;
}

/**
 * Generate a studio image using Nano Banana Pro.
 * Handles: temp upload → createTask → poll → download → cleanup
 */
export async function callNanoBananaImageGen(
  req: NanoBananaImageGenRequest,
): Promise<NanoBananaImageGenResponse> {
  const tempId = crypto.randomUUID();
  const imageUrls: string[] = [];

  // Upload all reference images to get public URLs
  console.log('[NanoBanana] Uploading reference images...');
  const primaryUrl = await uploadTempImage(tempId, 'primary', req.imageDataUrl);
  imageUrls.push(primaryUrl);

  if (req.referenceImageDataUrls?.length) {
    for (let i = 0; i < req.referenceImageDataUrls.length; i++) {
      const url = await uploadTempImage(tempId, `ref-${i}`, req.referenceImageDataUrls[i]);
      imageUrls.push(url);
    }
  }

  // Map resolution: "2K" → "2K", "4K" → "4K", default "1K"
  const resolution = req.imageSize ?? '2K';
  const aspectRatio = req.aspectRatio ?? '1:1';

  try {
    const taskId = await createTask(req.apiKey, req.prompt, imageUrls, aspectRatio, resolution);
    const resultUrls = await pollTaskResult(req.apiKey, taskId);

    if (!resultUrls?.length) {
      throw new Error('NanoBanana: no result URLs returned');
    }

    const imageDataUrl = await urlToDataUrl(resultUrls[0]);
    return { imageDataUrl };
  } finally {
    // Always cleanup temp images
    await cleanupTempImages(tempId);
  }
}
