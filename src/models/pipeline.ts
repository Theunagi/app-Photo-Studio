/**
 * Studio Pro Front Full Pipeline - Data Models
 * Hybrid pipeline: LLM Vision (Analysis) + Generative AI (Render) + DSP (Retouch, Compositing)
 */

// --- Pipeline Configuration ---

/** Output format controls background and shadow in the final render. */
export type OutputFormat = 'transparent-shadow' | 'white-shadow' | 'transparent-clean';

export interface PipelineConfig {
  openaiApiKey: string;
  geminiApiKey: string;
  falApiKey: string;
  /** Vision model for product analysis (Step 1) & luminance check (Step 3) */
  visionModel: 'gpt-4o' | 'gemini-1.5-pro';
  /** Image generation model (Step 2) */
  generationModel: string;
  /** Image gen resolution */
  imageSize: string;
  /** Image gen aspect ratio */
  aspectRatio: string;
  /** Output format: background + shadow combination */
  outputFormat: OutputFormat;
}

export const DEFAULT_PIPELINE_CONFIG: Partial<PipelineConfig> = {
  visionModel: 'gpt-4o',
  generationModel: 'gemini-3-pro-image-preview',
  imageSize: '2K',
  aspectRatio: '1:1',
  outputFormat: 'transparent-shadow',
};

// --- Node Status & Events ---

export type NodeStatus = 'idle' | 'running' | 'completed' | 'error' | 'skipped';

export interface NodeResult<T = unknown> {
  status: NodeStatus;
  data?: T;
  error?: string;
  durationMs?: number;
}

// --- Step-Specific Types ---

/** Step 0: Input */
export interface PipelineInput {
  imageBlob: Blob;
  imageDataUrl: string;
  fileName: string;
}

/** Step 1: Product Analysis Output */
export interface ProductAnalysis {
  description: string;
  colors: string[];
  materials: string[];
  visibleTexts: string[];
  rawResponse: string;
}

/** Step 2: Studio Generation Output */
export interface StudioGeneration {
  imageBlob: Blob;
  imageDataUrl: string;
}

/** Step 3: Luminance Classification */
export type LuminanceClass = 'Light' | 'Dark';

/** Step 4: Retouch Presets */
export interface RetouchPresetLight {
  type: 'Light';
  midtones: number;    // +4
  highlights: number;  // +4
  shadows: number;     // +8
  whites: number;      // +18
  texture: number;     // +12
  clarity: number;     // +10
  sharpen: number;     // +15
}

export interface RetouchPresetDark {
  type: 'Dark';
  contrast: number;          // +8
  midtones: number;          // +8
  whites: number;            // +14
  blacks: number;            // -13
  highlightProtection: number; // 100
  texture: number;           // +16
  clarity: number;           // +14
  sharpen: number;           // +11
}

export type RetouchPreset = RetouchPresetLight | RetouchPresetDark;

export const RETOUCH_PRESET_LIGHT: RetouchPresetLight = {
  type: 'Light',
  midtones: 4,
  highlights: 4,
  shadows: 8,
  whites: 18,
  texture: 12,
  clarity: 10,
  sharpen: 15,
};

export const RETOUCH_PRESET_DARK: RetouchPresetDark = {
  type: 'Dark',
  contrast: 8,
  midtones: 8,
  whites: 14,
  blacks: -13,
  highlightProtection: 100,
  texture: 16,
  clarity: 14,
  sharpen: 11,
};

/** Step 4: Retouch Output */
export interface RetouchResult {
  imageBlob: Blob;
  imageDataUrl: string;
  presetUsed: RetouchPreset;
}

/** Step 5: Background Removal Output */
export interface CutoutResult {
  imageBlob: Blob;
  imageDataUrl: string;
}

/** Step 6: Smart Shadow Output */
export interface ShadowCompositeResult {
  imageBlob: Blob;
  imageDataUrl: string;
}

/** Step 7: Auto Crop Output */
export interface AutoCropResult {
  imageBlob: Blob;
  imageDataUrl: string;
  cropBounds: { x: number; y: number; width: number; height: number };
}

// --- Full Pipeline State ---

export interface PipelineState {
  input: NodeResult<PipelineInput>;
  analysis: NodeResult<ProductAnalysis>;
  studioGeneration: NodeResult<StudioGeneration>;
  luminanceCheck: NodeResult<LuminanceClass>;
  retouch: NodeResult<RetouchResult>;
  cutout: NodeResult<CutoutResult>;
  shadowComposite: NodeResult<ShadowCompositeResult>;
  autoCrop: NodeResult<AutoCropResult>;
}

export type PipelineStep = keyof PipelineState;

export const PIPELINE_STEPS: { key: PipelineStep; label: string; nodeId: string }[] = [
  { key: 'input', label: 'Input (Front View)', nodeId: 'request-input-front' },
  { key: 'analysis', label: 'Product Analysis (Vision)', nodeId: 'processor-1766480495179' },
  { key: 'studioGeneration', label: 'Studio Generation (Render)', nodeId: 'proc-1' },
  { key: 'luminanceCheck', label: 'Luminance Classification', nodeId: 'processor-1766505601417' },
  { key: 'retouch', label: 'Parametric Retouch', nodeId: 'retouch-light-dark' },
  { key: 'cutout', label: 'Background Removal', nodeId: 'processor-1767873606572' },
  { key: 'shadowComposite', label: 'Smart Shadow Composer', nodeId: 'processor-1767033110607' },
  { key: 'autoCrop', label: 'Auto Crop & Center', nodeId: 'processor-1767033126139' },
];

export function createInitialPipelineState(): PipelineState {
  return {
    input: { status: 'idle' },
    analysis: { status: 'idle' },
    studioGeneration: { status: 'idle' },
    luminanceCheck: { status: 'idle' },
    retouch: { status: 'idle' },
    cutout: { status: 'idle' },
    shadowComposite: { status: 'idle' },
    autoCrop: { status: 'idle' },
  };
}
