/**
 * Project persistence — Supabase (primary) with IndexedDB fallback.
 *
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, all data goes to
 * Supabase Postgres + Storage. Otherwise falls back to local IndexedDB.
 *
 * If Supabase calls fail at runtime (auth error, network), the app
 * auto-falls back to IndexedDB so the user is never stuck on a white page.
 */

import type { Project, ProjectResult } from '../../models/project';
import { supabase, isSupabaseConfigured } from './supabase';

/** Get current authenticated user's ID (throws if not logged in) */
async function getAuthUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}
import {
  uploadProjectImages,
  downloadProjectImages,
  deleteProjectImages,
  getPublicUrl,
} from './storage';

// ====================================================================
// Supabase implementation
// ====================================================================

/** DB row shape — images stored as storage paths, not data URLs */
interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
  collection_id: string | null;
  config: Record<string, string>;
  results: Record<string, unknown>;
}

function rowToProject(row: ProjectRow): Project {
  // Derive thumbnail from results if not explicitly set
  let thumbPath = row.thumbnail;
  if (!thumbPath) {
    const r = row.results as Record<string, unknown>;
    const fallbacks = ['autoCrop', 'retouch', 'shadowComposite', 'studioGeneration', 'inputImage'];
    for (const slot of fallbacks) {
      const val = r[slot];
      if (typeof val === 'string' && val && !val.startsWith('data:')) {
        thumbPath = val;
        break;
      }
    }
  }

  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    thumbnail: thumbPath ? getPublicUrl(thumbPath) : undefined,
    config: {
      imageSize: (row.config?.imageSize as string) ?? '2K',
      aspectRatio: (row.config?.aspectRatio as string) ?? '1:1',
    },
    collectionId: row.collection_id ?? undefined,
    results: row.results as unknown as ProjectResult,
  };
}

async function hydrateImages(project: Project): Promise<Project> {
  const r = project.results as unknown as Record<string, unknown>;
  const storagePaths: Record<string, string> = {};

  // Collect storage paths from results
  const imageSlots = [
    'inputImage', 'studioGeneration', 'retouch',
    'cutout', 'shadowComposite', 'autoCrop',
  ];
  for (const slot of imageSlots) {
    const val = r[slot];
    if (typeof val === 'string' && !val.startsWith('data:')) {
      storagePaths[slot] = val;
    }
  }

  // Collect additional input image storage paths
  const inputImages = r.inputImages as string[] | undefined;
  if (inputImages?.length) {
    inputImages.forEach((img, i) => {
      if (typeof img === 'string' && !img.startsWith('data:')) {
        storagePaths[`inputImage-${i}`] = img;
      }
    });
  }

  // Collect lifestyle storage paths
  const lifestyles = r.lifestyles as { image: string; prompt: string }[] | undefined;
  if (lifestyles?.length) {
    lifestyles.forEach((li, i) => {
      if (!li.image.startsWith('data:')) {
        storagePaths[`lifestyle-${i}`] = li.image;
      }
    });
  }

  // Collect edit storage paths
  const edits = r.edits as { image: string; prompt: string }[] | undefined;
  if (edits?.length) {
    edits.forEach((ei, i) => {
      if (!ei.image.startsWith('data:')) {
        storagePaths[`edit-${i}`] = ei.image;
      }
    });
  }

  // Download all in parallel
  const dataUrls = await downloadProjectImages(storagePaths);

  // Replace paths with data URLs in results
  for (const slot of imageSlots) {
    if (dataUrls[slot]) {
      (r as Record<string, unknown>)[slot] = dataUrls[slot];
    }
  }
  // Hydrate additional input images
  if (inputImages?.length) {
    inputImages.forEach((_, i) => {
      if (dataUrls[`inputImage-${i}`]) {
        inputImages[i] = dataUrls[`inputImage-${i}`];
      }
    });
  }
  if (lifestyles?.length) {
    lifestyles.forEach((li, i) => {
      if (dataUrls[`lifestyle-${i}`]) {
        li.image = dataUrls[`lifestyle-${i}`];
      }
    });
  }
  if (edits?.length) {
    edits.forEach((ei, i) => {
      if (dataUrls[`edit-${i}`]) {
        ei.image = dataUrls[`edit-${i}`];
      }
    });
  }

  // Hydrate thumbnail
  if (project.thumbnail && !project.thumbnail.startsWith('data:')) {
    // thumbnail is already a public URL from getPublicUrl, keep it
  }

  return project;
}

