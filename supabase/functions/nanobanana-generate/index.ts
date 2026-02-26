import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { verifyAuth } from '../_shared/auth.ts';
import { downloadAndStore } from '../_shared/storage.ts';
import { buildStudioPrompt } from '../_shared/prompts.ts';

const API_BASE = 'https://api.kie.ai/api/v1/jobs';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await verifyAuth(req);

    const body = await req.json();
    const { action } = body;

    const apiKey = Deno.env.get('NANOBANANA_API_KEY');
    if (!apiKey) throw new Error('NANOBANANA_API_KEY not configured');

    if (action === 'create') {
      const { imageUrl, referenceImageUrls, productDescription, resolution, aspectRatio } = body;

      if (!imageUrl || !productDescription) {
        return new Response(JSON.stringify({ error: 'Missing imageUrl or productDescription' }), {
          status: 400,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const prompt = buildStudioPrompt(productDescription);
      const imageUrls = [imageUrl, ...(referenceImageUrls ?? [])];

      const response = await fetch(`${API_BASE}/createTask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'nano-banana-pro',
          input: {
            prompt,
            image_input: imageUrls,
            aspect_ratio: aspectRatio ?? '1:1',
            resolution: resolution ?? '2K',
            output_format: 'png',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`NanoBanana createTask HTTP ${response.status}: ${errText.slice(0, 500)}`);
      }

      const data = await response.json();
      if (data.code !== 200 && data.code !== 0) {
        throw new Error(`NanoBanana createTask: ${data.message ?? data.msg ?? JSON.stringify(data)}`);
      }

      const taskId = data.data?.taskId ?? data.data?.task_id ?? data.taskId;
      if (!taskId) throw new Error(`NanoBanana: no taskId in response`);

      return new Response(JSON.stringify({ taskId }), {
        headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
      });

    } else if (action === 'poll') {
      const { taskId, sessionId } = body;

      if (!taskId) {
        return new Response(JSON.stringify({ error: 'Missing taskId' }), {
          status: 400,
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const response = await fetch(`${API_BASE}/recordInfo?taskId=${taskId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ status: 'processing' }), {
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      const data = await response.json();
      const taskData = data.data ?? data;
      const state = taskData.state ?? taskData.status;

      if (state === 'success' || state === 'completed') {
        const resultJson = typeof taskData.resultJson === 'string'
          ? JSON.parse(taskData.resultJson)
          : taskData.resultJson ?? taskData;
        const urls = resultJson.resultUrls ?? resultJson.result_urls ?? resultJson.output;
        const resultUrlList = Array.isArray(urls) ? urls : [urls];

        if (!resultUrlList?.length || !resultUrlList[0]) {
          throw new Error('NanoBanana: no result URLs returned');
        }

        // Download and store result
        const sid = sessionId ?? crypto.randomUUID();
        const storagePath = `temp-results/${sid}/nanobanana-${Date.now()}.png`;
        const resultImageUrl = await downloadAndStore(resultUrlList[0], storagePath);

        return new Response(JSON.stringify({ status: 'completed', resultImageUrl }), {
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      if (state === 'fail' || state === 'failed' || state === 'error') {
        return new Response(JSON.stringify({
          status: 'failed',
          error: taskData.failMsg ?? taskData.message ?? 'Unknown error',
        }), {
          headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ status: 'processing' }), {
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
