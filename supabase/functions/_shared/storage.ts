import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'project-images';

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

/** Fetch image from URL and return as base64 + mimeType */
export async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  const mimeType = response.headers.get('content-type') ?? 'image/png';
  return { base64, mimeType };
}

/** Fetch image and return as data URL */
export async function fetchImageAsDataUrl(imageUrl: string): Promise<string> {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
  return `data:${mimeType};base64,${base64}`;
}

/** Upload result image to Storage, return public URL */
export async function uploadResultToStorage(
  imageData: Uint8Array,
  path: string,
  mimeType = 'image/png',
): Promise<string> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, imageData, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Download image from URL and upload to Storage, return public URL */
export async function downloadAndStore(
  sourceUrl: string,
  storagePath: string,
): Promise<string> {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return uploadResultToStorage(new Uint8Array(buffer), storagePath);
}

/** Convert base64 string to Uint8Array */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
