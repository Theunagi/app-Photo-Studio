# Mass Upload System — Design Document

**Date:** 2026-03-03
**Status:** Approved

## Overview

Mass upload system with AI-powered auto-grouping, auto-naming, and collection/folder organization for FrameFlow. Allows users to upload up to 50 product images at once, have them automatically grouped by product similarity using Vision AI, named descriptively, and batch-processed through the existing 8-step pipeline.

## Architecture

### Approach: Upload Hub (dedicated screen accessible from Home)

Entry point: "Mass Import" button on Home screen → opens `/upload` route with a 3-step wizard flow, then returns to Home with projects created inside a collection.

## Data Model

### New: `Collection`

```typescript
interface Collection {
  id: string;              // UUID
  name: string;            // "Collection Été 2025"
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;      // Auto: first project thumbnail
  projectIds: string[];    // Projects in this collection
  userId: string;
}
```

### Modified: `Project`

```typescript
interface Project {
  // ... existing fields unchanged ...
  collectionId?: string;   // Optional reference to a collection
  sourceImages?: string[]; // Source images before grouping (multi-angle)
}
```

### New Supabase table: `collections`

```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  thumbnail TEXT
);

ALTER TABLE projects ADD COLUMN collection_id UUID REFERENCES collections(id);
CREATE INDEX idx_projects_collection ON projects(collection_id);
CREATE INDEX idx_collections_user ON collections(user_id);
```

### Storage: new path convention

```
project-images/
  {collectionId}/
    {projectId}/
      input.png
      autoCrop.png
      studioGeneration.png
      ...
```

When no collection: existing behavior unchanged (`{projectId}/{slot}.png`).

## UI Flow

### Step 1: Drop Zone

- Full-screen drop zone with "Drop your product photos or click to browse"
- Accepts PNG/JPEG, up to 50 images, max 10MB each
- Collection name input (auto-generated, editable)
- Back button to Home
- Progress bar during upload

### Step 2: AI Grouping & Preview

- Grid view of all uploaded images
- AI-proposed groups with:
  - Auto-generated name (editable inline)
  - Primary image selector (the one that goes through the pipeline)
  - Secondary images = reference images for the project
  - Drag & drop between groups to reorganize
- "Ungrouped" section for images the AI couldn't match
- "Select All" / individual checkboxes for batch selection
- Credit cost estimation displayed

### Step 3: Batch Pipeline Launch

- Sequential pipeline execution (one project at a time)
- Per-project progress bar
- Global progress (X/N projects done)
- Credits remaining counter
- Pause/Cancel controls
- On completion: redirect to collection in Home gallery

## AI Grouping Logic

### Implementation

Single batch call to GPT-4 Vision via existing `openai-vision` edge function:

1. Resize all images to 256px thumbnails (reduce token cost ~90%)
2. Send batch to Vision API with structured prompt:
   ```
   Analyze these product images. Group images showing the SAME product
   (different angles/views). Return JSON:
   {groups: [{name: "descriptive name", indices: [0,2,3], primary: 0}, ...],
    ungrouped: [5,7]}
   ```
3. If > 20 images: split into batches of 20, then merge results
4. Cost: ~$0.01-0.03 per batch of 20 (operational cost, free for user)

### Auto-naming

- Vision AI returns descriptive names ("White Leather Sneaker", "Gold Perfume Bottle")
- Fallback: parse filename (`sneaker_nike_01.jpg` → `Sneaker Nike`)
- All names are editable by the user before launching

### Fallback

If Vision API fails: each image becomes its own group, named from filename.

## Error Handling

### Limits
- Max 50 images per batch
- Max 10MB per image
- PNG/JPEG only
- Insufficient credits: show cost estimate, link to Pricing

### Network errors
- Upload failure: auto-retry x3 with exponential backoff, then "Failed" with retry button
- Vision API failure: fallback to 1 image = 1 group, name from filename
- Pipeline failure on one project: continue others, mark failed with retry option

### Edge cases
- Duplicate images: client-side MD5 hash detection → warning
- Browser closed during batch: created projects are saved, collection exists with completed + pending projects
- 0 images: stay on drop zone
- 1 image: skip grouping, create project directly

## Home Screen Modifications

- "Mass Import" button next to "New Project" in header
- Collections section above project grid: clickable collection cards (thumbnail + name + project count)
- Click collection → filter gallery to its projects
- Breadcrumb: "All Projects" / "Collection Name"

## Credits

- AI grouping/naming: FREE (operational cost)
- Pipeline execution: existing pricing (2 credits for 2K, 3 credits for 4K) per project
- Cost estimation shown before batch launch

## Files to Create/Modify

### New files
- `src/screens/Upload/UploadScreen.tsx` — Main upload hub screen
- `src/screens/Upload/UploadScreen.css` — Styles
- `src/screens/Upload/components/DropZone.tsx` — Drag & drop zone
- `src/screens/Upload/components/GroupingView.tsx` — AI grouping review UI
- `src/screens/Upload/components/BatchProgress.tsx` — Batch pipeline progress
- `src/services/api/imageGrouping.ts` — Vision AI grouping logic
- `src/services/db/collectionDB.ts` — Collection CRUD operations
- `src/models/collection.ts` — Collection type + factory

### Modified files
- `src/models/project.ts` — Add `collectionId`, `sourceImages`
- `src/models/index.ts` — Export collection types
- `src/services/db/projectDB.ts` — Add collection filtering
- `src/services/db/storage.ts` — Support new path convention with collections
- `src/screens/Home/HomeScreen.tsx` — Add Mass Import button + Collections section
- `src/screens/Home/HomeScreen.css` — Collection card styles
- `src/App.tsx` — Add `/upload` route
- `supabase/migrations/` — New migration for collections table + projects column
