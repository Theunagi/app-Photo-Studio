/**
 * Google Gemini API — Secure Proxy via Supabase Edge Functions
 * Used for Lifestyle Generation & Vision Analysis
 *
 * API keys and prompt templates are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

/**
 * Generate a lifestyle image using Gemini.
 * Returns a Storage URL (not base64).
 */
export async function generateLifestyleImage(
  imageUrl: string,
  lifestylePrompt: string,
  options?: {
    referenceImageUrls?: string[];
    imageSize?: string;
    aspectRatio?: string;
    sessionId?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl?: string; imageDataUrl?: string }>('studio-api', {
    action: 'lifestyle',
    imageUrl,
    userPrompt: lifestylePrompt,
    resolution: options?.imageSize,
    aspectRatio: options?.aspectRatio,
  });
  // studio-api may return imageUrl (Storage URL) or imageDataUrl (base64 fallback)
  return { resultImageUrl: result.imageUrl ?? result.imageDataUrl ?? '' };
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
