import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { downloadAndStore } from '../_shared/storage.ts';

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

    const { imageUrl, keepShadows, sessionId } = await req.json();

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing imageUrl' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    if (!isAllowedUrl(imageUrl)) {
      return new Response(JSON.stringify({ error: 'Invalid image URL' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) throw new Error('FAL_API_KEY not configured');

    // Call Fal.ai Bria — accepts public URLs directly
    const response = await fetch('https://fal.run/fal-ai/bria/background/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falApiKey}`,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        keep_shadows: keepShadows ?? false,
      }),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`Fal.ai Bria API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const resultUrl = data.image?.url ?? data.image;
    if (!resultUrl) {
      throw new Error('Fal.ai Bria returned no result image');
    }

    // Download result and store in our Storage
    const sid = sessionId ?? crypto.randomUUID();
    const storagePath = `temp-results/${sid}/bg-removed-${Date.now()}.png`;

    let resultImageUrl: string;
    if (resultUrl.startsWith('data:')) {
      const base64 = resultUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { error } = await supabase.storage
        .from('project-images')
        .upload(storagePath, bytes, { contentType: 'image/png', upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
      const { data: urlData } = supabase.storage.from('project-images').getPublicUrl(storagePath);
      resultImageUrl = urlData.publicUrl;
    } else {
      resultImageUrl = await downloadAndStore(resultUrl, storagePath);
    }

    return new Response(JSON.stringify({ resultImageUrl }), {
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
