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

  // Dev mode: if token is the anon key (public, already in frontend),
  // allow bypass for local development only.
  // The anon key is NOT a user JWT so getUser() would reject it.
  // TODO: Remove this bypass before production launch with real users.
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (anonKey && token === anonKey) {
    console.log("[Edge] Dev/anon mode: anon key used as bearer — returning dev user");
    return "dev-user-00000000";
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
 * Step 2: Studio Generation — Fal.ai (primary) → NanoBanana/kie.ai (fallback)
 */
async function handleGenerate(body: {
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
  // Use JPEG for 4K to keep file size under OpenAI's 20MB URL limit
  const outputFormat = resolution === "4K" ? "jpeg" : "png";
  const fullPrompt = `${STUDIO_RENDER_PROMPT}\n\n${body.productDescription}`;

  // 1) Try Fal.ai NanoBanana Pro Edit — PRIMARY
  if (falKey) {
    try {
      console.log(`[Edge] Generate: trying Fal.ai nano-banana-2/edit (${resolution}, ${outputFormat})`);
      const falResp = await fetch(
        "https://fal.run/fal-ai/nano-banana-2/edit",
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

      if (!falResp.ok) {
        const errText = await falResp.text().catch(() => "");
        console.warn(`[Edge] Fal.ai HTTP ${falResp.status}: ${errText.slice(0, 300)}`);
        throw new Error(`Fal.ai HTTP ${falResp.status}`);
      }

      const falData = await falResp.json();
      const resultUrl =
        falData.images?.[0]?.url ?? falData.image?.url ?? falData.image;
      if (!resultUrl) throw new Error("Fal.ai: no result image");

      return jsonResponse({ imageUrl: resultUrl });
    } catch (falErr) {
      console.warn("[Edge] Fal.ai failed, trying NanoBanana:", falErr);
    }
  }

  // 2) NanoBanana Pro (kie.ai) — FALLBACK
  if (!nbKey) {
    return errorResponse("No image generation API available", 500);
  }

  console.log("[Edge] Generate: trying NanoBanana (fallback)");
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

  // Poll for result
  const POLL_INTERVAL = 5000;
  const MAX_POLLS = 60;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));

    const pollResp = await fetch(
      `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${nbKey}` } }
    );

    if (!pollResp.ok) continue;

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
      return jsonResponse({ imageUrl: resultUrls[0] });
    }

    if (state === "fail" || state === "failed" || state === "error") {
      return errorResponse(
        `NanoBanana task failed: ${taskData.failMsg ?? taskData.message ?? "Unknown"}`,
        502
      );
    }
  }

  return errorResponse("NanoBanana task timed out (5 min)", 504);
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

  // Convert image URLs to base64 so OpenAI can always access them
  for (const url of body.imageUrls) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const { mimeType, base64 } = parseDataUrl(dataUrl);
      imageContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
      });
    } catch {
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
 * Analyze Style for Replication — GPT-4o Vision (Art Director Prompt)
 * Returns a detailed, production-ready image generation prompt that
 * replicates the exact visual style of the reference image(s).
 */
async function handleAnalyzeStyleReplicate(body: { imageUrls: string[]; productDescription?: string }): Promise<Response> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return errorResponse("OpenAI API key not configured", 500);

  const systemPrompt = `Role
You are a senior advertising art director and visual analyst specializing in premium commercial imagery. Your task is to analyze the visual style of a reference image and translate it into a production-ready image generation prompt for a generative image model.

Critical Rule
Do NOT describe the product itself. Only reference it as "referenced product" in the prompt, because it will be used for new generation. Assume the product will be replaced. Focus exclusively on style, mood, composition, lighting, camera language, materials, and post-production aesthetics.

Step 1 — Style Deconstruction (Internal Analysis)
Analyze the reference image across these dimensions:
- Overall Visual Intent: Commercial goal, emotional tone, perceived budget level and brand positioning
- Composition & Framing: Camera distance, perspective, negative space, balance
- Lighting Design: Light type, key/fill/rim behavior, shadow softness, reflections, specular control
- Color & Material Language: Color palette, background treatment, surface qualities, color grading style
- Camera & Optics: Lens feel, depth of field, sharpness vs softness, grain or ultra-clean finish
- Post-Production & Finish: Retouching level, contrast curve, bloom, glow, micro-contrast, CGI vs photographic realism
- Physical Scene Interaction & Material Dynamics: Degree of occlusion, environmental material type, interaction mode, particle behavior, visual hierarchy, tactile implication

Step 2 — Prompt Synthesis
Transform the analysis into a single cohesive prompt optimized for an image generation model. The prompt must:
- Be product-agnostic (use placeholders like "the referenced product")
- Sound like a luxury advertising brief
- Be precise, visual, and unambiguous
- Avoid storytelling unrelated to visuals
- Avoid brand names unless explicitly requested

Optional: Add a short negative prompt section if relevant (e.g. "no clutter, no text, no logos").

STRICTLY FOLLOW: Only return the prompt itself, no other text or headlines. No "image generation prompt" in the beginning.`;

  // Convert image URLs to base64 data URLs so OpenAI can always access them
  // (Supabase Storage public URLs may not be reachable from OpenAI's servers)
  const imageContent: unknown[] = [
    {
      type: "text",
      text: "Analyze the visual style of this reference image and create a production-ready prompt to replicate it exactly with a different product.",
    },
  ];

  for (const url of body.imageUrls) {
    try {
      const dataUrl = await urlToDataUrl(url);
      const { mimeType, base64 } = parseDataUrl(dataUrl);
      imageContent.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
      });
    } catch (dlErr) {
      console.error(`[Edge] Failed to download style ref image: ${url}`, dlErr);
      // Fallback: try the URL directly
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
      max_tokens: 1500,
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: imageContent },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    console.error(`[Edge] OpenAI style-replicate error ${resp.status}:`, err.slice(0, 1000));
    return errorResponse(`OpenAI API error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const stylePrompt = data.choices?.[0]?.message?.content ?? "";
  console.log(`[Edge] Style Replicate: ${stylePrompt.slice(0, 100)}...`);
  return jsonResponse({ styleDescription: stylePrompt });
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
  styleMode?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";

  let prompt: string;

  if (body.styleMode === 'replicate' && body.styleDescription) {
    // Replicate mode: the style description IS the prompt (like pasting ChatGPT output directly into NanoBanana)
    prompt = body.styleDescription;
    if (body.userPrompt?.trim()) {
      prompt += `\n\n${body.userPrompt.trim()}`;
    }
    if (body.productDescription) {
      prompt += `\n\nProduct details (preserve exactly): ${body.productDescription}`;
    }
  } else {
    // Inspire mode or no style: use the generic lifestyle prompt wrapper
    prompt = `Using this product image as reference, generate a lifestyle photo of this product ${body.userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

    if (body.productDescription) {
      prompt += `\n\nIMPORTANT — Product details (preserve exactly): ${body.productDescription}`;
    }

    if (body.styleDescription) {
      prompt += `\n\nApply this visual style: ${body.styleDescription}`;
    }
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

  // Check status — use base model ID (without /edit subpath) for queue status/result
  const queueBase = "https://queue.fal.run/fal-ai/nano-banana-2";
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
  styleMode?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resolution = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";

  let prompt: string;

  if (body.styleMode === 'replicate' && body.styleDescription) {
    prompt = body.styleDescription;
    if (body.userPrompt?.trim()) {
      prompt += `\n\n${body.userPrompt.trim()}`;
    }
    if (body.productDescription) {
      prompt += `\n\nProduct details (preserve exactly): ${body.productDescription}`;
    }
  } else {
    prompt = `Using this product image as reference, generate a lifestyle photo of this product ${body.userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

    if (body.productDescription) {
      prompt += `\n\nIMPORTANT — Product details (preserve exactly): ${body.productDescription}`;
    }

    if (body.styleDescription) {
      prompt += `\n\nApply this visual style: ${body.styleDescription}`;
    }
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
  isLifestyle?: boolean;
  productDescription?: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

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

  const resp = await fetch("https://fal.run/fal-ai/nano-banana-2/edit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_urls: [body.imageUrl],
      prompt,
      resolution: "2K",
      aspect_ratio: "1:1",
      output_format: "png",
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
        return await handleGenerate(
          body as {
            action: string;
            imageUrl: string;
            productDescription: string;
            resolution?: string;
            aspectRatio?: string;
            referenceImageUrls?: string[];
          }
        );

      case "analyze-style":
        return await handleAnalyzeStyle(body as { action: string; imageUrls: string[] });

      case "analyze-style-replicate":
        return await handleAnalyzeStyleReplicate(body as { action: string; imageUrls: string[] });

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
            isLifestyle?: boolean;
            productDescription?: string;
          }
        );

      case "group-images":
        return await handleGroupImages(
          body as { action: string; images: string[]; count: number }
        );

      case "proxy-image": {
        // Download image server-side (bypasses browser CORS)
        // Upload to Supabase Storage and return public URL (instead of huge base64 data URL)
        const imgUrl = body.imageUrl as string;
        if (!imgUrl) return errorResponse("Missing imageUrl for proxy", 400);
        console.log(`[Edge] Proxy-image: ${imgUrl.slice(0, 80)}`);

        // If already a Supabase URL or data URL, return as-is
        if (imgUrl.includes("supabase.co") || imgUrl.startsWith("data:")) {
          return jsonResponse({ publicUrl: imgUrl });
        }

        // Download server-side
        const proxyResp = await fetch(imgUrl);
        if (!proxyResp.ok) return errorResponse(`Proxy download failed: ${proxyResp.status}`, 502);
        const proxyBuffer = await proxyResp.arrayBuffer();
        const proxyMime = proxyResp.headers.get("content-type") ?? "image/png";
        const proxyExt = proxyMime.includes("jpeg") || proxyMime.includes("jpg") ? "jpg" : "png";

        // Upload to Supabase Storage
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const sb = createClient(supabaseUrl, serviceKey);
        const proxyPath = `temp-proxy/proxy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${proxyExt}`;

        const { error: uploadErr } = await sb.storage
          .from("project-images")
          .upload(proxyPath, new Uint8Array(proxyBuffer), { contentType: proxyMime, upsert: true });

        if (uploadErr) {
          console.warn(`[Edge] Proxy upload failed: ${uploadErr.message}, falling back to data URL`);
          const dataUrl = await urlToDataUrl(imgUrl);
          return jsonResponse({ publicUrl: dataUrl });
        }

        const { data: pubData } = sb.storage.from("project-images").getPublicUrl(proxyPath);
        console.log(`[Edge] Proxied: ${imgUrl.slice(0, 50)} → ${pubData.publicUrl.slice(0, 60)}`);
        return jsonResponse({ publicUrl: pubData.publicUrl });
      }

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
