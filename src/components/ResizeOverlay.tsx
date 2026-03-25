import { useRef, useEffect, useState, useCallback } from 'react';
import './ResizeOverlay.css';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ResizeOverlayProps {
  imageSrc: string;
  onApply: (annotatedImageDataUrl: string, rect: Rect) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function ResizeOverlay({
  imageSrc,
  onApply,
  onCancel,
  isProcessing = false,
}: ResizeOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const drawingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw the canvas whenever rect or image changes
  const draw = useCallback(
    (currentRect: Rect | null) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Match canvas pixel size to display size
      const displayW = canvas.clientWidth;
      const displayH = canvas.clientHeight;
      if (canvas.width !== displayW || canvas.height !== displayH) {
        canvas.width = displayW;
        canvas.height = displayH;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (currentRect) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
        ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);

        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h);
        ctx.setLineDash([]);
      }
    },
    [],
  );

  useEffect(() => {
    if (imageLoaded) draw(rect);
  }, [imageLoaded, rect, draw]);

  // Resize observer to keep canvas sized correctly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      draw(rect);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw, rect]);

  // --- Pointer helpers ---
  const getPos = (
    e: React.MouseEvent | React.TouchEvent,
  ): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0]?.clientX ?? e.changedTouches[0].clientX : e.clientX;
    const clientY =
      'touches' in e ? e.touches[0]?.clientY ?? e.changedTouches[0].clientY : e.clientY;
    return {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    e.preventDefault();
    const pos = getPos(e);
    startRef.current = pos;
    drawingRef.current = true;
    setRect(null);
    draw(null);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !startRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const newRect: Rect = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    };
    draw(newRect);
    // Store without re-render during move for performance
    setRect(newRect);
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current || !startRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    const pos = getPos(e);
    const finalRect: Rect = {
      x: Math.min(startRef.current.x, pos.x),
      y: Math.min(startRef.current.y, pos.y),
      w: Math.abs(pos.x - startRef.current.x),
      h: Math.abs(pos.y - startRef.current.y),
    };
    startRef.current = null;
    // Only keep rectangle if it has meaningful size
    if (finalRect.w > 5 && finalRect.h > 5) {
      setRect(finalRect);
    } else {
      setRect(null);
      draw(null);
    }
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !rect) return;

    const scaleX = img.naturalWidth / canvas.clientWidth;
    const scaleY = img.naturalHeight / canvas.clientHeight;

    const origRect: Rect = {
      x: Math.round(rect.x * scaleX),
      y: Math.round(rect.y * scaleY),
      w: Math.round(rect.w * scaleX),
      h: Math.round(rect.h * scaleY),
    };

    // Draw on offscreen canvas at original resolution
    const offscreen = document.createElement('canvas');
    offscreen.width = img.naturalWidth;
    offscreen.height = img.naturalHeight;
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    ctx.fillStyle = 'rgba(0, 255, 0, 0.25)';
    ctx.fillRect(origRect.x, origRect.y, origRect.w, origRect.h);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = Math.max(2, Math.round(3 * scaleX));
    ctx.setLineDash([
      Math.round(6 * scaleX),
      Math.round(4 * scaleX),
    ]);
    ctx.strokeRect(origRect.x, origRect.y, origRect.w, origRect.h);

    const dataUrl = offscreen.toDataURL('image/png');
    onApply(dataUrl, origRect);
  };

  return (
    <div className="resize-overlay">
      <canvas
        ref={canvasRef}
        className="resize-overlay-canvas"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
      <div className="resize-overlay-toolbar">
        {!rect && !isProcessing && (
          <span className="resize-overlay-hint">
            Draw a rectangle where the product should go
          </span>
        )}
        {isProcessing && (
          <span className="resize-overlay-hint">Resizing...</span>
        )}
        {rect && !isProcessing && (
          <>
            <button
              className="resize-overlay-btn resize-overlay-apply"
              onClick={handleApply}
              disabled={isProcessing}
            >
              Apply
            </button>
            <button
              className="resize-overlay-btn resize-overlay-cancel"
              onClick={onCancel}
              disabled={isProcessing}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
