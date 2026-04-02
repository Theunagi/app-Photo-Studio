import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { fetchImageAsDataUrl } from '../_shared/storage.ts';
import { PRODUCT_ANALYSIS_SYSTEM_PROMPT, LUMINANCE_CHECK_SYSTEM_PROMPT } from '../_shared/prompts.ts';

const ALLOWED_URL_PATTERNS = [
  /^https:\/\/.*\.supabase\.co\//,
  /^https:\/\/fal\.media\//,
  /^https:\/\/.*\.fal\.run\//,
  /^https:\/\/storage\.googleapis\.com\//,
  /^https:\/\/.*\.kie\.ai\//,
  /^https:\/\/.*\.replicate\.delivery\//,
  /^https:\/\/oaidalleapiprodscus\.blob\.core\.windows\.net\//,
  /^https:\/\/generativelanguage\.googleapis\.com\//,
  /^data:image\//,
];

function isAllowedUrl(url: string): boolean {
  return ALLOWED_URL_PATTERNS.some(pattern => pattern.test(url));
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await verifyAuth(req);

    const { action, imageUrl, additionalImageUrls } = await req.json();

    if (!action || !imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing action or imageUrl' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Validate all user-supplied URLs against allowlist
    if (!isAllowedUrl(imageUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid image URL' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }
    if (additionalImageUrls?.length) {
      for (const url of additionalImageUrls) {
        if (!isAllowedUrl(url)) {
          return new Response(JSON.stringify({ error: 'Invalid image URL' }), {
            status: 400,
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          });
        }
      }
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    // Fetch primary image as data URL
    const primaryDataUrl = await fetchImageAsDataUrl(imageUrl);

    // Fetch additional images if provided
    const additionalDataUrls: string[] = [];
    if (additionalImageUrls?.length) {
      for (const url of additionalImageUrls) {
        additionalDataUrls.push(await fetchImageAsDataUrl(url));
      }
    }

    let systemPrompt: string;
    let userPrompt: string;
    let maxTokens: number;
    let temperature: number;

    if (action === 'analyze') {
      systemPrompt = PRODUCT_ANALYSIS_SYSTEM_PROMPT;
      userPrompt = additionalDataUrls.length > 0
        ? `Describe colors, materials, and text of this product from all ${1 + additionalDataUrls.length} reference views. Short precise description.`
        : 'Describe colors and materials and text of this product, short precise description.';
      maxTokens = 800;
      temperature = 0.1;
    } else if (action === 'luminance') {
      systemPrompt = LUMINANCE_CHECK_SYSTEM_PROMPT;
      userPrompt = 'Just tell me if the product is light or dark. Only output accepted: Light or Dark.';
      maxTokens = 10;
      temperature = 0.0;
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const imageContent = [
      { type: 'text', text: userPrompt },
      { type: 'image_url', image_url: { url: primaryDataUrl, detail: 'high' } },
      ...additionalDataUrls.map(url => ({
        type: 'image_url' as const,
        image_url: { url, detail: 'high' as const },
      })),
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: maxTokens,
        temperature,
        top_p: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: imageContent },
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

    const text = choice.message.content;

    if (action === 'luminance') {
      const normalized = text.trim().toLowerCase();
      const classification = normalized.includes('dark') ? 'Dark' : 'Light';
      return new Response(JSON.stringify({ classification }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      text,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    }), {
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes('auth') || message.includes('Authorization') ? 401 : 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
