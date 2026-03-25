/**
 * Google Gemini API — Secure Proxy via Supabase Edge Functions
 * Used for Lifestyle Generation & Vision Analysis
 *
 * API keys and prompt templates are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/** Polling interval for queue-based generation (ms) */
const POLL_INTERVAL = 3000;
/** Max polling time before giving up (ms) — 3 minutes */
const POLL_TIMEOUT = 180_000;

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
    /** Style mode: 'replicate' uses style as main prompt, 'inspire' appends it */
    styleMode?: 'inspire' | 'replicate';
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
    styleMode: options?.styleMode,
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
    styleMode?: 'inspire' | 'replicate';
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
    styleMode: options?.styleMode,
  });

  const requestId = submitResult.request_id;
  if (!requestId) throw new Error('No request_id returned from queue submit');

  // Step 2: Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < POLL_TIMEOUT) {
    await sleep(POLL_INTERVAL);

    const pollResult = await invokeEdgeFunction<{ status: string; imageUrl?: string }>('studio-api', {
      action: 'lifestyle-poll',
      request_id: requestId,
    });

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
 * Mode "S'inspirer" — returns a short mood/palette/lighting description.
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
 * Analyze style for exact replication via GPT-4o Vision (Edge Function).
 * Mode "Répliquer" — uses the full art director prompt to generate a
 * detailed, production-ready prompt that replicates the exact scene.
 */
export async function analyzeStyleReplicate(
  imageUrls: string[],
  productDescription?: string,
): Promise<{ styleDescription: string }> {
  const result = await invokeEdgeFunction<{ styleDescription: string }>('studio-api', {
    action: 'analyze-style-replicate',
    imageUrls,
    productDescription,
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

/**
 * Resize / reposition a product in a lifestyle scene.
 *
 * Takes a lifestyle image with a bright-green rectangle overlay indicating
 * where the product should be placed, plus the product cutout as a reference
 * image. Gemini replaces the green rectangle with the product at the correct
 * size and position while keeping the rest of the scene intact.
 */
export async function resizeLifestyleImage(
  annotatedImageUrl: string,
  productCutoutUrl: string,
  options?: {
    imageSize?: string;
    aspectRatio?: string;
    productDescription?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const resolution = options?.imageSize ?? '2K';

  const result = await invokeEdgeFunction<{ imageUrl?: string; imageDataUrl?: string }>('studio-api', {
    action: 'lifestyle',
    imageUrl: annotatedImageUrl,
    referenceImageUrl: productCutoutUrl,
    userPrompt:
      'This image has a bright green rectangle overlay. The green rectangle indicates EXACTLY where the product should be placed and at what size. Replace the green rectangle area with the product shown in the reference image. The product must fit precisely within the green rectangle boundaries. Remove the green overlay completely. Keep the rest of the scene identical — same background, lighting, shadows, and perspective. Generate realistic shadows and reflections for the product at its new position.',
    resolution,
    aspectRatio: options?.aspectRatio,
    productDescription: options?.productDescription,
  });

  return { resultImageUrl: result.imageUrl ?? result.imageDataUrl ?? '' };
}
