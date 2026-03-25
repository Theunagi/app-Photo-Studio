/**
 * FrameFlow - Studio Screen
 * Sidebar layout with pipeline viewer.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import type { Project } from '../../models/project';
import { runPipeline } from '../../services/pipeline/orchestrator';
import { editImage } from '../../services/api/falImageGen';
import { generateLifestyleImage, analyzeStyleReferences, analyzeStyleReplicate } from '../../services/api/gemini';
import { fetchImageAsDataUrl } from '../../services/api/edgeFunctions';
import { supabase } from '../../services/db/supabase';
import { getPublicUrl } from '../../services/db/storage';
import { saveProject, getAllProjects, patchProjectVariants } from '../../services/db/projectDB';
import { deductPoints, GENERATION_COST } from '../../services/db/points';
import { trackGenerateImage, trackGenerateLifestyle } from '../../services/analytics';
import './StudioScreen.css';

// ─── Debug Panel ──────────────────────────────────────────────
// Visible when URL contains ?debug=1
// Shows build ID, fetch log, and errors to diagnose prod issues
const BUILD_ID = '__BUILD_' + new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14) + '__';

interface FetchLogEntry {
  time: string;
  url: string;
  method: string;
  status: number | string;
  error?: string;
  body?: string;
}

// Global fetch interceptor — logs every fetch call
const fetchLog: FetchLogEntry[] = [];
if (typeof window !== 'undefined' && !(window as any).__fetchIntercepted) {
  (window as any).__fetchIntercepted = true;
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || 'unknown';
    const method = (args[1] as RequestInit)?.method || 'GET';
    const entry: FetchLogEntry = {
      time: new Date().toLocaleTimeString(),
      url: url.slice(0, 150),
      method,
      status: 'pending',
    };
    fetchLog.push(entry);
    if (fetchLog.length > 50) fetchLog.shift();
    try {
      const resp = await originalFetch.apply(this, args);
      entry.status = resp.status;
      if (!resp.ok) {
        const clone = resp.clone();
        entry.body = (await clone.text().catch(() => '')).slice(0, 200);
      }
      return resp;
    } catch (err) {
      entry.status = 'ERROR';
      entry.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  };
}

function DebugPanel() {
  const [, forceUpdate] = React.useState(0);
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');

  React.useEffect(() => {
    if (!isDebug) return;
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [isDebug]);

  if (!isDebug) return null;

  const errors = fetchLog.filter((e) => e.status === 'ERROR' || (typeof e.status === 'number' && e.status >= 400));
  const recent = fetchLog.slice(-15);

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99999,
      background: '#1a1a2e', color: '#0f0', fontFamily: 'monospace', fontSize: '11px',
      padding: '8px 12px', maxHeight: '250px', overflowY: 'auto', borderTop: '2px solid #e94560',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <strong style={{ color: '#e94560' }}>🔧 DEBUG PANEL — {BUILD_ID}</strong>
        <span>{fetchLog.length} requests | {errors.length} errors</span>
      </div>
      {errors.length > 0 && (
        <div style={{ background: '#2d0000', padding: '4px 8px', marginBottom: '4px', borderRadius: '4px' }}>
          <strong style={{ color: '#ff4444' }}>❌ ERRORS:</strong>
          {errors.map((e, i) => (
            <div key={i} style={{ color: '#ff6666' }}>
              [{e.time}] {e.method} {e.url} → {e.status} {e.error || ''} {e.body || ''}
            </div>
          ))}
        </div>
      )}
      <div>
        <strong>Recent requests:</strong>
        {recent.map((e, i) => (
          <div key={i} style={{ color: e.status === 'ERROR' ? '#ff4444' : typeof e.status === 'number' && e.status >= 400 ? '#ffaa00' : '#0f0' }}>
            [{e.time}] {e.method} {e.url.slice(0, 80)} → {e.status}
          </div>
        ))}
      </div>
    </div>
  );
}

const MAX_IMAGES = 5;

/** Clean up raw edge function error messages for user display */
function friendlyError(raw: string): string {
  // Strip nested JSON from edge function errors
  // e.g. 'Edge function "studio-api" failed (502): {"error":"Fal.ai Pixelcut error 500: ..."}'
  if (raw.includes('Background removal unavailable')) return 'Background removal is temporarily unavailable. Please try again in a few minutes.';
  if (raw.includes('timed out')) return 'The request timed out. Please try again.';
  if (raw.includes('No image generation API')) return 'Image generation service is unavailable. Please try again later.';
  // Generic edge function errors — extract the human-readable part
  const edgeMatch = raw.match(/Edge function "[^"]+".+?:\s*(.+)/);
  if (edgeMatch) {
    try {
      const parsed = JSON.parse(edgeMatch[1]);
      if (parsed.error) return `Generation failed: ${parsed.error.split(':')[0]}. Please try again.`;
    } catch { /* not JSON, use as-is */ }
    return `Generation failed. Please try again.`;
  }
  return raw;
}

/** Unique ID generator for lifestyle/edit image entries */
const genEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Ensure every entry in a lifestyle/edit array has a unique id (migration for old saved data) */
function ensureIds(entries: { id?: string; image: string; prompt: string }[]): { id: string; image: string; prompt: string }[] {
  return entries.map(e => ({ ...e, id: e.id ?? genEntryId() }));
}

/** Convert a data URL string to a File object so the pipeline can consume it */
function dataUrlToFile(dataUrl: string, fileName = 'restored-image.png'): File {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) throw new Error('Invalid data URL format');
  const header = dataUrl.slice(0, commaIdx);
  const base64 = dataUrl.slice(commaIdx + 1);
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bstr = atob(base64);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], fileName, { type: mime });
}

/**
 * Convert any image source (data URL, public URL, or Storage path) to a URL
 * usable by edge functions. Storage paths (from saved projects) are converted
 * to public URLs. Data URLs and http(s) URLs pass through unchanged.
 */
function toUsableImageUrl(source: string): string {
  if (source.startsWith('data:') || source.startsWith('http')) return source;
  // Storage path (e.g. "uuid/autoCrop.png") — convert to public URL
  return getPublicUrl(source);
}

// --- Progress status messages (generic, no pipeline details exposed) ---
const PROGRESS_MESSAGES = [
  'Analyzing your product...',
  'Preparing studio scene...',
  'Generating studio render...',
  'Enhancing image quality...',
  'Refining details...',
  'Composing final output...',
  'Applying finishing touches...',
  'Almost there...',
];

export interface StudioScreenProps {
  project: Project | null;
  onBack: () => void;
  onNewProject?: () => void;
  onOpenStudio: (project: Project | null) => void;
  pointsBalance: number;
  onPointsChanged: () => void;
  userName?: string;
  userAvatar?: string;
  credits?: number;
  onSignOut?: () => void;
  onGoPricing?: () => void;
  onGoSettings?: () => void;
  onMassImport?: () => void;
}

