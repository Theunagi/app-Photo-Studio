/**
 * Studio Pro - Front Full Pipeline Screen
 *
 * Hybrid pipeline: LLM Vision + Generative AI + DSP
 * Upload a product photo (front view) and get a studio-quality render.
 */

import React, { useState, useRef, useCallback } from 'react';
import type { PipelineConfig, PipelineState, PipelineStep } from '../../models/pipeline';
import { PIPELINE_STEPS, createInitialPipelineState, DEFAULT_PIPELINE_CONFIG } from '../../models/pipeline';
import { runPipeline } from '../../services/pipeline/orchestrator';
import './StudioScreen.css';

// --- Status icon helper ---
function statusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'idle': return <span className="step-status-icon">-</span>;
    case 'running': return <span className="step-status-icon"><span className="spinner" /></span>;
    case 'completed': return <span className="step-status-icon">+</span>;
    case 'error': return <span className="step-status-icon">x</span>;
    default: return <span className="step-status-icon">-</span>;
  }
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- File Upload ---
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInputFile(file);
    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result as string);
    reader.readAsDataURL(file);
    // Reset pipeline state
    setPipelineState(createInitialPipelineState());
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setInputFile(file);
    const reader = new FileReader();
    reader.onload = () => setInputPreview(reader.result as string);
    reader.readAsDataURL(file);
    setPipelineState(createInitialPipelineState());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
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
    link.download = `studio-pro-${inputFile?.name ?? 'output'}.png`;
    link.click();
  }, [pipelineState.autoCrop.data, inputFile]);

  // --- Config Update ---
  const updateConfig = useCallback((field: keyof PipelineConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  // --- Validation ---
  const canRun = inputFile && config.openaiApiKey && config.geminiApiKey && config.falApiKey && !isRunning;

  // --- Get image data from step result ---
  const getStepImage = (step: PipelineStep): string | null => {
    const result = pipelineState[step];
    if (result.status !== 'completed' || !result.data) return null;
    const data = result.data as unknown as Record<string, unknown>;
    return (data.imageDataUrl as string) ?? null;
  };

  // --- Render ---
  return (
    <div className="screen studio-screen">
      <div className="screen-content">
        <h1 className="screen-title">Studio Pro - Front Pipeline</h1>
        <p className="screen-subtitle">
          Product photo to studio-quality render in 7 steps
        </p>

        {/* API Configuration */}
        <details className="api-config card">
          <summary>API Keys Configuration</summary>
          <div className="api-config-fields">
            <label>
              OpenAI API Key
              <input
                type="password"
                placeholder="sk-proj-..."
                value={config.openaiApiKey}
                onChange={e => updateConfig('openaiApiKey', e.target.value)}
              />
            </label>
            <label>
              Gemini API Key
              <input
                type="password"
                placeholder="AI..."
                value={config.geminiApiKey}
                onChange={e => updateConfig('geminiApiKey', e.target.value)}
              />
            </label>
            <label>
              Fal.ai API Key
              <input
                type="password"
                placeholder="84f7d31a..."
                value={config.falApiKey}
                onChange={e => updateConfig('falApiKey', e.target.value)}
              />
            </label>
          </div>
        </details>

        {/* Upload Area */}
        <div
          className={`upload-area ${inputPreview ? 'has-image' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {inputPreview ? (
            <img src={inputPreview} alt="Input preview" className="preview-image" />
          ) : (
            <>
              <span className="upload-icon">+</span>
              <p className="upload-text">
                <strong>Click or drag</strong> to upload a product photo (front view)
              </p>
            </>
          )}
        </div>

        {/* Pipeline Controls */}
        <div className="pipeline-controls">
          <button
            className="btn btn-run"
            onClick={handleRunPipeline}
            disabled={!canRun}
          >
            {isRunning ? 'Processing...' : 'Run Pipeline'}
          </button>
          <button
            className="btn btn-reset"
            onClick={handleReset}
          >
            Reset
          </button>
        </div>

        {/* Pipeline Steps Tracker */}
        <div className="pipeline-tracker card">
          <h3>Pipeline Progress</h3>
          <div className="step-list">
            {PIPELINE_STEPS.map(step => {
              const result = pipelineState[step.key];
              return (
                <div key={step.key} className={`step-item ${result.status}`}>
                  {statusIcon(result.status)}
                  <span className="step-label">{step.label}</span>
                  {result.durationMs !== undefined && (
                    <span className="step-duration">{(result.durationMs / 1000).toFixed(1)}s</span>
                  )}
                  {result.error && (
                    <span className="step-error" title={result.error}>{result.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Analysis Results */}
        {pipelineState.analysis.status === 'completed' && pipelineState.analysis.data && (
          <div className="card" style={{ marginTop: 'var(--spacing-md)' }}>
            <h3>Product Analysis</h3>
            <div className="analysis-text">
              {(pipelineState.analysis.data as { rawResponse: string }).rawResponse}
            </div>
          </div>
        )}

        {/* Luminance Result */}
        {pipelineState.luminanceCheck.status === 'completed' && pipelineState.luminanceCheck.data && (
          <div style={{ textAlign: 'center', marginTop: 'var(--spacing-md)' }}>
            <span className={`luminance-badge ${(pipelineState.luminanceCheck.data as string).toLowerCase()}`}>
              Product: {pipelineState.luminanceCheck.data as string}
            </span>
          </div>
        )}

        {/* Intermediate Results Gallery */}
        {pipelineState.studioGeneration.status === 'completed' && (
          <div className="results-gallery">
            <h3>Pipeline Outputs</h3>
            <div className="results-grid">
              {/* Step 2: Studio Generation */}
              {getStepImage('studioGeneration') && (
                <div className="result-card">
                  <h4>Step 2: Studio Render</h4>
                  <img src={getStepImage('studioGeneration')!} alt="Studio render" className="result-image" />
                  {pipelineState.studioGeneration.durationMs && (
                    <span className="step-duration">{(pipelineState.studioGeneration.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Step 4: Retouch */}
              {getStepImage('retouch') && (
                <div className="result-card">
                  <h4>Step 4: Color Graded</h4>
                  <img src={getStepImage('retouch')!} alt="Retouched" className="result-image" />
                  {pipelineState.retouch.durationMs && (
                    <span className="step-duration">{(pipelineState.retouch.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Step 5: Cutout */}
              {getStepImage('cutout') && (
                <div className="result-card">
                  <h4>Step 5: Cutout</h4>
                  <img src={getStepImage('cutout')!} alt="Cutout" className="result-image" />
                  {pipelineState.cutout.durationMs && (
                    <span className="step-duration">{(pipelineState.cutout.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}

              {/* Step 6: Shadow Composite */}
              {getStepImage('shadowComposite') && (
                <div className="result-card">
                  <h4>Step 6: Shadow Composed</h4>
                  <img src={getStepImage('shadowComposite')!} alt="Shadow composite" className="result-image" />
                  {pipelineState.shadowComposite.durationMs && (
                    <span className="step-duration">{(pipelineState.shadowComposite.durationMs / 1000).toFixed(1)}s</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final Output */}
        {pipelineState.autoCrop.status === 'completed' && getStepImage('autoCrop') && (
          <div className="final-output">
            <h3>Final Output</h3>
            <img src={getStepImage('autoCrop')!} alt="Final output" className="final-image" />
            <br />
            <button className="btn download-btn" onClick={handleDownload}>
              Download PNG
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudioScreen;
