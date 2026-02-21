/**
 * Fal.ai NanoBanana Pro Edit + AI Upscaler
 *
 * Used for:
 * 1) Step 2 generation (primary) — callFalImageGen (gen + upscale)
 * 2) AI Edit feature — callFalEdit (same API, convenience alias)
 *
 * Endpoint gen:     https://fal.run/fal-ai/nano-banana-pro/edit
 * Endpoint upscale: https://fal.run/fal-ai/real-esrgan
 * Auth: Key-based (VITE_FAL_API_KEY)
 */

export interface FalImageGenRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
  /** '2K' or '4K' — used to determine upscale factor */
  imageSize?: string;
}

export interface FalImageGenResponse {
  imageDataUrl: string;
}

/**
 * Generate an image using NanoBanana Pro Edit, then upscale to 2K/4K
 * using Real-ESRGAN. The gen model outputs ~1K natively.
 */
export async function callFalImageGen(
  req: FalImageGenRequest,
): Promise<FalImageGenResponse> {
  console.log('[Fal.ai] Step 1/2: Generating with nano-banana-pro/edit...');

  // --- 1) Generate ---
  let genResponse: Response;
  try {
    genResponse = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${req.falApiKey}`,
      },
      body: JSON.stringify({
        image_urls: [req.imageDataUrl],
        prompt: req.prompt,
      }),
    });
  } catch (fetchErr) {
    console.error('[Fal.ai] Gen fetch failed:', fetchErr);
    throw new Error(`Fal.ai gen network error: ${fetchErr}`);
  }

  if (!genResponse.ok) {
    const errText = await genResponse.text().catch(() => '');
    console.error('[Fal.ai] Gen HTTP error:', genResponse.status, errText.slice(0, 500));
    throw new Error(`Fal.ai gen HTTP ${genResponse.status}: ${errText.slice(0, 500)}`);
  }

  const genData = await genResponse.json();
  console.log('[Fal.ai] Gen response keys:', Object.keys(genData));

  const genUrl = genData.images?.[0]?.url ?? genData.image?.url ?? genData.image;
  if (!genUrl) {
    throw new Error(`Fal.ai gen: no result image: ${JSON.stringify(genData).slice(0, 300)}`);
  }

  // Get generated image as data URL
  let genDataUrl: string;
  if (genUrl.startsWith('data:')) {
    genDataUrl = genUrl;
  } else {
    const imgResp = await fetch(genUrl);
    if (!imgResp.ok) throw new Error(`Failed to download gen result: ${imgResp.status}`);
    const blob = await imgResp.blob();
    genDataUrl = await blobToDataUrl(blob);
  }

  console.log('[Fal.ai] Generation done. Image size:', Math.round(genDataUrl.length / 1024), 'KB');

  // --- 2) Upscale with Real-ESRGAN ---
  // nano-banana-pro outputs ~1024px. scale=2 → 2048px (2K), scale=4 → 4096px (4K)
  const scale = req.imageSize === '4K' ? 4 : 2;
  console.log(`[Fal.ai] Step 2/2: Upscaling ${scale}x with Real-ESRGAN...`);

  let upResponse: Response;
  try {
    upResponse = await fetch('https://fal.run/fal-ai/real-esrgan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${req.falApiKey}`,
      },
      body: JSON.stringify({
        image_url: genDataUrl,
        scale,
      }),
    });
  } catch (upErr) {
    console.warn('[Fal.ai] Upscale failed, returning original:', upErr);
    return { imageDataUrl: genDataUrl };
  }

  if (!upResponse.ok) {
    const errText = await upResponse.text().catch(() => '');
    console.warn('[Fal.ai] Upscale HTTP error:', upResponse.status, errText.slice(0, 300));
    // Return unscaled image rather than failing entirely
    return { imageDataUrl: genDataUrl };
  }

  const upData = await upResponse.json();
  console.log('[Fal.ai] Upscale response keys:', Object.keys(upData));

  const upUrl = upData.image?.url ?? upData.images?.[0]?.url ?? upData.image;
  if (!upUrl) {
    console.warn('[Fal.ai] Upscale: no result image, returning original');
    return { imageDataUrl: genDataUrl };
  }

  let finalDataUrl: string;
  if (upUrl.startsWith('data:')) {
    finalDataUrl = upUrl;
  } else {
    const upImgResp = await fetch(upUrl);
    if (!upImgResp.ok) {
      console.warn('[Fal.ai] Failed to download upscaled image, returning original');
      return { imageDataUrl: genDataUrl };
    }
    const upBlob = await upImgResp.blob();
    finalDataUrl = await blobToDataUrl(upBlob);
  }

  console.log('[Fal.ai] Upscale done. Final size:', Math.round(finalDataUrl.length / 1024), 'KB');
  return { imageDataUrl: finalDataUrl };
}

// Alias for AI Edit (no upscale needed)
export interface FalEditRequest {
  falApiKey: string;
  imageDataUrl: string;
  prompt: string;
}

export interface FalEditResponse {
  imageDataUrl: string;
}

export async function callFalEdit(req: FalEditRequest): Promise<FalEditResponse> {
  // AI Edit: generate only, no upscale
  console.log('[Fal.ai Edit] Calling nano-banana-pro/edit...');

  const response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${req.falApiKey}`,
    },
    body: JSON.stringify({
      image_urls: [req.imageDataUrl],
      prompt: req.prompt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Fal.ai Edit HTTP ${response.status}: ${errText.slice(0, 500)}`);
  }

  const data = await response.json();
  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) {
    throw new Error(`Fal.ai Edit: no result image: ${JSON.stringify(data).slice(0, 300)}`);
  }

  if (resultUrl.startsWith('data:')) {
    return { imageDataUrl: resultUrl };
  }

  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Fal.ai Edit result: ${imageResponse.status}`);
  }

  const resultBlob = await imageResponse.blob();
  const imageDataUrl = await blobToDataUrl(resultBlob);
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
