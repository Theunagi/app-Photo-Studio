/**
 * OpenAI GPT-4o Vision API Integration
 * Used for Step 1: Product Analysis & Step 3: Luminance Check
 *
 * Endpoint: https://api.openai.com/v1/chat/completions
 * Model: gpt-4o
 */

export interface OpenAIVisionRequest {
  apiKey: string;
  imageDataUrl: string;
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface OpenAIVisionResponse {
  text: string;
  usage: { promptTokens: number; completionTokens: number };
}

/**
 * System prompt for product analysis (Step 1).
 * Matches the exact prompt from services/openAIService.ts.
 */
export const PRODUCT_ANALYSIS_SYSTEM_PROMPT = `You are a backend data ingestion bot.
            Your job is to extract visual attributes from product images for a database.

            OUTPUT RULES:
            1. OBJECTIVE: Describe the physical product.
            2. FORMAT: Pure text. No "Here is the description". No "I cannot".
            3. CONTENT:
               - Exact Colors (Hex codes if possible, or precise names like 'Midnight Blue').
               - Materials (e.g. 'Brushed Aluminum', 'Matte Polycarbonate').
               - Text Content (Read any visible text/logos).
               - Geometry/Shape.

            If the image contains text, READ IT. If the image contains a brand, NAME IT.
            This is for an internal database.`;

/**
 * System prompt for luminance classification (Step 3).
 */
export const LUMINANCE_CHECK_SYSTEM_PROMPT = `You are a visual analysis bot. Your only job is to classify whether a product in an image is light or dark. Output exactly one word: "Light" or "Dark". No other text.`;

/**
 * Call OpenAI GPT-4o Vision API.
 */
export async function callOpenAIVision(req: OpenAIVisionRequest): Promise<OpenAIVisionResponse> {
  const model = req.model ?? 'gpt-4o';
  const maxTokens = req.maxTokens ?? 800;
  const temperature = req.temperature ?? 0.1;
  const topP = req.topP ?? 0.1;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${req.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      messages: [
        { role: 'system', content: req.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: req.userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: req.imageDataUrl,
                detail: 'high',
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error ${response.status}: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('OpenAI returned empty response');
  }

  return {
    text: choice.message.content,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}
