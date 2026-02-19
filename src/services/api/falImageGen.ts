/**
 * Fal.ai API Services
 *
 * 1) callFalImageGen — Flux Dev image-to-image (Step 2 fallback for generation)
 * 2) callFalEdit    — NanoBanana Pro Edit (AI Edit feature)
 *
 * Auth: Key-based (same VITE_FAL_API_KEY used for Bria bg removal)
 */

// ============================================================
// Image Generation (Flux Dev) — used as Step 2 fallback
// ============================================================

export interface FalImageGenRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
  imageSize?: string;
}

export interface FalImageGenResponse {
  imageDataUrl: string;
}

export async function callFalImageGen(
  req: FalImageGenRequest,
): Promise<FalImageGenResponse> {
  const sizeMap: Record<string, string> = {
    '1K': '1024x1024',
    '2K': '1536x1536',
    '4K': '2048x2048',
  };
  const imageSize = sizeMap[req.imageSize ?? '2K'] ?? '1536x1536';

  console.log('[Fal.ai ImageGen] Calling Flux Dev image-to-image...');

  const response = await fetch('https://fal.run/fal-ai/flux/dev/image-to-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${req.falApiKey}`,
    },
    body: JSON.stringify({
      image_url: req.imageDataUrl,
      prompt: req.prompt,
      strength: 0.75,
      num_inference_steps: 28,
      image_size: imageSize,
      output_format: 'png',
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Fal.ai ImageGen HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  console.log('[Fal.ai ImageGen] Response keys:', Object.keys(data));

  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error(`Fal.ai ImageGen: no result image: ${JSON.stringify(data).slice(0, 300)}`);
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
  console.log('[Fal.ai ImageGen] Image generated successfully');
  return { imageDataUrl };
}

// ============================================================
// AI Edit (NanoBanana Pro Edit) — used for post-pipeline edits
// ============================================================

export interface FalEditRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
}

export interface FalEditResponse {
  imageDataUrl: string;
}

/**
 * Edit an image using Fal.ai NanoBanana Pro Edit.
 * Accepts data URLs directly.
 */
export async function callFalEdit(
  req: FalEditRequest,
): Promise<FalEditResponse> {
  console.log('[Fal.ai Edit] Calling nano-banana-pro/edit...');

  const response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${req.falApiKey}`,
    },
    body: JSON.stringify({
      image_url: req.imageDataUrl,
      prompt: req.prompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Fal.ai Edit HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  console.log('[Fal.ai Edit] Response keys:', Object.keys(data));

  // Extract result image URL
  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error(`Fal.ai Edit: no result image in response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  // If result is already a data URL, return directly
  if (resultUrl.startsWith('data:')) {
    return { imageDataUrl: resultUrl };
  }

  // Otherwise fetch the result image and convert to data URL
  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Fal.ai Edit result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const imageDataUrl = await blobToDataUrl(resultBlob);

  console.log('[Fal.ai Edit] Edit completed successfully');
  return { imageDataUrl };
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