// --- Supabase CRUD ---

async function sbGetAll(): Promise<Project[]> {
  const userId = await getAuthUserId();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Supabase getAllProjects: ${error.message}`);

  // For listing, don't hydrate full images — just return metadata + thumbnail URL
  return (data as ProjectRow[]).map(rowToProject);
}

async function sbGetProject(id: string): Promise<Project | undefined> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return undefined; // not found
    throw new Error(`Supabase getProject: ${error.message}`);
  }

  const project = rowToProject(data as ProjectRow);
  return hydrateImages(project);
}

async function sbSave(project: Project): Promise<void> {
  const results = { ...(project.results as unknown as Record<string, unknown>) };

  // Debug: log which result slots have data
  const filledSlots = Object.entries(results)
    .filter(([, v]) => v != null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? (v.startsWith('data:') ? 'dataURL' : v.slice(0, 40)) : typeof v}`);
  console.log('[DB] sbSave results slots:', filledSlots);

  // Upload images to Storage, get paths
  const { storagePaths, thumbnailPath } = await uploadProjectImages(
    project.id,
    results,
    project.thumbnail,
  );

  // Replace data URLs with storage paths in the results copy
  const imageSlots = [
    'inputImage', 'studioGeneration', 'retouch',
    'cutout', 'shadowComposite', 'autoCrop',
  ];
  for (const slot of imageSlots) {
    if (storagePaths[slot]) {
      results[slot] = storagePaths[slot];
    }
  }

  // Replace additional input image data URLs with paths
  const inputImages = results.inputImages as string[] | undefined;
  if (inputImages?.length) {
    results.inputImages = inputImages.map((img, i) =>
      storagePaths[`inputImage-${i}`] ?? img
    );
  }

  // Replace lifestyle data URLs with paths
  const lifestyles = results.lifestyles as { image: string; prompt: string }[] | undefined;
  if (lifestyles?.length) {
    results.lifestyles = lifestyles.map((li, i) => ({
      ...li,
      image: storagePaths[`lifestyle-${i}`] ?? li.image,
    }));
  }

  // Replace edit data URLs with paths
  const edits = results.edits as { image: string; prompt: string }[] | undefined;
  if (edits?.length) {
    results.edits = edits.map((ei, i) => ({
      ...ei,
      image: storagePaths[`edit-${i}`] ?? ei.image,
    }));
  }

  const userId = await getAuthUserId();
  const row: Record<string, unknown> = {
    id: project.id,
    user_id: userId,
    name: project.name,
    created_at: new Date(project.createdAt).toISOString(),
    updated_at: new Date().toISOString(),
    thumbnail: thumbnailPath ?? null,
    config: project.config,
    results,
  };

  const { error } = await supabase
    .from('projects')
    .upsert(row, { onConflict: 'id' });

  if (error) throw new Error(`Supabase saveProject: ${error.message}`);
}

