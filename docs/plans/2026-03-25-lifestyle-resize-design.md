# Lifestyle Product Resize — Design Doc

## Problem
Gemini-generated lifestyle images often have the product at the wrong size (too big or too small). Users need a way to control product placement and scale.

## Solution
Add a "Resize product" mode on lifestyle results. The user draws a green rectangle on the image to indicate where and how big the product should be. The image + green rectangle is sent back to Gemini to regenerate with correct sizing.

## Approach
Approach A: Green rectangle overlay + Gemini re-generation (full image). Chosen over Fal.ai inpainting because it reuses the existing pipeline, produces coherent lighting/shadows, and is simpler to implement.

## UX Flow
1. User generates a lifestyle (existing flow)
2. Clicks "Resize product" button (new, next to Edit/Download)
3. Image enters rectangle mode: crosshair cursor, draws green semi-transparent rectangle
4. Can re-draw by clicking again (resets previous rectangle)
5. Clicks "Apply" — sends to Gemini — loading state
6. New lifestyle returned, added as variant. Old one preserved in thumbnails.

## Frontend: ResizeOverlay Component
- Transparent HTML canvas overlaid on the lifestyle image (same dimensions)
- mousedown → start corner, mousemove → preview rect (green border + rgba(0,255,0,0.3) fill), mouseup → finalize
- Touch support: touchstart/touchmove/touchend
- Coordinates stored as normalized 0-1 values (relative to original image, not display size)
- Buttons: "Apply" + "Cancel"
- On Apply: draw green rect onto a copy of the lifestyle image (canvas), export as PNG

## Backend: Gemini Re-generation
- Reuses existing `gemini-generate` edge function
- Inputs:
  - image: lifestyle with green rectangle baked in (PNG)
  - referenceImage: original product cutout
  - prompt: "Replace the green rectangle area with the product. Place the product exactly within the green rectangle boundaries, matching that size and position. Keep the rest of the scene identical. Maintain realistic lighting, shadows and perspective."
- No new endpoint needed
- Cost: 1 credit (same as lifestyle generation)

## Key Files to Modify
- `src/screens/Studio/StudioScreen.tsx` — add Resize button + state management
- `src/components/ResizeOverlay.tsx` — new component (canvas + rectangle drawing)
- `src/services/api/gemini.ts` — add resizeLifestyle() function (or reuse generateLifestyleImage with modified params)
- `supabase/functions/gemini-generate/index.ts` — may need a "resize" mode or just reuse "lifestyle" mode with the baked-in rectangle image

## Out of Scope
- Free-form brush painting (future iteration)
- Pre-generation placement (draw before generating)
- Multiple product placement zones
