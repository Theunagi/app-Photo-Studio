/**
 * OpenAI Vision API — Secure Proxy via Supabase Edge Functions
 * Used for Step 1: Product Analysis & Step 3: Luminance Check
 *
 * API keys and prompts are kept server-side in the Edge Function.
 */

import { invokeEdgeFunction } from './edgeFunctions';

export interface OpenAIVisionResponse {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
}

/**
 * Analyze a product image (Step 1).
 * Prompts are server-side — only image URLs are sent.
 */
export async function analyzeProduct(
  imageUrl: string,
  additionalImageUrls?: string[],
): Promise<OpenAIVisionResponse> {
  return invokeEdgeFunction<OpenAIVisionResponse>('openai-vision', {
    action: 'analyze',
    imageUrl,
    additionalImageUrls,
  });
}

/**
 * Check luminance of a product image (Step 3).
 */
export async function checkLuminance(imageUrl: string): Promise<'Light' | 'Dark'> {
  const result = await invokeEdgeFunction<{ classification: string }>('openai-vision', {
    action: 'luminance',
    imageUrl,
  });
  return result.classification as 'Light' | 'Dark';
}
