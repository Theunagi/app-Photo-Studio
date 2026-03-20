/**
 * Studio API — Supabase Edge Function
 *
 * Proxies all external AI API calls so that API keys and proprietary prompts
 * never leave the server. The frontend sends action + params, this function
 * injects the correct key/prompt and forwards to the external API.
 *
 * Actions:
 *   analyze   — OpenAI GPT-4o Vision (product analysis)
 *   luminance — OpenAI GPT-4o Vision (light/dark classification)
 *   generate  — Fal.ai NanoBanana Pro Edit (primary) → NanoBanana/kie.ai (fallback)
 *   bg-remove — Fal.ai Pixelcut Background Removal
 *   lifestyle — Gemini image generation
 *   edit      — Fal.ai NanoBanana Pro Edit
 *   group-images — OpenAI GPT-4o Vision (batch image grouping by similarity)
 *
 * Environment variables (Supabase Secrets):
 *   OPENAI_API_KEY, GEMINI_API_KEY, FAL_API_KEY, NANOBANANA_API_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ─── CORS (uses shared whitelist — no more wildcard *) ───────────────────────
// _corsReq is set at the start of each request to provide origin-aware headers
let _corsReq: Request | null = null;
function CORS() { return _corsReq ? corsHeaders(_corsReq) : { "Access-Control-Allow-Origin": "https://frameflow.design", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" }; }

// ─── Prompts (server-side only — never sent to frontend) ─────────────────────

const PRODUCT_ANALYSIS_SYSTEM_PROMPT = `You are a backend data ingestion bot.
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

const LUMINANCE_CHECK_SYSTEM_PROMPT = `You are a visual analysis bot. Your only job is to classify whether a product in an image is light or dark. Output exactly one word: "Light" or "Dark". No other text.`;

const STUDIO_RENDER_PROMPT = `Front orthographic commercial product render.
Keep the exact original geometry, silhouette, proportions and curvature of the uploaded product — no distortion, no perspective drift, no reshaping.
DO NOT MIRROR. DO NOT FLIP HORIZONTALLY. Maintain exact orientation.

BACKGROUND
Pure white background (#FFFFFF), seamless, clean, no texture, no yellow color cast.

CAMERA
Front orthographic.
No tilt, no rotation.
Product centered, full height inside frame, ~90% frame fill.
No hand, no props, no crop.

LIGHTING — RIMOWA Bright Edition (Default Metallic Preset)
• Key Light: intensity 1.9, softbox, 5400 K
• Fill Light: intensity 1.9, softbox, 5400 K
• Rim Light: 1.35 from right side, very soft, controlled
• Micro Side-Strip Highlight: ultra-thin, subtle edge light to shape curvature without forming a hard rim
• Contour Wrap Light: soft gradient around edges
• Top Light: subtle top diffusion for uniform highlight rolloff
• Contact Shadow: True

MATERIALS
Rebuild the material properties exactly as on the real product:
• Rubber: slightly matte, smooth tactile grain
• Plastic: satin, clean edges, no plastic CGI shine
• Metal: brushed where needed, reflectivity realistic, no chrome exaggeration
Texture Restoration = 100% (preserve all micro-textures)

ENHANCEMENT PASSES
• Clean_Surface = true (remove dust, scratches, noise)
• Geometry_Freeze = true
• Texture_Boost = +10%
• Strong Midtone Clarity Boost: more local contrast, **no sharpening halos**
• Curvature Enhancement = true
• Dual Highlight Pass = true
• Microcontrast Recovery = +18%
• Highlight Boost = +10%
• Color Depth Correction: +5% saturation, +7% contrast, gamma 0.96
• White Clip = 98.8%
• FullPipeline Mode enabled (Clean + Restore + MaterialRebuild)

OUTPUT
• Ultra-sharp, crisp, photoreal
• No artifacts, no refraction errors
• Maintain all printed labels exactly as in the image
• No added reflections
• Bright 3d render, photorealistic clean 3d textures, realistic ground shadow`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS(), "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

/** Download a URL and convert to base64 data URL */
async function urlToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.status}`);
  const blob = await resp.blob();
  const buffer = await blob.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), "")
  );
  const mime = blob.type || "image/png";
  return `data:${mime};base64,${base64}`;
}

/** Extract base64 + mimeType from a data URL */
function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URL format");
  return { mimeType: match[1], base64: match[2] };
}

// ─── Auth verification ───────────────────────────────────────────────────────

async function verifyAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) throw new Error("Missing authorization header");

  const token = authHeader.replace("Bearer ", "");

  // Dev mode bypass — ONLY in local development, NEVER in production.
  // Supabase Edge Functions set DENO_DEPLOYMENT_ID in production.
  const isProduction = !!Deno.env.get("DENO_DEPLOYMENT_ID");
  if (!isProduction) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (anonKey && token === anonKey) {
      console.log("[Edge] Dev/anon mode: anon key used as bearer — returning dev user");
      return "dev-user-00000000";
    }
  }

  // Production: verify real user JWT
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Invalid or expired token");
  return user.id;
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

/**
 * Step 1: Product Analysis — OpenAI GPT-4o Vision
 */
async function handleAnalyze(body: {
  imageUrl: string;
  additionalImageUrls?: string[];
}): Promise<Response> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return errorResponse("OpenAI API key not configured", 500);

  // Build image content parts
  const imageContent: unknown[] = [
    { type: "text", text: "Describe colors and materials and text of this product, short precise description." },
    {
      type: "image_url",
      image_url: { url: body.imageUrl, detail: "high" },
    },
  ];

  if (body.additionalImageUrls?.length) {
    // Update the text prompt for multi-view
    imageContent[0] = {
      type: "text",
      text: `Describe colors, materials, and text of this product from all ${1 + body.additionalImageUrls.length} reference views. Short precise description.`,
    };
    for (const url of body.additionalImageUrls) {
      imageContent.push({
        type: "image_url",
        image_url: { url, detail: "high" },
      });
    }
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0.1,
      top_p: 0.1,
      messages: [
        { role: "system", content: PRODUCT_ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: imageContent },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`OpenAI API error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) return errorResponse("OpenAI returned empty response", 502);

  return jsonResponse({
    text,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  });
}

