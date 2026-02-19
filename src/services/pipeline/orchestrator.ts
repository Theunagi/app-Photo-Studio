/**
 * Studio Pro Front Full Pipeline — Orchestrator
 *
 * Chains all 8 steps (0-7) in sequence, passing blobs and text between nodes.
 * Each step updates the shared PipelineState via a callback, enabling
 * real-time UI updates at each stage.
 *
 * Pipeline Flow:
 *   Input → Analysis(Vision) → StudioGen(NanoBanana|Fal.ai|Gemini) → LuminanceCheck(GPT-4o)
 *   → Retouch(DSP) → BgRemoval(Fal.ai/Bria) → ShadowComposer(DSP) → AutoCrop(DSP)
 */

import type {
  PipelineConfig,
  PipelineState,
  PipelineInput,
  ProductAnalysis,
  StudioGeneration,
  LuminanceClass,
  RetouchResult,
  CutoutResult,
  ShadowCompositeResult,
  AutoCropResult,
  NodeResult,
  PipelineStep,
} from '../../models/pipeline';
import {
  RETOUCH_PRESET_LIGHT,
  RETOUCH_PRESET_DARK,
  createInitialPipelineState,
} from '../../models/pipeline';

// API Services
import { callOpenAIVision, PRODUCT_ANALYSIS_SYSTEM_PROMPT, LUMINANCE_CHECK_SYSTEM_PROMPT } from '../api/openai';
import { callGeminiImageGen, buildStudioPrompt } from '../api/gemini';
import { callNanoBananaImageGen } from '../api/nanobanana';
import { callFalImageGen } from '../api/falImageGen';
import { removeBackground } from '../api/bria';

// Image Processing (DSP)
import { applyColorGrading } from '../imageProcessing/colorGrading';
import { composeShadow } from '../imageProcessing/shadowComposer';
import { autoCrop } from '../imageProcessing/autoCrop';
import { blobToDataUrl, dataUrlToBlob } from '../imageProcessing/utils';

// --- Types ---

export type PipelineEventCallback = (state: PipelineState, step: PipelineStep) => void;

export interface PipelineRunOptions {
  config: PipelineConfig;
  inputFile: File;
  /** Additional reference images (up to 4 more) as data URLs */
  additionalImageDataUrls?: string[];
  onStateChange: PipelineEventCallback;
  abortSignal?: AbortSignal;
}

// --- Helper: Execute a step with timing and error handling ---

async function executeStep<T>(
  state: PipelineState,
  stepKey: PipelineStep,
  onStateChange: PipelineEventCallback,
  fn: () => Promise<T>
): Promise<T> {
  // Mark step as running
  (state[stepKey] as NodeResult<T>).status = 'running';
  onStateChange({ ...state }, stepKey);

  const start = performance.now();
  try {
    const data = await fn();
    const durationMs = Math.round(performance.now() - start);
    (state[stepKey] as NodeResult<T>) = { status: 'completed', data, durationMs };
    onStateChange({ ...state }, stepKey);
    return data;
  } catch (err) {
    const durationMs = Math.round(performance.now() - start);
    const errorMsg = err instanceof Error ? err.message : String(err);
    (state[stepKey] as NodeResult<T>) = { status: 'error', error: errorMsg, durationMs };
    onStateChange({ ...state }, stepKey);
    throw err;
  }
}

// --- Main Pipeline Runner ---

