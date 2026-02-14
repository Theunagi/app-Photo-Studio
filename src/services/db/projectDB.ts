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
  name: string;
  created_at: string;
  updated_at: string;
  thumbnail: string | null;
  config: Record<string, string>;
  results: Record<string, unknown>;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    thumbnail: row.thumbnail ? getPublicUrl(row.thumbnail) : undefined,
    config: {
      imageSize: (row.config?.imageSize as string) ?? '2K',
      aspectRatio: (row.config?.aspectRatio as string) ?? '1:1',
    },
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

  // Collect lifestyle storage paths
  const lifestyles = r.lifestyles as { image: string; prompt: string }[] | undefined;
  if (lifestyles?.length) {
    lifestyles.forEach((li, i) => {
      if (!li.image.startsWith('data:')) {
        storagePaths[`lifestyle-${i}`] = li.image;
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
  if (lifestyles?.length) {
    lifestyles.forEach((li, i) => {
      if (dataUrls[`lifestyle-${i}`]) {
        li.image = dataUrls[`lifestyle-${i}`];
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
  const { data, error } = await supabase
    .from('projects')
    .select('*')
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

  // Replace lifestyle data URLs with paths
  const lifestyles = results.lifestyles as { image: string; prompt: string }[] | undefined;
  if (lifestyles?.length) {
    results.lifestyles = lifestyles.map((li, i) => ({
      ...li,
      image: storagePaths[`lifestyle-${i}`] ?? li.image,
    }));
  }

  const row = {
    id: project.id,
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
const DB_VERSION = 1;
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
    console.warn('[DB] Supabase call failed, falling back to IndexedDB:', err);
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
  // Always keep a local copy
  await idbSave(project);
}

export async function deleteProject(id: string): Promise<void> {
  if (!useSB) return idbDelete(id);
  try {
    await sbDelete(id);
  } catch (err) {
    console.warn('[DB] Supabase delete failed:', err);
  }
  await idbDelete(id);
}
