import React, { useState, useRef, useCallback } from 'react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  maxFiles = 50,
  maxSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSubmit = useCallback((fileList: FileList | File[]) => {
    setError(null);
    const files = Array.from(fileList);

    if (files.length > maxFiles) {
      setError(`Maximum ${maxFiles} images per upload. You selected ${files.length}.`);
      return;
    }

    const valid: File[] = [];
    for (const f of files) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        setError(`"${f.name}" is not a supported format. Use PNG or JPEG.`);
        return;
      }
      if (f.size > maxSizeMB * 1024 * 1024) {
        setError(`"${f.name}" exceeds ${maxSizeMB}MB limit.`);
        return;
      }
      valid.push(f);
    }

    if (valid.length === 0) {
      setError('No valid images selected.');
      return;
    }

    onFilesSelected(valid);
  }, [maxFiles, maxSizeMB, onFilesSelected]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      validateAndSubmit(e.dataTransfer.files);
    }
  }, [validateAndSubmit]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      validateAndSubmit(e.target.files);
    }
  }, [validateAndSubmit]);

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg"
        multiple
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <div className="dropzone-content">
        <svg className="dropzone-icon" width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M6 30l10-10 8 8 6-6 12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="16" cy="20" r="3" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
        <p className="dropzone-title">
          {isDragging ? 'Drop images here' : 'Drop your product photos here'}
        </p>
        <p className="dropzone-subtitle">
          or click to browse — PNG, JPEG — up to {maxFiles} images, {maxSizeMB}MB each
        </p>
        {error && <p className="dropzone-error">{error}</p>}
      </div>
    </div>
  );
};

export default DropZone;
