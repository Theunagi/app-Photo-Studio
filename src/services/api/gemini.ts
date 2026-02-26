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
  return invokeEdgeFunction<{ resultImageUrl: string }>('gemini-generate', {
    action: 'lifestyle',
    imageUrl,
    lifestylePrompt,
    referenceImageUrls: options?.referenceImageUrls,
    imageSize: options?.imageSize,
    aspectRatio: options?.aspectRatio,
    sessionId: options?.sessionId,
  });
}

/**
 * Call Gemini Vision for text-only analysis (fallback).
 */
export async function callGeminiVision(
  imageUrl: string,
  visionPrompt: string,
): Promise<{ text: string }> {
  return invokeEdgeFunction<{ text: string }>('gemini-generate', {
    action: 'vision',
    imageUrl,
    visionPrompt,
  });
}
