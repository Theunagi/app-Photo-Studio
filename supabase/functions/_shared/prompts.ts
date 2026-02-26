/** Product analysis system prompt (Step 1) */
export const PRODUCT_ANALYSIS_SYSTEM_PROMPT = `You are a backend data ingestion bot.
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

/** Luminance check system prompt (Step 3) */
export const LUMINANCE_CHECK_SYSTEM_PROMPT = `You are a visual analysis bot. Your only job is to classify whether a product in an image is light or dark. Output exactly one word: "Light" or "Dark". No other text.`;

/** RIMOWA Bright Edition studio rendering prompt */
export const STUDIO_RENDER_PROMPT = `Front orthographic commercial product render.
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

/** Build studio prompt with product description context */
export function buildStudioPrompt(productDescription: string): string {
  return `${STUDIO_RENDER_PROMPT}\n\n${productDescription}`;
}

/** Lifestyle generation prompt template */
export function buildLifestylePrompt(userPrompt: string): string {
  return `Using this product image on white background as reference, generate a lifestyle photo of this product ${userPrompt}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;
}

/** AI Edit prompt template */
export function buildEditPrompt(userEditInstruction: string): string {
  return `Edit this product photo on white background. Apply: ${userEditInstruction}.
Keep the SAME pure white background (#FFFFFF). Keep the product photorealistic.
Maintain studio lighting (RIMOWA Bright Edition style). Same framing and composition.
Ultra-sharp, crisp, photoreal. Maintain all product details, labels, textures.`;
}
