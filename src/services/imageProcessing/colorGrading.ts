/**
 * Step 4: Parametric Color Grading (Pure DSP - No AI)
 *
 * Applies Lightroom-style adjustments using pixel math on Canvas ImageData.
 * Two presets: "Light" (bright products) and "Dark" (dark/black products).
 */

import type { RetouchPreset } from '../../models/pipeline';
import { clamp, getLuminance, getImageData, canvasToBlob, canvasToDataUrl } from './utils';

// --- Tone Zone Classification ---

/** Classify a pixel's luminance into shadow / midtone / highlight / white / black zones */
function getToneZone(lum: number): 'black' | 'shadow' | 'midtone' | 'highlight' | 'white' {
  if (lum < 20) return 'black';
  if (lum < 64) return 'shadow';
  if (lum < 192) return 'midtone';
  if (lum < 240) return 'highlight';
  return 'white';
}

// --- Individual Adjustments ---

/**
 * Apply a tonal shift to a single channel value.
 * `amount` is in Lightroom-like units (-100 to +100), mapped to pixel delta.
 */
function applyToneShift(value: number, amount: number): number {
  // Map Lightroom units roughly: +100 => +25.5 pixel shift (10%)
  const delta = (amount / 100) * 25.5;
  return clamp(value + delta, 0, 255);
}

/**
 * Apply contrast adjustment.
 * Increases distance from midpoint (128).
 */
function applyContrast(value: number, amount: number): number {
  const factor = 1 + (amount / 100) * 0.5; // +100 => 1.5x contrast
  return clamp(128 + (value - 128) * factor, 0, 255);
}

/**
 * Apply midtone clarity (local contrast boost on midtones).
 * Implemented as a gentle S-curve push.
 */
function applyClarity(value: number, lum: number, amount: number): number {
  const zone = getToneZone(lum);
  if (zone !== 'midtone') return value;
  const strength = (amount / 100) * 0.3;
  const normalized = value / 255;
  // S-curve: push midtones away from 0.5
  const curved = normalized + strength * (normalized - 0.5) * (1 - Math.abs(normalized - 0.5) * 2);
  return clamp(curved * 255, 0, 255);
}

/**
 * Apply texture enhancement (high-frequency local detail).
 * Approximated by micro-contrast boost.
 */
function applyTexture(value: number, lum: number, amount: number): number {
  const strength = (amount / 100) * 0.15;
  // Boost distance from local luminance
  const diff = value - lum;
  return clamp(value + diff * strength, 0, 255);
}

// --- Unsharp Mask (Sharpen) ---

/**
 * Apply a fast unsharp mask to ImageData in-place.
 * Uses a simple 3x3 box blur as the low-pass filter.
 */
function applySharpen(imageData: ImageData, amount: number): void {
  const { width, height, data } = imageData;
  const strength = (amount / 100) * 1.5; // Map sharpen units
  const original = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        // 3x3 box blur for this channel
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            sum += original[((y + dy) * width + (x + dx)) * 4 + c];
          }
        }
        const blurred = sum / 9;
        const sharpened = original[idx + c] + (original[idx + c] - blurred) * strength;
        data[idx + c] = clamp(sharpened, 0, 255);
      }
    }
  }
}

// --- Highlight Protection ---

/**
 * Protect highlights from being blown out.
 * Compresses values above a threshold toward 255.
 */
function applyHighlightProtection(r: number, g: number, b: number, amount: number): [number, number, number] {
  if (amount <= 0) return [r, g, b];
  const threshold = 200;
  const strength = amount / 100;

  const protect = (v: number) => {
    if (v <= threshold) return v;
    const excess = v - threshold;
    const range = 255 - threshold;
    // Compress excess using a gentle curve
    const compressed = threshold + range * (1 - Math.pow(1 - excess / range, 1 + strength));
    return clamp(compressed, 0, 255);
  };

  return [protect(r), protect(g), protect(b)];
}

// --- Main Color Grading Function ---

export interface ColorGradingResult {
  imageBlob: Blob;
  imageDataUrl: string;
}

