/**
 * Supabase Storage helpers — upload/download images as base64 data URLs.
 *
 * Images are stored in the "project-images" bucket.
 * Path convention: {projectId}/{slot}.png  (e.g. "abc-123/autoCrop.png")
 */

import { supabase, isSupabaseConfigured } from './supabase';

const BUCKET = 'project-images';

/**
 * Convert a base64 data URL to a Blob for upload.
 */
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

/**
 * Upload a base64 data URL to Supabase Storage.
 * Returns the storage path (not a full URL).
 */
export async function uploadImage(projectId: string, slot: string, dataUrl: string): Promise<string> {
  const path = `${projectId}/${slot}.png`;
  const blob = dataUrlToBlob(dataUrl);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Storage upload failed (${slot}): ${error.message}`);
  return path;
}

/**
 * Get the public URL for a storage path.
 */
export function getPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Download a storage path back to a base64 data URL.
 */
export async function downloadImage(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });
}

/**
 * Upload all images from a project results object.
 * Returns a new results object with storage paths instead of data URLs.
 */
export async function uploadProjectImages(
  projectId: string,
  results: Record<string, unknown>,
  thumbnail?: string,
): Promise<{ storagePaths: Record<string, string>; thumbnailPath?: string }> {
  if (!isSupabaseConfigured()) return { storagePaths: {} };

  const imageSlots = [
    'inputImage', 'studioGeneration', 'retouch',
    'cutout', 'shadowComposite', 'autoCrop',
  ];

  const storagePaths: Record<string, string> = {};

  // Upload main image slots in parallel
  const uploads = imageSlots.map(async (slot) => {
    const val = results[slot];
    if (typeof val === 'string' && val.startsWith('data:')) {
      storagePaths[slot] = await uploadImage(projectId, slot, val);
    }
  });

  // Upload additional input images
  const inputImages = results.inputImages as string[] | undefined;
  if (inputImages?.length) {
    inputImages.forEach((img, i) => {
      if (img.startsWith('data:')) {
        uploads.push(
          uploadImage(projectId, `inputImage-${i}`, img).then(path => {
            storagePaths[`inputImage-${i}`] = path;
          })
        );
      }
    });
  }

  // Upload lifestyle images
  const lifestyles = results.lifestyles as { image: string; prompt: string }[] | undefined;
  if (lifestyles?.length) {
    lifestyles.forEach((li, i) => {
      if (li.image.startsWith('data:')) {
        uploads.push(
          uploadImage(projectId, `lifestyle-${i}`, li.image).then(path => {
            storagePaths[`lifestyle-${i}`] = path;
          })
        );
      }
    });
  }

  // Upload thumbnail
  let thumbnailPath: string | undefined;
  if (thumbnail?.startsWith('data:')) {
    uploads.push(
      uploadImage(projectId, 'thumbnail', thumbnail).then(path => {
        thumbnailPath = path;
      })
    );
  }

  await Promise.all(uploads);
  return { storagePaths, thumbnailPath };
}

/**
 * Download all images for a project, replacing storage paths with data URLs.
 */
export async function downloadProjectImages(
  storagePaths: Record<string, string>,
): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};

  const dataUrls: Record<string, string> = {};
  const downloads = Object.entries(storagePaths).map(async ([slot, path]) => {
    try {
      dataUrls[slot] = await downloadImage(path);
    } catch (err) {
      console.warn(`Failed to download ${slot}:`, err);
    }
  });

  await Promise.all(downloads);
  return dataUrls;
}

/**
 * Delete all images for a project from storage.
 */
export async function deleteProjectImages(projectId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const { data } = await supabase.storage.from(BUCKET).list(projectId);
  if (!data?.length) return;

  const paths = data.map(f => `${projectId}/${f.name}`);
  await supabase.storage.from(BUCKET).remove(paths);
}
