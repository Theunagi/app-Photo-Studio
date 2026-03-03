/**
 * Photo Studio - Studio Screen
 * Sidebar layout with pipeline viewer.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import type { Project } from '../../models/project';
import { runPipeline } from '../../services/pipeline/orchestrator';
import { editImage } from '../../services/api/falImageGen';
import { generateLifestyleImage } from '../../services/api/gemini';
import { supabase } from '../../services/db/supabase';
import { saveProject, getAllProjects } from '../../services/db/projectDB';
import { deductPoints, GENERATION_COST } from '../../services/db/points';
import './StudioScreen.css';

const MAX_IMAGES = 5;

/** Convert a data URL string to a File object so the pipeline can consume it */
function dataUrlToFile(dataUrl: string, fileName = 'restored-image.png'): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const bstr = atob(base64);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], fileName, { type: mime });
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
  onOpenStudio: (project: Project | null) => void;
  pointsBalance: number;
  onPointsChanged: () => void;
  userName?: string;
  userAvatar?: string;
  credits?: number;
  onSignOut?: () => void;
  onGoPricing?: () => void;
  onMassImport?: () => void;
}

const StudioScreen: React.FC<StudioScreenProps> = ({
  project, onBack, onOpenStudio, pointsBalance, onPointsChanged,
  userName = 'User', userAvatar, credits, onSignOut, onGoPricing, onMassImport,
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

    const restoreImageStep = (step: PipelineStep, dataUrl: string | undefined) => {
      if (!dataUrl) return;
      (state[step] as { status: string; data?: unknown }) = {
        status: 'completed',
        data: { imageDataUrl: dataUrl, imageBlob: new Blob() },
      };
    };

    if (r.inputImage) {
      (state.input as { status: string; data?: unknown }) = {
        status: 'completed',
        data: { imageDataUrl: r.inputImage, imageBlob: new Blob(), fileName: 'saved' },
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
    restoreImageStep('retouch', r.retouch);
    restoreImageStep('cutout', r.cutout);
    restoreImageStep('shadowComposite', r.shadowComposite);
    restoreImageStep('autoCrop', r.autoCrop);

    return state;
  };

  const buildInitialPreviews = (): string[] => {
    const previews: string[] = [];
    if (project?.results.inputImage) previews.push(project.results.inputImage);
    if (project?.results.inputImages) previews.push(...project.results.inputImages);
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
  const [lifestyleImages, setLifestyleImages] = useState<{ image: string; prompt: string }[]>(project?.results.lifestyles ?? []);
  const [isGeneratingLifestyle, setIsGeneratingLifestyle] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [editImages, setEditImages] = useState<{ image: string; prompt: string }[]>(project?.results.edits ?? []);
  const [isGeneratingEdit, setIsGeneratingEdit] = useState(false);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(project);
  const pipelineStateRef = useRef<PipelineState>(pipelineState);
  const inputPreviewsRef = useRef<string[]>(inputPreviews);
  const lifestyleImagesRef = useRef<{ image: string; prompt: string }[]>(lifestyleImages);
  const editImagesRef = useRef<{ image: string; prompt: string }[]>(editImages);

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { inputPreviewsRef.current = inputPreviews; }, [inputPreviews]);
  useEffect(() => { lifestyleImagesRef.current = lifestyleImages; }, [lifestyleImages]);
  useEffect(() => { editImagesRef.current = editImages; }, [editImages]);

  // Load recent projects for sidebar
  useEffect(() => {
    getAllProjects().then(list => setRecentProjects(list.slice(0, 3))).catch(() => {});
  }, []);

  // Derived: primary image is the first one
  const inputPreview = inputPreviews[0] ?? null;
  const inputFile = inputFiles[0] ?? null;

  // --- Auto-save project results after pipeline completes ---
  const autoSave = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;

    const state = pipelineStateRef.current;
    const previews = inputPreviewsRef.current;

    const getImg = (step: PipelineStep): string | undefined => {
      const r = state[step];
      if (r.status !== 'completed' || !r.data) return undefined;
      const d = r.data as unknown as Record<string, unknown>;
      return d.imageDataUrl as string | undefined;
    };

    p.results = {
      inputImage: previews[0] ?? undefined,
      inputImages: previews.length > 1 ? previews.slice(1) : undefined,
      analysis: state.analysis.status === 'completed' && state.analysis.data
        ? (state.analysis.data as { rawResponse: string }).rawResponse : undefined,
      luminanceClass: state.luminanceCheck.status === 'completed' && state.luminanceCheck.data
        ? (state.luminanceCheck.data as string) : undefined,
      studioGeneration: getImg('studioGeneration'),
      retouch: getImg('retouch'),
      cutout: getImg('cutout'),
      shadowComposite: getImg('shadowComposite'),
      autoCrop: getImg('autoCrop'),
      lifestyles: lifestyleImagesRef.current.length > 0 ? lifestyleImagesRef.current : undefined,
      edits: editImagesRef.current.length > 0 ? editImagesRef.current : undefined,
    };
    p.thumbnail = getImg('autoCrop') ?? getImg('retouch') ?? getImg('shadowComposite') ?? getImg('studioGeneration') ?? previews[0] ?? undefined;
    p.config = { imageSize: config.imageSize, aspectRatio: config.aspectRatio };
    p.updatedAt = Date.now();

    try {
      await saveProject(p);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }, [config.imageSize, config.aspectRatio]);

  // --- File Upload (multi-image) ---
  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: File[] = [];
    const readers: Promise<string>[] = [];

    const filesToAdd = Array.from(files).filter(f => f.type.startsWith('image/'));
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
  const handleRunPipeline = useCallback(async () => {
    // Use the real File if available, otherwise reconstruct from data URL preview
    const fileToUse = inputFile ?? (inputPreview ? dataUrlToFile(inputPreview, project?.name ?? 'restored-image.png') : null);
    if (!fileToUse) return;

    const cost = GENERATION_COST[config.imageSize] ?? 2;
    if (pointsBalance < cost) {
      alert(`Crédits insuffisants. Il faut ${cost} crédits pour une génération ${config.imageSize}. Vous avez ${pointsBalance} crédits.`);
      return;
    }

    try {
      await deductPoints(cost);
      onPointsChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deduct credits');
      return;
    }

    setIsRunning(true);
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
    } catch (err) {
      console.error('Pipeline failed:', err);
    } finally {
      setIsRunning(false);
      await autoSave();
    }
  }, [inputFile, inputPreview, inputPreviews, config, autoSave, pointsBalance, onPointsChanged, project?.name]);

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

  const confirmDelete = useCallback(() => {
    const variantKey = deleteConfirmKey;
    if (!variantKey) return;

    if (variantKey.startsWith('lifestyle-')) {
      const idx = parseInt(variantKey.replace('lifestyle-', ''), 10);
      const updated = lifestyleImages.filter((_, i) => i !== idx);
      setLifestyleImages(updated);
      lifestyleImagesRef.current = updated;
    } else if (variantKey.startsWith('edit-')) {
      const idx = parseInt(variantKey.replace('edit-', ''), 10);
      const updated = editImages.filter((_, i) => i !== idx);
      setEditImages(updated);
      editImagesRef.current = updated;
    }

    setDeleteConfirmKey(null);
    setActiveVariant('final');
    setTimeout(() => autoSave(), 100);
  }, [deleteConfirmKey, lifestyleImages, editImages, autoSave]);

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
    const parts = dataUrl.split(',');
    const bstr = atob(parts[1]);
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

  // --- Lifestyle Generation ---
  const handleGenerateLifestyle = useCallback(async () => {
    const sourceImage = getStepImage('autoCrop');
    if (!sourceImage || !lifestylePrompt.trim()) return;

    setIsGeneratingLifestyle(true);
    try {
      const imageUrl = await uploadForEdgeFunction(sourceImage, 'lifestyle-input');

      const response = await generateLifestyleImage(imageUrl, lifestylePrompt.trim(), {
        imageSize: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
      });

      const imgResponse = await fetch(response.resultImageUrl);
      const blob = await imgResponse.blob();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const newEntry = { image: imageDataUrl, prompt: lifestylePrompt.trim() };
      const updated = [...lifestyleImages, newEntry];
      setLifestyleImages(updated);
      lifestyleImagesRef.current = updated;
      setActiveVariant(`lifestyle-${lifestyleImages.length}`);
      setLifestylePrompt('');
      await autoSave();
    } catch (err) {
      console.error('Lifestyle generation failed:', err);
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
      const idx = parseInt(activeVariant.replace('edit-', ''), 10);
      sourceImage = editImages[idx]?.image ?? null;
    } else if (activeVariant.startsWith('lifestyle-')) {
      const idx = parseInt(activeVariant.replace('lifestyle-', ''), 10);
      sourceImage = lifestyleImages[idx]?.image ?? null;
    } else if (activeVariant === 'original') {
      sourceImage = inputPreviews[0] ?? null;
    } else if (activeVariant === 'cutout') {
      sourceImage = getStepImage('cutout');
    } else {
      sourceImage = getStepImage('autoCrop');
    }
    if (!sourceImage || !editPrompt.trim()) return;
    setIsGeneratingEdit(true);
    try {
      const imageUrl = await uploadForEdgeFunction(sourceImage, 'edit-input');

      const response = await editImage(imageUrl, editPrompt.trim());

      const imgResponse = await fetch(response.resultImageUrl);
      const blob = await imgResponse.blob();
      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const newEntry = { image: imageDataUrl, prompt: editPrompt.trim() };
      const updated = [...editImages, newEntry];
      setEditImages(updated);
      editImagesRef.current = updated;
      setActiveVariant(`edit-${editImages.length}`);
      setEditPrompt('');
      await autoSave();
    } catch (err) {
      console.error('Edit generation failed:', err);
    } finally {
      setIsGeneratingEdit(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPrompt, editImages, activeVariant, lifestyleImages, inputPreviews, autoSave, uploadForEdgeFunction]);

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

  // --- Progress calculation ---
  const completedSteps = PIPELINE_STEPS.filter(s => pipelineState[s.key].status === 'completed').length;
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
  type Variant = { key: string; label: string; image: string };
  const resultVariants: Variant[] = pipelineComplete ? (() => {
    const base: Variant[] = [
      ...(inputPreview ? [{ key: 'original', label: 'Original', image: inputPreview }] : []),
      { key: 'final', label: 'Final', image: getStepImage('autoCrop')! },
      { key: 'cutout', label: 'Cutout', image: getStepImage('cutout')! },
    ].filter(v => v.image != null);
    const lifeV: Variant[] = lifestyleImages.map((li, i) => ({ key: `lifestyle-${i}`, label: `Lifestyle ${i + 1}`, image: li.image }));
    const editV: Variant[] = editImages.map((ei, i) => ({ key: `edit-${i}`, label: `Edit ${i + 1}`, image: ei.image }));
    return [...base, ...lifeV, ...editV];
  })() : [];
  const currentVariant = resultVariants.find(v => v.key === activeVariant) ?? resultVariants.find(v => v.key === 'final') ?? resultVariants[0];
  const downloadSuffix = currentVariant?.key ?? 'final';

  // --- Render ---
  return (
    <div className="studio">
      {/* ===== Sidebar ===== */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <svg className="sidebar-logo-icon" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="14" cy="14" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="20" cy="8" r="2" fill="currentColor"/>
          </svg>
          <span className="sidebar-logo-text">Photo Studio</span>
        </div>

        {/* Actions */}
        <div className="sidebar-actions">
          <button className="sidebar-btn-primary" onClick={onBack}>
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
          <button className="sidebar-bottom-btn" onClick={onGoPricing}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M8 5v6M5.5 7.5l2.5-2.5 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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

        {/* Result Viewer */}
        {pipelineComplete && currentVariant && (
          <section className="result-viewer">
            <div className="result-layout">
              <div className="result-card">
                <div className="result-canvas">
                  <img src={currentVariant.image} alt={currentVariant.label} className="result-canvas-img" />

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

            {/* Lifestyle prompt panel */}
            {showLifestyle && (
              <div className="prompt-panel">
                <div className="prompt-panel-header">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z" fill="currentColor"/>
                  </svg>
                  <span>Generate Lifestyle</span>
                </div>
                <p className="prompt-panel-hint">Describe the scene for your product (e.g. "on a marble kitchen counter with soft morning light")</p>
                <div className="prompt-panel-input-row">
                  <input
                    type="text"
                    className="prompt-panel-input"
                    placeholder="on a wooden table in a cozy café..."
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
              {saved && <span className="result-sidebar-saved">Saved</span>}
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
