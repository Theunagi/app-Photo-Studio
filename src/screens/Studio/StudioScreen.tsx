/**
 * Photo Studio - Studio Screen
 * Pipeline UI with optional project save.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import type { Project } from '../../models/project';
import { runPipeline } from '../../services/pipeline/orchestrator';
import { saveProject } from '../../services/db/projectDB';
import './StudioScreen.css';

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

  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputPreview, setInputPreview] = useState<string | null>(project?.results.inputImage ?? null);
  const [pipelineState, setPipelineState] = useState<PipelineState>(buildRestoredState);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectRef = useRef<Project | null>(project);
  const pipelineStateRef = useRef<PipelineState>(pipelineState);
  const inputPreviewRef = useRef<string | null>(inputPreview);

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { inputPreviewRef.current = inputPreview; }, [inputPreview]);

  // --- Auto-save project results after pipeline completes (or partially completes) ---
  const autoSave = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return; // Fast generation — no save

    const state = pipelineStateRef.current;
    const preview = inputPreviewRef.current;

    const getImg = (step: PipelineStep): string | undefined => {
      const r = state[step];
      if (r.status !== 'completed' || !r.data) return undefined;
      const d = r.data as unknown as Record<string, unknown>;
      return d.imageDataUrl as string | undefined;
    };

    p.results = {
      inputImage: preview ?? undefined,
      analysis: state.analysis.status === 'completed' && state.analysis.data
        ? (state.analysis.data as { rawResponse: string }).rawResponse : undefined,
      luminanceClass: state.luminanceCheck.status === 'completed' && state.luminanceCheck.data
        ? (state.luminanceCheck.data as string) : undefined,
      studioGeneration: getImg('studioGeneration'),
      retouch: getImg('retouch'),
      cutout: getImg('cutout'),
      shadowComposite: getImg('shadowComposite'),
      autoCrop: getImg('autoCrop'),
    };
    // Use final output or studio render as thumbnail
    p.thumbnail = getImg('autoCrop') ?? getImg('studioGeneration') ?? preview ?? undefined;
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

  // --- File Upload ---
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInputFile(file);
    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPipelineState(createInitialPipelineState());
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setInputFile(file);
    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPipelineState(createInitialPipelineState());
  }, []);

  // --- Pipeline Execution ---
  const handleRunPipeline = useCallback(async () => {
    if (!inputFile) return;
    setIsRunning(true);
    const freshState = createInitialPipelineState();
    setPipelineState(freshState);
    pipelineStateRef.current = freshState;
    try {
      const result = await runPipeline({
        config,
        inputFile,
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
  }, [inputFile, config, autoSave]);

  const handleReset = useCallback(() => {
    setInputFile(null);
    setInputPreview(null);
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

  const handleDownload = useCallback(() => {
    const img = getStepImage('autoCrop');
    if (img) downloadImage(img, 'final');
  }, [pipelineState.autoCrop.data, downloadImage]);

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

  // --- Validation ---
  const missingItems: string[] = [];
  if (!inputFile && !inputPreview) missingItems.push('Image');
  if (!config.openaiApiKey) missingItems.push('OpenAI Key');
  if (!config.geminiApiKey) missingItems.push('Gemini Key');
  if (!config.falApiKey) missingItems.push('Fal.ai Key');
  const canRun = missingItems.length === 0 && !isRunning && !!inputFile;

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
  const progressMessage = hasError
    ? 'An error occurred during processing'
    : completedSteps >= totalSteps
      ? 'Generation complete'
      : PROGRESS_MESSAGES[Math.min(completedSteps, PROGRESS_MESSAGES.length - 1)];

  const isFastMode = !project;

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

      <main className="studio-main">
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

        {/* Upload + Controls Section */}
        <section className="upload-section">
          <div
            className={`dropzone ${inputPreview ? 'has-image' : ''} ${isDragging ? 'dragging' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            {inputPreview ? (
              <img src={inputPreview} alt="Input" className="dropzone-preview" />
            ) : (
              <div className="dropzone-placeholder">
                <div className="dropzone-icon">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <path d="M20 8v24M8 20h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="dropzone-title">Drop your product photo</p>
                <p className="dropzone-hint">or click to browse</p>
              </div>
            )}
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

              {missingItems.length > 0 && !isRunning && (
                <span className="missing-hint">
                  {missingItems.join(' + ')} required
                </span>
              )}
            </div>

            <div className="controls-right">
              {(inputFile || completedSteps > 0) && (
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

        {/* Available Downloads */}
        {pipelineState.cutout.status === 'completed' && (
          <section className="gallery-section">
            <h3>Available Downloads</h3>
            <div className="gallery-grid">
              {getStepImage('cutout') && (
                <div className="gallery-item">
                  <span className="gallery-label">Cutout</span>
                  <img src={getStepImage('cutout')!} alt="Cutout" />
                  <button
                    className="gallery-download"
                    onClick={e => { e.stopPropagation(); downloadImage(getStepImage('cutout')!, 'cutout'); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    PNG
                  </button>
                </div>
              )}
              {getStepImage('shadowComposite') && (
                <div className="gallery-item">
                  <span className="gallery-label">Shadow</span>
                  <img src={getStepImage('shadowComposite')!} alt="Shadow" />
                  <button
                    className="gallery-download"
                    onClick={e => { e.stopPropagation(); downloadImage(getStepImage('shadowComposite')!, 'shadow'); }}
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v9M4 8l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    PNG
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Final Output */}
        {pipelineState.autoCrop.status === 'completed' && getStepImage('autoCrop') && (
          <section className="final-section">
            <h3>Final Output</h3>
            <div className="final-frame">
              <img src={getStepImage('autoCrop')!} alt="Final output" className="final-img" />
            </div>
            <button className="btn-download" onClick={handleDownload}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v9M4 8l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download PNG
            </button>
          </section>
        )}
      </main>
    </div>
  );
};

export default StudioScreen;
