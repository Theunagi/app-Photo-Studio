# Multi-Angle Product Photography — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to upload real photos from multiple camera angles (Front, Back, Side, 3/4, Top) and generate studio renders for all angles in parallel within a single project.

**Architecture:** Add a `CameraAngle` type and angle-aware prompt builder. The backend replaces "Front orthographic" with the selected angle's prompt fragment. The frontend adds angle tabs above the upload dropzone, each tab managing its own upload + pipeline state. A "Generate All" button runs pipelines in parallel via `Promise.all`.

**Tech Stack:** React + TypeScript (frontend), Supabase Edge Functions / Deno (backend), Fal.ai / NanoBanana (image generation)

---

## Task 1: Add CameraAngle type and CAMERA_ANGLES constant to pipeline model

**Files:**
- Modify: `src/models/pipeline.ts:1-28`

**Step 1: Add CameraAngle type and constant after line 9 (after OutputFormat)**

Add this after the `OutputFormat` type definition (line 9):

```ts
/** Available camera angles for studio generation */
export type CameraAngle = 'front' | 'back' | 'side' | 'three-quarter' | 'top';

export const CAMERA_ANGLES: { key: CameraAngle; label: string; promptFragment: string }[] = [
  { key: 'front', label: 'Front', promptFragment: 'Front orthographic' },
  { key: 'back', label: 'Back', promptFragment: 'Back orthographic' },
  { key: 'side', label: 'Side', promptFragment: 'Side orthographic' },
  { key: 'three-quarter', label: '3/4 View', promptFragment: '3/4 angle perspective' },
  { key: 'top', label: 'Top', promptFragment: 'Top-down orthographic' },
];
```

**Step 2: Add cameraAngle to PipelineConfig**

In the `PipelineConfig` interface (line 11-22), add after `productNotes`:

```ts
  /** Camera angle for studio generation (defaults to 'front') */
  cameraAngle?: CameraAngle;
```

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors related to pipeline.ts

**Step 4: Commit**

```bash
git add src/models/pipeline.ts
git commit -m "feat: add CameraAngle type and CAMERA_ANGLES constant"
```

---

## Task 2: Add angle-aware prompt builder to shared prompts

**Files:**
- Modify: `supabase/functions/_shared/prompts.ts:68-73`

**Step 1: Add ANGLE_PROMPT_MAP and buildStudioPromptWithAngle**

After the existing `buildStudioPrompt` function (line 73), add:

```ts
/** Camera angle prompt fragments */
const ANGLE_PROMPT_MAP: Record<string, { opening: string; camera: string }> = {
  'front': { opening: 'Front orthographic', camera: 'Front orthographic' },
  'back': { opening: 'Back orthographic', camera: 'Back orthographic' },
  'side': { opening: 'Side orthographic', camera: 'Side orthographic' },
  'three-quarter': { opening: '3/4 angle perspective', camera: '3/4 angle perspective view' },
  'top': { opening: 'Top-down orthographic', camera: 'Top-down orthographic' },
};

/** Build studio prompt with camera angle support */
export function buildStudioPromptWithAngle(productDescription: string, cameraAngle: string = 'front'): string {
  const ap = ANGLE_PROMPT_MAP[cameraAngle] ?? ANGLE_PROMPT_MAP['front'];
  const prompt = STUDIO_RENDER_PROMPT
    .replace('Front orthographic commercial', `${ap.opening} commercial`)
    .replace('Front orthographic.', `${ap.camera}.`);
  return `${prompt}\n\n${productDescription}`;
}
```

**Step 2: Commit**

```bash
git add supabase/functions/_shared/prompts.ts
git commit -m "feat: add angle-aware prompt builder"
```

---

## Task 3: Update studio-api edge function to accept cameraAngle

**Files:**
- Modify: `supabase/functions/studio-api/index.ts:275-288`

**Step 1: Add cameraAngle to handleGenerate signature**

At line 275, update the function signature to include `cameraAngle`:

```ts
async function handleGenerate(body: {
  imageUrl: string;
  productDescription: string;
  resolution?: string;
  aspectRatio?: string;
  cameraAngle?: string; // NEW
  referenceImageUrls?: string[];
}): Promise<Response> {
```

**Step 2: Replace hardcoded prompt construction**

At line 288, replace:

```ts
const fullPrompt = `${STUDIO_RENDER_PROMPT}\n\n${body.productDescription}`;
```

With:

