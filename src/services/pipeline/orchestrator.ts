/**
 * Studio Pro Front Full Pipeline — Orchestrator
 *
 * Chains all 8 steps (0-7) in sequence, passing blobs and text between nodes.
 * Each step updates the shared PipelineState via a callback, enabling
 * real-time UI updates at each stage.
 *
 * API calls go through Supabase Edge Functions (keys & prompts are server-side).
 * Images are uploaded to Supabase Storage; URLs are passed between steps.
 *
 * Pipeline Flow:
 *   Input → Analysis(Vision) → StudioGen(Fal.ai|NanoBanana) → LuminanceCheck(GPT-4o)
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

// API Services (Edge Function proxies)
import { analyzeProduct, checkLuminance } from '../api/openai';
import { callNanoBananaImageGen } from '../api/nanobanana';
import { generateStudioImage } from '../api/falImageGen';
import { removeBackground } from '../api/bria';

// Image Processing (DSP — client-side, no API keys)
import { applyColorGrading } from '../imageProcessing/colorGrading';
import { composeShadow } from '../imageProcessing/shadowComposer';
import { autoCrop } from '../imageProcessing/autoCrop';
import { blobToDataUrl, dataUrlToBlob } from '../imageProcessing/utils';

// Supabase Storage (for uploading intermediate images)
import { supabase } from '../db/supabase';

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

// --- Helper: Upload image to Supabase Storage and get public URL ---

const BUCKET = 'project-images';

async function uploadToStorage(
  dataUrl: string,
  sessionId: string,
  label: string,
): Promise<string> {
  const parts = dataUrl.split(',');
  const bstr = atob(parts[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }

  const path = `temp-pipeline/${sessionId}/${label}-${Date.now()}.png`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, u8arr, { contentType: 'image/png', upsert: true });
  if (error) throw new Error(`Storage upload failed (${label}): ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Download image from URL back to a data URL (for client-side DSP steps) */
async function urlToDataUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
  const blob = await response.blob();
  return blobToDataUrl(blob);
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
  const sessionId = config.sessionId ?? crypto.randomUUID();

  // =========================================================================
  // STEP 0: INPUT — Upload to Storage for API steps
  // =========================================================================
  const input = await executeStep<PipelineInput>(state, 'input', onStateChange, async () => {
    const imageDataUrl = await blobToDataUrl(inputFile);
    return {
      imageBlob: inputFile,
      imageDataUrl,
      fileName: inputFile.name,
    };
  });

  // Upload input image to Storage for Edge Functions
  const inputStorageUrl = await uploadToStorage(input.imageDataUrl, sessionId, 'input');

  // Upload additional reference images if any
  let additionalStorageUrls: string[] | undefined;
  if (additionalImageDataUrls?.length) {
    additionalStorageUrls = [];
    for (let i = 0; i < additionalImageDataUrls.length; i++) {
      const url = await uploadToStorage(additionalImageDataUrls[i], sessionId, `ref-${i}`);
      additionalStorageUrls.push(url);
    }
  }

  // =========================================================================
  // STEP 1: PRODUCT ANALYSIS (Vision — GPT-4o via Edge Function)
  // =========================================================================
  const analysis = await executeStep<ProductAnalysis>(state, 'analysis', onStateChange, async () => {
    const response = await analyzeProduct(inputStorageUrl, additionalStorageUrls);

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
  // STEP 2: STUDIO GENERATION (Fal.ai → NanoBanana via Edge Functions)
  // =========================================================================
  const studioGen = await executeStep<StudioGeneration>(state, 'studioGeneration', onStateChange, async () => {
    // --- Fallback chain: Fal.ai → NanoBanana ---

    // 1) Try Fal.ai NanoBanana Pro Edit — PRIMARY
    try {
      const response = await generateStudioImage(inputStorageUrl, analysis.description, {
        resolution: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
        sessionId,
      });
      // Download result for DSP steps
      const imageDataUrl = await urlToDataUrl(response.resultImageUrl);
      return {
        imageBlob: dataUrlToBlob(imageDataUrl),
        imageDataUrl,
      };
    } catch (falErr) {
      console.warn('[Pipeline] Fal.ai failed, trying NanoBanana:', falErr);
    }

    // 2) NanoBanana Pro — fallback
    const response = await callNanoBananaImageGen(inputStorageUrl, analysis.description, {
      referenceImageUrls: additionalStorageUrls,
      resolution: config.imageSize ?? '2K',
      aspectRatio: config.aspectRatio ?? '1:1',
      sessionId,
    });
    const imageDataUrl = await urlToDataUrl(response.resultImageUrl);
    return {
      imageBlob: dataUrlToBlob(imageDataUrl),
      imageDataUrl,
    };
  });

  // =========================================================================
  // STEP 3: LUMINANCE CLASSIFICATION (GPT-4o via Edge Function)
  // =========================================================================
  // Upload studio result for the luminance check
  const studioStorageUrl = await uploadToStorage(studioGen.imageDataUrl, sessionId, 'studio');

  const luminanceClass = await executeStep<LuminanceClass>(state, 'luminanceCheck', onStateChange, async () => {
    return checkLuminance(studioStorageUrl);
  });

  // =========================================================================
  // STEP 4: PARAMETRIC RETOUCH (Color Grading — Pure DSP, client-side)
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
  // STEP 5: BACKGROUND REMOVAL (Fal.ai / Bria via Edge Function)
  // =========================================================================
  // Upload retouched image for BG removal
  const retouchStorageUrl = await uploadToStorage(retouch.imageDataUrl, sessionId, 'retouched');

  const cutout = await executeStep<CutoutResult>(state, 'cutout', onStateChange, async () => {
    const result = await removeBackground(retouchStorageUrl, sessionId, false);
    // Download result for DSP steps
    const imageDataUrl = await urlToDataUrl(result.resultImageUrl);
    return {
      imageBlob: dataUrlToBlob(imageDataUrl),
      imageDataUrl,
    };
  });

  // =========================================================================
  // STEP 6: SMART SHADOW COMPOSER (DSP — client-side)
  // Skipped for 'transparent-clean' output format.
  // =========================================================================
  let step6ImageDataUrl: string;

  if (config.outputFormat === 'transparent-clean') {
    (state.shadowComposite as NodeResult<ShadowCompositeResult>) = { status: 'skipped', durationMs: 0 };
    onStateChange({ ...state }, 'shadowComposite');
    step6ImageDataUrl = cutout.imageDataUrl;
  } else {
    const shadow = await executeStep<ShadowCompositeResult>(state, 'shadowComposite', onStateChange, async () => {
      const result = await composeShadow(
        retouch.imageDataUrl,
        cutout.imageDataUrl,
        0.8,
        8,
        config.outputFormat === 'white-shadow'
      );

      return {
        imageBlob: result.imageBlob,
        imageDataUrl: result.imageDataUrl,
      };
    });
    step6ImageDataUrl = shadow.imageDataUrl;
  }

  // =========================================================================
  // STEP 7: AUTO CROP & CENTER (DSP — client-side)
  // =========================================================================
  await executeStep<AutoCropResult>(state, 'autoCrop', onStateChange, async () => {
    const result = await autoCrop(step6ImageDataUrl, 10);

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
      const colonIdx = line.indexOf(':');
      if (colonIdx >= 0) {
        const content = line.slice(colonIdx + 1).trim();
        const items = content.split(/[,;•\-–]/).map(s => s.trim()).filter(Boolean);
        results.push(...items);
      }
    }
  }

  return results;
}
