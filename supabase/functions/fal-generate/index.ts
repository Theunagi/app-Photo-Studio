import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { downloadAndStore } from '../_shared/storage.ts';
import { buildStudioPrompt, buildEditPrompt } from '../_shared/prompts.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await verifyAuth(req);

    const { action, imageUrl, productDescription, editPrompt, resolution, aspectRatio, sessionId } = await req.json();

    if (!action || !imageUrl) {
      return new Response(JSON.stringify({ error: 'Missing action or imageUrl' }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    const falApiKey = Deno.env.get('FAL_API_KEY');
    if (!falApiKey) throw new Error('FAL_API_KEY not configured');

    let prompt: string;
    if (action === 'studio') {
      if (!productDescription) {
        return new Response(JSON.stringify({ error: 'Missing productDescription for studio action' }), {
          status: 400,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      prompt = buildStudioPrompt(productDescription);
    } else if (action === 'edit') {
      if (!editPrompt) {
        return new Response(JSON.stringify({ error: 'Missing editPrompt for edit action' }), {
          status: 400,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }
      prompt = buildEditPrompt(editPrompt);
    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
        status: 400,
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });
    }

    // Call Fal.ai — it accepts public URLs directly
    const response = await fetch('https://fal.run/fal-ai/nano-banana-pro/edit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${falApiKey}`,
      },
      body: JSON.stringify({
        image_urls: [imageUrl],
        prompt,
        resolution: resolution ?? '2K',
        aspect_ratio: aspectRatio ?? '1:1',
        output_format: 'png',
        num_images: 1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Fal.ai HTTP ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = await response.json();
    const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
    if (!resultUrl) {
      throw new Error(`Fal.ai: no result image: ${JSON.stringify(data).slice(0, 300)}`);
    }

    // If result is a URL, download and store in our Storage
    const sid = sessionId ?? crypto.randomUUID();
    const suffix = action === 'studio' ? 'studio' : 'edit';
    const storagePath = `temp-results/${sid}/fal-${suffix}-${Date.now()}.png`;

    let resultImageUrl: string;
    if (resultUrl.startsWith('data:')) {
      // Base64 result — extract and upload
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
