# Mass Upload System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a mass upload system with AI-powered auto-grouping, auto-naming, collections, and batch pipeline execution.

**Architecture:** New Upload Hub screen (`/upload`) accessible from Home via "Mass Import" button. 3-step wizard: DropZone → AI Grouping Review → Batch Pipeline. New `collections` table in Supabase, `collection_id` column on `projects`. Storage paths optionally prefixed with `{collectionId}/`.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + Storage + Edge Functions), GPT-4 Vision for grouping, existing pipeline orchestrator for batch execution.

**Design doc:** `docs/plans/2026-03-03-mass-upload-design.md`

---

## Task 1: Collection Model

**Files:**
- Create: `src/models/collection.ts`
- Modify: `src/models/index.ts`

**Step 1: Create the collection model file**

```typescript
// src/models/collection.ts
/**
 * Collection Model — Groups of related projects (e.g. a product line batch upload)
 */

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  projectCount: number;
  userId?: string;
}

export function createCollection(name: string): Collection {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    projectCount: 0,
  };
}
```

**Step 2: Export from models/index.ts**

Add to `src/models/index.ts` (after line 9):
```typescript
// Collections
export * from './collection';
```

**Step 3: Commit**

```bash
git add src/models/collection.ts src/models/index.ts
git commit -m "feat: add Collection model"
```

---

## Task 2: Update Project Model

**Files:**
- Modify: `src/models/project.ts` (lines 20-31)

**Step 1: Add collectionId and sourceImages to Project interface**

In `src/models/project.ts`, add two optional fields to the `Project` interface after line 30 (`results: ProjectResult;`):

```typescript
export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumbnail?: string;
  config: {
    imageSize: string;
    aspectRatio: string;
  };
  results: ProjectResult;
  /** Collection this project belongs to (mass upload) */
  collectionId?: string;
  /** Original source images before pipeline (multi-angle uploads) */
  sourceImages?: string[];
}
```

No changes to `createProject()` — the new fields are optional.

**Step 2: Commit**

```bash
git add src/models/project.ts
git commit -m "feat: add collectionId and sourceImages to Project"
```

---

## Task 3: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260303_collections.sql`

**Step 1: Create migration file**

```sql
-- Collections table for grouping mass-uploaded projects
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  thumbnail TEXT
);

-- Add collection reference to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_collection ON projects(collection_id);

-- RLS: users can only access their own collections
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own collections"
  ON collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own collections"
  ON collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
  ON collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
  ON collections FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger (reuse pattern from projects)
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

**Step 2: Commit**

```bash
git add supabase/migrations/20260303_collections.sql
git commit -m "feat: add collections table migration"
```

---

## Task 4: Collection DB Service

**Files:**
- Create: `src/services/db/collectionDB.ts`

**Step 1: Create collectionDB.ts**

Follow the exact same patterns from `src/services/db/projectDB.ts`: Supabase primary with IndexedDB fallback via `withFallback()`.

```typescript
// src/services/db/collectionDB.ts
/**
 * Collection persistence — Supabase (primary) with IndexedDB fallback.
 * Mirrors the pattern from projectDB.ts.
 */

import type { Collection } from '../../models/collection';
import { supabase, isSupabaseConfigured } from './supabase';

async function getAuthUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// --- Supabase row shape ---
interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
}

function rowToCollection(row: CollectionRow, projectCount: number): Collection {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    thumbnail: row.thumbnail ?? undefined,
    projectCount,
    userId: row.user_id,
  };
}

// --- Supabase CRUD ---

async function sbGetAll(): Promise<Collection[]> {
  const userId = await getAuthUserId();
  const { data, error } = await supabase
    .from('collections')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Supabase getAllCollections: ${error.message}`);

  // Get project counts per collection
  const collections = data as CollectionRow[];
  const results: Collection[] = [];

  for (const row of collections) {
    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('collection_id', row.id);
    results.push(rowToCollection(row, count ?? 0));
  }

  return results;
}

async function sbSave(collection: Collection): Promise<void> {
  const userId = await getAuthUserId();
  const row = {
    id: collection.id,
    user_id: userId,
    name: collection.name,
    created_at: new Date(collection.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
    thumbnail: collection.thumbnail ?? null,
  };

  const { error } = await supabase
    .from('collections')
    .upsert(row, { onConflict: 'id' });

  if (error) throw new Error(`Supabase saveCollection: ${error.message}`);
}

async function sbDelete(id: string): Promise<void> {
  // Unlink projects first (don't delete them)
  await supabase
    .from('projects')
    .update({ collection_id: null })
    .eq('collection_id', id);

  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Supabase deleteCollection: ${error.message}`);
}

// --- IndexedDB fallback ---

