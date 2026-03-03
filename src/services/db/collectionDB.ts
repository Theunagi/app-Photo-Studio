/**
 * Collection persistence — Supabase (primary) with IndexedDB fallback.
 *
 * When VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set, all data goes to
 * Supabase Postgres. Otherwise falls back to local IndexedDB.
 *
 * If Supabase calls fail at runtime (auth error, network), the app
 * auto-falls back to IndexedDB so the user is never stuck on a white page.
 */

import type { Collection } from '../../models/collection';
import { supabase, isSupabaseConfigured } from './supabase';

/** Get current authenticated user's ID (throws if not logged in) */
async function getAuthUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not authenticated');
  return data.user.id;
}

// ====================================================================
// Supabase implementation
// ====================================================================

/** DB row shape for collections */
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
  };
}

// --- Supabase CRUD ---

async function sbGetAll(): Promise<Collection[]> {
  const userId = await getAuthUserId();

  // Fetch collections with a project count via Supabase's count aggregation
  const { data, error } = await supabase
    .from('collections')
    .select('*, projects(count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Supabase getAllCollections: ${error.message}`);

  return (data as (CollectionRow & { projects: { count: number }[] })[]).map(
    (row) => rowToCollection(row, row.projects?.[0]?.count ?? 0),
  );
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
  // First unlink projects (set collection_id to null)
  const { error: unlinkError } = await supabase
    .from('projects')
    .update({ collection_id: null })
    .eq('collection_id', id);

  if (unlinkError) throw new Error(`Supabase unlinkProjects: ${unlinkError.message}`);

  // Then delete the collection
  const { error } = await supabase
    .from('collections')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Supabase deleteCollection: ${error.message}`);
}

// ====================================================================
// IndexedDB fallback
// ====================================================================

const DB_NAME = 'photostudio';
const DB_VERSION = 2;
const STORE = 'collections';

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Keep existing projects store
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      // Add collections store
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
    console.warn('[CollectionDB] Supabase call failed, falling back to IndexedDB:', err);
    return idbFn();
  }
}

export async function getAllCollections(): Promise<Collection[]> {
  return withFallback(sbGetAll, idbGetAll);
}

export async function saveCollection(collection: Collection): Promise<void> {
  if (!useSB) return idbSave(collection);
  // For save, try Supabase first but always save to IndexedDB as well
  try {
    await sbSave(collection);
  } catch (err) {
    console.warn('[CollectionDB] Supabase save failed, saving to IndexedDB:', err);
  }
  // Always keep a local copy
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