```ts
  // Build angle-aware prompt
  const angle = body.cameraAngle ?? 'front';
  const anglePrompts: Record<string, { opening: string; camera: string }> = {
    'front': { opening: 'Front orthographic', camera: 'Front orthographic' },
    'back': { opening: 'Back orthographic', camera: 'Back orthographic' },
    'side': { opening: 'Side orthographic', camera: 'Side orthographic' },
    'three-quarter': { opening: '3/4 angle perspective', camera: '3/4 angle perspective view' },
    'top': { opening: 'Top-down orthographic', camera: 'Top-down orthographic' },
  };
  const ap = anglePrompts[angle] || anglePrompts['front'];
  const anglePrompt = STUDIO_RENDER_PROMPT
    .replace('Front orthographic commercial', `${ap.opening} commercial`)
    .replace('Front orthographic.', `${ap.camera}.`);
  const fullPrompt = `${anglePrompt}\n\n${body.productDescription}`;
```

**Step 3: Commit**

```bash
git add supabase/functions/studio-api/index.ts
git commit -m "feat: studio-api accepts cameraAngle parameter for prompt"
```

---

## Task 4: Pass cameraAngle through frontend API layer and orchestrator

**Files:**
- Modify: `src/services/api/falImageGen.ts:14-31`
- Modify: `src/services/pipeline/orchestrator.ts:176-208`

**Step 1: Update generateStudioImage to accept cameraAngle**

In `src/services/api/falImageGen.ts`, update the function (line 14-31):

```ts
export async function generateStudioImage(
  imageUrl: string,
  productDescription: string,
  options?: {
    resolution?: string;
    aspectRatio?: string;
    sessionId?: string;
    cameraAngle?: string; // NEW
  },
): Promise<{ resultImageUrl: string }> {
  const result = await invokeEdgeFunction<{ imageUrl: string }>('studio-api', {
    action: 'generate',
    imageUrl,
    productDescription,
    resolution: options?.resolution,
    aspectRatio: options?.aspectRatio,
    cameraAngle: options?.cameraAngle, // NEW
  });
  return { resultImageUrl: result.imageUrl };
}
```

**Step 2: Update orchestrator to pass cameraAngle**

In `src/services/pipeline/orchestrator.ts`, at line 181, update the `generateStudioImage` call:

```ts
      const response = await generateStudioImage(inputStorageUrl, analysis.description, {
        resolution: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
        sessionId,
        cameraAngle: config.cameraAngle, // NEW
      });
```

Also update the NanoBanana fallback at line 197:

```ts
    const response = await callNanoBananaImageGen(inputStorageUrl, analysis.description, {
      referenceImageUrls: additionalStorageUrls,
      resolution: config.imageSize ?? '2K',
      aspectRatio: config.aspectRatio ?? '1:1',
      sessionId,
      cameraAngle: config.cameraAngle, // NEW
    });
```

**Step 3: Update callNanoBananaImageGen if needed**

Check `src/services/api/nanobanana.ts` and add `cameraAngle` to its options + edge function call the same way.

**Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/services/api/falImageGen.ts src/services/pipeline/orchestrator.ts src/services/api/nanobanana.ts
git commit -m "feat: pass cameraAngle through API layer and pipeline orchestrator"
```

---

## Task 5: Create AngleTabs component

**Files:**
- Create: `src/screens/Studio/components/AngleTabs.tsx`

**Step 1: Create the AngleTabs component**

```tsx
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { type CameraAngle, CAMERA_ANGLES } from '../../../models/pipeline';

interface AngleTab {
  angle: CameraAngle;
  hasImage: boolean;
  thumbnailUrl: string | null;
}

interface AngleTabsProps {
  tabs: AngleTab[];
  activeIndex: number;
  onTabClick: (index: number) => void;
  onAddAngle: (angle: CameraAngle) => void;
  onRemoveAngle: (index: number) => void;
  disabled?: boolean;
}

