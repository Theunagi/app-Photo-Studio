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
 *   bg-remove — Fal.ai Bria 2.3 RMBG
 *   lifestyle — Gemini image generation
 *   edit      — Fal.ai NanoBanana Pro Edit
 *
 * Environment variables (Supabase Secrets):
 *   OPENAI_API_KEY, GEMINI_API_KEY, FAL_API_KEY, NANOBANANA_API_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const token = authHeader.replace("Bearer ", "");
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
              image_url: { url: body.imageUrl, detail: "high" },
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
  const fullPrompt = `${STUDIO_RENDER_PROMPT}\n\n${body.productDescription}`;

  // 1) Try Fal.ai NanoBanana Pro Edit — PRIMARY
  if (falKey) {
    try {
      console.log("[Edge] Generate: trying Fal.ai nano-banana-pro/edit");
      const falResp = await fetch(
        "https://fal.run/fal-ai/nano-banana-pro/edit",
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
            output_format: "png",
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
      model: "nano-banana-pro",
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
 * Step 5: Background Removal — Fal.ai Bria 2.3 RMBG
 */
async function handleBgRemove(body: { imageUrl: string }): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const resp = await fetch("https://fal.run/fal-ai/bria/background/remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${falKey}`,
    },
    body: JSON.stringify({
      image_url: body.imageUrl,
      keep_shadows: false,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Fal.ai Bria error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const resultUrl = data.image?.url ?? data.image;
  if (!resultUrl) return errorResponse("Fal.ai Bria: no result image", 502);

  return jsonResponse({ imageUrl: resultUrl });
}

/**
 * Lifestyle Generation — Gemini Image Gen
 */
async function handleLifestyle(body: {
  imageUrl: string;
  userPrompt: string;
  resolution?: string;
  aspectRatio?: string;
}): Promise<Response> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return errorResponse("Gemini API key not configured", 500);

  const imageSize = body.resolution ?? "2K";
  const aspectRatio = body.aspectRatio ?? "1:1";

  // Download image and convert to base64 for Gemini inline_data
  const imageDataUrl = await urlToDataUrl(body.imageUrl);
  const { mimeType, base64 } = parseDataUrl(imageDataUrl);

  const prompt = `Using this product image on white background as reference, generate a lifestyle photo of this product ${body.userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "[REFERENCE IMAGE: Product on white background — use as reference ONLY. Generate a NEW lifestyle scene.]",
            },
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        imageConfig: { imageSize, aspectRatio },
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => "");
    return errorResponse(`Gemini error ${resp.status}: ${err.slice(0, 500)}`, 502);
  }

  const data = await resp.json();
  const parts = data.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    return errorResponse(`Gemini: no parts in response`, 502);
  }

  let resultBase64 = "";
  let resultMime = "image/png";
  for (const part of parts) {
    if (part.inlineData) {
      resultBase64 = part.inlineData.data;
      resultMime = part.inlineData.mimeType ?? "image/png";
    }
    if (part.inline_data) {
      resultBase64 = part.inline_data.data;
      resultMime = part.inline_data.mime_type ?? "image/png";
    }
  }

  if (!resultBase64) {
    return errorResponse("Gemini: no image in response", 502);
  }

  // Upload result to Supabase Storage so we can return a URL
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const resultPath = `results/${crypto.randomUUID()}.png`;
  const bytes = Uint8Array.from(atob(resultBase64), (c) => c.charCodeAt(0));
  const { error: uploadError } = await supabase.storage
    .from("project-images")
    .upload(resultPath, bytes, {
      contentType: resultMime,
      upsert: true,
    });

  if (uploadError) {
    // Fallback: return as data URL
    return jsonResponse({
      imageDataUrl: `data:${resultMime};base64,${resultBase64}`,
    });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("project-images").getPublicUrl(resultPath);

  return jsonResponse({ imageUrl: publicUrl });
}

/**
 * AI Edit — Fal.ai NanoBanana Pro Edit
 */
async function handleEdit(body: {
  imageUrl: string;
  userPrompt: string;
}): Promise<Response> {
  const falKey = Deno.env.get("FAL_API_KEY");
  if (!falKey) return errorResponse("Fal.ai API key not configured", 500);

  const prompt = `Edit this product photo on white background. Apply: ${body.userPrompt}.
Keep the SAME pure white background (#FFFFFF). Keep the product photorealistic.
Maintain studio lighting (RIMOWA Bright Edition style). Same framing and composition.
Ultra-sharp, crisp, photoreal. Maintain all product details, labels, textures.`;

  const resp = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", {
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

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
          }
        );

      case "edit":
        return await handleEdit(
          body as { action: string; imageUrl: string; userPrompt: string }
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
