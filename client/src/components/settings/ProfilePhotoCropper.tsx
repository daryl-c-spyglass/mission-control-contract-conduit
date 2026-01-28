import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ZoomIn, ZoomOut, Move, Loader2, AlertCircle } from 'lucide-react';

interface ProfilePhotoCropperProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onCropComplete: (croppedImageUrl: string) => void;
  onError?: (error: string) => void;
}

const DEFAULT_ZOOM = 1.2;

export function ProfilePhotoCropper({
  isOpen,
  onClose,
  imageUrl,
  onCropComplete,
  onError,
}: ProfilePhotoCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && imageUrl) {
      setIsLoading(true);
      setImageError(null);
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setIsLoading(false);
        setImageError(null);
      };
      img.onerror = () => {
        setIsLoading(false);
        setImageError('Could not load image. Please try uploading a different photo.');
        onError?.('Could not load image for cropping');
      };
      img.src = imageUrl;
    }
  }, [isOpen, imageUrl, onError]);

  const onCropChange = useCallback((location: Point) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const onCropCompleteCallback = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(imageUrl, croppedAreaPixels);
      onCropComplete(croppedImage);
      resetAndClose();
    } catch (error) {
      console.error('Error cropping image:', error);
      onError?.('Failed to crop image');
    }
  };

  const resetAndClose = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(DEFAULT_ZOOM);
    setCroppedAreaPixels(null);
    setIsLoading(true);
    setImageError(null);
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetAndClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adjust Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="relative w-full h-80 bg-gray-900 dark:bg-gray-800 rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
          {imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-4">
              <AlertCircle className="w-10 h-10 mb-2 text-destructive" />
              <p className="text-sm text-center">{imageError}</p>
            </div>
          )}
          {!imageError && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onCropComplete={onCropCompleteCallback}
            />
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Move className="w-4 h-4" />
          <span>Drag to reposition</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Zoom</Label>
            <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
          </div>
          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-muted-foreground" />
            <Slider
              value={[zoom]}
              onValueChange={([value]) => setZoom(value)}
              min={1}
              max={3}
              step={0.1}
              className="flex-1"
              disabled={!!imageError}
              data-testid="slider-zoom"
            />
            <ZoomIn className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} data-testid="button-cancel-crop">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!!imageError || isLoading}
            data-testid="button-apply-crop"
          >
            Apply Crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg', 0.9);
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });
}