export function AngleTabs({ tabs, activeIndex, onTabClick, onAddAngle, onRemoveAngle, disabled }: AngleTabsProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const usedAngles = new Set(tabs.map(t => t.angle));
  const availableAngles = CAMERA_ANGLES.filter(a => !usedAngles.has(a.key));

  return (
    <div className="angle-tabs">
      <div className="angle-tabs-list">
        {tabs.map((tab, i) => {
          const angleDef = CAMERA_ANGLES.find(a => a.key === tab.angle);
          return (
            <button
              key={tab.angle}
              className={`angle-tab ${i === activeIndex ? 'active' : ''} ${tab.hasImage ? 'has-image' : ''}`}
              onClick={() => onTabClick(i)}
              disabled={disabled}
            >
              {tab.thumbnailUrl && (
                <img src={tab.thumbnailUrl} alt={angleDef?.label} className="angle-tab-thumb" />
              )}
              <span className="angle-tab-label">{angleDef?.label ?? tab.angle}</span>
              {tabs.length > 1 && (
                <span
                  className="angle-tab-remove"
                  onClick={(e) => { e.stopPropagation(); onRemoveAngle(i); }}
                >
                  <X size={12} />
                </span>
              )}
            </button>
          );
        })}

        {availableAngles.length > 0 && (
          <div className="angle-tab-add-wrapper">
            <button
              className="angle-tab-add"
              onClick={() => setShowAddMenu(!showAddMenu)}
              disabled={disabled}
            >
              <Plus size={14} />
            </button>

            {showAddMenu && (
              <div className="angle-add-menu">
                {availableAngles.map(a => (
                  <button
                    key={a.key}
                    className="angle-add-option"
                    onClick={() => { onAddAngle(a.key); setShowAddMenu(false); }}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Add CSS styles**

Add styles to the existing Studio stylesheet (or inline with the component's existing pattern). Key styles:

```css
.angle-tabs { margin-bottom: 12px; }
.angle-tabs-list { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.angle-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); cursor: pointer; font-size: 13px;
  transition: all 0.15s;
}
.angle-tab.active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.25); color: #fff; }
.angle-tab.has-image { border-color: rgba(99,102,241,0.4); }
.angle-tab-thumb { width: 20px; height: 20px; border-radius: 4px; object-fit: cover; }
.angle-tab-remove { opacity: 0.4; cursor: pointer; display: flex; }
.angle-tab-remove:hover { opacity: 1; }
.angle-tab-add { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(255,255,255,0.06); border: 1px dashed rgba(255,255,255,0.15); color: rgba(255,255,255,0.4); cursor: pointer; }
.angle-tab-add:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.angle-tab-add-wrapper { position: relative; }
.angle-add-menu { position: absolute; top: 100%; left: 0; margin-top: 4px; background: #1a1a2e; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; z-index: 10; min-width: 120px; }
.angle-add-option { display: block; width: 100%; padding: 6px 10px; border-radius: 4px; background: none; border: none; color: rgba(255,255,255,0.7); cursor: pointer; text-align: left; font-size: 13px; }
.angle-add-option:hover { background: rgba(255,255,255,0.08); color: #fff; }
```

**Step 3: Commit**

```bash
git add src/screens/Studio/components/AngleTabs.tsx
git commit -m "feat: create AngleTabs component for multi-angle selection"
```

---

## Task 6: Refactor StudioScreen to support multi-angle state

**Files:**
- Modify: `src/screens/Studio/StudioScreen.tsx`

This is the largest task. It touches state management, upload handling, generation, and result display.

**Step 1: Add imports and AngleState interface**

At the top of StudioScreen.tsx, add:

```ts
import { AngleTabs } from './components/AngleTabs';
import { type CameraAngle, CAMERA_ANGLES, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';

interface AngleSlot {
  angle: CameraAngle;
  inputFile: File | null;
  inputPreview: string | null;
  pipelineState: PipelineState;
}
```

**Step 2: Add multi-angle state**

After existing state declarations (around line 267), add:

```ts
const [angleSlots, setAngleSlots] = useState<AngleSlot[]>([
  { angle: 'front', inputFile: null, inputPreview: null, pipelineState: createInitialPipelineState() }
]);
const [activeAngleIndex, setActiveAngleIndex] = useState(0);
```

**Step 3: Add angle management handlers**

Add these handler functions:

```ts
const addAngle = (angle: CameraAngle) => {
  setAngleSlots(prev => [...prev, { angle, inputFile: null, inputPreview: null, pipelineState: createInitialPipelineState() }]);
  setActiveAngleIndex(angleSlots.length); // switch to new tab
};

const removeAngle = (index: number) => {
  if (angleSlots.length <= 1) return;
  setAngleSlots(prev => prev.filter((_, i) => i !== index));
  setActiveAngleIndex(prev => prev >= index ? Math.max(0, prev - 1) : prev);
};
```

**Step 4: Update upload handlers to target active angle**

Modify `addFiles` (around line 411) so that files uploaded go into `angleSlots[activeAngleIndex]` instead of `inputFiles`/`inputPreviews`. The first uploaded file becomes that angle's `inputFile` and `inputPreview`. Keep existing `inputFiles`/`inputPreviews` for backward compat — derive them from the active angle slot.

**Step 5: Update handleRunPipeline for parallel multi-angle generation**

Replace the existing `handleRunPipeline` (line 468-518) with a version that:
1. Collects all angle slots that have an uploaded image
2. Calculates total cost = N angles x per-angle cost
3. Checks credits for total cost
4. Runs `Promise.all` over all angles, each calling `runPipeline()` with its own `cameraAngle` in config
5. Updates each angle's `pipelineState` independently via the callback

```ts
const handleRunPipeline = async () => {
  const slotsWithImages = angleSlots.filter(s => s.inputFile || s.inputPreview);
  if (slotsWithImages.length === 0 || isRunning) return;

  const totalCost = slotsWithImages.length * GENERATION_COST[config.imageSize as keyof typeof GENERATION_COST];
  if (pointsBalance < totalCost) { /* show error */ return; }

  setIsRunning(true);
  setPipelineError(null);

  try {
    await Promise.all(
      angleSlots.map(async (slot, index) => {
        if (!slot.inputFile && !slot.inputPreview) return;

        const file = slot.inputFile ?? await dataUrlToFile(slot.inputPreview!);
        const angleConfig = { ...config, cameraAngle: slot.angle };

        await runPipeline({
          config: angleConfig,
          inputFile: file,
          onStateChange: (newState) => {
            setAngleSlots(prev => prev.map((s, i) =>
              i === index ? { ...s, pipelineState: { ...newState } } : s
            ));
          },
        });
      })
    );

    // Deduct credits
    // Track analytics
  } catch (err) {
    setPipelineError(friendlyError(err));
  } finally {
    setIsRunning(false);
    autoSave();
  }
};
```

**Step 6: Insert AngleTabs in upload section**

In the JSX, right before the dropzone section (around line 1131), add:

```tsx
<AngleTabs
  tabs={angleSlots.map(s => ({
    angle: s.angle,
    hasImage: !!s.inputPreview,
    thumbnailUrl: s.inputPreview,
  }))}
  activeIndex={activeAngleIndex}
  onTabClick={setActiveAngleIndex}
  onAddAngle={addAngle}
  onRemoveAngle={removeAngle}
  disabled={isRunning}
/>
```

**Step 7: Show active angle's dropzone and pipeline state**

Update the dropzone to show `angleSlots[activeAngleIndex].inputPreview` instead of `inputPreviews[0]`. Update the pipeline progress to show the active angle's `pipelineState`.

**Step 8: Add angle tabs to result viewer**

In the result viewer section (line 1303+), add the same `AngleTabs` bar at the top so users can switch between angle results. Each angle's final result comes from `angleSlots[activeAngleIndex].pipelineState.autoCrop`.

**Step 9: Update cost display**

Update the generate button label to show total cost:

```tsx
const uploadedAnglesCount = angleSlots.filter(s => s.inputPreview).length;
const totalCost = uploadedAnglesCount * GENERATION_COST[config.imageSize];

// Button text:
{uploadedAnglesCount > 1
  ? `Generate All (${uploadedAnglesCount} angles) — ${totalCost} credits`
  : `Generate — ${totalCost} credits`
}
```

**Step 10: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

**Step 11: Commit**

```bash
git add src/screens/Studio/StudioScreen.tsx
git commit -m "feat: multi-angle state management, parallel generation, angle tabs UI"
```

---

## Task 7: Update NanoBanana API to pass cameraAngle

**Files:**
- Modify: `src/services/api/nanobanana.ts`

**Step 1: Add cameraAngle to the options and edge function call**

Same pattern as Task 4 Step 1 — add `cameraAngle?: string` to options, pass it in the `invokeEdgeFunction` call.

**Step 2: Commit**

```bash
git add src/services/api/nanobanana.ts
git commit -m "feat: pass cameraAngle through NanoBanana API"
```

---

## Task 8: Manual end-to-end test

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test default behavior (regression)**

1. Open studio, upload a front product photo
2. Click Generate — should work exactly as before (Front orthographic prompt)
3. Verify result looks correct

**Step 3: Test multi-angle flow**

1. Click "+" to add "Back" angle tab
2. Switch to Back tab, upload a back-view photo
3. Click "+" to add "Side" tab, upload side-view photo
4. Click "Generate All"
5. Verify all 3 angles generate in parallel
6. Switch between angle tabs in result viewer — each shows its own render
7. Verify credit cost shows correctly (3x single cost)

**Step 4: Test edge cases**

1. Remove an angle tab — verify state cleanup
2. Single angle only (no extra tabs) — should work identically to old behavior
3. Add angle but don't upload image — should be skipped during generation

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: multi-angle edge case fixes from manual testing"
```

---

## Task 9: Deploy edge function

**Step 1: Deploy updated studio-api**

```bash
npx supabase functions deploy studio-api
```

**Step 2: Verify deployment**

Check Supabase dashboard that the function is deployed and running.

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: deploy studio-api with multi-angle support"
```
