/**
 * Google Gemini API — Secure Proxy via Supabase Edge Functions
 * Used for Lifestyle Generation & Vision Analysis
 *
 * API keys and prompt templates are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Generate a lifestyle image.
 * - 2K: uses synchronous endpoint (fast enough)
 * - 4K: also uses synchronous endpoint now (edge function handles long call)
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

  // Both 2K and 4K use synchronous call now — edge function handles long-running Fal.ai call
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