const DB_NAME = 'photostudio';
const DB_VERSION = 2; // Bump version to add collections store
const STORE = 'collections';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Ensure projects store also exists (from v1)
      if (!db.objectStoreNames.contains('projects')) {
        const ps = db.createObjectStore('projects', { keyPath: 'id' });
        ps.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

async function idbGetAll(): Promise<Collection[]> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const store = idbTx(db, 'readonly');
    const index = store.index('updatedAt');
    const req = index.openCursor(null, 'prev');
    const results: Collection[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as Collection);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(collection: Collection): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = idbTx(db, 'readwrite').put({ ...collection, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = idbTx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Public API with fallback ---

const useSB = isSupabaseConfigured();

async function withFallback<T>(
  sbFn: () => Promise<T>,
  idbFn: () => Promise<T>,
): Promise<T> {
  if (!useSB) return idbFn();
  try {
    return await sbFn();
  } catch (err) {
    console.warn('[CollectionDB] Supabase call failed, falling back to IndexedDB:', err);
    return idbFn();
  }
}

export async function getAllCollections(): Promise<Collection[]> {
  return withFallback(sbGetAll, idbGetAll);
}

export async function saveCollection(collection: Collection): Promise<void> {
  if (!useSB) return idbSave(collection);
  try {
    await sbSave(collection);
  } catch (err) {
    console.warn('[CollectionDB] Supabase save failed:', err);
  }
  await idbSave(collection);
}

export async function deleteCollection(id: string): Promise<void> {
  if (!useSB) return idbDelete(id);
  try {
    await sbDelete(id);
  } catch (err) {
    console.warn('[CollectionDB] Supabase delete failed:', err);
  }
  await idbDelete(id);
}
```

**Step 2: Commit**

```bash
git add src/services/db/collectionDB.ts
git commit -m "feat: add Collection DB service with Supabase + IndexedDB fallback"
```

---

## Task 5: Add collection filtering to projectDB

**Files:**
- Modify: `src/services/db/projectDB.ts`

**Step 1: Add getProjectsByCollection function**

Add after the `deleteProject` export (line 374):

```typescript
export async function getProjectsByCollection(collectionId: string): Promise<Project[]> {
  return withFallback(
    async () => {
      const userId = await getAuthUserId();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .eq('collection_id', collectionId)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(`Supabase getProjectsByCollection: ${error.message}`);
      return (data as ProjectRow[]).map(rowToProject);
    },
    async () => {
      const all = await idbGetAll();
      return all.filter(p => p.collectionId === collectionId);
    },
  );
}
```

**Step 2: Update sbSave to persist collectionId**

In the `sbSave` function (around line 224), add `collection_id` to the row object:

```typescript
  const row = {
    id: project.id,
    user_id: userId,
    name: project.name,
    created_at: new Date(project.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
    thumbnail: thumbnailPath ?? null,
    config: project.config,
    results,
    collection_id: project.collectionId ?? null,
  };
```

**Step 3: Update rowToProject to read collectionId**

In `rowToProject` (line 43-56), update the `ProjectRow` interface and function:

Add `collection_id: string | null;` to `ProjectRow` interface (after line 40).

In the `rowToProject` function, add `collectionId: row.collection_id ?? undefined,` to the returned object.

**Step 4: Commit**

```bash
git add src/services/db/projectDB.ts
git commit -m "feat: add collection filtering and collectionId persistence to projectDB"
```

---

## Task 6: AI Image Grouping Service

**Files:**
- Create: `src/services/api/imageGrouping.ts`

**Step 1: Create the grouping service**

This service resizes images to 256px thumbnails, sends them to GPT-4 Vision in batches of 20, and returns structured groups.

```typescript
// src/services/api/imageGrouping.ts
/**
 * AI Image Grouping — Uses GPT-4 Vision to group product images by similarity.
 * Resizes to 256px thumbnails before sending to minimize token cost.
 */

import { invokeEdgeFunction } from './edgeFunctions';

export interface ImageGroup {
  name: string;
  /** Indices into the original images array */
  imageIndices: number[];
  /** Index of the primary image (the one to use in the pipeline) */
  primaryIndex: number;
}

export interface GroupingResult {
  groups: ImageGroup[];
  ungroupedIndices: number[];
}

/** Resize an image data URL to max 256px on its longest side */
async function resizeTo256(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 256;
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      } else {
        if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  });
}

/** Convert File to data URL */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Parse filename into a readable name: "sneaker_nike_01.jpg" → "Sneaker Nike" */
export function parseFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, '') // remove extension
    .replace(/[-_]+/g, ' ')  // replace separators with spaces
    .replace(/\d+/g, '')     // remove numbers
    .replace(/\s+/g, ' ')    // collapse whitespace
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    || 'Product';
}

/**
 * Group images by product similarity using Vision AI.
 * Falls back to 1-image-per-group if the API call fails.
 */
