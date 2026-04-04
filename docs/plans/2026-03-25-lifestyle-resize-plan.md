# Lifestyle Product Resize — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users draw a green rectangle on a lifestyle image to resize/reposition the product, then re-generate via Gemini.

**Architecture:** New `ResizeOverlay` React component (canvas overlay for rectangle drawing) + new `resizeLifestyle()` API function that sends the annotated image + product cutout to the existing Gemini edge function with a resize-specific prompt.

**Tech Stack:** React, Canvas 2D API, existing Gemini edge function pipeline.

---

### Task 1: Create ResizeOverlay component

**Files:**
- Create: `src/components/ResizeOverlay.tsx`
- Create: `src/components/ResizeOverlay.css`

**Step 1: Create the component file**

Create `src/components/ResizeOverlay.tsx`:

```tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import './ResizeOverlay.css';

interface ResizeOverlayProps {
  /** The lifestyle image URL (data URL or public URL) to overlay on */
  imageSrc: string;
  /** Called when user clicks Apply with the annotated image (green rect baked in) as data URL */
  onApply: (annotatedImageDataUrl: string, rect: { x: number; y: number; w: number; h: number }) => void;
  /** Called when user clicks Cancel */
  onCancel: () => void;
  /** Whether the resize is currently being processed */
  isProcessing?: boolean;
}

export default function ResizeOverlay({ imageSrc, onApply, onCancel, isProcessing }: ResizeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImageEl(img);
    img.src = imageSrc;
  }, [imageSrc]);

  // Resize canvas to match displayed image size
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imageEl) return;

    const resizeCanvas = () => {
      const containerRect = container.getBoundingClientRect();
      canvas.width = containerRect.width;
      canvas.height = containerRect.height;
      drawCanvas();
    };

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);
    resizeCanvas();
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageEl, rect]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rectangle if exists
    if (rect) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
      ctx.setLineDash([]);
    }
  }, [rect]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault();
    const pos = getPos(e);
    setStartPos(pos);
    setRect(null);
    setIsDrawing(true);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !startPos || isProcessing) return;
    e.preventDefault();
    const pos = getPos(e);
    setRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y),
    });
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleApply = useCallback(() => {
    if (!rect || !imageEl) return;
    const canvas = canvasRef.current!;

    // Convert display rect to original image coordinates
    const scaleX = imageEl.naturalWidth / canvas.width;
    const scaleY = imageEl.naturalHeight / canvas.height;
    const origRect = {
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      w: Math.round(rect.w * scaleX),
      h: Math.round(rect.h * scaleY),
    };

    // Draw green rectangle on original-resolution image
    const offscreen = document.createElement('canvas');
    offscreen.width = imageEl.naturalWidth;
    offscreen.height = imageEl.naturalHeight;
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(imageEl, 0, 0);

    // Draw solid green rectangle
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.fillRect(origRect.x, origRect.y, origRect.w, origRect.h);
    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 4;
    ctx.strokeRect(origRect.x, origRect.y, origRect.w, origRect.h);

    const annotatedDataUrl = offscreen.toDataURL('image/png');
    onApply(annotatedDataUrl, origRect);
  }, [rect, imageEl, onApply]);

  return (
    <div ref={containerRef} className="resize-overlay">
      <canvas
        ref={canvasRef}
        className="resize-overlay-canvas"
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
      <div className="resize-overlay-toolbar">
        {!rect && <span className="resize-overlay-hint">Draw a rectangle where the product should be</span>}
        {rect && (
          <button className="resize-overlay-btn resize-overlay-apply" onClick={handleApply} disabled={isProcessing}>
            {isProcessing ? 'Resizing...' : 'Apply'}
          </button>
        )}
        <button className="resize-overlay-btn resize-overlay-cancel" onClick={onCancel} disabled={isProcessing}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Create the CSS file**

Create `src/components/ResizeOverlay.css`:

```css
.resize-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  cursor: crosshair;
}

.resize-overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.resize-overlay-toolbar {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  padding: 8px 16px;
  border-radius: 12px;
  z-index: 11;
}

.resize-overlay-hint {
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  white-space: nowrap;
}