export async function runPipeline(options: PipelineRunOptions): Promise<PipelineState> {
  const { config, inputFile, additionalImageDataUrls, onStateChange } = options;
  const state = createInitialPipelineState();

  // =========================================================================
  // STEP 0: INPUT
  // =========================================================================
  const input = await executeStep<PipelineInput>(state, 'input', onStateChange, async () => {
    const imageDataUrl = await blobToDataUrl(inputFile);
    return {
      imageBlob: inputFile,
      imageDataUrl,
      fileName: inputFile.name,
    };
  });

  // =========================================================================
  // STEP 1: PRODUCT ANALYSIS (Vision — GPT-4o)
  // =========================================================================
  const analysis = await executeStep<ProductAnalysis>(state, 'analysis', onStateChange, async () => {
    const response = await callOpenAIVision({
      apiKey: config.openaiApiKey,
      imageDataUrl: input.imageDataUrl,
      additionalImageDataUrls: additionalImageDataUrls,
      systemPrompt: PRODUCT_ANALYSIS_SYSTEM_PROMPT,
      userPrompt: additionalImageDataUrls?.length
        ? `Describe colors, materials, and text of this product from all ${1 + additionalImageDataUrls.length} reference views. Short precise description.`
        : 'Describe colors and materials and text of this product, short precise description.',
      model: 'gpt-4o',
      maxTokens: 800,
      temperature: 0.1,
      topP: 0.1,
    });

    // Parse the raw response into structured fields
    const raw = response.text;
    const colors = extractField(raw, 'colors');
    const materials = extractField(raw, 'materials');
    const visibleTexts = extractField(raw, 'text');

    return {
      description: raw,
      colors,
      materials,
      visibleTexts,
      rawResponse: raw,
    };
  });

  // =========================================================================
  // STEP 2: STUDIO GENERATION (NanoBanana Pro or Gemini fallback)
  // =========================================================================
  const studioGen = await executeStep<StudioGeneration>(state, 'studioGeneration', onStateChange, async () => {
    const fullPrompt = buildStudioPrompt(analysis.description);

    // --- Fallback chain: NanoBanana → Fal.ai → Gemini ---

    // 1) Try NanoBanana Pro (kie.ai)
    if (config.nanoBananaApiKey) {
      try {
        console.log('[Pipeline] Step 2: Using Nano Banana Pro');
        const response = await callNanoBananaImageGen({
          apiKey: config.nanoBananaApiKey,
          imageDataUrl: input.imageDataUrl,
          referenceImageDataUrls: additionalImageDataUrls,
          prompt: fullPrompt,
          imageSize: config.imageSize ?? '2K',
          aspectRatio: config.aspectRatio ?? '1:1',
        });
        return {
          imageBlob: dataUrlToBlob(response.imageDataUrl),
          imageDataUrl: response.imageDataUrl,
        };
      } catch (nbErr) {
        console.warn('[Pipeline] NanoBanana failed, trying Fal.ai:', nbErr);
      }
    }

    // 2) Try Fal.ai Flux Dev (image-to-image)
    if (config.falApiKey) {
      try {
        console.log('[Pipeline] Step 2: Using Fal.ai Flux (fallback 1)');
        const response = await callFalImageGen({
          falApiKey: config.falApiKey,
          imageDataUrl: input.imageDataUrl,
          prompt: fullPrompt,
          imageSize: config.imageSize ?? '2K',
          strength: 0.75,
        });
        return {
          imageBlob: dataUrlToBlob(response.imageDataUrl),
          imageDataUrl: response.imageDataUrl,
        };
      } catch (falErr) {
        console.warn('[Pipeline] Fal.ai failed, trying Gemini:', falErr);
      }
    }

    // 3) Gemini (last resort)
    console.log('[Pipeline] Step 2: Using Gemini (fallback 2)');
    const response = await callGeminiImageGen({
      apiKey: config.geminiApiKey,
      imageDataUrl: input.imageDataUrl,
      referenceImageDataUrls: additionalImageDataUrls,
      prompt: fullPrompt,
      model: config.generationModel ?? 'gemini-3-pro-image-preview',
      imageSize: config.imageSize ?? '2K',
      aspectRatio: config.aspectRatio ?? '1:1',
    });

    return {
      imageBlob: dataUrlToBlob(response.imageDataUrl),
      imageDataUrl: response.imageDataUrl,
    };
  });

  // =========================================================================
  // STEP 3: LUMINANCE CLASSIFICATION (GPT-4o — Logic Gate)
  // =========================================================================
  const luminanceClass = await executeStep<LuminanceClass>(state, 'luminanceCheck', onStateChange, async () => {
    const response = await callOpenAIVision({
      apiKey: config.openaiApiKey,
      imageDataUrl: studioGen.imageDataUrl,
      systemPrompt: LUMINANCE_CHECK_SYSTEM_PROMPT,
      userPrompt: 'Just tell me if the product is light or dark. Only output accepted: Light or Dark.',
      model: 'gpt-4o',
      maxTokens: 10,
      temperature: 0.0,
      topP: 0.1,
    });

    const normalized = response.text.trim().toLowerCase();
    return normalized.includes('dark') ? 'Dark' : 'Light';
  });

  // =========================================================================
  // STEP 4: PARAMETRIC RETOUCH (Color Grading — Pure DSP)
  // =========================================================================
  const retouch = await executeStep<RetouchResult>(state, 'retouch', onStateChange, async () => {
    const preset = luminanceClass === 'Dark' ? RETOUCH_PRESET_DARK : RETOUCH_PRESET_LIGHT;
    const result = await applyColorGrading(studioGen.imageDataUrl, preset);

    return {
      imageBlob: result.imageBlob,
      imageDataUrl: result.imageDataUrl,
      presetUsed: preset,
    };
  });

  // =========================================================================
  // STEP 5: BACKGROUND REMOVAL (Fal.ai / Bria 2.3)
  // =========================================================================
  const cutout = await executeStep<CutoutResult>(state, 'cutout', onStateChange, async () => {
    const result = await removeBackground({
      falApiKey: config.falApiKey,
      imageDataUrl: retouch.imageDataUrl,
      keepShadows: false,
    });

    return {
      imageBlob: result.imageBlob,
      imageDataUrl: result.imageDataUrl,
    };
  });

  // =========================================================================
  // STEP 6: SMART SHADOW COMPOSER (DSP — "The Secret")
  // Skipped for 'transparent-clean' output format.
  // =========================================================================
  let step6ImageDataUrl: string;

  if (config.outputFormat === 'transparent-clean') {
    // No shadow — skip step 6, pass cutout directly
    (state.shadowComposite as NodeResult<ShadowCompositeResult>) = { status: 'skipped', durationMs: 0 };
    onStateChange({ ...state }, 'shadowComposite');
    step6ImageDataUrl = cutout.imageDataUrl;
  } else {
    const shadow = await executeStep<ShadowCompositeResult>(state, 'shadowComposite', onStateChange, async () => {
      const result = await composeShadow(
        retouch.imageDataUrl,   // W: white-bg with natural shadow
        cutout.imageDataUrl,    // T: cutout product (transparent)
        0.8,                    // Shadow opacity
        8,                      // Gaussian blur radius
        config.outputFormat === 'white-shadow' // fill white bg
      );

      return {
        imageBlob: result.imageBlob,
        imageDataUrl: result.imageDataUrl,
      };
    });
    step6ImageDataUrl = shadow.imageDataUrl;
  }

  // =========================================================================
  // STEP 7: AUTO CROP & CENTER
  // =========================================================================
  await executeStep<AutoCropResult>(state, 'autoCrop', onStateChange, async () => {
    const result = await autoCrop(
      step6ImageDataUrl,
      10 // 10px margin
    );

    return {
      imageBlob: result.imageBlob,
      imageDataUrl: result.imageDataUrl,
      cropBounds: result.cropBounds,
    };
  });

  return state;
}

// --- Utility: Parse structured fields from raw analysis text ---

function extractField(text: string, fieldType: 'colors' | 'materials' | 'text'): string[] {
  const lines = text.split('\n');
  const results: string[] = [];

  const patterns: Record<string, RegExp[]> = {
    colors: [/colors?:/i, /couleurs?:/i, /hex/i],
    materials: [/materials?:/i, /mat[eé]riaux?:/i],
    text: [/texts?:/i, /textes?:/i, /logos?:/i, /brand/i],
  };

  for (const line of lines) {
    const pats = patterns[fieldType];
    if (pats.some(p => p.test(line))) {
      // Extract content after the colon
      const colonIdx = line.indexOf(':');
      if (colonIdx >= 0) {
        const content = line.slice(colonIdx + 1).trim();
        // Split by comma or dash
        const items = content.split(/[,;•\-–]/).map(s => s.trim()).filter(Boolean);
        results.push(...items);
      }
    }
  }

  return results;
}
