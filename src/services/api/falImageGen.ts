/**
 * Fal.ai NanoBanana Pro Edit — Secure Proxy via Supabase Edge Functions
 * Used for Step 2: Studio Generation (primary) & AI Edit feature
 *
 * API keys and studio prompt are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Generate a studio image (Step 2 — primary).
 * The full studio prompt (RIMOWA Bright Edition) is assembled server-side.
 */
export async function generateStudioImage(
  imageUrl: string,
  productDescription: string,
  options?: {
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
    cameraAngle?: string;
    referenceImageUrls?: string[];
  },
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl: string }>('studio-api', {
    action: 'generate',
    imageUrl,
    productDescription,
    resolution: options?.resolution,
    aspectRatio: options?.aspectRatio,
    cameraAngle: options?.cameraAngle,
    referenceImageUrls: options?.referenceImageUrls,
  });
  return { resultImageUrl: result.imageUrl };
}

/**
 * Edit a product image using AI.
 * The edit prompt template is assembled server-side.
 */
export async function editImage(
  imageUrl: string,
  editPrompt: string,
  options?: {
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
    /** When true, the source image is a lifestyle scene (not a white-bg studio shot) */
    isLifestyle?: boolean;
    /** Product description from pipeline analysis (texts, colors, materials) */
    productDescription?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl: string }>('studio-api', {
    action: 'edit',
    imageUrl,
    userPrompt: editPrompt,
    resolution: options?.resolution,
    aspectRatio: options?.aspectRatio,
    isLifestyle: options?.isLifestyle ?? false,
    productDescription: options?.productDescription,
  });
  return { resultImageUrl: result.imageUrl };
}