export async function groupImagesByAI(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<GroupingResult> {
  // Single image: skip AI, return directly
  if (files.length <= 1) {
    return {
      groups: files.map((f, i) => ({
        name: parseFileName(f.name),
        imageIndices: [i],
        primaryIndex: i,
      })),
      ungroupedIndices: [],
    };
  }

  onProgress?.('Preparing thumbnails...');

  // Convert + resize all images to 256px thumbnails
  const thumbnails: string[] = [];
  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    const thumb = await resizeTo256(dataUrl);
    thumbnails.push(thumb);
  }

  // Batch into groups of 20 for API call
  const BATCH_SIZE = 20;
  const allGroups: ImageGroup[] = [];
  const allUngrouped: number[] = [];
  let indexOffset = 0;

  for (let i = 0; i < thumbnails.length; i += BATCH_SIZE) {
    const batch = thumbnails.slice(i, i + BATCH_SIZE);
    const batchOffset = i;

    onProgress?.(`Analyzing images ${i + 1}-${Math.min(i + BATCH_SIZE, thumbnails.length)}...`);

    try {
      const result = await invokeEdgeFunction<{
        groups: Array<{ name: string; indices: number[]; primary: number }>;
        ungrouped: number[];
      }>('studio-api', {
        action: 'group-images',
        images: batch,
        count: batch.length,
      });

      // Offset indices to match global array
      for (const g of result.groups) {
        allGroups.push({
          name: g.name,
          imageIndices: g.indices.map(idx => idx + batchOffset),
          primaryIndex: g.primary + batchOffset,
        });
      }
      allUngrouped.push(...result.ungrouped.map(idx => idx + batchOffset));
    } catch (err) {
      console.warn('[Grouping] Vision API failed for batch, using fallback:', err);
      // Fallback: each image in this batch becomes its own group
      for (let j = 0; j < batch.length; j++) {
        const globalIdx = batchOffset + j;
        allGroups.push({
          name: parseFileName(files[globalIdx].name),
          imageIndices: [globalIdx],
          primaryIndex: globalIdx,
        });
      }
    }

    indexOffset += batch.length;
  }

  return { groups: allGroups, ungroupedIndices: allUngrouped };
}
```

**Step 2: Commit**

```bash
git add src/services/api/imageGrouping.ts
git commit -m "feat: add AI image grouping service with Vision API"
```

---

## Task 7: Upload Screen — DropZone Component

**Files:**
- Create: `src/screens/Upload/components/DropZone.tsx`

**Step 1: Create DropZone component**

```typescript
// src/screens/Upload/components/DropZone.tsx
import React, { useState, useRef, useCallback } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  maxFiles = 50,
  maxSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSubmit = useCallback((fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);

    // Validate count
    if (files.length > maxFiles) {
      setError(`Maximum ${maxFiles} images per upload. You selected ${files.length}.`);
      return;
    }

    // Validate types and sizes
    const valid: File[] = [];
    for (const f of files) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not a supported format. Use PNG or JPEG.`);
        return;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`"${f.name}" exceeds ${maxSizeMB}MB limit.`);
        return;
      }
      valid.push(f);
    }

    if (valid.length === 0) {
      setError('No valid images selected.');
      return;
    }

    onFilesSelected(valid);
  }, [maxFiles, maxSizeMB, onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      validateAndSubmit(e.dataTransfer.files);
    }
  }, [validateAndSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      validateAndSubmit(e.target.files);
    }
  }, [validateAndSubmit]);

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <div className="dropzone-content">
        <svg className="dropzone-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 30l10-10 8 8 6-6 12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <p className="dropzone-title">
          {isDragging ? 'Drop images here' : 'Drop your product photos here'}
        </p>
        <p className="dropzone-subtitle">
          or click to browse — PNG, JPEG — up to {maxFiles} images, {maxSizeMB}MB each
        </p>
        {error && <p className="dropzone-error">{error}</p>}
      </div>
    </div>
  );
};

export default DropZone;
```

**Step 2: Commit**

```bash
git add src/screens/Upload/components/DropZone.tsx
git commit -m "feat: add DropZone component for mass upload"
```

---

## Task 8: Upload Screen — GroupingView Component

**Files:**
- Create: `src/screens/Upload/components/GroupingView.tsx`

**Step 1: Create GroupingView component**

This is the review screen where users see AI-proposed groups, edit names, select primary images, and choose which groups to process.

```typescript
// src/screens/Upload/components/GroupingView.tsx
import React, { useState, useCallback, useEffect } from 'react';
import type { ImageGroup, GroupingResult } from '../../../services/api/imageGrouping';

interface GroupingViewProps {
  files: File[];
  groupingResult: GroupingResult;
  thumbnails: string[]; // pre-generated data URLs for preview
  creditsPerProject: number;
  creditsAvailable: number;
  onLaunchBatch: (groups: ImageGroup[]) => void;
  onBack: () => void;
}

const GroupingView: React.FC<GroupingViewProps> = ({
  files,
  groupingResult,
  thumbnails,
  creditsPerProject,
  creditsAvailable,
  onLaunchBatch,
  onBack,
}) => {
  const [groups, setGroups] = useState<ImageGroup[]>(groupingResult.groups);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(groupingResult.groups.map((_, i) => i))
  );

  const selectedGroups = groups.filter((_, i) => selectedIndices.has(i));
  const totalCost = selectedGroups.length * creditsPerProject;
  const canAfford = totalCost <= creditsAvailable;

  const toggleSelect = useCallback((idx: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(groups.map((_, i) => i)));
  }, [groups]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const updateGroupName = useCallback((groupIdx: number, name: string) => {
    setGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, name } : g
    ));
  }, []);

  const setPrimaryImage = useCallback((groupIdx: number, imageIndex: number) => {
    setGroups(prev => prev.map((g, i) =>
      i === groupIdx ? { ...g, primaryIndex: imageIndex } : g
    ));
  }, []);

  const handleLaunch = useCallback(() => {
    const toProcess = groups.filter((_, i) => selectedIndices.has(i));
    onLaunchBatch(toProcess);
  }, [groups, selectedIndices, onLaunchBatch]);

  return (
    <div className="grouping-view">
      {/* Header */}
      <div className="grouping-header">
        <div className="grouping-header-left">
          <button className="btn-ghost" onClick={onBack}>Back</button>
          <h2>{groups.length} product{groups.length !== 1 ? 's' : ''} detected</h2>
        </div>
        <div className="grouping-header-right">
          <span className="grouping-cost">
            Cost: {totalCost} credits
            {!canAfford && <span className="grouping-cost-warning"> (insufficient)</span>}
          </span>
          <button className="btn-ghost" onClick={selectedIndices.size === groups.length ? deselectAll : selectAll}>
            {selectedIndices.size === groups.length ? 'Deselect All' : 'Select All'}
          </button>
          <button
            className="btn-primary-orange"
            onClick={handleLaunch}
            disabled={selectedIndices.size === 0 || !canAfford}
          >
            Generate {selectedIndices.size} Project{selectedIndices.size !== 1 ? 's' : ''}
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="grouping-list">
        {groups.map((group, gIdx) => (
          <div key={gIdx} className={`group-card ${selectedIndices.has(gIdx) ? 'selected' : ''}`}>
            {/* Checkbox + Name */}
            <div className="group-card-header">
              <label className="group-checkbox">
                <input
                  type="checkbox"
                  checked={selectedIndices.has(gIdx)}
                  onChange={() => toggleSelect(gIdx)}
                />
                <span className="checkmark" />
              </label>
              <input
                type="text"
                className="group-name-input"
                value={group.name}
                onChange={e => updateGroupName(gIdx, e.target.value)}
                maxLength={80}
              />
              <span className="group-image-count">{group.imageIndices.length} image{group.imageIndices.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Image thumbnails */}
            <div className="group-images">
              {group.imageIndices.map(imgIdx => (
                <div
                  key={imgIdx}
                  className={`group-image ${imgIdx === group.primaryIndex ? 'primary' : ''}`}
                  onClick={() => setPrimaryImage(gIdx, imgIdx)}
                  title={imgIdx === group.primaryIndex ? 'Primary image' : 'Click to set as primary'}
                >
                  <img src={thumbnails[imgIdx]} alt={files[imgIdx]?.name} />
                  {imgIdx === group.primaryIndex && (
                    <span className="primary-badge">Primary</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Ungrouped images */}
        {groupingResult.ungroupedIndices.length > 0 && (
          <div className="group-card ungrouped">
            <div className="group-card-header">
              <span className="group-name-static">Ungrouped ({groupingResult.ungroupedIndices.length})</span>
            </div>
            <div className="group-images">
              {groupingResult.ungroupedIndices.map(imgIdx => (
                <div key={imgIdx} className="group-image">
                  <img src={thumbnails[imgIdx]} alt={files[imgIdx]?.name} />
                  <span className="ungrouped-name">{files[imgIdx]?.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupingView;
```

**Step 2: Commit**

```bash
git add src/screens/Upload/components/GroupingView.tsx
git commit -m "feat: add GroupingView component for AI grouping review"
```

---

## Task 9: Upload Screen — BatchProgress Component

**Files:**
- Create: `src/screens/Upload/components/BatchProgress.tsx`

**Step 1: Create BatchProgress component**

```typescript
// src/screens/Upload/components/BatchProgress.tsx
import React from 'react';

export interface BatchProjectStatus {
  name: string;
  status: 'queued' | 'running' | 'completed' | 'error';
  progress?: number; // 0-100 for running
  error?: string;
}

interface BatchProgressProps {
  projects: BatchProjectStatus[];
  creditsUsed: number;
  creditsRemaining: number;
  onPause?: () => void;
  onCancel?: () => void;
  onDone?: () => void;
  isPaused?: boolean;
}

const BatchProgress: React.FC<BatchProgressProps> = ({
  projects,
  creditsUsed,
  creditsRemaining,
  onPause,
  onCancel,
  onDone,
  isPaused,
}) => {
  const completed = projects.filter(p => p.status === 'completed').length;
  const errors = projects.filter(p => p.status === 'error').length;
  const total = projects.length;
  const allDone = projects.every(p => p.status === 'completed' || p.status === 'error');
  const globalProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="batch-progress">
      {/* Global header */}
      <div className="batch-header">
        <h2>
          {allDone
            ? `Done — ${completed} of ${total} completed`
            : `Processing — ${completed} of ${total}`}
        </h2>
        <div className="batch-credits">
          <span>{creditsUsed} credits used</span>
          <span className="batch-credits-remaining">{creditsRemaining} remaining</span>
        </div>
      </div>

      {/* Global progress bar */}
      <div className="batch-progress-bar">
        <div className="batch-progress-fill" style={{ width: `${globalProgress}%` }} />
      </div>

      {/* Per-project list */}
      <div className="batch-list">
        {projects.map((p, i) => (
          <div key={i} className={`batch-item batch-item-${p.status}`}>
            <div className="batch-item-icon">
              {p.status === 'completed' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#34C759" strokeWidth="1.5"/>
                  <path d="M5 8l2 2 4-4" stroke="#34C759" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {p.status === 'error' && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#FF3B30" strokeWidth="1.5"/>
                  <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#FF3B30" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )}
              {p.status === 'running' && <span className="batch-spinner" />}
              {p.status === 'queued' && <span className="batch-queued-dot" />}
            </div>

            <span className="batch-item-name">{p.name}</span>

            {p.status === 'running' && p.progress !== undefined && (
              <div className="batch-item-progress">
                <div className="batch-item-progress-fill" style={{ width: `${p.progress}%` }} />
              </div>
            )}

            {p.status === 'error' && p.error && (
              <span className="batch-item-error">{p.error}</span>
            )}

            <span className="batch-item-status">
              {p.status === 'completed' ? 'Done' : p.status === 'running' ? `${p.progress ?? 0}%` : p.status === 'error' ? 'Failed' : 'Queue'}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="batch-actions">
        {!allDone ? (
          <>
            {onPause && (
              <button className="btn-ghost" onClick={onPause}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
            )}
            {onCancel && (
              <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            )}
          </>
        ) : (
          onDone && (
            <button className="btn-primary-orange" onClick={onDone}>
              View Collection
            </button>
          )
        )}
      </div>
    </div>
  );
};

export default BatchProgress;
```

**Step 2: Commit**

```bash
git add src/screens/Upload/components/BatchProgress.tsx
git commit -m "feat: add BatchProgress component for pipeline execution tracking"
```

---

## Task 10: Upload Screen — Main Screen + CSS

**Files:**
- Create: `src/screens/Upload/UploadScreen.tsx`
- Create: `src/screens/Upload/UploadScreen.css`

**Step 1: Create UploadScreen.tsx**

This is the main orchestrator that manages the 3-step wizard flow: DropZone → GroupingView → BatchProgress.

```typescript
// src/screens/Upload/UploadScreen.tsx
import React, { useState, useCallback, useRef } from 'react';
import type { ImageGroup, GroupingResult } from '../../services/api/imageGrouping';
import { groupImagesByAI, parseFileName } from '../../services/api/imageGrouping';
import type { Collection } from '../../models/collection';
import { createCollection } from '../../models/collection';
import { createProject } from '../../models/project';
import type { Project } from '../../models/project';
import { saveProject } from '../../services/db/projectDB';
import { saveCollection } from '../../services/db/collectionDB';
import { runPipeline } from '../../services/pipeline/orchestrator';
import type { PipelineState, PipelineStep } from '../../models/pipeline';
import DropZone from './components/DropZone';
import GroupingView from './components/GroupingView';
import BatchProgress, { type BatchProjectStatus } from './components/BatchProgress';
import './UploadScreen.css';

type Step = 'drop' | 'grouping' | 'batch';

interface UploadScreenProps {
  onBack: () => void;
  onDone: (collectionId: string) => void;
  creditsAvailable: number;
  onCreditsChanged: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({
  onBack,
  onDone,
  creditsAvailable,
  onCreditsChanged,
}) => {
  const [step, setStep] = useState<Step>('drop');
  const [files, setFiles] = useState<File[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [groupingStatus, setGroupingStatus] = useState<string>('');
  const [collectionName, setCollectionName] = useState('');
  const [batchStatuses, setBatchStatuses] = useState<BatchProjectStatus[]>([]);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const CREDITS_PER_PROJECT = 2; // 2K default

  // Step 1: Files selected from DropZone
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setFiles(selectedFiles);

    // Generate thumbnails for preview
    const thumbs: string[] = [];
    for (const f of selectedFiles) {
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(f);
      });
      thumbs.push(url);
    }
    setThumbnails(thumbs);

    // Auto-generate collection name from first file or date
    if (!collectionName) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setCollectionName(`Import ${today}`);
    }

    // Start AI grouping
    setStep('grouping');
    setGroupingStatus('Analyzing images...');

    try {
      const result = await groupImagesByAI(selectedFiles, setGroupingStatus);
      setGroupingResult(result);
      setGroupingStatus('');
    } catch (err) {
      console.error('Grouping failed:', err);
      // Fallback: each image = its own group
      setGroupingResult({
        groups: selectedFiles.map((f, i) => ({
          name: parseFileName(f.name),
          imageIndices: [i],
          primaryIndex: i,
        })),
        ungroupedIndices: [],
      });
      setGroupingStatus('');
    }
  }, [collectionName]);

  // Step 2 → Step 3: Launch batch
  const handleLaunchBatch = useCallback(async (groups: ImageGroup[]) => {
    setStep('batch');

    // Create collection
    const col = createCollection(collectionName || 'Untitled Import');
    col.projectCount = groups.length;
    setCollection(col);
    await saveCollection(col);

    // Initialize batch statuses
    const statuses: BatchProjectStatus[] = groups.map(g => ({
      name: g.name,
      status: 'queued',
    }));
    setBatchStatuses([...statuses]);

    // Process each group sequentially
    const abort = new AbortController();
    abortRef.current = abort;
    let used = 0;

    for (let i = 0; i < groups.length; i++) {
      if (abort.signal.aborted) break;

      // Wait if paused
      // (simple approach: check flag in loop)

      const group = groups[i];
      statuses[i] = { ...statuses[i], status: 'running', progress: 0 };
      setBatchStatuses([...statuses]);

      try {
        // Create project
        const project = createProject(group.name);
        project.collectionId = col.id;

        // Get primary image file
        const primaryFile = files[group.primaryIndex];

        // Get additional image data URLs
        const additionalDataUrls = group.imageIndices
          .filter(idx => idx !== group.primaryIndex)
          .map(idx => thumbnails[idx]); // Use full-res data URLs

        // Map pipeline steps to progress percentage
        const stepProgressMap: Record<string, number> = {
          input: 5, analysis: 15, studioGeneration: 50,
          luminanceCheck: 55, retouch: 65, cutout: 80,
          shadowComposite: 90, autoCrop: 100,
        };

        // Run pipeline
        const state = await runPipeline({
          config: {
            imageSize: '2K',
            aspectRatio: '1:1',
            sessionId: project.id,
          },
          inputFile: primaryFile,
          additionalImageDataUrls: additionalDataUrls.length > 0 ? additionalDataUrls : undefined,
          onStateChange: (pState: PipelineState, pStep: PipelineStep) => {
            const progress = stepProgressMap[pStep] ?? 0;
            statuses[i] = { ...statuses[i], progress };
            setBatchStatuses([...statuses]);
          },
          abortSignal: abort.signal,
        });

        // Save project with results
        project.results = {
          inputImage: state.input?.data?.imageDataUrl,
          analysis: state.analysis?.data?.description,
          luminanceClass: state.luminanceCheck?.data as string,
          studioGeneration: state.studioGeneration?.data?.imageDataUrl,
          retouch: state.retouch?.data?.imageDataUrl,
          cutout: state.cutout?.data?.imageDataUrl,
          shadowComposite: state.shadowComposite?.data?.imageDataUrl,
          autoCrop: state.autoCrop?.data?.imageDataUrl,
        };
        await saveProject(project);

        statuses[i] = { ...statuses[i], status: 'completed', progress: 100 };
        used += CREDITS_PER_PROJECT;
        setCreditsUsed(used);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        statuses[i] = { ...statuses[i], status: 'error', error: errorMsg };
      }

      setBatchStatuses([...statuses]);
    }

    onCreditsChanged();
  }, [files, thumbnails, collectionName, onCreditsChanged]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDone = useCallback(() => {
    if (collection) {
      onDone(collection.id);
    } else {
      onBack();
    }
  }, [collection, onDone, onBack]);

  return (
    <div className="upload-screen">
      {/* Top bar */}
      <div className="upload-topbar">
        <button className="upload-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Gallery
        </button>
        <h1 className="upload-title">Mass Import</h1>
        <div className="upload-topbar-right">
          {step === 'drop' && (
            <input
              type="text"
              className="collection-name-input"
              placeholder="Collection name..."
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              maxLength={80}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="upload-content">
        {step === 'drop' && (
          <DropZone onFilesSelected={handleFilesSelected} />
        )}

        {step === 'grouping' && groupingStatus && !groupingResult && (
          <div className="upload-loading">
            <span className="upload-spinner" />
            <p>{groupingStatus}</p>
          </div>
        )}

        {step === 'grouping' && groupingResult && (
          <GroupingView
            files={files}
            groupingResult={groupingResult}
            thumbnails={thumbnails}
            creditsPerProject={CREDITS_PER_PROJECT}
            creditsAvailable={creditsAvailable}
            onLaunchBatch={handleLaunchBatch}
            onBack={() => { setStep('drop'); setGroupingResult(null); }}
          />
        )}

        {step === 'batch' && (
          <BatchProgress
            projects={batchStatuses}
            creditsUsed={creditsUsed}
            creditsRemaining={creditsAvailable - creditsUsed}
            onCancel={handleCancel}
            onDone={handleDone}
            isPaused={isPaused}
          />
        )}
      </div>
    </div>
  );
};

export default UploadScreen;
```

**Step 2: Create UploadScreen.css**

Create `src/screens/Upload/UploadScreen.css` with styles matching the existing HomeScreen design system (cream background, charcoal buttons, orange accents). Key classes needed:

- `.upload-screen` — full-screen flex layout
- `.upload-topbar` — header with back button, title, collection name input
- `.upload-content` — main content area
- `.dropzone`, `.dropzone-active` — drag & drop zone with dashed border
- `.dropzone-icon`, `.dropzone-title`, `.dropzone-subtitle`, `.dropzone-error`
- `.grouping-view`, `.grouping-header`, `.grouping-list`
- `.group-card`, `.group-card.selected`, `.group-card-header`
- `.group-checkbox`, `.group-name-input`, `.group-images`, `.group-image`, `.group-image.primary`
- `.primary-badge`, `.ungrouped-name`
- `.batch-progress`, `.batch-header`, `.batch-progress-bar`, `.batch-progress-fill`
- `.batch-list`, `.batch-item`, `.batch-item-{status}`, `.batch-spinner`
- `.batch-actions`
- `.btn-primary-orange` — orange CTA button (matches `.btn-new` from Home)
- `.upload-loading`, `.upload-spinner`

Use the same color palette: `#FAFAF8` bg, `#ff4000` accent, `#2D2D2D` buttons, `#E8E8E4` borders, `#F5F4F0` fills.

**Step 3: Commit**

```bash
git add src/screens/Upload/UploadScreen.tsx src/screens/Upload/UploadScreen.css
git commit -m "feat: add UploadScreen with 3-step wizard flow"
```

---

## Task 11: Integrate into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add 'upload' view to the View type**

At line 11-15, add the upload view:

```typescript
type View =
  | { screen: 'home'; collectionFilter?: string }
  | { screen: 'studio'; project: Project | null }
  | { screen: 'pricing' }
  | { screen: 'upload' }
  | { screen: 'loading' };
```

**Step 2: Add import for UploadScreen**

After line 9, add:
```typescript
import UploadScreen from './screens/Upload/UploadScreen';
```

**Step 3: Add navigation callbacks**

After `goPricing` (line 97), add:
```typescript
const goUpload = useCallback(() => { setView({ screen: 'upload' }); }, []);
const goHomeWithCollection = useCallback((collectionId: string) => {
  refreshProfile();
  setView({ screen: 'home', collectionFilter: collectionId });
}, [refreshProfile]);
```

**Step 4: Add upload screen to renderScreen switch**

In the `renderScreen` function (after the pricing case, around line 180), add:

```typescript
      case 'upload':
        return (
          <UploadScreen
            onBack={goHome}
            onDone={goHomeWithCollection}
            creditsAvailable={profile?.points_balance ?? 0}
            onCreditsChanged={refreshProfile}
          />
        );
```

**Step 5: Pass goUpload to HomeScreen**

Update the HomeScreen render (around line 183) to pass the new prop:

```typescript
        return (
          <HomeScreen
            onOpenStudio={openStudio}
            onMassImport={goUpload}
            userName={user.name || user.email || 'User'}
            userAvatar={user.avatar}
            credits={profile?.points_balance}
            onSignOut={handleSignOut}
            onGoPricing={goPricing}
            collectionFilter={(view as { collectionFilter?: string }).collectionFilter}
          />
        );
```

**Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate UploadScreen into App routing"
```

---

## Task 12: Update HomeScreen — Mass Import Button + Collections

**Files:**
- Modify: `src/screens/Home/HomeScreen.tsx`
- Modify: `src/screens/Home/HomeScreen.css`

**Step 1: Add new props to HomeScreen interface**

Update `HomeScreenProps` (line 11-18):

```typescript
interface HomeScreenProps {
  onOpenStudio: (project: Project | null) => void;
  onMassImport?: () => void;
  userName?: string;
  userAvatar?: string;
  credits?: number;
  onSignOut?: () => void;
  onGoPricing?: () => void;
  collectionFilter?: string;
}
```

Add `onMassImport` and `collectionFilter` to the destructured props (line 20-27).

**Step 2: Add collections state + loading**

After the existing state declarations (around line 33), add:

```typescript
import { getAllCollections } from '../../services/db/collectionDB';
import { getProjectsByCollection } from '../../services/db/projectDB';
import type { Collection } from '../../models/collection';

// Inside the component:
const [collections, setCollections] = useState<Collection[]>([]);
const [activeCollection, setActiveCollection] = useState<string | null>(collectionFilter ?? null);
```

Update `loadProjects` to also load collections and handle collection filtering:

```typescript
const loadProjects = useCallback(async () => {
  try {
    if (activeCollection) {
      const list = await getProjectsByCollection(activeCollection);
      setProjects(list);
    } else {
      const list = await getAllProjects();
      setProjects(list);
    }
    const cols = await getAllCollections();
    setCollections(cols);
  } catch (err) {
    console.error('Failed to load:', err);
  } finally {
    setLoading(false);
  }
}, [activeCollection]);
```

**Step 3: Add "Mass Import" button to sidebar**

In the sidebar-actions div (after the "Fast Generation" button, around line 112), add:

```tsx
{onMassImport && (
  <button className="sidebar-btn-ghost" onClick={onMassImport}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3M8 2v8M5 5l3-3 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Mass Import
  </button>
)}
```

**Step 4: Add Collections section to sidebar**

After the "/ WORKSPACE" section (around line 127), add a "/ COLLECTIONS" section if there are any collections:

```tsx
{collections.length > 0 && (
  <div className="sidebar-section">
    <span className="sidebar-label">/ COLLECTIONS</span>
    {activeCollection && (
      <button
        className="sidebar-nav-item"
        onClick={() => setActiveCollection(null)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        All Projects
      </button>
    )}
    {collections.map(c => (
      <button
        key={c.id}
        className={`sidebar-nav-item ${activeCollection === c.id ? 'active' : ''}`}
        onClick={() => setActiveCollection(c.id)}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M2 6.5h12M5 4V2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span className="sidebar-project-name">{c.name}</span>
        <span className="sidebar-collection-count">{c.projectCount}</span>
      </button>
    ))}
  </div>
)}
```

**Step 5: Add "Mass Import" button to the main header**

In the `projects-header-right` div (around line 241-247), add before the "New Project" button:

```tsx
{onMassImport && (
  <button className="btn-mass-import" onClick={onMassImport}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 8.5v3a1 1 0 001 1h10a1 1 0 001-1v-3M7 1.5v7M4.5 4L7 1.5 9.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    Mass Import
  </button>
)}
```

**Step 6: Update heading to show collection name**

Update the `<h1>` in the projects header:

```tsx
<h1>{activeCollection ? collections.find(c => c.id === activeCollection)?.name ?? 'Collection' : 'My Projects'}</h1>
```

**Step 7: Add CSS for new elements**

In `HomeScreen.css`, add:

```css
/* Mass Import button */
.btn-mass-import {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 36px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  background: #FFFFFF;
  color: #1D1D1F;
  border: 1px solid #E8E8E4;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-mass-import:hover {
  background: #F5F4F0;
  border-color: #D5D5D0;
}

/* Collection count badge in sidebar */
.sidebar-collection-count {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: #9E9E9E;
  background: #F5F4F0;
  padding: 1px 7px;
  border-radius: 10px;
}
```

**Step 8: Commit**

```bash
git add src/screens/Home/HomeScreen.tsx src/screens/Home/HomeScreen.css
git commit -m "feat: add Mass Import button and Collections section to Home"
```

---

## Task 13: Verify & Polish

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Verify compilation**

Check for any TypeScript errors. Fix any import issues or type mismatches.

**Step 3: Visual verification**

1. Home screen should show "Mass Import" button in sidebar and header
2. Click "Mass Import" → Upload screen with DropZone
3. Drop/select images → AI grouping view (or fallback)
4. Review groups → Launch batch → Progress view
5. Done → Return to Home with collection filter

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete mass upload system with AI grouping and batch pipeline"
```

---

## Summary

| Task | Description | New/Modify | Key Files |
|------|-------------|------------|-----------|
| 1 | Collection model | Create | `src/models/collection.ts`, `src/models/index.ts` |
| 2 | Update Project model | Modify | `src/models/project.ts` |
| 3 | Supabase migration | Create | `supabase/migrations/20260303_collections.sql` |
| 4 | Collection DB service | Create | `src/services/db/collectionDB.ts` |
| 5 | Collection filtering in projectDB | Modify | `src/services/db/projectDB.ts` |
| 6 | AI image grouping service | Create | `src/services/api/imageGrouping.ts` |
| 7 | DropZone component | Create | `src/screens/Upload/components/DropZone.tsx` |
| 8 | GroupingView component | Create | `src/screens/Upload/components/GroupingView.tsx` |
| 9 | BatchProgress component | Create | `src/screens/Upload/components/BatchProgress.tsx` |
| 10 | UploadScreen + CSS | Create | `src/screens/Upload/UploadScreen.tsx`, `.css` |
| 11 | App.tsx routing | Modify | `src/App.tsx` |
| 12 | HomeScreen updates | Modify | `src/screens/Home/HomeScreen.tsx`, `.css` |
| 13 | Verify & polish | - | All files |
