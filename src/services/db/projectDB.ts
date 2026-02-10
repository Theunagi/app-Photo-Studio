/**
 * IndexedDB wrapper for Project persistence.
 * Uses a single object store "projects" keyed by id.
 */

import type { Project } from '../../models/project';

const DB_NAME = 'photostudio';
const DB_VERSION = 1;
const STORE = 'projects';

function open(): Promise<IDBDatabase> {
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

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly');
    const index = store.index('updatedAt');
    const req = index.openCursor(null, 'prev'); // newest first
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

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').get(id);
    req.onsuccess = () => resolve(req.result as Project | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProject(project: Project): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put({ ...project, updatedAt: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
