/**
 * Photo Studio - Studio Screen
 * Pipeline UI with optional project save.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import type { Project } from '../../models/project';
import { runPipeline } from '../../services/pipeline/orchestrator';
import { callGeminiImageGen } from '../../services/api/gemini';
import { saveProject } from '../../services/db/projectDB';
import './StudioScreen.css';

const MAX_IMAGES = 5;

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
}

const StudioScreen: React.FC<StudioScreenProps> = ({ project, onBack }) => {
  // --- State ---
  const [config, setConfig] = useState<PipelineConfig>({
    openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
    falApiKey: import.meta.env.VITE_FAL_API_KEY ?? '',
    visionModel: 'gpt-4o',
    generationModel: DEFAULT_PIPELINE_CONFIG.generationModel!,
    imageSize: project?.config.imageSize ?? DEFAULT_PIPELINE_CONFIG.imageSize!,
    aspectRatio: project?.config.aspectRatio ?? DEFAULT_PIPELINE_CONFIG.aspectRatio!,
    outputFormat: DEFAULT_PIPELINE_CONFIG.outputFormat!,
  });

  // --- Restore saved results into initial pipeline state ---
  const buildRestoredState = (): PipelineState => {
    if (!project?.results) return createInitialPipelineState();
    const r = project.results;
    const state = createInitialPipelineState();

    // Helper: mark a step as completed with saved image data
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

  // Build initial previews from saved project
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
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeVariant, setActiveVariant] = useState<string>('final');
  const [showLifestyle, setShowLifestyle] = useState(false);
  const [lifestylePrompt, setLifestylePrompt] = useState('');
  const [lifestyleImages, setLifestyleImages] = useState<{ image: string; prompt: string }[]>(project?.results.lifestyles ?? []);
  const [isGeneratingLifestyle, setIsGeneratingLifestyle] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(project);
  const pipelineStateRef = useRef<PipelineState>(pipelineState);
  const inputPreviewsRef = useRef<string[]>(inputPreviews);
  const lifestyleImagesRef = useRef<{ image: string; prompt: string }[]>(lifestyleImages);

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { inputPreviewsRef.current = inputPreviews; }, [inputPreviews]);
  useEffect(() => { lifestyleImagesRef.current = lifestyleImages; }, [lifestyleImages]);

  // Derived: primary image is the first one
  const inputPreview = inputPreviews[0] ?? null;
  const inputFile = inputFiles[0] ?? null;

  // --- Auto-save project results after pipeline completes (or partially completes) ---
  const autoSave = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return; // Fast generation — no save

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
    };
    // Use final output or studio render as thumbnail
    p.thumbnail = getImg('autoCrop') ?? getImg('studioGeneration') ?? previews[0] ?? undefined;
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
      // Reset pipeline when images change
      if (inputPreviews.length === 0) {
        setPipelineState(createInitialPipelineState());
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputPreviews.length]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Reset input value so same file can be re-selected
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
    if (!inputFile) return;
    setIsRunning(true);
    const freshState = createInitialPipelineState();
    setPipelineState(freshState);
    pipelineStateRef.current = freshState;

    // Additional reference image data URLs (all except the first)
    const additionalImageDataUrls = inputPreviews.length > 1 ? inputPreviews.slice(1) : undefined;

    try {
      const result = await runPipeline({
        config,
        inputFile,
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
      // Always save — even partial results are valuable
      await autoSave();
    }
  }, [inputFile, inputPreviews, config, autoSave]);

  const handleReset = useCallback(() => {
    setInputFiles([]);
    setInputPreviews([]);
    setPipelineState(createInitialPipelineState());
    setIsRunning(false);
  }, []);

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
        ? 'transparent-shadow'   // turning shadow ON
        : 'transparent-clean',   // turning shadow OFF
    }));
  }, []);

  const toggleWhiteBg = useCallback(() => {
    setConfig(prev => ({
      ...prev,
      outputFormat: prev.outputFormat === 'white-shadow'
        ? 'transparent-shadow'   // turning white bg OFF
        : 'white-shadow',        // turning white bg ON
    }));
  }, []);

  // --- Lifestyle Generation ---
  const handleGenerateLifestyle = useCallback(async () => {
    const sourceImage = getStepImage('autoCrop');
    if (!sourceImage || !lifestylePrompt.trim() || !config.geminiApiKey) return;

    setIsGeneratingLifestyle(true);
    try {
      const prompt = `Using this product image on white background as reference, generate a lifestyle photo of this product ${lifestylePrompt.trim()}.
The product must remain photorealistic and true to the original. Create a beautiful, editorial-quality lifestyle scene.
Keep the product as the hero/focus of the image. The scene should feel natural, aspirational, and commercially appealing.
High-end product photography style, natural lighting, shallow depth of field where appropriate.`;

      const response = await callGeminiImageGen({
        apiKey: config.geminiApiKey,
        imageDataUrl: sourceImage,
        prompt,
        model: config.generationModel ?? 'gemini-3-pro-image-preview',
        imageSize: config.imageSize ?? '2K',
        aspectRatio: config.aspectRatio ?? '1:1',
      });

      const newEntry = { image: response.imageDataUrl, prompt: lifestylePrompt.trim() };
      const updated = [...lifestyleImages, newEntry];
      setLifestyleImages(updated);
      lifestyleImagesRef.current = updated;
      setActiveVariant(`lifestyle-${lifestyleImages.length}`);
      setLifestylePrompt('');
      // Save lifestyle to project
      await autoSave();
    } catch (err) {
      console.error('Lifestyle generation failed:', err);
    } finally {
      setIsGeneratingLifestyle(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifestylePrompt, config.geminiApiKey, config.generationModel, config.imageSize, config.aspectRatio, lifestyleImages, autoSave]);

  // --- Validation ---
  const missingItems: string[] = [];
  if (inputPreviews.length === 0 && inputFiles.length === 0) missingItems.push('Image');
  if (!config.openaiApiKey) missingItems.push('OpenAI Key');
  if (!config.geminiApiKey) missingItems.push('Gemini Key');
  if (!config.falApiKey) missingItems.push('Fal.ai Key');
  const canRun = missingItems.length === 0 && !isRunning && (!!inputFile || inputPreviews.length > 0);

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

  // --- Render ---
  return (
    <div className="studio">
      {/* Header */}
      <header className="studio-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack} title="Back to projects">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="header-title-group">
            <span className="header-title">
              {isFastMode ? 'Fast Generation' : project.name}
            </span>
            {isFastMode && (
              <span className="header-badge fast">FAST</span>
            )}
            {!isFastMode && saved && (
              <span className="header-badge saved">Saved</span>
            )}
          </div>
        </div>
        <div className="header-right">
          <button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M9 1.5V3M9 15v1.5M1.5 9H3M15 9h1.5M3.4 3.4l1.1 1.1M13.5 13.5l1.1 1.1M3.4 14.6l1.1-1.1M13.5 4.5l1.1-1.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      <main className={`studio-main ${pipelineComplete ? 'studio-main--results' : ''}`}>
        {/* Settings Panel */}
        {showSettings && (
          <section className="settings-panel">
            <div className="settings-grid">
              <div className="setting-field">
                <label>OpenAI API Key</label>
                <input
                  type="text"
                  placeholder="sk-proj-..."
                  value={config.openaiApiKey}
                  onChange={e => updateConfig('openaiApiKey', e.target.value)}
                />
              </div>
              <div className="setting-field">
                <label>Gemini API Key</label>
                <input
                  type="text"
                  placeholder="AI..."
                  value={config.geminiApiKey}
                  onChange={e => updateConfig('geminiApiKey', e.target.value)}
                />
              </div>
              <div className="setting-field">
                <label>Fal.ai API Key</label>
                <input
                  type="text"
                  placeholder="xxxxxxxx-xxxx-..."
                  value={config.falApiKey}
                  onChange={e => updateConfig('falApiKey', e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

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

                {missingItems.length > 0 && !isRunning && (
                  <span className="missing-hint">
                    {missingItems.join(' + ')} required
                  </span>
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
                    'Generate'
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
        {pipelineComplete && (() => {
          type Variant = { key: string; label: string; image: string };
          const base: Variant[] = [
            ...(inputPreview ? [{ key: 'original', label: 'Original', image: inputPreview }] : []),
            { key: 'final', label: 'Final', image: getStepImage('autoCrop')! },
            { key: 'cutout', label: 'Cutout', image: getStepImage('cutout')! },
            { key: 'shadow', label: 'Shadow', image: getStepImage('shadowComposite')! },
          ].filter(v => v.image != null);

          const lifeVariants: Variant[] = lifestyleImages.map((li, i) => ({
            key: `lifestyle-${i}`,
            label: `Lifestyle ${i + 1}`,
            image: li.image,
          }));
          const variants = [...base, ...lifeVariants];
          const current = variants.find(v => v.key === activeVariant) ?? variants.find(v => v.key === 'final') ?? variants[0];
          const downloadSuffix = current.key;

          return (
            <section className="result-viewer">
              <div className="result-layout">
                {/* Main image area */}
                <div className="result-main">
                  <img src={current.image} alt={current.label} className="result-main-img" />

                  {/* Thumbnail strip - bottom left */}
                  {variants.length > 1 && (
                    <div className="result-thumbs">
                      {variants.map(v => (
                        <button
                          key={v.key}
                          className={`result-thumb ${v.key === (current.key) ? 'active' : ''}`}
                          onClick={() => setActiveVariant(v.key)}
                          title={v.label}
                        >
                          <img src={v.image} alt={v.label} />
                          <span className="thumb-label">{v.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Download button - bottom right */}
                  <button
                    className="result-download"
                    onClick={() => downloadImage(current.image, downloadSuffix)}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v9M4 8l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download {current.label}
                  </button>
                </div>

                {/* Side action bar */}
                <div className="result-sidebar">
                  <button
                    className={`sidebar-action ${showLifestyle ? 'active' : ''}`}
                    onClick={() => setShowLifestyle(prev => !prev)}
                    title="Generate lifestyle photo"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3 7a4 4 0 014-4h6a4 4 0 014 4v6a4 4 0 01-4 4H7a4 4 0 01-4-4V7z" stroke="currentColor" strokeWidth="1.4"/>
                      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/>
                      <path d="M3 13l4-3.5 3 2.5 3-4 4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>Lifestyle</span>
                  </button>

                  <button
                    className="sidebar-action"
                    onClick={handleRunPipeline}
                    disabled={isRunning || !inputFile}
                    title="Regenerate base image"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M3.5 10a6.5 6.5 0 0111.3-4.4M16.5 10a6.5 6.5 0 01-11.3 4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <path d="M14 2.5v4h-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 17.5v-4h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{isRunning ? '...' : 'Redo'}</span>
                  </button>
                </div>
              </div>

              {/* Lifestyle prompt panel */}
              {showLifestyle && (
                <div className="lifestyle-panel">
                  <div className="lifestyle-header">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M8 1l2.1 4.3 4.7.7-3.4 3.3.8 4.7L8 11.8 3.8 14l.8-4.7L1.2 6l4.7-.7L8 1z" fill="currentColor"/>
                    </svg>
                    <span>Generate Lifestyle</span>
                  </div>
                  <p className="lifestyle-hint">Describe the scene for your product (e.g. "on a marble kitchen counter with soft morning light")</p>
                  <div className="lifestyle-input-row">
                    <input
                      type="text"
                      className="lifestyle-input"
                      placeholder="on a wooden table in a cozy café..."
                      value={lifestylePrompt}
                      onChange={e => setLifestylePrompt(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !isGeneratingLifestyle) handleGenerateLifestyle(); }}
                      disabled={isGeneratingLifestyle}
                    />
                    <button
                      className="lifestyle-generate"
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
                    <p className="lifestyle-status">Generating your lifestyle scene...</p>
                  )}
                </div>
              )}
            </section>
          );
        })()}
      </main>
    </div>
  );
};

export default StudioScreen;
