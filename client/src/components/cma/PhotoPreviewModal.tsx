import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PhotoPreviewModalProps {
  isOpen: boolean;
  photoUrl: string | null;
  photoLabel: string | null;
  onClose: () => void;
}

export function PhotoPreviewModal({
  isOpen,
  photoUrl,
  photoLabel,
  onClose,
}: PhotoPreviewModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen]);

  const handleDownload = () => {
    if (!photoUrl) return;
    const link = document.createElement('a');
    link.href = photoUrl;
    link.download = `${photoLabel || 'cover-photo'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!photoUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-gray-950 border-gray-800">
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/90 to-transparent">
          <div className="text-white">
            <h3 className="font-medium text-lg">{photoLabel || 'Photo Preview'}</h3>
            <p className="text-sm text-gray-400">Zoom: {Math.round(zoom * 100)}%</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full"
            data-testid="close-photo-modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-auto p-4 pt-20 pb-24 h-full">
          <img
            src={photoUrl}
            alt={photoLabel || 'Preview'}
            className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-t from-black/90 to-transparent flex-wrap">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
            disabled={zoom <= 0.5}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
            data-testid="zoom-out-btn"
          >
            <ZoomOut className="w-4 h-4 mr-1.5" />
            Zoom Out
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
            disabled={zoom >= 3}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
            data-testid="zoom-in-btn"
          >
            <ZoomIn className="w-4 h-4 mr-1.5" />
            Zoom In
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
            data-testid="rotate-btn"
          >
            <RotateCw className="w-4 h-4 mr-1.5" />
            Rotate
          </Button>
          
          <div className="w-px h-6 bg-white/20 mx-1 hidden sm:block" />
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setZoom(1); setRotation(0); }}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
            data-testid="reset-btn"
          >
            <Maximize2 className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className="bg-white/10 hover:bg-white/20 text-white border-0"
            data-testid="download-btn"
          >
            <Download className="w-4 h-4 mr-1.5" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PhotoPreviewModal;