const StudioScreen: React.FC<StudioScreenProps> = ({
  project, onBack, onNewProject, onOpenStudio, pointsBalance, onPointsChanged,
  userName = 'User', userAvatar, credits, onSignOut, onGoPricing, onGoSettings, onMassImport,
}) => {
  // --- State ---
  const [config, setConfig] = useState<PipelineConfig>({
    imageSize: project?.config.imageSize ?? DEFAULT_PIPELINE_CONFIG.imageSize,
    aspectRatio: project?.config.aspectRatio ?? DEFAULT_PIPELINE_CONFIG.aspectRatio,
    outputFormat: DEFAULT_PIPELINE_CONFIG.outputFormat,
  });

  // --- Restore saved results into initial pipeline state ---
  const buildRestoredState = (): PipelineState => {
    if (!project?.results) return createInitialPipelineState();
    const r = project.results;
    const state = createInitialPipelineState();

    const restoreImageStep = (step: PipelineStep, imgSrc: string | undefined) => {
      if (!imgSrc) return;
      (state[step] as { status: string; data?: unknown }) = {
        status: 'completed',
        data: { imageDataUrl: toUsableImageUrl(imgSrc), imageBlob: new Blob() },
      };
    };

    if (r.inputImage) {
      (state.input as { status: string; data?: unknown }) = {
        status: 'completed',
        data: { imageDataUrl: toUsableImageUrl(r.inputImage), imageBlob: new Blob(), fileName: 'saved' },
      };
    }
    if (r.analysis) {
      (state.analysis as { status: string; data?: unknown }) = {
        status: 'completed',
        data: { rawResponse: r.analysis, description: r.analysis, colors: [], materials: [], visibleTexts: [] },
      };
    }
    if (r.luminanceClass) {
      (state.luminanceCheck as { status: string; data?: unknown }) = {
        status: 'completed',
        data: r.luminanceClass,
      };
    }
    restoreImageStep('studioGeneration', r.studioGeneration);
    if (r.retouch) {
      restoreImageStep('retouch', r.retouch);
    } else {
      // Retouch is currently disabled — mark as skipped so progress shows 100%
      (state.retouch as { status: string; durationMs: number }) = { status: 'skipped', durationMs: 0 };
    }
    restoreImageStep('cutout', r.cutout);
    restoreImageStep('shadowComposite', r.shadowComposite);
    restoreImageStep('autoCrop', r.autoCrop);

    return state;
  };

  const buildInitialPreviews = (): string[] => {
    const previews: string[] = [];
    if (project?.results.inputImage) previews.push(toUsableImageUrl(project.results.inputImage));
    if (project?.results.inputImages) previews.push(...project.results.inputImages.map(toUsableImageUrl));
    return previews;
  };

  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [inputPreviews, setInputPreviews] = useState<string[]>(buildInitialPreviews);
  const [pipelineState, setPipelineState] = useState<PipelineState>(buildRestoredState);
  const [isRunning, setIsRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeVariant, setActiveVariant] = useState<string>('final');
  const [showLifestyle, setShowLifestyle] = useState(false);
  const [lifestylePrompt, setLifestylePrompt] = useState('');
  const [lifestyleImages, setLifestyleImages] = useState<{ id: string; image: string; prompt: string }[]>(ensureIds(project?.results.lifestyles ?? []));
  const [isGeneratingLifestyle, setIsGeneratingLifestyle] = useState(false);
  const [lifestyleError, setLifestyleError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editImages, setEditImages] = useState<{ id: string; image: string; prompt: string }[]>(ensureIds(project?.results.edits ?? []));
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  // Style reference images state
  const [styleMode, setStyleMode] = useState<'inspire' | 'replicate'>('inspire');
  const [styleRefImages, setStyleRefImages] = useState<string[]>(project?.results.styleReferenceImages ?? []);
  const [styleDescription, setStyleDescription] = useState<string | null>(project?.results.styleDescription ?? null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);
  const [showStyleDescription, setShowStyleDescription] = useState(false);
  const styleRefInputRef = useRef<HTMLInputElement>(null);
  const styleRefImagesRef = useRef<string[]>(styleRefImages);
  const styleDescriptionRef = useRef<string | null>(styleDescription);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(project);
  const pipelineStateRef = useRef<PipelineState>(pipelineState);
  const inputPreviewsRef = useRef<string[]>(inputPreviews);
  const lifestyleImagesRef = useRef<{ id: string; image: string; prompt: string }[]>(lifestyleImages);
  const editImagesRef = useRef<{ id: string; image: string; prompt: string }[]>(editImages);
  const saveVersionRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { inputPreviewsRef.current = inputPreviews; }, [inputPreviews]);
  useEffect(() => { lifestyleImagesRef.current = lifestyleImages; }, [lifestyleImages]);
  useEffect(() => { editImagesRef.current = editImages; }, [editImages]);
  useEffect(() => { styleRefImagesRef.current = styleRefImages; }, [styleRefImages]);
  useEffect(() => { styleDescriptionRef.current = styleDescription; }, [styleDescription]);

  // Reinitialize lifestyle/edit state when project changes (e.g. navigating between projects)
  useEffect(() => {
    const lf = ensureIds(project?.results.lifestyles ?? []);
    setLifestyleImages(lf);
    lifestyleImagesRef.current = lf;
    const ed = ensureIds(project?.results.edits ?? []);
    setEditImages(ed);
    editImagesRef.current = ed;
    setActiveVariant('final');
    // Restore style reference state
    setStyleRefImages(project?.results.styleReferenceImages ?? []);
    styleRefImagesRef.current = project?.results.styleReferenceImages ?? [];
    setStyleDescription(project?.results.styleDescription ?? null);
    styleDescriptionRef.current = project?.results.styleDescription ?? null;
    setShowStyleDescription(false);
    setStyleError(null);
  }, [project?.id]);

  // Load recent projects for sidebar
  useEffect(() => {
    getAllProjects().then(list => setRecentProjects(list.slice(0, 3))).catch(() => {});
  }, []);

  // Derived: primary image is the first one
  const inputPreview = inputPreviews[0] ?? null;
  const inputFile = inputFiles[0] ?? null;

  // --- Auto-save project results after pipeline completes ---
  const autoSave = useCallback(async () => {
    // Bump version so stale queued saves can bail out
    const thisVersion = ++saveVersionRef.current;

    // Enqueue: wait for any running save to finish, then run this one
    const doSave = async () => {
      // If a newer save was requested while we waited in queue, skip this one
      if (saveVersionRef.current !== thisVersion) return;

      const p = projectRef.current;
      if (!p) return;

      const state = pipelineStateRef.current;
      const previews = inputPreviewsRef.current;
      const prev = p.results;

      const getImg = (step: PipelineStep): string | undefined => {
        const r = state[step];
        if (r.status !== 'completed' || !r.data) return undefined;
        const d = r.data as unknown as Record<string, unknown>;
        return d.imageDataUrl as string | undefined;
      };

      // Check if the pipeline has actually run in this session
      const pipelineRan = state.autoCrop.status === 'completed'
        || state.cutout.status === 'completed'
        || state.studioGeneration.status === 'completed';

      p.results = {
        // For pipeline step images: use pipeline state if it ran, otherwise preserve existing DB values
        inputImage: previews[0] ?? prev.inputImage ?? undefined,
        inputImages: previews.length > 1 ? previews.slice(1) : prev.inputImages ?? undefined,
        analysis: pipelineRan
          ? (state.analysis.status === 'completed' && state.analysis.data
            ? (state.analysis.data as { rawResponse: string }).rawResponse : undefined)
          : prev.analysis ?? undefined,
        luminanceClass: pipelineRan
          ? (state.luminanceCheck.status === 'completed' && state.luminanceCheck.data
            ? (state.luminanceCheck.data as string) : undefined)
          : prev.luminanceClass ?? undefined,
        studioGeneration: pipelineRan ? getImg('studioGeneration') : prev.studioGeneration ?? undefined,
        retouch: pipelineRan ? getImg('retouch') : prev.retouch ?? undefined,
        cutout: pipelineRan ? getImg('cutout') : prev.cutout ?? undefined,
        shadowComposite: pipelineRan ? getImg('shadowComposite') : prev.shadowComposite ?? undefined,
        autoCrop: pipelineRan ? getImg('autoCrop') : prev.autoCrop ?? undefined,
        // Lifestyle/edit always use current in-memory state (these are managed independently)
        lifestyles: lifestyleImagesRef.current.length > 0 ? lifestyleImagesRef.current : undefined,
        edits: editImagesRef.current.length > 0 ? editImagesRef.current : undefined,
        // Style reference images and description
        styleReferenceImages: styleRefImagesRef.current.length > 0 ? styleRefImagesRef.current : undefined,
        styleDescription: styleDescriptionRef.current ?? undefined,
      };
      const newThumb = getImg('autoCrop') ?? getImg('retouch') ?? getImg('shadowComposite') ?? getImg('studioGeneration') ?? previews[0];
      p.thumbnail = newThumb ?? p.thumbnail ?? undefined;
      p.config = { imageSize: config.imageSize, aspectRatio: config.aspectRatio };
      p.updatedAt = Date.now();

      try {
        await saveProject(p);
        if (saveVersionRef.current === thisVersion) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        }
      } catch (err) {
        console.error('[autoSave] Failed to save project:', err);
      }
    };

    saveQueueRef.current = saveQueueRef.current.then(doSave).catch(() => {});
    await saveQueueRef.current;
  }, [config.imageSize, config.aspectRatio]);

  // --- File Upload (multi-image) ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
    const newFiles: File[] = [];
    const readers: Promise<string>[] = [];

    const filesToAdd = Array.from(files).filter(f => {
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`[Upload] Rejected ${f.name}: ${Math.round(f.size / 1024 / 1024)}MB exceeds 10MB limit`);
        return false;
      }
      return true;
    });
    const available = MAX_IMAGES - inputPreviews.length;
    const toProcess = filesToAdd.slice(0, available);

    for (const file of toProcess) {
      newFiles.push(file);
      readers.push(new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }));
    }

    if (newFiles.length === 0) return;

    Promise.all(readers).then(dataUrls => {
      setInputFiles(prev => [...prev, ...newFiles]);
      setInputPreviews(prev => [...prev, ...dataUrls]);
      if (inputPreviews.length === 0) {
        setPipelineState(createInitialPipelineState());
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputPreviews.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeImage = useCallback((index: number) => {
    setInputFiles(prev => prev.filter((_, i) => i !== index));
    setInputPreviews(prev => prev.filter((_, i) => i !== index));
    setPipelineState(createInitialPipelineState());
  }, []);

  // --- Pipeline Execution ---
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const handleRunPipeline = useCallback(async () => {
    if (isRunning) return; // prevent double-click

    // Use the real File if available, otherwise reconstruct from data URL preview
    const fileToUse = inputFile ?? (inputPreview ? dataUrlToFile(inputPreview, project?.name ?? 'restored-image.png') : null);
    if (!fileToUse) return;

    const cost = GENERATION_COST[config.imageSize] ?? 2;
    if (pointsBalance < cost) {
      alert(`Crédits insuffisants. Il faut ${cost} crédits pour une génération ${config.imageSize}. Vous avez ${pointsBalance} crédits.`);
      return;
    }

    setIsRunning(true);
    setPipelineError(null);
    const freshState = createInitialPipelineState();
    setPipelineState(freshState);
    pipelineStateRef.current = freshState;

    const additionalImageDataUrls = inputPreviews.length > 1 ? inputPreviews.slice(1) : undefined;

    try {
      const result = await runPipeline({
        config,
        inputFile: fileToUse,
        additionalImageDataUrls,
        onStateChange: (newState: PipelineState, _step: PipelineStep) => {
          pipelineStateRef.current = newState;
          setPipelineState({ ...newState });
        },
      });
      pipelineStateRef.current = result;

      // Track successful generation
      trackGenerateImage(config.imageSize ?? '2K', cost);

      // Deduct credits only after successful pipeline completion
      try {
        await deductPoints(cost);
        onPointsChanged();
      } catch (err) {
        console.error('Credit deduction failed after pipeline success:', err);
      }
    } catch (err) {
      console.error('Pipeline failed:', err);
      setPipelineError(friendlyError(err instanceof Error ? err.message : 'Pipeline failed. Please try again.'));
    } finally {
      setIsRunning(false);
      await autoSave();
    }
  }, [isRunning, inputFile, inputPreview, inputPreviews, config, autoSave, pointsBalance, onPointsChanged, project?.name]);

  const handleReset = useCallback(() => {
    setInputFiles([]);
    setInputPreviews([]);
    setPipelineState(createInitialPipelineState());
    setIsRunning(false);
  }, []);

  // --- Delete a generated lifestyle or edit image ---
  const deleteVariant = useCallback((variantKey: string) => {
    setDeleteConfirmKey(variantKey);
  }, []);

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = useCallback(async () => {
    const variantKey = deleteConfirmKey;
    if (!variantKey) return;

    // Update in-memory state immediately
    if (variantKey.startsWith('lifestyle-')) {
      const id = variantKey.replace('lifestyle-', '');
      const updated = lifestyleImagesRef.current.filter(li => li.id !== id);
      setLifestyleImages(updated);
      lifestyleImagesRef.current = updated;
    } else if (variantKey.startsWith('edit-')) {
      const id = variantKey.replace('edit-', '');
      const updated = editImagesRef.current.filter(ei => ei.id !== id);
      setEditImages(updated);
      editImagesRef.current = updated;
    }
    setDeleteConfirmKey(null);
    setActiveVariant('final');

    // Lightweight DB patch — only updates lifestyles/edits, no image re-upload, no thumbnail change
    const p = projectRef.current;
    if (p) {
      setIsDeleting(true);
      try {
        await patchProjectVariants(
          p.id,
          lifestyleImagesRef.current.length > 0 ? lifestyleImagesRef.current : undefined,
          editImagesRef.current.length > 0 ? editImagesRef.current : undefined,
        );
        // Also update in-memory project results
        p.results = {
          ...p.results,
          lifestyles: lifestyleImagesRef.current.length > 0 ? lifestyleImagesRef.current : undefined,
          edits: editImagesRef.current.length > 0 ? editImagesRef.current : undefined,
        };
        p.updatedAt = Date.now();
        import.meta.env.DEV && console.log('[confirmDelete] ✅ Deletion saved');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error('[confirmDelete] ❌ Save failed:', err);
      } finally {
        setIsDeleting(false);
      }
    }
  }, [deleteConfirmKey]);

  // --- Download any step image ---
  const downloadImage = useCallback((dataUrl: string, suffix: string) => {
    const base = project?.name ?? inputFile?.name ?? 'output';
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `studio-${base}-${suffix}.png`;
    link.click();
  }, [inputFile, project]);

  // --- Config Update ---
  const updateConfig = useCallback((field: keyof PipelineConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // --- Toggle helpers for shadow/white bg ---
  const shadowEnabled = config.outputFormat !== 'transparent-clean';
  const whiteBgEnabled = config.outputFormat === 'white-shadow';

  const toggleShadow = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      outputFormat: prev.outputFormat === 'transparent-clean'
        ? 'transparent-shadow'
        : 'transparent-clean',
    }));
  }, []);

  const toggleWhiteBg = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      outputFormat: prev.outputFormat === 'white-shadow'
        ? 'transparent-shadow'
        : 'white-shadow',
    }));
  }, []);

  // --- Helper: Upload data URL image to Storage for Edge Functions ---
  const uploadForEdgeFunction = useCallback(async (dataUrl: string, label: string): Promise<string> => {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx < 0) throw new Error('Invalid data URL format');
    const bstr = atob(dataUrl.slice(commaIdx + 1));
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    const sessionId = crypto.randomUUID();
    const path = `temp-pipeline/${sessionId}/${label}-${Date.now()}.png`;
    const { error } = await supabase.storage
      .from('project-images')
      .upload(path, u8arr, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data } = supabase.storage.from('project-images').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  // --- Style Reference Upload & Analysis ---
  const handleStyleRefUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Copy the file list BEFORE resetting the input (value='' clears the live FileList)
    const fileArray = Array.from(files);
    // Reset input so the same file can be re-selected
    e.target.value = '';

    // Read files as data URLs
    const newDataUrls: string[] = [];
    for (const file of fileArray) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      newDataUrls.push(dataUrl);
    }
    if (newDataUrls.length === 0) return;

    // Combine with existing, max 4
    const combined = [...styleRefImages, ...newDataUrls].slice(0, 4);
    setStyleRefImages(combined);
    styleRefImagesRef.current = combined;
    setStyleError(null);
    setIsAnalyzingStyle(true);

    try {
      // Upload all images to Storage for the edge function
      const uploadedUrls = await Promise.all(
        combined.map((du, i) => uploadForEdgeFunction(du, `style-ref-${i}`))
      );

      // Analyze style via GPT-4o Vision — use art director prompt in replicate mode
      // Pass product description so colors/props adapt to the actual product
      const productDesc = pipelineState.analysis.status === 'completed' && pipelineState.analysis.data
        ? (pipelineState.analysis.data as { rawResponse?: string }).rawResponse
        : undefined;
      const result = styleMode === 'replicate'
        ? await analyzeStyleReplicate(uploadedUrls, productDesc ?? undefined)
        : await analyzeStyleReferences(uploadedUrls);
      setStyleDescription(result.styleDescription);
      styleDescriptionRef.current = result.styleDescription;
      setShowStyleDescription(true);
      await autoSave();
    } catch (err) {
      console.error('Style analysis failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setStyleError(`Style analysis failed: ${friendlyError(msg)}`);
      setStyleDescription(null);
      styleDescriptionRef.current = null;
    } finally {
      setIsAnalyzingStyle(false);
    }
  }, [styleRefImages, styleMode, uploadForEdgeFunction, autoSave]);

  const removeStyleRef = useCallback((index: number) => {
    const updated = styleRefImages.filter((_, i) => i !== index);
    setStyleRefImages(updated);
    styleRefImagesRef.current = updated;
    // Invalidate style description when images change
    setStyleDescription(null);
    styleDescriptionRef.current = null;
    setShowStyleDescription(false);
    autoSave();
  }, [styleRefImages, autoSave]);

  // --- Lifestyle Generation ---
  const handleGenerateLifestyle = useCallback(async () => {
    const sourceImage = getStepImage('autoCrop');
    // In replicate mode, prompt is optional (style description IS the scene)
    const hasPrompt = lifestylePrompt.trim().length > 0;
    const hasStyle = !!styleDescriptionRef.current;
    if (!sourceImage || (!hasPrompt && !hasStyle)) return;

    setIsGeneratingLifestyle(true);
    setLifestyleError(null);
    try {
      // Handle data URLs (fresh pipeline) and Storage paths/public URLs (saved projects)
      let imageUrl: string;
      if (sourceImage.startsWith('data:')) {
        imageUrl = await uploadForEdgeFunction(sourceImage, 'lifestyle-input');
      } else {
        imageUrl = toUsableImageUrl(sourceImage);
      }

      // Get product description from analysis (for text/label preservation)
      const analysisData = pipelineState.analysis.status === 'completed' && pipelineState.analysis.data
        ? (pipelineState.analysis.data as { rawResponse?: string }).rawResponse
        : project?.results.analysis;

      // In replicate mode, the style description IS the main prompt if no user prompt given
      const effectivePrompt = lifestylePrompt.trim() || (styleMode === 'replicate' && styleDescriptionRef.current ? 'Generate using the style description' : '');
      const response = await generateLifestyleImage(imageUrl, effectivePrompt, {
        imageSize: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
        styleDescription: styleDescriptionRef.current ?? undefined,
        productDescription: analysisData ?? undefined,
        styleMode: styleMode as 'inspire' | 'replicate',
      });

      if (!response.resultImageUrl) throw new Error('No image URL returned from AI');

      const imageDataUrl = await fetchImageAsDataUrl(response.resultImageUrl);

      trackGenerateLifestyle();
      const newEntry = { id: genEntryId(), image: imageDataUrl, prompt: lifestylePrompt.trim() };
      const updated = [...lifestyleImages, newEntry];
      setLifestyleImages(updated);
      lifestyleImagesRef.current = updated;
      setActiveVariant(`lifestyle-${newEntry.id}`);
      setLifestylePrompt('');
      await autoSave();
    } catch (err) {
      console.error('Lifestyle generation failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLifestyleError(friendlyError(msg));
    } finally {
      setIsGeneratingLifestyle(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifestylePrompt, config.imageSize, config.aspectRatio, lifestyleImages, autoSave, uploadForEdgeFunction]);

  // --- AI Edit Generation (via Edge Function) ---
  const handleEditImage = useCallback(async () => {
    // Use the currently selected variant's image, not always the final
    let sourceImage: string | null = null;
    if (activeVariant.startsWith('edit-')) {
      const id = activeVariant.replace('edit-', '');
      sourceImage = editImages.find(e => e.id === id)?.image ?? null;
    } else if (activeVariant.startsWith('lifestyle-')) {
      const id = activeVariant.replace('lifestyle-', '');
      sourceImage = lifestyleImages.find(l => l.id === id)?.image ?? null;
    } else if (activeVariant === 'original') {
      sourceImage = inputPreviews[0] ?? null;
    } else if (activeVariant === 'cutout') {
      sourceImage = getStepImage('cutout');
    } else {
      sourceImage = getStepImage('autoCrop');
    }
    if (!sourceImage || !editPrompt.trim()) return;
    setIsGeneratingEdit(true);
    setEditError(null);
    try {
      // Handle data URLs (fresh pipeline) and Storage paths/public URLs (saved projects)
      let imageUrl: string;
      if (sourceImage.startsWith('data:')) {
        imageUrl = await uploadForEdgeFunction(sourceImage, 'edit-input');
      } else {
        imageUrl = toUsableImageUrl(sourceImage);
      }

      // Get product description from analysis (for text/label preservation)
      const analysisData = pipelineState.analysis.status === 'completed' && pipelineState.analysis.data
        ? (pipelineState.analysis.data as { rawResponse?: string }).rawResponse
        : project?.results.analysis;

      const isLifestyleSource = activeVariant.startsWith('lifestyle-');
      const response = await editImage(imageUrl, editPrompt.trim(), {
        resolution: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
        isLifestyle: isLifestyleSource,
        productDescription: analysisData ?? undefined,
      });

      if (!response.resultImageUrl) throw new Error('No image URL returned from AI');

      const imageDataUrl = await fetchImageAsDataUrl(response.resultImageUrl);

      const newEntry = { id: genEntryId(), image: imageDataUrl, prompt: editPrompt.trim() };
      const updated = [...editImages, newEntry];
      setEditImages(updated);
      editImagesRef.current = updated;
      setActiveVariant(`edit-${newEntry.id}`);
      setEditPrompt('');
      await autoSave();
    } catch (err) {
      console.error('Edit generation failed:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setEditError(friendlyError(msg));
    } finally {
      setIsGeneratingEdit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPrompt, editImages, activeVariant, lifestyleImages, inputPreviews, config.imageSize, config.aspectRatio, autoSave, uploadForEdgeFunction]);

  // --- Validation ---
  const hasImage = inputPreviews.length > 0 || inputFiles.length > 0;
  const canRun = hasImage && !isRunning;

  // --- Get image data from step result ---
  const getStepImage = (step: PipelineStep): string | null => {
    const result = pipelineState[step];
    if (result.status !== 'completed' || !result.data) return null;
    const data = result.data as unknown as Record<string, unknown>;
    return (data.imageDataUrl as string) ?? null;
  };

  // --- Progress calculation (count both completed and skipped steps) ---
  const completedSteps = PIPELINE_STEPS.filter(s => {
    const st = pipelineState[s.key].status;
    return st === 'completed' || st === 'skipped';
  }).length;
  const totalSteps = PIPELINE_STEPS.length;
  const progressPercent = (completedSteps / totalSteps) * 100;
  const hasError = PIPELINE_STEPS.some(s => pipelineState[s.key].status === 'error');
  const errorStep = PIPELINE_STEPS.find(s => pipelineState[s.key].status === 'error');
  const errorDetail = errorStep ? pipelineState[errorStep.key].error : undefined;
  const progressMessage = hasError
    ? `Error: ${errorDetail ?? 'Unknown error'}`
    : completedSteps >= totalSteps
      ? 'Generation complete'
      : PROGRESS_MESSAGES[Math.min(completedSteps, PROGRESS_MESSAGES.length - 1)];

  const isFastMode = !project;
  const pipelineComplete = pipelineState.autoCrop.status === 'completed' && !!getStepImage('autoCrop');
  const hasImages = inputPreviews.length > 0;

  // --- Variant list (computed at component level for both canvas + sidebar) ---
  type Variant = { key: string; label: string; image: string; prompt?: string };
  const resultVariants: Variant[] = pipelineComplete ? (() => {
    const base: Variant[] = [
      ...(inputPreview ? [{ key: 'original', label: 'Original', image: inputPreview }] : []),
      { key: 'final', label: 'Final', image: getStepImage('autoCrop')! },
      // Debug: per-step images
      ...(getStepImage('studioGeneration') ? [{ key: 'debug-studio', label: 'Step 2: Studio', image: getStepImage('studioGeneration')! }] : []),
      ...(getStepImage('cutout') ? [{ key: 'cutout', label: 'Step 4: Cutout', image: getStepImage('cutout')! }] : []),
      ...(getStepImage('retouch') ? [{ key: 'debug-retouch', label: 'Step 5: Retouch', image: getStepImage('retouch')! }] : []),
      ...(getStepImage('shadowComposite') ? [{ key: 'debug-shadow', label: 'Step 6: Shadow', image: getStepImage('shadowComposite')! }] : []),
    ].filter(v => v.image != null);
    const lifeV: Variant[] = lifestyleImages.map((li, i) => ({ key: `lifestyle-${li.id}`, label: `Lifestyle ${i + 1}`, image: li.image, prompt: li.prompt }));
    const editV: Variant[] = editImages.map((ei, i) => ({ key: `edit-${ei.id}`, label: `Edit ${i + 1}`, image: ei.image, prompt: ei.prompt }));
    return [...base, ...lifeV, ...editV];
  })() : [];
  const currentVariant = resultVariants.find(v => v.key === activeVariant) ?? resultVariants.find(v => v.key === 'final') ?? resultVariants[0];
  const downloadSuffix = currentVariant?.key ?? 'final';

  // --- Render ---
  return (
    <div className="studio">
      <DebugPanel />
      {/* ===== Sidebar ===== */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <svg className="sidebar-logo-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="20" cy="8" r="2" fill="currentColor"/>
          </svg>
          <span className="sidebar-logo-text">FrameFlow</span>
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          <button className="sidebar-btn-primary" onClick={onNewProject ?? onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6 8h4M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            New Project
          </button>
          <button
            className={`sidebar-btn-ghost ${isFastMode ? 'sidebar-btn-ghost--active' : ''}`}
            onClick={() => { if (!isFastMode) onOpenStudio(null); }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M9.5 3L5 9h4l-1 4L13 7H9l.5-4z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Fast Generation
          </button>
          {onMassImport && (
            <button className="sidebar-btn-ghost" onClick={onMassImport}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 10l6-6 6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 4v9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M3 14h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Mass Import
            </button>
          )}
        </div>

        {/* Workspace */}
        <div className="sidebar-section">
          <span className="sidebar-label">/ WORKSPACE</span>
          <button className="sidebar-nav-item" onClick={onBack}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            All Projects
          </button>
        </div>

        {/* Recent */}
        {recentProjects.length > 0 && (
          <div className="sidebar-section">
            <span className="sidebar-label">/ RECENT</span>
            {recentProjects.map(p => (
              <button
                key={p.id}
                className="sidebar-nav-item"
                onClick={() => onOpenStudio(p)}
              >
                <span className="sidebar-dot" />
                <span className="sidebar-project-name">{p.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="sidebar-spacer" />

        {/* Bottom — User */}
        <div className="sidebar-bottom">
          <div className="sidebar-user" onClick={onGoPricing}>
            <div className="sidebar-avatar">
              {userAvatar ? (
                <img src={userAvatar} alt="" />
              ) : (
                <span>{(userName || 'U')[0].toUpperCase()}</span>
              )}
            </div>
            <span className="sidebar-username">{userName}</span>
            {credits !== undefined && (
              <span className="sidebar-credits">{credits} credits</span>
            )}
          </div>
          <button className="sidebar-bottom-btn" onClick={onGoSettings ?? onGoPricing}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6.5 1.5h3l.4 1.6a5.5 5.5 0 011.3.7l1.5-.6 1.5 2.6-1.2 1a5.5 5.5 0 010 1.4l1.2 1-1.5 2.6-1.5-.6a5.5 5.5 0 01-1.3.7l-.4 1.6h-3l-.4-1.6a5.5 5.5 0 01-1.3-.7l-1.5.6-1.5-2.6 1.2-1a5.5 5.5 0 010-1.4l-1.2-1 1.5-2.6 1.5.6a5.5 5.5 0 011.3-.7l.4-1.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Settings
          </button>
          <button className="sidebar-bottom-btn" onClick={onSignOut}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 13H3.5A1.5 1.5 0 012 11.5v-7A1.5 1.5 0 013.5 3H6M10.5 11L14 8l-3.5-3M14 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ===== Main Content ===== */}
      <main className="studio-main">

        {/* Upload + Controls Section — hidden once results are ready */}
        {!pipelineComplete && (
          <section className="upload-section">
            {/* Hidden file input (supports multi-select) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {!hasImages ? (
              /* Empty state — large dropzone */
              <div
                className={`dropzone ${isDragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
              >
                <div className="dropzone-placeholder">
                  <div className="dropzone-icon">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <path d="M20 8v24M8 20h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <p className="dropzone-title">Drop your product photos</p>
                  <p className="dropzone-hint">Up to {MAX_IMAGES} reference images — or click to browse</p>
                </div>
              </div>
            ) : (
              /* Images uploaded — show grid */
              <div
                className={`image-grid ${isDragging ? 'dragging' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
              >
                {inputPreviews.map((preview, i) => (
                  <div key={i} className={`image-grid-item ${i === 0 ? 'primary' : ''}`}>
                    <img src={preview} alt={`Reference ${i + 1}`} />
                    {i === 0 && <span className="image-grid-badge">Main</span>}
                    <button
                      className="image-grid-remove"
                      onClick={() => removeImage(i)}
                      title="Remove"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  </div>
                ))}

                {inputPreviews.length < MAX_IMAGES && (
                  <button
                    className="image-grid-add"
                    onClick={() => fileInputRef.current?.click()}
                    title={`Add image (${inputPreviews.length}/${MAX_IMAGES})`}
                  >
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span>{inputPreviews.length}/{MAX_IMAGES}</span>
                  </button>
                )}
              </div>
            )}

            {/* Product Notes */}
            <div className="product-notes-bar">
              <textarea
                className="product-notes-input"
                placeholder="Add details about your product (e.g. &quot;This is a matte black wireless speaker, 15cm tall, brand name is SoundPulse&quot;)"
                value={config.productNotes ?? ''}
                onChange={(e) => updateConfig('productNotes', e.target.value)}
                disabled={isRunning}
                rows={2}
              />
            </div>

            {/* Controls Bar */}
            <div className="controls-bar">
              <div className="controls-left">
                {/* Resolution Toggle */}
                <div className="resolution-toggle">
                  <button
                    className={`res-btn ${config.imageSize === '2K' ? 'active' : ''}`}
                    onClick={() => updateConfig('imageSize', '2K')}
                    disabled={isRunning}
                  >2K</button>
                  <button
                    className={`res-btn ${config.imageSize === '4K' ? 'active' : ''}`}
                    onClick={() => updateConfig('imageSize', '4K')}
                    disabled={isRunning}
                  >4K</button>
                </div>

                {/* Shadow Toggle */}
                <button
                  className={`option-toggle ${shadowEnabled ? 'active' : ''}`}
                  onClick={toggleShadow}
                  disabled={isRunning}
                >
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">Shadow</span>
                </button>

                {/* White Background Toggle */}
                <button
                  className={`option-toggle ${whiteBgEnabled ? 'active' : ''} ${!shadowEnabled ? 'disabled-toggle' : ''}`}
                  onClick={toggleWhiteBg}
                  disabled={isRunning || !shadowEnabled}
                >
                  <span className="toggle-track">
                    <span className="toggle-thumb" />
                  </span>
                  <span className="toggle-label">White BG</span>
                </button>

                {!hasImage && !isRunning && (
                  <span className="missing-hint">Image required</span>
                )}
              </div>

              <div className="controls-right">
                {(hasImages || completedSteps > 0) && (
                  <button className="btn-ghost" onClick={handleReset}>Reset</button>
                )}
                <button
                  className="btn-primary"
                  onClick={handleRunPipeline}
                  disabled={!canRun}
                >
                  {isRunning ? (
                    <>
                      <span className="btn-spinner" />
                      Processing...
                    </>
                  ) : (
                    `Generate (${GENERATION_COST[config.imageSize] ?? 2} credits)`
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Progress Bar */}
        {(isRunning || completedSteps > 0) && completedSteps < totalSteps && (
          <section className={`progress-section ${hasError ? 'has-error' : ''}`}>
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${isRunning ? 'animated' : ''}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-message">{progressMessage}</span>
              <span className="progress-percent">{Math.round(progressPercent)}%</span>
            </div>
          </section>
        )}

        {/* Pipeline Error */}
        {pipelineError && (
          <section className="pipeline-error" style={{ padding: '12px 16px', margin: '0 24px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 14 }}>
            <strong>Error:</strong> {pipelineError}
            <button onClick={() => setPipelineError(null)} style={{ marginLeft: 12, color: '#991b1b', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>Dismiss</button>
          </section>
        )}

        {/* Result Viewer */}
        {pipelineComplete && currentVariant && (
          <section className="result-viewer">
            <div className="result-layout">
              <div className="result-card">
                <div className={`result-canvas ${['cutout', 'debug-retouch', 'debug-shadow'].includes(activeVariant) ? 'result-canvas--checkerboard' : ''}`}>
                  <img src={currentVariant.image} alt={currentVariant.label} className="result-canvas-img" />

                  {/* Prompt badge for lifestyle/edit variants */}
                  {currentVariant.prompt && (
                    <div
                      className="result-prompt-badge"
                      onClick={() => {
                        const el = document.querySelector('.result-prompt-expanded') as HTMLElement | null;
                        if (el) {
                          el.classList.toggle('visible');
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="result-prompt-badge-label">Prompt</span>
                      <span className="result-prompt-badge-text">{currentVariant.prompt}</span>
                      <button
                        className="result-prompt-copy-btn"
                        title="Copy prompt"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(currentVariant.prompt || '');
                          const btn = e.currentTarget;
                          btn.textContent = '✓';
                          setTimeout(() => { btn.textContent = '⧉'; }, 1500);
                        }}
                      >⧉</button>
                    </div>
                  )}
                  {currentVariant.prompt && (
                    <div className="result-prompt-expanded">
                      <div className="result-prompt-expanded-header">
                        <span>Full Prompt</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(currentVariant.prompt || '');
                            const btn = document.querySelector('.result-prompt-expanded .result-prompt-copy-btn') as HTMLElement;
                            if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 1500); }
                          }}
                          className="result-prompt-copy-btn result-prompt-copy-btn--text"
                        >Copy</button>
                      </div>
                      <p className="result-prompt-expanded-text">{currentVariant.prompt}</p>
                    </div>
                  )}

                  {/* Thumbnail strip - bottom center */}
                  {resultVariants.length > 1 && (
                    <div className="result-thumbs">
                      {resultVariants.map(v => {
                        const isDeletable = v.key.startsWith('lifestyle-') || v.key.startsWith('edit-');
                        return (
                          <div key={v.key} className="result-thumb-wrapper">
                            <button
                              className={`result-thumb ${v.key === currentVariant.key ? 'active' : ''}`}
                              onClick={() => setActiveVariant(v.key)}
                              title={v.label}
                            >
                              <img src={v.image} alt={v.label} />
                              <span className="thumb-label">{v.label}</span>
                            </button>
                            {isDeletable && (
                              <button
                                className="result-thumb-delete"
                                onClick={(e) => { e.stopPropagation(); deleteVariant(v.key); }}
                                title="Supprimer"
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile action toolbar — visible only on small screens where sidebar is hidden */}
            <div className="mobile-toolbar">
              <button
                className="mobile-toolbar-btn"
                onClick={onBack}
                title="Back"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M12.5 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Back</span>
              </button>
              <button
                className={`mobile-toolbar-btn ${showLifestyle ? 'active' : ''}`}
                onClick={() => { setShowLifestyle(prev => !prev); setShowEdit(false); }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 7a4 4 0 014-4h6a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V7z" stroke="currentColor" strokeWidth="1.4"/>
                  <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
                  <path d="M3 13l4-3.5 3 2.5 3-4 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Lifestyle</span>
              </button>
              <button
                className={`mobile-toolbar-btn ${showEdit ? 'active' : ''}`}
                onClick={() => { setShowEdit(prev => !prev); setShowLifestyle(false); }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M14.5 2.5l3 3-10 10H4.5v-3l10-10z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span>Edit</span>
              </button>
              <button
                className="mobile-toolbar-btn"
                onClick={() => downloadImage(currentVariant.image, downloadSuffix)}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v9.5M6 9.5L10 13l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 15.5h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
                <span>Download</span>
              </button>
              <button
                className="mobile-toolbar-btn"
                onClick={handleRunPipeline}
                disabled={isRunning || !hasImage}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3.5 3.5v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5.5 12.5a6 6 0 105-7.5H3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Redo</span>
              </button>
            </div>

            {/* Lifestyle prompt panel */}
            {showLifestyle && (
              <div className="prompt-panel">
                <div className="prompt-panel-header">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z" fill="currentColor"/>
                  </svg>
                  <span>Generate Lifestyle</span>
                  <div className="resolution-toggle" style={{ marginLeft: 'auto' }}>
                    <button className={`res-btn ${config.imageSize === '2K' ? 'active' : ''}`} onClick={() => updateConfig('imageSize', '2K')} disabled={isGeneratingLifestyle}>2K</button>
                    <button className={`res-btn ${config.imageSize === '4K' ? 'active' : ''}`} onClick={() => updateConfig('imageSize', '4K')} disabled={isGeneratingLifestyle}>4K</button>
                  </div>
                </div>
                {/* Style Mode Tabs */}
                <div className="style-mode-tabs">
                  <button
                    className={`style-mode-tab ${styleMode === 'inspire' ? 'active' : ''}`}
                    onClick={() => { setStyleMode('inspire'); setStyleDescription(null); styleDescriptionRef.current = null; setStyleRefImages([]); styleRefImagesRef.current = []; }}
                    disabled={isAnalyzingStyle || isGeneratingLifestyle}
                  >
                    ✨ Inspire
                  </button>
                  <button
                    className={`style-mode-tab ${styleMode === 'replicate' ? 'active' : ''}`}
                    onClick={() => { setStyleMode('replicate'); setStyleDescription(null); styleDescriptionRef.current = null; setStyleRefImages([]); styleRefImagesRef.current = []; }}
                    disabled={isAnalyzingStyle || isGeneratingLifestyle}
                  >
                    🎯 Replicate
                  </button>
                </div>

                <p className="prompt-panel-hint">
                  {styleMode === 'inspire'
                    ? 'Describe the scene for your product (e.g. "on a marble kitchen counter with soft morning light")'
                    : 'Upload a reference image — the exact visual style will be replicated with your product'}
                </p>

                {/* Style Reference Images */}
                <div className="style-ref-section">
                  <div className="style-ref-header">
                    <span className="style-ref-label">{styleMode === 'inspire' ? 'Style references' : 'Reference image'}</span>
                    {styleRefImages.length < 4 && (
                      <button
                        className="style-ref-add-btn"
                        onClick={() => styleRefInputRef.current?.click()}
                        disabled={isAnalyzingStyle || isGeneratingLifestyle}
                      >
                        + Add
                      </button>
                    )}
                    <input
                      ref={styleRefInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleStyleRefUpload}
                    />
                  </div>

                  {styleRefImages.length > 0 && (
                    <div className="style-ref-thumbs">
                      {styleRefImages.map((img, i) => (
                        <div key={i} className="style-ref-thumb">
                          <img src={img} alt={`Style ref ${i + 1}`} />
                          <button
                            className="style-ref-thumb-remove"
                            onClick={() => removeStyleRef(i)}
                            disabled={isAnalyzingStyle}
                            title="Remove"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isAnalyzingStyle && (
                    <p className="prompt-panel-status">
                      <span className="btn-spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                      Analyzing visual style...
                    </p>
                  )}

                  {styleError && (
                    <p className="prompt-panel-error">{styleError}</p>
                  )}

                  {styleDescription && !isAnalyzingStyle && (
                    <div className="style-description-toggle">
                      <button
                        className="style-description-btn"
                        onClick={() => setShowStyleDescription(v => !v)}
                      >
                        {styleMode === 'replicate' ? '🎯 Style ready to replicate' : '✓ Style detected'}
                        <span className="style-description-chevron">{showStyleDescription ? '▲' : '▼'}</span>
                      </button>
                      {showStyleDescription && (
                        <p className="style-description-text">{styleDescription}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="prompt-panel-input-row">
                  <input
                    type="text"
                    className="prompt-panel-input"
                    placeholder={styleMode === 'replicate' ? '(optional) adjust the scene...' : 'on a wooden table in a cozy café...'}
                    value={lifestylePrompt}
                    onChange={e => setLifestylePrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !isGeneratingLifestyle) handleGenerateLifestyle(); }}
                    disabled={isGeneratingLifestyle}
                  />
                  <button
                    className="prompt-panel-send"
                    onClick={handleGenerateLifestyle}
                    disabled={isGeneratingLifestyle || !lifestylePrompt.trim()}
                  >
                    {isGeneratingLifestyle ? (
                      <span className="btn-spinner" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3 15l12-6L3 3v5l8 1-8 1v5z" fill="currentColor"/>
                      </svg>
                    )}
                  </button>
                </div>
                {isGeneratingLifestyle && (
                  <p className="prompt-panel-status">Generating your lifestyle scene...</p>
                )}
                {lifestyleError && (
                  <p className="prompt-panel-error">{lifestyleError}</p>
                )}
              </div>
            )}

            {/* AI Edit prompt panel */}
            {showEdit && (
              <div className="prompt-panel">
                <div className="prompt-panel-header">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1.5l3 3-8.5 8.5H3v-3l8.5-8.5z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>AI Edit</span>
                  <div className="resolution-toggle" style={{ marginLeft: 'auto' }}>
                    <button className={`res-btn ${config.imageSize === '2K' ? 'active' : ''}`} onClick={() => updateConfig('imageSize', '2K')} disabled={isGeneratingEdit}>2K</button>
                    <button className={`res-btn ${config.imageSize === '4K' ? 'active' : ''}`} onClick={() => updateConfig('imageSize', '4K')} disabled={isGeneratingEdit}>4K</button>
                  </div>
                </div>
                <p className="prompt-panel-hint">Retouch or modify the studio image (e.g. "new angle", "remove scratch", "brighter lighting")</p>
                <div className="prompt-panel-input-row">
                  <input
                    type="text"
                    className="prompt-panel-input"
                    placeholder="new angle, retouch details, adjust lighting..."
                    value={editPrompt}
                    onChange={e => setEditPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !isGeneratingEdit) handleEditImage(); }}
                    disabled={isGeneratingEdit}
                  />
                  <button
                    className="prompt-panel-send"
                    onClick={handleEditImage}
                    disabled={isGeneratingEdit || !editPrompt.trim()}
                  >
                    {isGeneratingEdit ? (
                      <span className="btn-spinner" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M3 15l12-6L3 3v5l8 1-8 1v5z" fill="currentColor"/>
                      </svg>
                    )}
                  </button>
                </div>
                {isGeneratingEdit && (
                  <p className="prompt-panel-status">Applying edit...</p>
                )}
                {editError && (
                  <p className="prompt-panel-error">{editError}</p>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ===== Right Sidebar (same style as left) ===== */}
      {pipelineComplete && currentVariant && (
        <aside className="result-sidebar">
          {/* Top — project name + date */}
          <div className="result-sidebar-top">
            <span className="result-sidebar-name">
              {isFastMode ? 'Fast Generation' : project.name}
              {isDeleting && <span className="result-sidebar-saved" style={{ background: '#ff9800' }}>Saving…</span>}
              {saved && !isDeleting && <span className="result-sidebar-saved">Saved</span>}
            </span>
            <span className="result-sidebar-date">
              {project?.updatedAt
                ? new Date(project.updatedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
                : new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
              }
            </span>
          </div>

          {/* Actions — labeled buttons */}
          <div className="result-sidebar-tools">
            <button
              className={`sidebar-tool-btn ${showLifestyle ? 'active' : ''}`}
              onClick={() => { setShowLifestyle(prev => !prev); setShowEdit(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3 7a4 4 0 014-4h6a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V7z" stroke="currentColor" strokeWidth="1.4"/>
                <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
                <path d="M3 13l4-3.5 3 2.5 3-4 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Lifestyle
            </button>
            <button
              className={`sidebar-tool-btn ${showEdit ? 'active' : ''}`}
              onClick={() => { setShowEdit(prev => !prev); setShowLifestyle(false); }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M14.5 2.5l3 3-10 10H4.5v-3l10-10z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Edit
            </button>
            <button
              className="sidebar-tool-btn"
              onClick={handleRunPipeline}
              disabled={isRunning || !hasImage}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                <path d="M3.5 3.5v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 12.5a6 6 0 105-7.5H3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Redo
            </button>
          </div>

          {/* Spacer */}
          <div className="result-sidebar-spacer" />

          {/* Bottom — Download */}
          <div className="result-sidebar-bottom">
            <button
              className="sidebar-download-btn"
              onClick={() => downloadImage(currentVariant.image, downloadSuffix)}
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M9 3v8.5M5.5 8.5L9 12l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 14h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Download
            </button>
          </div>
        </aside>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {deleteConfirmKey && (
        <div className="confirm-overlay" onClick={() => setDeleteConfirmKey(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M7 9h14M11 9V7a2 2 0 012-2h2a2 2 0 012 2v2M18 9v11a2 2 0 01-2 2h-4a2 2 0 01-2-2V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="confirm-title">Supprimer cette image ?</h3>
            <p className="confirm-text">Cette action est irréversible.</p>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setDeleteConfirmKey(null)}>Annuler</button>
              <button className="confirm-btn-delete" onClick={confirmDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudioScreen;
