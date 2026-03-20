/**
 * Google Gemini API — Secure Proxy via Supabase Edge Functions
 * Used for Lifestyle Generation & Vision Analysis
 *
 * API keys and prompt templates are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/** Polling interval for queue-based generation (ms) */
const POLL_INTERVAL = 3000;

/**
 * Generate a lifestyle image.
 * - 2K: uses synchronous endpoint (fast enough)
 * - 4K: uses queue-based async flow to avoid worker timeout
 */
export async function generateLifestyleImage(
  imageUrl: string,
  lifestylePrompt: string,
  options?: {
    referenceImageUrls?: string[];
    imageSize?: string;
    aspectRatio?: string;
    sessionId?: string;
    styleDescription?: string;
    /** Product description from pipeline analysis (texts, colors, materials) */
    productDescription?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const resolution = options?.imageSize ?? '2K';

  // 4K uses queue to avoid WORKER_LIMIT on Supabase Edge Functions
  if (resolution === '4K') {
    return generateLifestyleQueued(imageUrl, lifestylePrompt, options);
  }

  // 2K uses synchronous call (fast enough)
  const result = await invokeEdgeFunction<{ imageUrl?: string; imageDataUrl?: string }>('studio-api', {
    action: 'lifestyle',
    imageUrl,
    userPrompt: lifestylePrompt,
    resolution,
    aspectRatio: options?.aspectRatio,
    styleDescription: options?.styleDescription,
    productDescription: options?.productDescription,
  });
  return { resultImageUrl: result.imageUrl ?? result.imageDataUrl ?? '' };
}

/**
 * Queue-based lifestyle generation (for 4K or heavy workloads).
 * Submits job → polls for result → returns image URL.
 */
async function generateLifestyleQueued(
  imageUrl: string,
  lifestylePrompt: string,
  options?: {
    imageSize?: string;
    aspectRatio?: string;
    styleDescription?: string;
    productDescription?: string;
  },
): Promise<{ resultImageUrl: string }> {
  // Step 1: Submit to queue
  const submitResult = await invokeEdgeFunction<{ request_id: string }>('studio-api', {
    action: 'lifestyle-submit',
    imageUrl,
    userPrompt: lifestylePrompt,
    resolution: options?.imageSize,
    aspectRatio: options?.aspectRatio,
    styleDescription: options?.styleDescription,
    productDescription: options?.productDescription,
  }, { timeoutMs: 60_000 });

  const requestId = submitResult.request_id;
  if (!requestId) throw new Error('No request_id returned from queue submit');

  // Step 2: Poll for completion
  const MAX_POLLS = 60; // 60 × 3s = 180s max wait
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL);

    let pollResult: { status: string; imageUrl?: string };
    try {
      pollResult = await invokeEdgeFunction<{ status: string; imageUrl?: string }>('studio-api', {
        action: 'lifestyle-poll',
        request_id: requestId,
      }, { timeoutMs: 20_000 });
      consecutiveErrors = 0; // Reset on successful poll
    } catch (err) {
      consecutiveErrors++;
      console.warn(`[Lifestyle Poll] Error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}:`, err);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error('Lifestyle generation failed: unable to check status after multiple attempts');
      }
      continue; // Retry poll
    }

    if (pollResult.status === 'COMPLETED' && pollResult.imageUrl) {
      return { resultImageUrl: pollResult.imageUrl };
    }

    if (pollResult.status !== 'IN_QUEUE' && pollResult.status !== 'IN_PROGRESS' && pollResult.status !== 'COMPLETED') {
      throw new Error(`Generation failed with status: ${pollResult.status}`);
    }
  }

  throw new Error('Generation timed out after 3 minutes');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Analyze style reference images via GPT-4o Vision (Edge Function).
 */
export async function analyzeStyleReferences(
  imageUrls: string[],
): Promise<{ styleDescription: string }> {
  const result = await invokeEdgeFunction<{ styleDescription: string }>('studio-api', {
    action: 'analyze-style',
    imageUrls,
  });
  return { styleDescription: result.styleDescription ?? '' };
}

/**
 * Call Gemini Vision for text-only analysis (fallback).
 * Note: studio-api doesn't have a 'vision' action — this uses 'analyze' as fallback.
 */
export async function callGeminiVision(
  imageUrl: string,
  _visionPrompt: string,
): Promise<{ text: string }> {
  return invokeEdgeFunction<{ text: string }>('studio-api', {
    action: 'analyze',
    imageUrl,
  });
}
