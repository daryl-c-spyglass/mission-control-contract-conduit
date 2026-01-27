import { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Move } from 'lucide-react';
import { ImageLightbox } from './ImageLightbox';

interface SlideImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export function SlideImageZoom({ src, alt, className }: SlideImageZoomProps) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const handleReset = () => setZoomLevel(100);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '+' || e.key === '=') handleZoomIn();
    if (e.key === '-') handleZoomOut();
    if (e.key === '0') handleReset();
    if (e.key === 'Escape') setIsLightboxOpen(false);
  };

  return (
    <div 
      className={`flex flex-col ${className || ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      data-testid="slide-image-zoom"
    >
      <div className="flex items-center justify-between bg-muted border rounded-t-lg px-3 py-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Move className="w-3 h-3" />
          Scroll to pan
        </span>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={handleZoomOut}
            disabled={zoomLevel <= 50}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom Out (−)"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div className="flex items-center bg-background border rounded px-2 py-1 min-w-16 justify-center">
            <span className="text-xs font-medium" data-testid="text-zoom-level">{zoomLevel}%</span>
          </div>
          
          <button 
            onClick={handleZoomIn}
            disabled={zoomLevel >= 200}
            className="p-1.5 rounded hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Zoom In (+)"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <button 
            onClick={handleReset}
            className="p-1.5 rounded hover:bg-accent transition-colors ml-1"
            title="Reset (0)"
            data-testid="button-zoom-reset"
          >
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
          </button>
          
          <div className="w-px h-5 bg-border mx-2" />
          
          <button 
            onClick={() => setIsLightboxOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors"
            title="Expand to fullscreen"
            data-testid="button-expand"
          >
            <Maximize2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Expand</span>
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className="border border-t-0 rounded-b-lg overflow-auto bg-background"
        style={{ maxHeight: '500px' }}
      >
        <div 
          className="transition-transform duration-200 ease-out p-4"
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top left',
            width: `${100 / (zoomLevel / 100)}%`,
          }}
        >
          <img 
            src={src}
            alt={alt}
            className="w-full h-auto rounded shadow-sm"
            draggable={false}
            data-testid="img-zoom-image"
          />
        </div>
      </div>
      
      {isLightboxOpen && (
        <ImageLightbox
          src={src}
          alt={alt}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </div>
  );
}
