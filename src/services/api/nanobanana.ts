/**
 * Kie.ai Nano Banana Pro — Secure Proxy via Supabase Edge Functions
 * Used for Step 2: Studio Generation (fallback)
 *
 * API key and studio prompt are kept server-side in the Edge Function.
 * Async workflow: create → poll → get result URL
 */

import { invokeEdgeFunction } from './edgeFunctions';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max

/**
 * Generate a studio image using NanoBanana Pro (async).
 * Handles: create task → poll → return Storage URL
 */
export async function callNanoBananaImageGen(
  imageUrl: string,
  productDescription: string,
  options?: {
    referenceImageUrls?: string[];
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
  },
): Promise<{ resultImageUrl: string }> {
  // Step 1: Create task
  const createResult = await invokeEdgeFunction<{ taskId: string }>('nanobanana-generate', {
    action: 'create',
    imageUrl,
    referenceImageUrls: options?.referenceImageUrls,
    productDescription,
    resolution: options?.resolution,
    aspectRatio: options?.aspectRatio,
  });

  const { taskId } = createResult;

  // Step 2: Poll for result
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    const pollResult = await invokeEdgeFunction<{
      status: string;
      resultImageUrl?: string;
      error?: string;
    }>('nanobanana-generate', {
      action: 'poll',
      taskId,
      sessionId: options?.sessionId,
    });

    if (pollResult.status === 'completed' && pollResult.resultImageUrl) {
      return { resultImageUrl: pollResult.resultImageUrl };
    }

    if (pollResult.status === 'failed') {
      throw new Error(`NanoBanana task failed: ${pollResult.error ?? 'Unknown error'}`);
    }
  }

  throw new Error('NanoBanana task timed out after 5 minutes');
}