.resize-overlay-btn {
  padding: 6px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.resize-overlay-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.resize-overlay-apply {
  background: #22c55e;
  color: #fff;
}

.resize-overlay-apply:hover:not(:disabled) {
  background: #16a34a;
}

.resize-overlay-cancel {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.resize-overlay-cancel:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
}
```

**Step 3: Commit**

```bash
git add src/components/ResizeOverlay.tsx src/components/ResizeOverlay.css
git commit -m "feat: add ResizeOverlay component for lifestyle product resize"
```

---

### Task 2: Add resizeLifestyle API function

**Files:**
- Modify: `src/services/api/gemini.ts` — add `resizeLifestyleImage()` function

**Step 1: Add the function at the end of gemini.ts (before any closing braces)**

```typescript
/**
 * Resize/reposition product in a lifestyle image.
 * Sends the lifestyle with a green rectangle overlay + product cutout to Gemini.
 * Gemini replaces the green zone with the product at the indicated size.
 */
export async function resizeLifestyleImage(
  annotatedImageUrl: string,
  productCutoutUrl: string,
  options?: {
    imageSize?: string;
    aspectRatio?: string;
    productDescription?: string;
  },
): Promise<{ resultImageUrl: string }> {
  const resolution = options?.imageSize ?? '2K';

  const resizePrompt = `This image has a bright green rectangle overlay. The green rectangle indicates EXACTLY where the product should be placed and at what size. Replace the green rectangle area with the product shown in the reference image. The product must fit precisely within the green rectangle boundaries. Remove the green overlay completely. Keep the rest of the scene identical — same background, lighting, shadows, and perspective. Generate realistic shadows and reflections for the product at its new position.`;

  const result = await invokeEdgeFunction<{ imageUrl?: string; imageDataUrl?: string }>('studio-api', {
    action: 'lifestyle',
    imageUrl: annotatedImageUrl,
    userPrompt: resizePrompt,
    resolution,
    aspectRatio: options?.aspectRatio,
    productDescription: options?.productDescription,
    // Pass cutout as style reference so Gemini sees the product clearly
    referenceImageUrl: productCutoutUrl,
  });
  return { resultImageUrl: result.imageUrl ?? result.imageDataUrl ?? '' };
}
```

**Step 2: Commit**

```bash
git add src/services/api/gemini.ts
git commit -m "feat: add resizeLifestyleImage API function"
```

---

### Task 3: Wire ResizeOverlay into StudioScreen

**Files:**
- Modify: `src/screens/Studio/StudioScreen.tsx`

**Step 1: Add imports at top of StudioScreen.tsx (after existing imports, ~line 18)**

Add after the existing gemini import line:
```typescript
import { generateLifestyleImage, analyzeStyleReferences, analyzeStyleReplicate, resizeLifestyleImage } from '../../services/api/gemini';
import ResizeOverlay from '../../components/ResizeOverlay';
```
(Replace the existing gemini import line with this one that includes resizeLifestyleImage)

**Step 2: Add state variables (near line 267, after showEdit state)**

```typescript
const [showResize, setShowResize] = useState(false);
const [isResizing, setIsResizing] = useState(false);
```

**Step 3: Add handleResize callback (after handleEditImage, around line 830)**

```typescript
// --- Lifestyle Resize (green rectangle) ---
const handleResize = useCallback(async (annotatedImageDataUrl: string, rect: { x: number; y: number; w: number; h: number }) => {
  setIsResizing(true);
  try {
    // Upload annotated image
    const annotatedUrl = await uploadForEdgeFunction(annotatedImageDataUrl, 'resize-annotated');

    // Get product cutout URL
    const cutoutImage = getStepImage('autoCrop');
    if (!cutoutImage) throw new Error('No product cutout available');
    let cutoutUrl: string;
    if (cutoutImage.startsWith('data:')) {
      cutoutUrl = await uploadForEdgeFunction(cutoutImage, 'resize-cutout');
    } else {
      cutoutUrl = toUsableImageUrl(cutoutImage);
    }

    // Get product description
    const analysisData = pipelineState.analysis.status === 'completed' && pipelineState.analysis.data
      ? (pipelineState.analysis.data as { rawResponse?: string }).rawResponse
      : project?.results.analysis;

    const response = await resizeLifestyleImage(annotatedUrl, cutoutUrl, {
      imageSize: config.imageSize ?? '2K',
      aspectRatio: config.aspectRatio ?? '1:1',
      productDescription: analysisData ?? undefined,
    });

    if (!response.resultImageUrl) throw new Error('No image URL returned');

    const imageDataUrl = await fetchImageAsDataUrl(response.resultImageUrl);
    const newEntry = { id: genEntryId(), image: imageDataUrl, prompt: '[Resized]' };
    const updated = [...lifestyleImages, newEntry];
    setLifestyleImages(updated);
    lifestyleImagesRef.current = updated;
    setActiveVariant(`lifestyle-${newEntry.id}`);
    setShowResize(false);
    await autoSave();
  } catch (err) {
    console.error('Resize failed:', err);
    setLifestyleError(err instanceof Error ? err.message : 'Resize failed');
  } finally {
    setIsResizing(false);
  }
}, [lifestyleImages, config.imageSize, config.aspectRatio, autoSave, uploadForEdgeFunction]);
```

**Step 4: Add ResizeOverlay in the result-canvas div (line ~1169, after the img tag)**

Inside the `result-canvas` div, after the `<img>` tag:

```tsx
{showResize && currentVariant.key.startsWith('lifestyle-') && (
  <ResizeOverlay
    imageSrc={currentVariant.image}
    onApply={handleResize}
    onCancel={() => setShowResize(false)}
    isProcessing={isResizing}
  />
)}
```

**Step 5: Add Resize button in mobile toolbar (after the Edit button, around line 1232)**

```tsx
{currentVariant.key.startsWith('lifestyle-') && (
  <button
    className={`mobile-toolbar-btn ${showResize ? 'active' : ''}`}
    onClick={() => { setShowResize(prev => !prev); setShowLifestyle(false); setShowEdit(false); }}
  >
    Resize
  </button>
)}
```

**Step 6: Add Resize button in sidebar toolbar (after the Edit button, around line 1483)**

```tsx
{currentVariant.key.startsWith('lifestyle-') && (
  <button
    className={`sidebar-tool-btn ${showResize ? 'active' : ''}`}
    onClick={() => { setShowResize(prev => !prev); setShowLifestyle(false); setShowEdit(false); }}
    title="Resize product position"
  >
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="3" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/><path d="M1 1h4M1 1v4M17 17h-4M17 17v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
    Resize
  </button>
)}
```

**Step 7: Close resize mode when switching variants**

In the `setActiveVariant` calls throughout the file, also set `setShowResize(false)` — or add an effect:

```typescript
useEffect(() => { setShowResize(false); }, [activeVariant]);
```

**Step 8: Commit**

```bash
git add src/screens/Studio/StudioScreen.tsx
git commit -m "feat: wire ResizeOverlay into StudioScreen with Gemini resize flow"
```

---

### Task 4: Handle referenceImageUrl in edge function

**Files:**
- Modify: `supabase/functions/studio-api/index.ts` — ensure lifestyle action passes reference image to Gemini
- Modify: `supabase/functions/gemini-generate/index.ts` — accept optional reference image

**Step 1: Check if gemini-generate already supports a second reference image**

Read `supabase/functions/gemini-generate/index.ts` to see how images are sent to Gemini. If it only sends one image, add support for `referenceImageUrl` as a second image input alongside the main lifestyle image. The Gemini API supports multiple image parts in a single request.

**Step 2: In studio-api/index.ts, pass referenceImageUrl through the lifestyle handler**

In the `case "lifestyle"` type assertion (~line 1032), add `referenceImageUrl?: string` to the body type. Then pass it to `handleLifestyle`.

**Step 3: In handleLifestyle, forward referenceImageUrl to the gemini-generate call**

**Step 4: In gemini-generate, if referenceImageUrl is provided, fetch it and add as a second image part in the Gemini API call**

**Step 5: Deploy and commit**

```bash
npx supabase functions deploy studio-api --project-ref lbyayuonwesmxvzvvavx --use-api
npx supabase functions deploy gemini-generate --project-ref lbyayuonwesmxvzvvavx --use-api
git add supabase/functions/
git commit -m "feat: support reference image in lifestyle generation for resize"
```

---

### Task 5: Test end-to-end

**Step 1: Run the app locally**
```bash
npm run dev
```

**Step 2: Generate a lifestyle image**

**Step 3: Click "Resize" button on the lifestyle result**

**Step 4: Draw a green rectangle where the product should be**

**Step 5: Click Apply — verify Gemini returns a new lifestyle with the product resized**

**Step 6: Verify the old lifestyle is still in thumbnails**

**Step 7: Final commit**
```bash
git add -A
git commit -m "feat: lifestyle product resize with green rectangle overlay"
```
