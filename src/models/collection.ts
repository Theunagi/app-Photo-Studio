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
