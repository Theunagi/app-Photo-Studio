/**
 * Project Model — Saved pipeline sessions
 */

export interface ProjectResult {
  inputImage?: string;
  /** Additional reference images (data URLs or storage paths) */
  inputImages?: string[];
  analysis?: string;
  luminanceClass?: string;
  studioGeneration?: string;
  retouch?: string;
  cutout?: string;
  shadowComposite?: string;
  autoCrop?: string;
  lifestyles?: { image: string; prompt: string }[];
}

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
}

export function createProject(name: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    config: { imageSize: '2K', aspectRatio: '1:1' },
    results: {},
  };
}
