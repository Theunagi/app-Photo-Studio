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
Keep the exact original geometry, silhouette, proportions and curvature.
DO NOT MIRROR. DO NOT FLIP HORIZONTALLY.

BACKGROUND: Pure white background (#FFFFFF).

LIGHTING — RIMOWA Bright Edition (Default Metallic Preset)
• Key Light: intensity 1.9, softbox, 5400 K
• Fill Light: intensity 1.9, softbox, 5400 K
• Rim Light: 1.35 from right side
• Micro Side-Strip Highlight: ultra-thin edge light
• Contact Shadow: True (Essential for Step 6)

ENHANCEMENT PASSES:
• Clean_Surface = true
• Geometry_Freeze = true
• Texture_Boost = +10%
• Strong Midtone Clarity Boost
• Microcontrast Recovery = +18%
• White Clip = 98.8%`;

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
  const { mimeType, base64 } = parseDataUrl(req.imageDataUrl);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${req.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: '[REFERENCE IMAGE: Front View (Main Reference)]' },
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: req.prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
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
