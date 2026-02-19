/**
 * Fal.ai Image Generation (Flux Dev Image-to-Image)
 * Used as Step 2 fallback: NanoBanana → Fal.ai → Gemini
 *
 * Endpoint: https://fal.run/fal-ai/flux/dev/image-to-image
 * Auth: Key-based (same VITE_FAL_API_KEY used for Bria bg removal)
 */

export interface FalImageGenRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
  /** Strength of the transformation (0-1). Lower = closer to original. Default 0.75 */
  strength?: number;
  /** Number of inference steps. Default 28 */
  numInferenceSteps?: number;
  /** Image size. Default "1024x1024" */
  imageSize?: string;
}

export interface FalImageGenResponse {
  imageDataUrl: string;
}

/**
 * Generate a studio image using Fal.ai Flux Dev (image-to-image).
 * Accepts data URLs directly (no need to upload to external storage).
 */
export async function callFalImageGen(
  req: FalImageGenRequest,
): Promise<FalImageGenResponse> {
  const strength = req.strength ?? 0.75;
  const numInferenceSteps = req.numInferenceSteps ?? 28;

  // Map resolution strings to pixel sizes
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
      strength,
      num_inference_steps: numInferenceSteps,
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

  // Fal.ai returns { images: [{ url, ... }] }
  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error(`Fal.ai ImageGen: no result image in response: ${JSON.stringify(data).slice(0, 300)}`);
  }

  // If result is already a data URL, return directly
  if (resultUrl.startsWith('data:')) {
    return { imageDataUrl: resultUrl };
  }

  // Otherwise fetch the result image and convert to data URL
  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Fal.ai result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const imageDataUrl = await blobToDataUrl(resultBlob);

  console.log('[Fal.ai ImageGen] Image generated successfully');
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
