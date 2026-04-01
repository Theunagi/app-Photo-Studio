# Multi-Angle Product Photography

## Summary

Add the ability to generate studio renders from multiple camera angles (Front, Back, Side, 3/4 View, Top) for the same product within a single project. Each angle uses a real photo uploaded by the user taken from that specific angle. All angles generate in parallel with a single "Generate All" action.

## Requirements

- **Angles available:** Front, Back, Side, 3/4 View, Top
- **Default:** Front (existing behavior unchanged)
- **Each angle** has its own real photo upload (taken from that angle)
- **No angle is mandatory** — user picks which ones they want
- **Generation:** Single "Generate All" button runs pipelines for all uploaded angles in parallel
- **Results:** All angle renders grouped in the same project

## Approach: Angle Tabs in StudioScreen

Add a tab bar above the upload dropzone. Each tab represents an angle. "Front" is the default active tab. Users add angles via a "+" button. Each tab has its own independent upload + pipeline state.

## Architecture

### Data Model Changes

**New type in `pipeline.ts`:**

```ts
export type CameraAngle = 'front' | 'back' | 'side' | 'three-quarter' | 'top';

export const CAMERA_ANGLES: { key: CameraAngle; label: string; promptFragment: string }[] = [
  { key: 'front', label: 'Front', promptFragment: 'Front orthographic' },
  { key: 'back', label: 'Back', promptFragment: 'Back orthographic' },
  { key: 'side', label: 'Side', promptFragment: 'Side orthographic' },
  { key: 'three-quarter', label: '3/4 View', promptFragment: '3/4 angle perspective' },
  { key: 'top', label: 'Top', promptFragment: 'Top-down orthographic' },
];
```

**New `PipelineConfig` field:**

```ts
export interface PipelineConfig {
  // ... existing fields
  cameraAngle?: CameraAngle; // defaults to 'front'
}
```

**New multi-angle state in StudioScreen:**

```ts
interface AngleState {
  angle: CameraAngle;
  inputFile: File | null;
  inputPreview: string | null; // data URL
  pipelineState: PipelineState;
  pipelineConfig: PipelineConfig;
}

// Component state:
const [angles, setAngles] = useState<AngleState[]>([
  { angle: 'front', inputFile: null, inputPreview: null, pipelineState: createInitialPipelineState(), pipelineConfig: { ...DEFAULT_PIPELINE_CONFIG, cameraAngle: 'front' } }
]);
const [activeAngleIndex, setActiveAngleIndex] = useState(0);
```

### Backend Changes

**`studio-api/index.ts` — `handleGenerate`:**

Accept new optional `cameraAngle` parameter:

```ts
async function handleGenerate(body: {
  imageUrl: string;
  productDescription: string;
  resolution?: string;
  aspectRatio?: string;
  cameraAngle?: string; // NEW
  referenceImageUrls?: string[];
}): Promise<Response> {
  const angle = body.cameraAngle ?? 'front';
  // Map angle to prompt fragment
  const anglePrompts: Record<string, { opening: string; camera: string }> = {
    'front': { opening: 'Front orthographic', camera: 'Front orthographic' },
    'back': { opening: 'Back orthographic', camera: 'Back orthographic' },
    'side': { opening: 'Side orthographic', camera: 'Side orthographic' },
    'three-quarter': { opening: '3/4 angle perspective', camera: '3/4 angle perspective view' },
    'top': { opening: 'Top-down orthographic', camera: 'Top-down orthographic' },
  };
  const ap = anglePrompts[angle] || anglePrompts['front'];

  // Replace "Front orthographic" in STUDIO_RENDER_PROMPT
  const anglePrompt = STUDIO_RENDER_PROMPT
    .replace('Front orthographic commercial', `${ap.opening} commercial`)
    .replace('Front orthographic.', `${ap.camera}.`);

  const fullPrompt = `${anglePrompt}\n\n${body.productDescription}`;
  // ... rest unchanged
}
```

**`_shared/prompts.ts`:**

Add `buildStudioPromptWithAngle`:

```ts
export function buildStudioPromptWithAngle(productDescription: string, cameraAngle: CameraAngle = 'front'): string {
  const angleMap: Record<CameraAngle, { opening: string; camera: string }> = {
    'front': { opening: 'Front orthographic', camera: 'Front orthographic' },
    'back': { opening: 'Back orthographic', camera: 'Back orthographic' },
    'side': { opening: 'Side orthographic', camera: 'Side orthographic' },
    'three-quarter': { opening: '3/4 angle perspective', camera: '3/4 angle perspective view' },
    'top': { opening: 'Top-down orthographic', camera: 'Top-down orthographic' },
  };
  const ap = angleMap[cameraAngle];
  const prompt = STUDIO_RENDER_PROMPT
    .replace('Front orthographic commercial', `${ap.opening} commercial`)
    .replace('Front orthographic.', `${ap.camera}.`);
  return `${prompt}\n\n${productDescription}`;
}
```

### Frontend Changes

**1. AngleTabs component (new):**

A tab bar with angle chips + "+" add button. Shows active angle highlighted. Each tab shows a small thumbnail of the uploaded image (or empty state). Tabs are removable (X button) except the last one.

**2. StudioScreen modifications:**

- Replace single `inputFiles`/`inputPreviews` state with `angles[]` array
- Active tab controls which dropzone is visible
- Upload goes into `angles[activeAngleIndex]`
- "Generate All" button replaces "Generate" — loops through all angles with uploaded images, runs `runPipeline()` for each in parallel (Promise.all)
- Pipeline progress shows per-angle status
- Result viewer has angle tabs to switch between results

**3. Pipeline orchestrator (`runPipeline`):**

- Accept `cameraAngle` in config
- Pass `cameraAngle` to the `studio-api` edge function call in the generate step

### UI Flow

1. User opens project — sees "Front" tab by default (current behavior)
2. User clicks "+" — dropdown with remaining angles (Back, Side, 3/4, Top)
3. User selects "Back" — new tab appears, shows empty dropzone
4. User uploads back photo — preview shown in that tab
5. User switches to "Side" tab, uploads side photo
6. User clicks "Generate All" — all angles with uploaded images run in parallel
7. Progress shows per angle (e.g., "Front: Studio Generation... | Back: Analysis...")
8. Results viewable by switching angle tabs

### Cost

Each angle = 1 full pipeline run = same credit cost as today. N angles = N x cost. Display total cost before generation ("This will use X credits for Y angles").

## Files to Modify

| File | Change |
|------|--------|
| `src/models/pipeline.ts` | Add `CameraAngle` type, `CAMERA_ANGLES` constant, add `cameraAngle` to `PipelineConfig` |
| `src/screens/Studio/StudioScreen.tsx` | Add angle tabs UI, multi-angle state, parallel generation |
| `src/screens/Studio/components/AngleTabs.tsx` | New component for angle tab bar |
| `supabase/functions/studio-api/index.ts` | Accept `cameraAngle` param, modify prompt dynamically |
| `supabase/functions/_shared/prompts.ts` | Add `buildStudioPromptWithAngle()` helper |
| `src/services/pipeline.ts` (or equivalent orchestrator) | Pass `cameraAngle` to edge function |

## Out of Scope

- Sharing analysis results between angles (each angle does its own analysis since photos are different)
- Auto-detecting angle from uploaded photo
- Exporting all angles as a bundle/zip
