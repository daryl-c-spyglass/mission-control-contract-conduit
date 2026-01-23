import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize2, 
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface PhotoGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: Array<{
    url: string;
    caption?: string;
  }>;
  initialIndex?: number;
}

export function PhotoGalleryModal({ 
  isOpen, 
  onClose, 
  photos, 
  initialIndex = 0 
}: PhotoGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const resetTransforms = useCallback(() => {
    setZoom(100);
    setRotation(0);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setZoom(100);
      setRotation(0);
    }
  }, [isOpen, initialIndex]);

  const currentPhoto = photos[currentIndex];
  const hasMultiplePhotos = photos.length > 1;

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    resetTransforms();
  }, [photos.length, resetTransforms]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    resetTransforms();
  }, [photos.length, resetTransforms]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 25));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, goToPrevious, goToNext, onClose, handleZoomIn, handleZoomOut]);

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleDownload = async () => {
    if (!currentPhoto) return;
    try {
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `photo-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      window.open(currentPhoto.url, '_blank');
    }
  };

  if (!currentPhoto) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 gap-0 bg-background border-border flex flex-col [&>button]:hidden" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Photo Gallery</DialogTitle>
        </VisuallyHidden>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="text-foreground font-medium">
              {currentPhoto.caption || `Photo ${currentIndex + 1} of ${photos.length}`}
            </h3>
            <p className="text-muted-foreground text-sm">Zoom: {zoom}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-gallery-close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-muted/30">
          {hasMultiplePhotos && (
            <Button
              variant="secondary"
              size="icon"
              onClick={goToPrevious}
              className="absolute left-4 z-10 h-12 w-12 rounded-full shadow-lg"
              data-testid="button-gallery-prev"
            >
              <ChevronLeft className="w-8 h-8" />
            </Button>
          )}

          <div className="overflow-auto max-w-full max-h-full p-4">
            <img
              src={currentPhoto.url}
              alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
              className="max-w-none transition-transform duration-200 rounded-lg shadow-lg"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
              }}
              draggable={false}
              data-testid="img-gallery-current"
            />
          </div>

          {hasMultiplePhotos && (
            <Button
              variant="secondary"
              size="icon"
              onClick={goToNext}
              className="absolute right-4 z-10 h-12 w-12 rounded-full shadow-lg"
              data-testid="button-gallery-next"
            >
              <ChevronRight className="w-8 h-8" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-border bg-background flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            data-testid="button-gallery-zoom-out"
          >
            <ZoomOut className="w-4 h-4 mr-1" />
            Zoom Out
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 300}
            data-testid="button-gallery-zoom-in"
          >
            <ZoomIn className="w-4 h-4 mr-1" />
            Zoom In
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRotate}
            data-testid="button-gallery-rotate"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            Rotate
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={resetTransforms}
            data-testid="button-gallery-reset"
          >
            <Maximize2 className="w-4 h-4 mr-1" />
            Reset
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            data-testid="button-gallery-download"
          >
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        </div>

        {photos.length > 1 && (
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    resetTransforms();
                  }}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                    ${index === currentIndex 
                      ? 'border-[#EF4923] ring-2 ring-[#EF4923]/20' 
                      : 'border-border opacity-70 hover:opacity-100 hover:border-muted-foreground'
                    }`}
                  data-testid={`button-gallery-thumb-${index}`}
                >
                  <img
                    src={photo.url}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              {currentIndex + 1} of {photos.length} • Use arrow keys to navigate
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
