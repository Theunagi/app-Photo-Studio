/**
 * Background Removal API Integration via Fal.ai (running Bria 2.3 RMBG)
 * Used for Step 5: Background Removal (Cutout)
 *
 * Endpoint: https://fal.run/fal-ai/bria/background/remove
 * Method: POST
 * Auth: Key-based (Fal.ai API key)
 */

export interface RemoveBgRequest {
  falApiKey: string;
  imageDataUrl: string;
  keepShadows?: boolean;
}

export interface RemoveBgResponse {
  imageBlob: Blob;
  imageDataUrl: string;
}

/**
 * Remove background using Fal.ai (Bria 2.3 RMBG).
 * Matches the exact payload from services/backgroundRemovalService.ts.
 */
export async function removeBackground(req: RemoveBgRequest): Promise<RemoveBgResponse> {
  const keepShadows = req.keepShadows ?? false;

  const response = await fetch('https://fal.run/fal-ai/bria/background/remove', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${req.falApiKey}`,
    },
    body: JSON.stringify({
      image_url: req.imageDataUrl,
      keep_shadows: keepShadows,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => '');
    throw new Error(`Fal.ai Bria API error ${response.status}: ${err}`);
  }

  const data = await response.json();

  // Fal.ai returns an image URL or base64 in the response
  const resultUrl = data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error('Fal.ai Bria returned no result image');
  }

  // If result is a URL, fetch it. If base64, convert.
  if (resultUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(resultUrl);
    return { imageBlob: blob, imageDataUrl: resultUrl };
  }

  // Fetch the result image from URL
  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Bria result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const dataUrl = await blobToDataUrl(resultBlob);

  return { imageBlob: resultBlob, imageDataUrl: dataUrl };
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
