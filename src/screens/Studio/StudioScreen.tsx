/**
 * Photo Studio - Main Screen
 * Modern UI for the Studio Pro image processing pipeline.
 */

import React, { useState, useRef, useCallback } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import { runPipeline } from '../../services/pipeline/orchestrator';
import './StudioScreen.css';

// --- Step status indicator ---
function StepIndicator({ status }: { status: string }) {
  if (status === 'running') return <span className="step-dot running"><span className="dot-pulse" /></span>;
  if (status === 'completed') return <span className="step-dot completed"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
  if (status === 'error') return <span className="step-dot error"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></span>;
  return <span className="step-dot idle" />;
}

const StudioScreen: React.FC = () => {
  // --- State ---
  const [config, setConfig] = useState<PipelineConfig>({
    openaiApiKey: import.meta.env.VITE_OPENAI_API_KEY ?? '',
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY ?? '',
    falApiKey: import.meta.env.VITE_FAL_API_KEY ?? '',
    visionModel: 'gpt-4o',
    generationModel: DEFAULT_PIPELINE_CONFIG.generationModel!,
    imageSize: DEFAULT_PIPELINE_CONFIG.imageSize!,
    aspectRatio: DEFAULT_PIPELINE_CONFIG.aspectRatio!,
  });

  const [inputFile, setInputFile] = useState<File | null>(null);
  const [inputPreview, setInputPreview] = useState<string | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>(createInitialPipelineState());
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setPipelineState(createInitialPipelineState());
    try {
      await runPipeline({
        config,
        inputFile,
        onStateChange: (newState: PipelineState, _step: PipelineStep) => {
          setPipelineState({ ...newState });
        },
      });
    } catch (err) {
      console.error('Pipeline failed:', err);
    } finally {
      setIsRunning(false);
    }
  }, [inputFile, config]);

  const handleReset = useCallback(() => {
    setInputFile(null);
    setInputPreview(null);
    setPipelineState(createInitialPipelineState());
    setIsRunning(false);
  }, []);

  // --- Download Final ---
  const handleDownload = useCallback(() => {
    const finalData = pipelineState.autoCrop.data;
    if (!finalData) return;
    const result = finalData as { imageDataUrl: string };
    const link = document.createElement('a');
    link.href = result.imageDataUrl;
    link.download = `studio-${inputFile?.name ?? 'output'}.png`;
    link.click();
  }, [pipelineState.autoCrop.data, inputFile]);

  // --- Config Update ---
  const updateConfig = useCallback((field: keyof PipelineConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // --- Validation ---
  const missingItems: string[] = [];
  if (!inputFile) missingItems.push('Image');
  if (!config.openaiApiKey) missingItems.push('OpenAI Key');
  if (!config.geminiApiKey) missingItems.push('Gemini Key');
  if (!config.falApiKey) missingItems.push('Fal.ai Key');
  const canRun = missingItems.length === 0 && !isRunning;

  // --- Get image data from step result ---
  const getStepImage = (step: PipelineStep): string | null => {
    const result = pipelineState[step];
    if (result.status !== 'completed' || !result.data) return null;
    const data = result.data as unknown as Record<string, unknown>;
    return (data.imageDataUrl as string) ?? null;
  };

  // --- Progress calculation ---
  const completedSteps = PIPELINE_STEPS.filter(s => pipelineState[s.key].status === 'completed').length;
  const progressPercent = (completedSteps / PIPELINE_STEPS.length) * 100;

  // --- Render ---
  return (
    <div className="studio">
      {/* Header */}
      <header className="studio-header">
        <div className="header-left">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="url(#logo-grad)"/>
              <circle cx="14" cy="13" r="5" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="14" cy="13" r="2" fill="white"/>
              <rect x="8" y="7" width="12" height="1.5" rx="0.75" fill="white" opacity="0.5"/>
              <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                  <stop stopColor="#6366f1"/><stop offset="1" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="logo-text">Photo Studio</span>
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

        {/* Pipeline Progress */}
        {(isRunning || completedSteps > 0) && (
          <section className="pipeline-section">
            {/* Progress bar */}
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="steps-grid">
              {PIPELINE_STEPS.map(step => {
                const result = pipelineState[step.key];
                return (
                  <div key={step.key} className={`step-row ${result.status}`}>
                    <StepIndicator status={result.status} />
                    <span className="step-name">{step.label}</span>
                    {result.durationMs !== undefined && (
                      <span className="step-time">{(result.durationMs / 1000).toFixed(1)}s</span>
                    )}
                    {result.error && (
                      <span className="step-err" title={result.error}>{result.error}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Analysis Card */}
        {pipelineState.analysis.status === 'completed' && pipelineState.analysis.data && (
          <section className="card analysis-card">
            <h3>Product Analysis</h3>
            <pre className="analysis-content">
              {(pipelineState.analysis.data as { rawResponse: string }).rawResponse}
            </pre>
          </section>
        )}

        {/* Luminance Badge */}
        {pipelineState.luminanceCheck.status === 'completed' && pipelineState.luminanceCheck.data && (
          <div className="luminance-row">
            <span className={`lum-badge ${(pipelineState.luminanceCheck.data as string).toLowerCase()}`}>
              {pipelineState.luminanceCheck.data as string} Product
            </span>
          </div>
        )}

        {/* Results Gallery */}
        {pipelineState.studioGeneration.status === 'completed' && (
          <section className="gallery-section">
            <h3>Pipeline Results</h3>
            <div className="gallery-grid">
              {getStepImage('studioGeneration') && (
                <div className="gallery-item">
                  <span className="gallery-label">Studio Render</span>
                  <img src={getStepImage('studioGeneration')!} alt="Studio render" />
                </div>
              )}
              {getStepImage('retouch') && (
                <div className="gallery-item">
                  <span className="gallery-label">Color Graded</span>
                  <img src={getStepImage('retouch')!} alt="Retouched" />
                </div>
              )}
              {getStepImage('cutout') && (
                <div className="gallery-item">
                  <span className="gallery-label">Cutout</span>
                  <img src={getStepImage('cutout')!} alt="Cutout" />
                </div>
              )}
              {getStepImage('shadowComposite') && (
                <div className="gallery-item">
                  <span className="gallery-label">Shadow</span>
                  <img src={getStepImage('shadowComposite')!} alt="Shadow" />
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
