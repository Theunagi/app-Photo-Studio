import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { fetchImageAsBase64, downloadAndStore } from '../_shared/storage.ts';
import { buildLifestylePrompt } from '../_shared/prompts.ts';

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

    const { action, imageUrl, referenceImageUrls, referenceImageUrl, lifestylePrompt, visionPrompt, imageSize, aspectRatio, sessionId } = await req.json();

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
    if (referenceImageUrls?.length) {
      for (const refUrl of referenceImageUrls) {
        if (!isAllowedUrl(refUrl)) {
          return new Response(JSON.stringify({ error: 'Invalid reference image URL' }), {
            status: 400,
            headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
          });
        }
      }
    }
    if (referenceImageUrl && !isAllowedUrl(referenceImageUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid reference image URL' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    if (action === 'lifestyle') {
      if (!lifestylePrompt) {
        return new Response(JSON.stringify({ error: 'Missing lifestylePrompt' }), {
          status: 400,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const model = 'gemini-3-pro-image-preview';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Fetch primary image
      const primary = await fetchImageAsBase64(imageUrl);
      const imageParts: { inlineData: { mimeType: string; data: string } }[] = [
        { inlineData: { mimeType: primary.mimeType, data: primary.base64 } },
      ];

      // Fetch reference images (array or single)
      if (referenceImageUrls?.length) {
        for (const refUrl of referenceImageUrls) {
          const ref = await fetchImageAsBase64(refUrl);
          imageParts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
        }
      } else if (referenceImageUrl) {
        const ref = await fetchImageAsBase64(referenceImageUrl);
        imageParts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
      }

      const refLabel = imageParts.length > 1
        ? `[REFERENCE IMAGES: ${imageParts.length} views of the product — use as geometry/color/texture reference ONLY. Generate a completely NEW studio-lit product render based on these references.]`
        : '[REFERENCE IMAGE: Front View — use this as geometry/color reference ONLY. Generate a completely NEW studio-lit product render based on this reference.]';

      const fullPrompt = buildLifestylePrompt(lifestylePrompt);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: refLabel },
              ...imageParts,
              { text: fullPrompt },
            ],
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            imageConfig: {
              imageSize: imageSize ?? '2K',
              aspectRatio: aspectRatio ?? '1:1',
            },
          },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(err)}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error(`Gemini: no candidates returned. BlockReason: ${data.promptFeedback?.blockReason ?? 'none'}`);
      }

      const parts = candidate.content?.parts;
      if (!parts?.length) {
        throw new Error(`Gemini: empty parts. FinishReason: ${candidate.finishReason}`);
      }

      let imageBase64 = '';
      let imageMimeType = 'image/png';

      for (const part of parts) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          imageMimeType = part.inlineData.mimeType ?? 'image/png';
        }
        if (part.inline_data) {
          imageBase64 = part.inline_data.data;
          imageMimeType = part.inline_data.mime_type ?? 'image/png';
        }
      }

      if (!imageBase64) {
        throw new Error('Gemini did not return an image');
      }

      // Upload result to Storage
      const binary = atob(imageBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const sid = sessionId ?? crypto.randomUUID();
      const storagePath = `temp-results/${sid}/gemini-lifestyle-${Date.now()}.png`;

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      const { error: uploadError } = await supabase.storage
        .from('project-images')
        .upload(storagePath, bytes, { contentType: imageMimeType, upsert: true });
      if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(storagePath);

      return new Response(JSON.stringify({ resultImageUrl: urlData.publicUrl }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });

    } else if (action === 'vision') {
      const model = 'gemini-2.0-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: visionPrompt ?? '' },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: { maxOutputTokens: 500 },
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error ${response.status}: ${JSON.stringify(err)}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned empty text response');

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: message.includes('auth') || message.includes('Authorization') ? 401 : 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
});
