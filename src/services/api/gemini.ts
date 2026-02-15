/**
 * Google Gemini API Integration
 * Used for Step 2: Studio Generation (gemini-3-pro-image-preview)
 *
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 * Uses direct REST calls (matching the @google/genai SDK behavior)
 */

// --- Gemini Image Generation (Step 2) ---

export interface GeminiImageGenRequest {
  apiKey: string;
  imageDataUrl: string;
  /** Additional reference images (e.g. other angles of the same product) */
  referenceImageDataUrls?: string[];
  prompt: string;
  model?: string;
  imageSize?: string;
  aspectRatio?: string;
}

export interface GeminiImageGenResponse {
  imageBase64: string;
  imageMimeType: string;
  imageDataUrl: string;
  textResponse?: string;
}

/**
 * Extract base64 data and MIME type from a data URL.
 */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URL format');
  return { mimeType: match[1], base64: match[2] };
}

/**
 * The RIMOWA Bright Edition studio rendering prompt.
 * This is the core "look" prompt that drives the studio generation.
 */
export const STUDIO_RENDER_PROMPT = `Front orthographic commercial product render.
Keep the exact original geometry, silhouette, proportions and curvature of the uploaded product — no distortion, no perspective drift, no reshaping.
DO NOT MIRROR. DO NOT FLIP HORIZONTALLY. Maintain exact orientation.

BACKGROUND
Pure white background (#FFFFFF), seamless, clean, no texture, no yellow color cast.

CAMERA
Front orthographic.
No tilt, no rotation.
Product centered, full height inside frame, ~90% frame fill.
No hand, no props, no crop.

LIGHTING — RIMOWA Bright Edition (Default Metallic Preset)
• Key Light: intensity 1.9, softbox, 5400 K
• Fill Light: intensity 1.9, softbox, 5400 K
• Rim Light: 1.35 from right side, very soft, controlled
• Micro Side-Strip Highlight: ultra-thin, subtle edge light to shape curvature without forming a hard rim
• Contour Wrap Light: soft gradient around edges
• Top Light: subtle top diffusion for uniform highlight rolloff
• Contact Shadow: True

MATERIALS
Rebuild the material properties exactly as on the real product:
• Rubber: slightly matte, smooth tactile grain
• Plastic: satin, clean edges, no plastic CGI shine
• Metal: brushed where needed, reflectivity realistic, no chrome exaggeration
Texture Restoration = 100% (preserve all micro-textures)

ENHANCEMENT PASSES
• Clean_Surface = true (remove dust, scratches, noise)
• Geometry_Freeze = true
• Texture_Boost = +10%
• Strong Midtone Clarity Boost: more local contrast, **no sharpening halos**
• Curvature Enhancement = true
• Dual Highlight Pass = true
• Microcontrast Recovery = +18%
• Highlight Boost = +10%
• Color Depth Correction: +5% saturation, +7% contrast, gamma 0.96
• White Clip = 98.8%
• FullPipeline Mode enabled (Clean + Restore + MaterialRebuild)

OUTPUT
• Ultra-sharp, crisp, photoreal
• No artifacts, no refraction errors
• Maintain all printed labels exactly as in the image
• No added reflections
• Bright 3d render, photorealistic clean 3d textures, realistic ground shadow`;

/**
 * Build the full generation prompt by injecting product description context.
 */
export function buildStudioPrompt(productDescription: string): string {
  return `${STUDIO_RENDER_PROMPT}\n\n${productDescription}`;
}

/**
 * Call Gemini Image Generation API.
 * Model: gemini-3-pro-image-preview
 *
 * Payload structure matches the actual app implementation:
 * - parts: [text reference label, inline_data image, text prompt]
 * - generationConfig.imageConfig: { imageSize, aspectRatio }
 */
export async function callGeminiImageGen(req: GeminiImageGenRequest): Promise<GeminiImageGenResponse> {
  const model = req.model ?? 'gemini-3-pro-image-preview';
  const imageSize = req.imageSize ?? '2K';
  const aspectRatio = req.aspectRatio ?? '1:1';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;

  // Build parts: label + all reference images + prompt
  const imageParts: { inlineData: { mimeType: string; data: string } }[] = [];

  // Primary image
  const primary = parseDataUrl(req.imageDataUrl);
  imageParts.push({ inlineData: { mimeType: primary.mimeType, data: primary.base64 } });

  // Additional reference images
  if (req.referenceImageDataUrls?.length) {
    for (const refUrl of req.referenceImageDataUrls) {
      const ref = parseDataUrl(refUrl);
      imageParts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
    }
  }

  const refLabel = imageParts.length > 1
    ? `[REFERENCE IMAGES: ${imageParts.length} views of the product — use as geometry/color/texture reference ONLY. Generate a completely NEW studio-lit product render based on these references.]`
    : '[REFERENCE IMAGE: Front View — use this as geometry/color reference ONLY. Generate a completely NEW studio-lit product render based on this reference.]';

  // Use imageConfig (native to gemini-3-pro) with responseModalities as fallback
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: refLabel },
            ...imageParts,
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          imageSize,
          aspectRatio,
        },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini ImageGen API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  console.log('[Gemini ImageGen] Full API response:', JSON.stringify(data, null, 2));

  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error(`Gemini ImageGen: no candidates returned. BlockReason: ${blockReason ?? 'none'}. Full response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const parts = candidate.content?.parts;
  if (!parts || parts.length === 0) {
    const finishReason = candidate.finishReason;
    throw new Error(`Gemini ImageGen: empty parts. FinishReason: ${finishReason}. Full candidate: ${JSON.stringify(candidate).slice(0, 500)}`);
  }

  let imageBase64 = '';
  let imageMimeType = 'image/png';
  let textResponse: string | undefined;

  for (const part of parts) {
    if (part.inlineData) {
      imageBase64 = part.inlineData.data;
      imageMimeType = part.inlineData.mimeType ?? 'image/png';
    }
    if (part.inline_data) {
      imageBase64 = part.inline_data.data;
      imageMimeType = part.inline_data.mime_type ?? 'image/png';
    }
    if (part.text) {
      textResponse = part.text;
    }
  }

  console.log('[Gemini ImageGen] Parts found:', parts.length, 'Has image:', !!imageBase64, 'Text:', textResponse?.slice(0, 100));

  if (!imageBase64) {
    throw new Error(`Gemini ImageGen did not return an image. Parts: ${JSON.stringify(parts.map((p: Record<string, unknown>) => Object.keys(p))).slice(0, 300)}`);
  }

  return {
    imageBase64,
    imageMimeType,
    imageDataUrl: `data:${imageMimeType};base64,${imageBase64}`,
    textResponse,
  };
}

// --- Gemini Vision (text-only response, for fallback analysis) ---

export interface GeminiVisionRequest {
  apiKey: string;
  imageDataUrl: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
}

export interface GeminiVisionResponse {
  text: string;
}

export async function callGeminiVision(req: GeminiVisionRequest): Promise<GeminiVisionResponse> {
  const model = req.model ?? 'gemini-2.0-flash';
  const { mimeType, base64 } = parseDataUrl(req.imageDataUrl);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: req.prompt },
            { inline_data: { mime_type: mimeType, data: base64 } },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: req.maxTokens ?? 500,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned empty text response');
  }

  return { text };
}
