/**
 * Fal.ai NanoBanana Pro Edit
 *
 * Used for:
 * 1) Step 2 generation (primary) — callFalImageGen
 * 2) AI Edit feature — callFalEdit
 *
 * Endpoint: https://fal.run/fal-ai/nano-banana-pro/edit
 * Auth: Key-based (VITE_FAL_API_KEY)
 *
 * Key params: prompt, image_urls[], resolution (1K|2K|4K),
 *             aspect_ratio, output_format, num_images
 */

export interface FalImageGenRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
  /** '1K', '2K' or '4K'. Default '2K' */
  resolution?: string;
  /** e.g. '1:1', '4:3', '16:9'. Default 'auto' */
  aspectRatio?: string;
}

export interface FalImageGenResponse {
  imageDataUrl: string;
}

/**
 * Generate a studio image using Fal.ai NanoBanana Pro Edit.
 * Natively supports 1K / 2K / 4K resolution.
 */
export async function callFalImageGen(
  req: FalImageGenRequest,
): Promise<FalImageGenResponse> {
  const resolution = req.resolution ?? '2K';
  const aspectRatio = req.aspectRatio ?? '1:1';

  console.log(`[Fal.ai] Calling nano-banana-pro/edit (${resolution}, ${aspectRatio})...`);

  let response: Response;
  try {
    response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${req.falApiKey}`,
      },
      body: JSON.stringify({
        image_urls: [req.imageDataUrl],
        prompt: req.prompt,
        resolution,
        aspect_ratio: aspectRatio,
        output_format: 'png',
        num_images: 1,
      }),
    });
  } catch (fetchErr) {
    console.error('[Fal.ai] Fetch failed:', fetchErr);
    throw new Error(`Fal.ai network error: ${fetchErr}`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    console.error('[Fal.ai] HTTP error:', response.status, errText.slice(0, 500));
    throw new Error(`Fal.ai HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  console.log('[Fal.ai] Response keys:', Object.keys(data));

  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error(`Fal.ai: no result image: ${JSON.stringify(data).slice(0, 300)}`);
  }

  // Log dimensions if available
  const w = data.images?.[0]?.width;
  const h = data.images?.[0]?.height;
  if (w && h) console.log(`[Fal.ai] Output: ${w}x${h}`);

  if (resultUrl.startsWith('data:')) {
    return { imageDataUrl: resultUrl };
  }

  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Fal.ai result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const imageDataUrl = await blobToDataUrl(resultBlob);
  console.log('[Fal.ai] Done. File size:', Math.round(resultBlob.size / 1024), 'KB');
  return { imageDataUrl };
}

// AI Edit (same API)
export interface FalEditRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
}

export interface FalEditResponse {
  imageDataUrl: string;
}

export async function callFalEdit(req: FalEditRequest): Promise<FalEditResponse> {
  return callFalImageGen({ ...req, resolution: '2K' });
}

// --- Utility ---

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
