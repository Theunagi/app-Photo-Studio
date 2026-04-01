/**
 * Kie.ai Nano Banana Pro — Secure Proxy via Supabase Edge Functions
 * Used for Step 2: Studio Generation (fallback)
 *
 * Note: studio-api already handles Fal.ai → NanoBanana fallback internally.
 * This function calls the same endpoint as generateStudioImage but serves
 * as the orchestrator's second-chance attempt.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Generate a studio image using NanoBanana Pro (via studio-api).
 * The server-side function handles the full Fal → NanoBanana fallback chain.
 */
export async function callNanoBananaImageGen(
  imageUrl: string,
  productDescription: string,
  options?: {
    referenceImageUrls?: string[];
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
    cameraAngle?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl: string }>('studio-api', {
    action: 'generate',
    imageUrl,
    productDescription,
    resolution: options?.resolution,
    aspectRatio: options?.aspectRatio,
    referenceImageUrls: options?.referenceImageUrls,
    cameraAngle: options?.cameraAngle,
  });
  return { resultImageUrl: result.imageUrl };
}
