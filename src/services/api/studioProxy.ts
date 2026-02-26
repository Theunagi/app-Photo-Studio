/**
 * Studio API Proxy — Frontend client for the Supabase Edge Function.
 *
 * All API keys and proprietary prompts stay server-side.
 * The frontend sends action + params and receives results.
 *
 * Images are uploaded to Supabase Storage first, then referenced by URL
 * to avoid hitting edge function body size limits.
 */

import { supabase } from '../db/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const BUCKET = 'project-images';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the current user's JWT token for edge function auth */
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

/** Upload a data URL to Supabase Storage and return the public URL */
export async function uploadTempImage(dataUrl: string, label = 'img'): Promise<string> {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const ext = mime.includes('png') ? 'png' : 'jpg';
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  const blob = new Blob([u8arr], { type: mime });

  const path = `temp-proxy/${crypto.randomUUID()}/${label}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mime, upsert: true });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Download a URL and return as data URL (for pipeline which needs data URLs) */
export async function urlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.status}`);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Call the studio-api edge function */
async function callEdgeFunction(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = await getAuthToken();
  const url = `${SUPABASE_URL}/functions/v1/studio-api`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data.error ?? `Edge function error ${resp.status}`);
  }
  return data;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ProxyAnalyzeResult {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
}

/**
 * Step 1: Product Analysis (OpenAI GPT-4o Vision)
 * Uploads image → calls edge function → returns analysis text
 */
export async function proxyAnalyze(
  imageDataUrl: string,
  additionalImageDataUrls?: string[],
): Promise<ProxyAnalyzeResult> {
  // Upload images to Storage to get URLs
  const imageUrl = await uploadTempImage(imageDataUrl, 'primary');
  let additionalImageUrls: string[] | undefined;

  if (additionalImageDataUrls?.length) {
    additionalImageUrls = [];
    for (let i = 0; i < additionalImageDataUrls.length; i++) {
      const url = await uploadTempImage(additionalImageDataUrls[i], `ref-${i}`);
      additionalImageUrls.push(url);
    }
  }

  const result = await callEdgeFunction({
    action: 'analyze',
    imageUrl,
    additionalImageUrls,
  });

  return result as unknown as ProxyAnalyzeResult;
}

/**
 * Step 3: Luminance Classification (OpenAI GPT-4o Vision)
 */
export async function proxyLuminance(imageDataUrl: string): Promise<'Light' | 'Dark'> {
  const imageUrl = await uploadTempImage(imageDataUrl, 'luminance');
  const result = await callEdgeFunction({
    action: 'luminance',
    imageUrl,
  });
  return result.classification as 'Light' | 'Dark';
}

/**
 * Step 2: Studio Generation (Fal.ai → NanoBanana)
 * Returns a data URL of the generated image.
 */
export async function proxyGenerate(
  imageDataUrl: string,
  productDescription: string,
  resolution?: string,
  aspectRatio?: string,
  referenceImageDataUrls?: string[],
): Promise<string> {
  const imageUrl = await uploadTempImage(imageDataUrl, 'generate-input');

  let referenceImageUrls: string[] | undefined;
  if (referenceImageDataUrls?.length) {
    referenceImageUrls = [];
    for (let i = 0; i < referenceImageDataUrls.length; i++) {
      const url = await uploadTempImage(referenceImageDataUrls[i], `gen-ref-${i}`);
      referenceImageUrls.push(url);
    }
  }

  const result = await callEdgeFunction({
    action: 'generate',
    imageUrl,
    productDescription,
    resolution,
    aspectRatio,
    referenceImageUrls,
  });

  // Edge function returns a URL — download and convert to data URL
  const resultUrl = (result.imageUrl ?? result.imageDataUrl) as string;
  if (resultUrl.startsWith('data:')) return resultUrl;
  return urlToDataUrl(resultUrl);
}

/**
 * Step 5: Background Removal (Fal.ai Bria 2.3)
 * Returns a data URL of the cutout image.
 */
export async function proxyBgRemove(imageDataUrl: string): Promise<string> {
  const imageUrl = await uploadTempImage(imageDataUrl, 'bg-remove');
  const result = await callEdgeFunction({
    action: 'bg-remove',
    imageUrl,
  });

  const resultUrl = (result.imageUrl ?? result.imageDataUrl) as string;
  if (resultUrl.startsWith('data:')) return resultUrl;
  return urlToDataUrl(resultUrl);
}

/**
 * Lifestyle Generation (Gemini)
 * Returns a data URL of the lifestyle image.
 */
export async function proxyLifestyle(
  imageDataUrl: string,
  userPrompt: string,
  resolution?: string,
  aspectRatio?: string,
): Promise<string> {
  const imageUrl = await uploadTempImage(imageDataUrl, 'lifestyle');
  const result = await callEdgeFunction({
    action: 'lifestyle',
    imageUrl,
    userPrompt,
    resolution,
    aspectRatio,
  });

  const resultUrl = (result.imageUrl ?? result.imageDataUrl) as string;
  if (resultUrl.startsWith('data:')) return resultUrl;
  return urlToDataUrl(resultUrl);
}

/**
 * AI Edit (Fal.ai NanoBanana Pro Edit)
 * Returns a data URL of the edited image.
 */
export async function proxyEdit(
  imageDataUrl: string,
  userPrompt: string,
): Promise<string> {
  const imageUrl = await uploadTempImage(imageDataUrl, 'edit');
  const result = await callEdgeFunction({
    action: 'edit',
    imageUrl,
    userPrompt,
  });

  const resultUrl = (result.imageUrl ?? result.imageDataUrl) as string;
  if (resultUrl.startsWith('data:')) return resultUrl;
  return urlToDataUrl(resultUrl);
}