async function sbDelete(id: string): Promise<void> {
  await deleteProjectImages(id);

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Supabase deleteProject: ${error.message}`);
}

// ====================================================================
// IndexedDB fallback
// ====================================================================

const DB_NAME = 'photostudio';
const DB_VERSION = 2;
const STORE = 'projects';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Collections store (shared DB — both modules must create both stores)
      if (!db.objectStoreNames.contains('collections')) {
        const colStore = db.createObjectStore('collections', { keyPath: 'id' });
        colStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

async function idbGetAll(): Promise<Project[]> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const store = idbTx(db, 'readonly');
    const index = store.index('updatedAt');
    const req = index.openCursor(null, 'prev');
    const results: Project[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as Project);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbGetProject(id: string): Promise<Project | undefined> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = idbTx(db, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result as Project | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbSave(project: Project): Promise<void> {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const req = idbTx(db, 'readwrite').put({ ...project, updatedAt: Date.now() });
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

// ====================================================================
// Public API — Supabase with auto-fallback to IndexedDB on error
// ====================================================================

const useSB = isSupabaseConfigured();

async function withFallback<T>(
  sbFn: () => Promise<T>,
  idbFn: () => Promise<T>,
): Promise<T> {
  if (!useSB) return idbFn();
  try {
    return await sbFn();
  } catch (err) {
    import.meta.env.DEV && console.warn('[DB] Supabase call failed, falling back to IndexedDB:', err);
    return idbFn();
  }
}

export async function getAllProjects(): Promise<Project[]> {
  return withFallback(sbGetAll, idbGetAll);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return withFallback(() => sbGetProject(id), () => idbGetProject(id));
}

export async function saveProject(project: Project): Promise<void> {
  if (!useSB) return idbSave(project);
  // For save, try Supabase first but always save to IndexedDB as well
  try {
    await sbSave(project);
  } catch (err) {
    console.warn('[DB] Supabase save failed, saving to IndexedDB:', err);
  }
  // Always keep a local copy (non-blocking — don't crash if IDB fails)
  try {
    await idbSave(project);
  } catch (err) {
    console.warn('[DB] IndexedDB save failed:', err);
  }
}

export async function deleteProject(id: string): Promise<void> {
  if (!useSB) return idbDelete(id);
  try {
    await sbDelete(id);
  } catch (err) {
    import.meta.env.DEV && console.warn('[DB] Supabase delete failed:', err);
  }
  await idbDelete(id);
}

/**
 * Lightweight partial update — only patches lifestyles/edits in the DB results
 * WITHOUT re-uploading any images. Used for deletions so they're instant.
 */
export async function patchProjectVariants(
  projectId: string,
  lifestyles: { id?: string; image: string; prompt: string }[] | undefined,
  edits: { id?: string; image: string; prompt: string }[] | undefined,
): Promise<void> {
  if (useSB) {
    try {
      // Read current DB row to get existing results with storage paths
      const { data: row, error: readErr } = await supabase
        .from('projects')
        .select('results')
        .eq('id', projectId)
        .single();

      if (readErr || !row) throw new Error(`Read failed: ${readErr?.message}`);

      const dbResults = (row.results ?? {}) as Record<string, unknown>;

      // Only update the lifestyle/edit arrays — keep everything else as-is (storage paths, pipeline images, etc.)
      if (lifestyles && lifestyles.length > 0) {
        // Keep storage paths for images that are already stored; only store URL for new ones
        const dbLifestyles = (dbResults.lifestyles ?? []) as { id?: string; image: string; prompt: string }[];
        dbResults.lifestyles = lifestyles.map(li => {
          // Try to find the matching DB entry to preserve its storage path
          const dbMatch = dbLifestyles.find(d => d.id === li.id) ??
                          dbLifestyles.find(d => d.prompt === li.prompt);
          return dbMatch ? { ...dbMatch, id: li.id } : li;
        });
      } else {
        delete dbResults.lifestyles;
      }

      if (edits && edits.length > 0) {
        const dbEdits = (dbResults.edits ?? []) as { id?: string; image: string; prompt: string }[];
        dbResults.edits = edits.map(ei => {
          const dbMatch = dbEdits.find(d => d.id === ei.id) ??
                          dbEdits.find(d => d.prompt === ei.prompt);
          return dbMatch ? { ...dbMatch, id: ei.id } : ei;
        });
      } else {
        delete dbResults.edits;
      }

      const { error: updateErr } = await supabase
        .from('projects')
        .update({ results: dbResults, updated_at: new Date().toISOString() })
        .eq('id', projectId);

      if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
    } catch (err) {
      import.meta.env.DEV && console.warn('[DB] Supabase patchProjectVariants failed, falling back to IndexedDB:', err);
    }
  }

  // Also patch IndexedDB
  try {
    const localProject = await idbGetProject(projectId);
    if (localProject) {
      localProject.results.lifestyles = lifestyles && lifestyles.length > 0 ? lifestyles : undefined;
      localProject.results.edits = edits && edits.length > 0 ? edits : undefined;
      localProject.updatedAt = Date.now();
      await idbSave(localProject);
    }
  } catch (err) {
    import.meta.env.DEV && console.warn('[DB] IndexedDB patchProjectVariants failed:', err);
  }
}

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
