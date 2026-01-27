import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [zoomLevel, setZoomLevel] = useState(100);

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 25, 300));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 25, 50));
  const handleReset = () => setZoomLevel(100);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
      if (e.key === '0') handleReset();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors z-10"
        aria-label="Close"
        data-testid="button-close-lightbox"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 z-10">
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          disabled={zoomLevel <= 50}
          className="p-2 hover:bg-white/10 rounded disabled:opacity-50 transition-colors"
          data-testid="button-lightbox-zoom-out"
        >
          <ZoomOut className="w-5 h-5 text-white" />
        </button>
        
        <span className="text-white font-medium min-w-16 text-center" data-testid="text-lightbox-zoom-level">
          {zoomLevel}%
        </span>
        
        <button 
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          disabled={zoomLevel >= 300}
          className="p-2 hover:bg-white/10 rounded disabled:opacity-50 transition-colors"
          data-testid="button-lightbox-zoom-in"
        >
          <ZoomIn className="w-5 h-5 text-white" />
        </button>
        
        <div className="w-px h-5 bg-white/30" />
        
        <button 
          onClick={(e) => { e.stopPropagation(); handleReset(); }}
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-white text-sm transition-colors flex items-center gap-1"
          data-testid="button-lightbox-reset"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </div>
      
      <div 
        className="overflow-auto max-w-full max-h-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <img 
          src={src}
          alt={alt}
          className="transition-transform duration-200 ease-out rounded-lg shadow-2xl"
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center',
            maxWidth: 'none',
          }}
          draggable={false}
          data-testid="img-lightbox-image"
        />
      </div>
      
      <div className="absolute bottom-6 right-6 text-white/50 text-xs">
        <p>+ / − to zoom • 0 to reset • Esc to close</p>
      </div>
    </div>
  );
}