/**
 * Step 3: Luminance Classification — OpenAI GPT-4o Vision
 */
async function handleLuminance(body: { imageUrl: string }): Promise<Response> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return errorResponse("OpenAI API key not configured", 500);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 10,
      temperature: 0.0,
      top_p: 0.1,
      messages: [
        { role: "system", content: LUMINANCE_CHECK_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Just tell me if the product is light or dark. Only output accepted: Light or Dark.",
            },
            {
              type: "image_url",
              image_url: { url: body.imageUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`OpenAI API error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content?.trim()?.toLowerCase() ?? "";
  const classification = text.includes("dark") ? "Dark" : "Light";

  return jsonResponse({ classification });
}

/**
 * Step 2: Studio Generation — Submit to Fal.ai queue (non-blocking).
 * Returns a request_id + provider for client-side polling via generate-poll.
 * Falls back to NanoBanana if Fal.ai submit fails.
 */
async function handleGenerateSubmit(body: {
  imageUrl: string;
  productDescription: string;
  resolution?: string;
  aspectRatio?: string;
  referenceImageUrls?: string[];
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  const nbKey = Deno.env.get("NANOBANANA_API_KEY");
  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";
  const outputFormat = resolution === "4K" ? "jpeg" : "png";
  const fullPrompt = `${STUDIO_RENDER_PROMPT}\n\n${body.productDescription}`;

  // 1) Try Fal.ai queue submit
  if (falKey) {
    try {
      console.log(`[Edge] Generate-submit: Fal.ai queue nano-banana-2/edit (${resolution}, ${outputFormat})`);

      const submitResp = await fetch(
        "https://queue.fal.run/fal-ai/nano-banana-2/edit",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Key ${falKey}`,
          },
          body: JSON.stringify({
            image_urls: [body.imageUrl],
            prompt: fullPrompt,
            resolution,
            aspect_ratio: aspectRatio,
            output_format: outputFormat,
            num_images: 1,
          }),
        }
      );

      if (!submitResp.ok) {
        const errText = await submitResp.text().catch(() => "");
        console.warn(`[Edge] Fal.ai queue submit HTTP ${submitResp.status}: ${errText.slice(0, 300)}`);
        throw new Error(`Fal.ai queue submit HTTP ${submitResp.status}`);
      }

      const submitData = await submitResp.json();
      const requestId = submitData.request_id;
      if (!requestId) throw new Error("Fal.ai queue: no request_id");

      console.log(`[Edge] Fal.ai queue request_id: ${requestId}`);
      return jsonResponse({ request_id: requestId, provider: "fal" });
    } catch (falErr) {
      console.warn("[Edge] Fal.ai submit failed, trying NanoBanana:", falErr);
    }
  }

  // 2) NanoBanana fallback submit
  if (!nbKey) {
    return errorResponse("No image generation API available", 500);
  }

  console.log("[Edge] Generate-submit: NanoBanana (fallback)");
  const createResp = await fetch("https://api.kie.ai/api/v1/jobs/createTask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${nbKey}`,
    },
    body: JSON.stringify({
      model: "nano-banana-2",
      input: {
        prompt: fullPrompt,
        image_input: [body.imageUrl, ...(body.referenceImageUrls ?? [])],
        aspect_ratio: aspectRatio,
        resolution,
        output_format: "png",
      },
    }),
  });

  if (!createResp.ok) {
    const errText = await createResp.text().catch(() => "");
    return errorResponse(`NanoBanana createTask HTTP ${createResp.status}: ${errText.slice(0, 500)}`, 502);
  }

  const createData = await createResp.json();
  if (createData.code !== 200 && createData.code !== 0) {
    return errorResponse(`NanoBanana: ${createData.message ?? createData.msg ?? JSON.stringify(createData)}`, 502);
  }

  const taskId =
    createData.data?.taskId ?? createData.data?.task_id ?? createData.taskId;
  if (!taskId) return errorResponse("NanoBanana: no taskId returned", 502);

  return jsonResponse({ request_id: taskId, provider: "nanobanana" });
}

