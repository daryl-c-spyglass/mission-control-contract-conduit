import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

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
  const { isDark } = useTheme();
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
      <DialogContent 
        className={cn(
          "max-w-5xl w-[95vw] h-[85vh] p-0 overflow-hidden border-0",
          isDark 
            ? "bg-gray-900" 
            : "bg-gray-100"
        )}
      >
        <div className={cn(
          "absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3",
          isDark 
            ? "bg-gradient-to-b from-gray-900 to-transparent" 
            : "bg-gradient-to-b from-gray-100 to-transparent"
        )}>
          <div>
            <h3 className={cn(
              "font-medium text-lg",
              isDark ? "text-white" : "text-gray-900"
            )}>
              {photoLabel || 'Photo Preview'}
            </h3>
            <p className={cn(
              "text-sm",
              isDark ? "text-gray-400" : "text-gray-600"
            )}>
              Zoom: {Math.round(zoom * 100)}%
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className={cn(
              "rounded-full",
              isDark 
                ? "text-white hover:bg-white/20" 
                : "text-gray-700 hover:bg-gray-200"
            )}
            data-testid="close-photo-modal"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-auto p-4 pt-20 pb-24 h-full">
          <img
            src={photoUrl}
            alt={photoLabel || 'Preview'}
            className={cn(
              "max-w-full max-h-full object-contain transition-transform duration-200 select-none rounded-lg",
              isDark ? "shadow-2xl" : "shadow-xl"
            )}
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        </div>

        <div className={cn(
          "absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-2 px-4 py-4 flex-wrap",
          isDark 
            ? "bg-gradient-to-t from-gray-900 to-transparent" 
            : "bg-gradient-to-t from-gray-100 to-transparent"
        )}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
            disabled={zoom <= 0.5}
            className={cn(
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700" 
                : "bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
            )}
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
            className={cn(
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700" 
                : "bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
            )}
            data-testid="zoom-in-btn"
          >
            <ZoomIn className="w-4 h-4 mr-1.5" />
            Zoom In
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className={cn(
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700" 
                : "bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
            )}
            data-testid="rotate-btn"
          >
            <RotateCw className="w-4 h-4 mr-1.5" />
            Rotate
          </Button>
          
          <div className={cn(
            "w-px h-6 mx-1 hidden sm:block",
            isDark ? "bg-gray-700" : "bg-gray-300"
          )} />
          
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { setZoom(1); setRotation(0); }}
            className={cn(
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700" 
                : "bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
            )}
            data-testid="reset-btn"
          >
            <Maximize2 className="w-4 h-4 mr-1.5" />
            Reset
          </Button>
          
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            className={cn(
              isDark 
                ? "bg-gray-800 hover:bg-gray-700 text-white border-gray-700" 
                : "bg-white hover:bg-gray-50 text-gray-900 border-gray-200"
            )}
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
