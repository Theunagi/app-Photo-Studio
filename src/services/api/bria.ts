/**
 * Background Removal — Secure Proxy via Supabase Edge Functions
 * Used for Step 5: Background Removal (Cutout) via Fal.ai Bria 2.3
 *
 * API key is kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Remove background from an image.
 * Returns a Storage URL of the result (transparent PNG).
 */
export async function removeBackground(
  imageUrl: string,
  sessionId: string,
  keepShadows = false,
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl: string }>('studio-api', {
    action: 'bg-remove',
    imageUrl,
  });
  return { resultImageUrl: result.imageUrl };
}
