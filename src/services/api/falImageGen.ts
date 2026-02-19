/**
 * Fal.ai NanoBanana Pro Edit - AI Image Editing
 * Used for the AI Edit feature (post-pipeline edits on final image)
 *
 * Endpoint: https://fal.run/fal-ai/nano-banana-pro/edit
 * Auth: Key-based (same VITE_FAL_API_KEY used for Bria bg removal)
 */

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
