/**
 * Fal.ai NanoBanana Pro Edit — Secure Proxy via Supabase Edge Functions
 * Used for Step 2: Studio Generation (primary) & AI Edit feature
 *
 * API keys and studio prompt are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Generate a studio image (Step 2 — primary).
 * Uses submit + poll pattern to avoid edge function timeout.
 * The full studio prompt (RIMOWA Bright Edition) is assembled server-side.
 */
export async function generateStudioImage(
  imageUrl: string,
  productDescription: string,
  options?: {
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
  },
): Promise<{ resultImageUrl: string }> {
  // 1) Submit to queue — returns immediately with request_id
  const submit = await invokeEdgeFunction<{ request_id: string; provider: string }>(
    'studio-api',
    {
      action: 'generate-submit',
      imageUrl,
      productDescription,
      resolution: options?.resolution,
      aspectRatio: options?.aspectRatio,
    },
    { timeoutMs: 60_000 },
  );

  // 2) Poll for result from client (each poll is a short edge function call)
  const POLL_INTERVAL = 5_000; // 5s between polls
  const MAX_POLLS = 36;        // 36 × 5s = 180s max wait
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    let poll: { status: string; imageUrl?: string; error?: string };
    try {
      poll = await invokeEdgeFunction<{
        status: string;
        imageUrl?: string;
        error?: string;
      }>('studio-api', {
        action: 'generate-poll',
        request_id: submit.request_id,
        provider: submit.provider,
      }, { timeoutMs: 20_000 });
      consecutiveErrors = 0; // Reset on successful poll
    } catch (err) {
      consecutiveErrors++;
      console.warn(`[Poll] Error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}:`, err);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error('Studio generation failed: unable to check status after multiple attempts');
      }
      continue; // Retry poll
    }

    if (poll.status === 'COMPLETED' && poll.imageUrl) {
      return { resultImageUrl: poll.imageUrl };
    }

    if (poll.status === 'FAILED') {
      throw new Error(`Studio generation failed: ${poll.error ?? 'Unknown error'}`);
    }

    // IN_QUEUE or IN_PROGRESS — keep polling
  }

  throw new Error('Studio generation timed out after 180s');
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