export async function applyColorGrading(
  inputDataUrl: string,
  preset: RetouchPreset
): Promise<ColorGradingResult> {
  const { imageData, canvas, ctx } = await getImageData(inputDataUrl);
  const { data, width, height } = imageData;

  // Pass 1: Per-pixel tonal adjustments
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const lum = getLuminance(r, g, b);
    const zone = getToneZone(lum);

    if (preset.type === 'Light') {
      // Midtones +4
      if (zone === 'midtone') {
        r = applyToneShift(r, preset.midtones);
        g = applyToneShift(g, preset.midtones);
        b = applyToneShift(b, preset.midtones);
      }
      // Highlights +4
      if (zone === 'highlight') {
        r = applyToneShift(r, preset.highlights);
        g = applyToneShift(g, preset.highlights);
        b = applyToneShift(b, preset.highlights);
      }
      // Shadows +8
      if (zone === 'shadow') {
        r = applyToneShift(r, preset.shadows);
        g = applyToneShift(g, preset.shadows);
        b = applyToneShift(b, preset.shadows);
      }
      // Whites +18
      if (zone === 'white') {
        r = applyToneShift(r, preset.whites);
        g = applyToneShift(g, preset.whites);
        b = applyToneShift(b, preset.whites);
      }
      // Clarity & Texture
      r = applyClarity(r, lum, preset.clarity);
      g = applyClarity(g, lum, preset.clarity);
      b = applyClarity(b, lum, preset.clarity);
      r = applyTexture(r, lum, preset.texture);
      g = applyTexture(g, lum, preset.texture);
      b = applyTexture(b, lum, preset.texture);
    } else {
      // Dark preset
      // Contrast +8
      r = applyContrast(r, preset.contrast);
      g = applyContrast(g, preset.contrast);
      b = applyContrast(b, preset.contrast);

      // Midtones +8
      if (zone === 'midtone') {
        r = applyToneShift(r, preset.midtones);
        g = applyToneShift(g, preset.midtones);
        b = applyToneShift(b, preset.midtones);
      }
      // Whites +14
      if (zone === 'white') {
        r = applyToneShift(r, preset.whites);
        g = applyToneShift(g, preset.whites);
        b = applyToneShift(b, preset.whites);
      }
      // Blacks -13 (crush blacks)
      if (zone === 'black' || zone === 'shadow') {
        r = applyToneShift(r, preset.blacks);
        g = applyToneShift(g, preset.blacks);
        b = applyToneShift(b, preset.blacks);
      }
      // Highlight Protection 100
      [r, g, b] = applyHighlightProtection(r, g, b, preset.highlightProtection);

      // Clarity & Texture
      r = applyClarity(r, lum, preset.clarity);
      g = applyClarity(g, lum, preset.clarity);
      b = applyClarity(b, lum, preset.clarity);
      r = applyTexture(r, lum, preset.texture);
      g = applyTexture(g, lum, preset.texture);
      b = applyTexture(b, lum, preset.texture);
    }

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
  }

  // Pass 2: Sharpen (needs neighbor access)
  const sharpenAmount = preset.type === 'Light' ? preset.sharpen : preset.sharpen;
  applySharpen(imageData, sharpenAmount);

  // Write back
  ctx.putImageData(imageData, 0, 0);

  // White clip pass (push near-whites to pure white)
  const whiteClip = 0.988; // 98.8%
  const threshold = Math.floor(whiteClip * 255);
  const finalData = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < finalData.data.length; i += 4) {
    const lum = getLuminance(finalData.data[i], finalData.data[i + 1], finalData.data[i + 2]);
    if (lum >= threshold) {
      finalData.data[i] = 255;
      finalData.data[i + 1] = 255;
      finalData.data[i + 2] = 255;
    }
  }
  ctx.putImageData(finalData, 0, 0);

  const imageDataUrl = canvasToDataUrl(canvas);
  const imageBlob = await canvasToBlob(canvas);

  return { imageBlob, imageDataUrl };
}
