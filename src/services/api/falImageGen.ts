/**
 * Fal.ai NanoBanana Pro Edit
 *
 * Used for:
 * 1) Step 2 generation (primary) — callFalImageGen
 * 2) AI Edit feature — callFalEdit (same API, convenience alias)
 *
 * Endpoint: https://fal.run/fal-ai/nano-banana-pro/edit
 * Auth: Key-based (VITE_FAL_API_KEY)
 */

export interface FalImageGenRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
  /** '2K' or '4K' — mapped to pixel dimensions */
  imageSize?: string;
}

export interface FalImageGenResponse {
  imageDataUrl: string;
}

/**
 * Generate/edit an image using Fal.ai NanoBanana Pro Edit.
 * Used as primary for Step 2 studio generation.
 */
export async function callFalImageGen(
  req: FalImageGenRequest,
): Promise<FalImageGenResponse> {
  // Map 2K/4K to pixel dimensions for Fal.ai
  const sizeMap: Record<string, { width: number; height: number }> = {
    '2K': { width: 2048, height: 2048 },
    '4K': { width: 4096, height: 4096 },
  };
  const imageSize = sizeMap[req.imageSize ?? '2K'] ?? sizeMap['2K'];

  console.log('[Fal.ai] Calling nano-banana-pro/edit...', req.imageSize, '→', imageSize);

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
        image_size: imageSize,
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

  if (resultUrl.startsWith('data:')) {
    return { imageDataUrl: resultUrl };
  }

  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Fal.ai result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const imageDataUrl = await blobToDataUrl(resultBlob);
  console.log('[Fal.ai] Image generated successfully');
  return { imageDataUrl };
}

// Alias for AI Edit (same API)
export interface FalEditRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
}

export interface FalEditResponse {
  imageDataUrl: string;
}

export async function callFalEdit(req: FalEditRequest): Promise<FalEditResponse> {
  return callFalImageGen(req);
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