/**
 * Step 2 Poll: Check status of a queued studio generation.
 * Returns { status, imageUrl? }
 */
async function handleGeneratePoll(body: {
  request_id: string;
  provider: string;
}): Promise<Response> {
  if (!body.request_id) return errorResponse("Missing request_id", 400);

  const provider = body.provider ?? "fal";

  if (provider === "fal") {
    const falKey = Deno.env.get("FAL_API_KEY");
    if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

    // Use full model path (with /edit) for queue status — matches submit URL
    const queueBase = "https://queue.fal.run/fal-ai/nano-banana-2/edit";
    const statusResp = await fetch(
      `${queueBase}/requests/${body.request_id}/status`,
      { headers: { Authorization: `Key ${falKey}` } }
    );

    if (!statusResp.ok) {
      const err = await statusResp.text().catch(() => "");
      console.warn(`[Edge] Fal.ai status HTTP ${statusResp.status}: ${err.slice(0, 300)}`);
      // Return IN_PROGRESS so client retries (transient status fetch failure)
      return jsonResponse({ status: "IN_PROGRESS" });
    }

    const statusData = await statusResp.json();
    console.log(`[Edge] Generate-poll (fal): ${statusData.status}`);

    if (statusData.status === "COMPLETED") {
      // Fetch actual result
      const resultResp = await fetch(
        `${queueBase}/requests/${body.request_id}`,
        { headers: { Authorization: `Key ${falKey}` } }
      );

      if (!resultResp.ok) {
        const err = await resultResp.text().catch(() => "");
        return errorResponse(`Fal.ai result fetch HTTP ${resultResp.status}: ${err.slice(0, 300)}`, 502);
      }

      const resultData = await resultResp.json();
      const resultUrl = resultData.images?.[0]?.url ?? resultData.image?.url ?? resultData.image;
      if (!resultUrl) return errorResponse("Fal.ai: no result image in completed response", 502);

      return jsonResponse({ status: "COMPLETED", imageUrl: resultUrl });
    }

    if (statusData.status === "FAILED") {
      return jsonResponse({ status: "FAILED", error: JSON.stringify(statusData).slice(0, 300) });
    }

    // IN_QUEUE or IN_PROGRESS
    return jsonResponse({ status: statusData.status ?? "IN_PROGRESS" });
  }

  if (provider === "nanobanana") {
    const nbKey = Deno.env.get("NANOBANANA_API_KEY");
    if (!nbKey) return errorResponse("NanoBanana API key not configured", 500);

    const pollResp = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${body.request_id}`,
      { headers: { Authorization: `Bearer ${nbKey}` } }
    );

    if (!pollResp.ok) {
      return jsonResponse({ status: "IN_PROGRESS" });
    }

    const pollData = await pollResp.json();
    const taskData = pollData.data ?? pollData;
    const state = taskData.state ?? taskData.status;

    if (state === "success" || state === "completed") {
      const resultJson =
        typeof taskData.resultJson === "string"
          ? JSON.parse(taskData.resultJson)
          : taskData.resultJson ?? taskData;
      const urls =
        resultJson.resultUrls ?? resultJson.result_urls ?? resultJson.output;
      const resultUrls = Array.isArray(urls) ? urls : [urls];
      if (!resultUrls?.length) {
        return errorResponse("NanoBanana: no result URLs", 502);
      }
      return jsonResponse({ status: "COMPLETED", imageUrl: resultUrls[0] });
    }

    if (state === "fail" || state === "failed" || state === "error") {
      return jsonResponse({
        status: "FAILED",
        error: taskData.failMsg ?? taskData.message ?? "Unknown",
      });
    }

    return jsonResponse({ status: "IN_PROGRESS" });
  }

  return errorResponse(`Unknown provider: ${provider}`, 400);
}

/**
 * Analyze Style References — GPT-4o Vision
 * Describes the visual style/mood of reference images for lifestyle generation.
 */
async function handleAnalyzeStyle(body: { imageUrls: string[] }): Promise<Response> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return errorResponse("OpenAI API key not configured", 500);

  const imageContent: unknown[] = [
    {
      type: "text",
      text: "Analyze these reference images and describe the visual style, mood, lighting, color palette, and composition in a concise paragraph. Focus on elements that could be replicated in a product lifestyle photo.",
    },
  ];

  for (const url of body.imageUrls) {
    imageContent.push({
      type: "image_url",
      image_url: { url, detail: "high" },
    });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 500,
      temperature: 0.3,
      messages: [
        { role: "user", content: imageContent },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`OpenAI API error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const styleDescription = data.choices?.[0]?.message?.content ?? "";
  return jsonResponse({ styleDescription });
}

/**
 * Step 5: Background Removal — Fal.ai Pixelcut
 */
async function handleBgRemove(body: { imageUrl: string }): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resp = await fetch("https://fal.run/pixelcut/background-removal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_url: body.imageUrl,
      output_format: "rgba",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Fal.ai Pixelcut error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const resultUrl = data.image?.url ?? data.image;
  if (!resultUrl) return errorResponse("Fal.ai Pixelcut: no result image", 502);

  return jsonResponse({ imageUrl: resultUrl });
}

/**
 * Lifestyle Generation — Submit to Fal.ai Queue (non-blocking)
 * Returns a request_id for polling via lifestyle-poll.
 */
async function handleLifestyleSubmit(body: {
  imageUrl: string;
  userPrompt: string;
  resolution?: string;
  aspectRatio?: string;
  styleDescription?: string;
  productDescription?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";

  let prompt = `Using this product image as reference, generate a lifestyle photo of this product ${body.userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

  if (body.productDescription) {
    prompt += `\n\nIMPORTANT — Product details (preserve exactly): ${body.productDescription}`;
  }

  if (body.styleDescription) {
    prompt += `\n\nApply this visual style: ${body.styleDescription}`;
  }

  // Submit to fal.ai QUEUE (returns immediately with request_id)
  const resp = await fetch("https://queue.fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_urls: [body.imageUrl],
      prompt,
      resolution,
      aspect_ratio: aspectRatio,
      output_format: "png",
      num_images: 1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Fal.ai queue submit error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const requestId = data.request_id;
  if (!requestId) return errorResponse("Fal.ai queue: no request_id returned", 502);

  return jsonResponse({ request_id: requestId });
}

/**
 * Lifestyle Poll — Check status of a queued Fal.ai request.
 * Returns { status, imageUrl? }
 */
async function handleLifestylePoll(body: {
  request_id: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);
  if (!body.request_id) return errorResponse("Missing request_id", 400);

  // Check status — use full model path (with /edit) matching submit URL
  const queueBase = "https://queue.fal.run/fal-ai/nano-banana-2/edit";
  const statusResp = await fetch(
    `${queueBase}/requests/${body.request_id}/status`,
    { headers: { Authorization: `Key ${falKey}` } }
  );

  if (!statusResp.ok) {
    const err = await statusResp.text().catch(() => "");
    return errorResponse(`Fal.ai status error ${statusResp.status}: ${err.slice(0, 500)}`, 502);
  }

  const statusData = await statusResp.json();

  // Queue status: IN_QUEUE, IN_PROGRESS, COMPLETED
  if (statusData.status === "COMPLETED") {
    // Fetch the actual result
    const resultResp = await fetch(
      `${queueBase}/requests/${body.request_id}`,
      { headers: { Authorization: `Key ${falKey}` } }
    );

    if (!resultResp.ok) {
      const err = await resultResp.text().catch(() => "");
      return errorResponse(`Fal.ai result error ${resultResp.status}: ${err.slice(0, 500)}`, 502);
    }

    const resultData = await resultResp.json();
    const resultUrl = resultData.images?.[0]?.url ?? resultData.image?.url ?? resultData.image;
    if (!resultUrl) return errorResponse("Fal.ai lifestyle: no result image", 502);

    return jsonResponse({ status: "COMPLETED", imageUrl: resultUrl });
  }

  // Still processing
  return jsonResponse({ status: statusData.status ?? "IN_PROGRESS" });
}

/**
 * Legacy synchronous lifestyle (kept as fallback for 2K)
 */
async function handleLifestyle(body: {
  imageUrl: string;
  userPrompt: string;
  resolution?: string;
  aspectRatio?: string;
  styleDescription?: string;
  productDescription?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";

  let prompt = `Using this product image as reference, generate a lifestyle photo of this product ${body.userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

  if (body.productDescription) {
    prompt += `\n\nIMPORTANT — Product details (preserve exactly): ${body.productDescription}`;
  }

  if (body.styleDescription) {
    prompt += `\n\nApply this visual style: ${body.styleDescription}`;
  }

  const resp = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_urls: [body.imageUrl],
      prompt,
      resolution,
      aspect_ratio: aspectRatio,
      output_format: "png",
      num_images: 1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Fal.ai lifestyle error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) return errorResponse("Fal.ai lifestyle: no result image", 502);

  return jsonResponse({ imageUrl: resultUrl });
}

/**
 * AI Edit — Fal.ai NanoBanana Pro Edit
 */
async function handleEdit(body: {
  imageUrl: string;
  userPrompt: string;
  resolution?: string;
  aspectRatio?: string;
  isLifestyle?: boolean;
  productDescription?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";
  // Use JPEG for 4K to keep file size manageable
  const outputFormat = resolution === "4K" ? "jpeg" : "png";

  const productContext = body.productDescription
    ? `\nIMPORTANT — Product details (preserve exactly): ${body.productDescription}`
    : '';

  const prompt = body.isLifestyle
    ? `Edit this product lifestyle photo. Apply: ${body.userPrompt}.
Keep the product photorealistic and true to the original.
Ultra-sharp, crisp, photoreal. Maintain all product details, labels, textures.${productContext}`
    : `Edit this product photo on white background. Apply: ${body.userPrompt}.
Keep the SAME pure white background (#FFFFFF). Keep the product photorealistic.
Maintain studio lighting (RIMOWA Bright Edition style). Same framing and composition.
Ultra-sharp, crisp, photoreal. Maintain all product details, labels, textures.${productContext}`;

  console.log(`[Edge] Edit: Fal.ai nano-banana-2/edit (${resolution}, ${outputFormat})`);
  const resp = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_urls: [body.imageUrl],
      prompt,
      resolution,
      aspect_ratio: aspectRatio,
      output_format: outputFormat,
      num_images: 1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Fal.ai edit error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const resultUrl = data.images?.[0]?.url ?? data.image?.url ?? data.image;
  if (!resultUrl) return errorResponse("Fal.ai edit: no result image", 502);

  return jsonResponse({ imageUrl: resultUrl });
}

/**
 * Group Images — OpenAI GPT-4o Vision (batch similarity grouping)
 */
async function handleGroupImages(body: {
  images: string[];
  count: number;
}): Promise<Response> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return errorResponse("OpenAI API key not configured", 500);

  const imageCount = body.count ?? body.images.length;

  const imageContent: unknown[] = [
    {
      type: "text",
      text: `I have ${imageCount} product photos. Group them by PRODUCT SIMILARITY — images showing the same product should be in the same group. Each group should get a short descriptive product name.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{"groups": [{"name": "Product Name", "indices": [0, 2], "primary": 0}], "ungrouped": []}

Rules:
- "indices" = array of 0-based image indices belonging to this group
- "primary" = index of the best/clearest photo in the group (for pipeline input)
- "ungrouped" = indices of images that don't clearly match any group
- If all images show different products, each gets its own group
- Group name should be a short product description (2-4 words max)`,
    },
  ];

  for (const dataUrl of body.images) {
    imageContent.push({
      type: "image_url",
      image_url: { url: dataUrl, detail: "low" },
    });
  }

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 1000,
      temperature: 0.1,
      top_p: 0.1,
      messages: [
        { role: "system", content: "You are a product image analysis bot. You group product photos by visual similarity. Output only valid JSON." },
        { role: "user", content: imageContent },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`OpenAI API error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";

  // Parse JSON from response (handle markdown code blocks)
  let parsed: { groups: Array<{ name: string; indices: number[]; primary: number }>; ungrouped: number[] };
  try {
    const jsonStr = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    console.error("[Edge] Failed to parse grouping JSON:", text);
    return errorResponse("Failed to parse AI grouping response", 502);
  }

  // Validate structure
  if (!Array.isArray(parsed.groups)) {
    return errorResponse("Invalid grouping response structure", 502);
  }

  return jsonResponse(parsed);
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  _corsReq = req;
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  // Verify auth
  try {
    await verifyAuth(req);
  } catch (err) {
    return errorResponse(
      `Auth failed: ${err instanceof Error ? err.message : String(err)}`,
      401
    );
  }

  // Parse body
  let body: { action: string; [key: string]: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const { action } = body;
  if (!action) return errorResponse("Missing action field", 400);

  console.log(`[Edge] Action: ${action}`);

  try {
    switch (action) {
      case "analyze":
        return await handleAnalyze(
          body as { action: string; imageUrl: string; additionalImageUrls?: string[] }
        );

      case "luminance":
        return await handleLuminance(body as { action: string; imageUrl: string });

      case "generate":
      case "generate-submit":
        return await handleGenerateSubmit(
          body as {
            action: string;
            imageUrl: string;
            productDescription: string;
            resolution?: string;
            aspectRatio?: string;
            referenceImageUrls?: string[];
          }
        );

      case "generate-poll":
        return await handleGeneratePoll(
          body as { action: string; request_id: string; provider: string }
        );

      case "analyze-style":
        return await handleAnalyzeStyle(body as { action: string; imageUrls: string[] });

      case "bg-remove":
        return await handleBgRemove(body as { action: string; imageUrl: string });

      case "lifestyle":
        return await handleLifestyle(
          body as {
            action: string;
            imageUrl: string;
            userPrompt: string;
            resolution?: string;
            aspectRatio?: string;
            styleDescription?: string;
            productDescription?: string;
          }
        );

      case "lifestyle-submit":
        return await handleLifestyleSubmit(
          body as {
            action: string;
            imageUrl: string;
            userPrompt: string;
            resolution?: string;
            aspectRatio?: string;
            styleDescription?: string;
            productDescription?: string;
          }
        );

      case "lifestyle-poll":
        return await handleLifestylePoll(
          body as { action: string; request_id: string }
        );

      case "edit":
        return await handleEdit(
          body as {
            action: string;
            imageUrl: string;
            userPrompt: string;
            resolution?: string;
            aspectRatio?: string;
            isLifestyle?: boolean;
            productDescription?: string;
          }
        );

      case "group-images":
        return await handleGroupImages(
          body as { action: string; images: string[]; count: number }
        );

      default:
        return errorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    console.error(`[Edge] Error in ${action}:`, err);
    return errorResponse(
      `Server error: ${err instanceof Error ? err.message : String(err)}`,
      500
    );
  }
});
