import React, { useState, useCallback, useRef } from 'react';
import type { ImageGroup, GroupingResult } from '../../services/api/imageGrouping';
import { groupImagesByAI, parseFileName } from '../../services/api/imageGrouping';
import { createCollection } from '../../models/collection';
import type { Collection } from '../../models/collection';
import { createProject } from '../../models/project';
import { saveProject } from '../../services/db/projectDB';
import { saveCollection } from '../../services/db/collectionDB';
import { deductPoints, GENERATION_COST } from '../../services/db/points';
import { runPipeline } from '../../services/pipeline/orchestrator';
import type { PipelineState, PipelineStep } from '../../models/pipeline';
import DropZone from './components/DropZone';
import GroupingView from './components/GroupingView';
import BatchProgress, { type BatchProjectStatus } from './components/BatchProgress';
import './UploadScreen.css';

type Step = 'drop' | 'grouping' | 'batch';

interface UploadScreenProps {
  onBack: () => void;
  onDone: (collectionId: string) => void;
  creditsAvailable: number;
  onCreditsChanged: () => void;
}

const UploadScreen: React.FC<UploadScreenProps> = ({
  onBack,
  onDone,
  creditsAvailable,
  onCreditsChanged,
}) => {
  const [step, setStep] = useState<Step>('drop');
  const [files, setFiles] = useState<File[]>([]);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [groupingResult, setGroupingResult] = useState<GroupingResult | null>(null);
  const [groupingStatus, setGroupingStatus] = useState<string>('');
  const [collectionName, setCollectionName] = useState('');
  const [batchStatuses, setBatchStatuses] = useState<BatchProjectStatus[]>([]);
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [collection, setCollection] = useState<Collection | null>(null);
  // Pause/resume not yet wired; kept as state for future use
  const [isPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const [batchImageSize, setBatchImageSize] = useState<'2K' | '4K'>('2K');
  const CREDITS_PER_PROJECT = GENERATION_COST[batchImageSize] ?? 2;

  // Step 1: Files selected from DropZone
  const handleFilesSelected = useCallback(async (selectedFiles: File[]) => {
    setFiles(selectedFiles);

    // Generate thumbnails for preview
    const thumbs: string[] = [];
    for (const f of selectedFiles) {
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(f);
      });
      thumbs.push(url);
    }
    setThumbnails(thumbs);

    // Auto-generate collection name from first file or date
    if (!collectionName) {
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setCollectionName(`Import ${today}`);
    }

    // Start AI grouping
    setStep('grouping');
    setGroupingStatus('Analyzing images...');

    try {
      const result = await groupImagesByAI(selectedFiles, setGroupingStatus);
      setGroupingResult(result);
      setGroupingStatus('');
    } catch (err) {
      console.error('Grouping failed:', err);
      // Fallback: each image = its own group
      setGroupingResult({
        groups: selectedFiles.map((f, i) => ({
          name: parseFileName(f.name),
          imageIndices: [i],
          primaryIndex: i,
        })),
        ungroupedIndices: [],
      });
      setGroupingStatus('');
    }
  }, [collectionName]);

  // Step 2 -> Step 3: Launch batch
  const handleLaunchBatch = useCallback(async (groups: ImageGroup[], imageSize: '2K' | '4K' = '2K') => {
    setBatchImageSize(imageSize);
    setStep('batch');

    // Create collection
    const col = createCollection(collectionName || 'Untitled Import');
    col.projectCount = groups.length;
    setCollection(col);
    await saveCollection(col);

    // Initialize batch statuses
    const statuses: BatchProjectStatus[] = groups.map(g => ({
      name: g.name,
      status: 'queued',
    }));
    setBatchStatuses([...statuses]);

    // Process each group sequentially
    const abort = new AbortController();
    abortRef.current = abort;
    let used = 0;

    for (let i = 0; i < groups.length; i++) {
      if (abort.signal.aborted) break;

      const group = groups[i];
      statuses[i] = { ...statuses[i], status: 'running', progress: 0 };
      setBatchStatuses([...statuses]);

      try {
        // Deduct credits before running pipeline
        try {
          await deductPoints(GENERATION_COST[imageSize] ?? 2);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Insufficient credits';
          statuses[i] = { ...statuses[i], status: 'error', error: errMsg };
          setBatchStatuses([...statuses]);
          continue;
        }

        // Create project
        const project = createProject(group.name);
        project.collectionId = col.id;

        // Get primary image file
        const primaryFile = files[group.primaryIndex];

        // Get additional image data URLs
        const additionalDataUrls = group.imageIndices
          .filter(idx => idx !== group.primaryIndex)
          .map(idx => thumbnails[idx]);

        // Map pipeline steps to progress percentage
        const stepProgressMap: Record<string, number> = {
          input: 5, analysis: 15, studioGeneration: 50,
          luminanceCheck: 55, retouch: 65, cutout: 80,
          shadowComposite: 90, autoCrop: 100,
        };

        // Run pipeline
        const state = await runPipeline({
          config: {
            imageSize: imageSize,
            aspectRatio: '1:1',
            outputFormat: 'transparent-shadow',
            sessionId: project.id,
          },
          inputFile: primaryFile,
          additionalImageDataUrls: additionalDataUrls.length > 0 ? additionalDataUrls : undefined,
          onStateChange: (_pState: PipelineState, pStep: PipelineStep) => {
            const progress = stepProgressMap[pStep] ?? 0;
            statuses[i] = { ...statuses[i], progress };
            setBatchStatuses([...statuses]);
          },
          abortSignal: abort.signal,
        });

        // Save project with results
        project.results = {
          inputImage: state.input?.data?.imageDataUrl,
          analysis: state.analysis?.data?.description,
          luminanceClass: state.luminanceCheck?.data as string,
          studioGeneration: state.studioGeneration?.data?.imageDataUrl,
          retouch: state.retouch?.data?.imageDataUrl,
          cutout: state.cutout?.data?.imageDataUrl,
          shadowComposite: state.shadowComposite?.data?.imageDataUrl,
          autoCrop: state.autoCrop?.data?.imageDataUrl,
        };
        project.thumbnail = state.autoCrop?.data?.imageDataUrl
          ?? state.retouch?.data?.imageDataUrl
          ?? state.shadowComposite?.data?.imageDataUrl
          ?? state.studioGeneration?.data?.imageDataUrl
          ?? state.input?.data?.imageDataUrl;
        await saveProject(project);

        statuses[i] = { ...statuses[i], status: 'completed', progress: 100 };
        used += CREDITS_PER_PROJECT;
        setCreditsUsed(used);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        statuses[i] = { ...statuses[i], status: 'error', error: errorMsg };
      }

      setBatchStatuses([...statuses]);
    }

    onCreditsChanged();
  }, [files, thumbnails, collectionName, onCreditsChanged]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleDone = useCallback(() => {
    if (collection) {
      onDone(collection.id);
    } else {
      onBack();
    }
  }, [collection, onDone, onBack]);

  return (
    <div className="upload-screen">
      {/* Top bar */}
      <div className="upload-topbar">
        <button className="upload-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to Gallery
        </button>
        <h1 className="upload-title">Mass Import</h1>
        <div className="upload-topbar-right">
          {step === 'drop' && (
            <input
              type="text"
              className="collection-name-input"
              placeholder="Collection name..."
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              maxLength={80}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="upload-content">
        {step === 'drop' && (
          <DropZone onFilesSelected={handleFilesSelected} />
        )}

        {step === 'grouping' && groupingStatus && !groupingResult && (
          <div className="upload-loading">
            <span className="upload-spinner" />
            <p>{groupingStatus}</p>
          </div>
        )}

        {step === 'grouping' && groupingResult && (
          <GroupingView
            files={files}
            groupingResult={groupingResult}
            thumbnails={thumbnails}
            creditsAvailable={creditsAvailable}
            onLaunchBatch={handleLaunchBatch}
            onBack={() => { setStep('drop'); setGroupingResult(null); }}
          />
        )}

        {step === 'batch' && (
          <BatchProgress
            projects={batchStatuses}
            creditsUsed={creditsUsed}
            creditsRemaining={creditsAvailable - creditsUsed}
            onCancel={handleCancel}
            onDone={handleDone}
            isPaused={isPaused}
          />
        )}
      </div>
    </div>
  );
};

export default UploadScreen;
