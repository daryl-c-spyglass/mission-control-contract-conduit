import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, ZoomIn, MoveHorizontal, MoveVertical, RotateCcw, Sparkles, Images, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageTransform } from '@/lib/flyer-types';
import type { PhotoSelectionInfo } from '@/lib/flyer-utils';

interface ImageUploadFieldProps {
  label: string;
  id: string;
  preview: string | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  transform?: ImageTransform;
  onTransformChange?: (transform: ImageTransform) => void;
  showCropControls?: boolean;
  compact?: boolean;
  circular?: boolean;
  aiSelectionInfo?: PhotoSelectionInfo | null;
  availablePhotos?: Array<{ url: string; classification: string; quality: number }>;
  onSelectPhoto?: (url: string) => void;
}

export function ImageUploadField({
  label,
  id,
  preview,
  onChange,
  transform = { scale: 1, positionX: 0, positionY: 0 },
  onTransformChange,
  showCropControls = false,
  compact = false,
  circular = false,
  aiSelectionInfo,
  availablePhotos,
  onSelectPhoto,
}: ImageUploadFieldProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);

  const handleReset = () => {
    onTransformChange?.({ scale: 1, positionX: 0, positionY: 0 });
  };

  const handleSelectFromGallery = (url: string) => {
    onSelectPhoto?.(url);
    setGalleryOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide">
          {label}
        </Label>
        {aiSelectionInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 cursor-help"
                data-testid={`ai-selection-trigger-${id}`}
              >
                <Sparkles className="w-3 h-3" />
                <span>AI Selected</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs" data-testid={`ai-selection-tooltip-${id}`}>
              <div className="space-y-1 text-xs">
                <p className="font-medium">{aiSelectionInfo.reason}</p>
                <p className="text-muted-foreground">
                  Type: {aiSelectionInfo.classification} | Quality: {aiSelectionInfo.quality}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <label
        htmlFor={id}
        className={cn(
          "flex cursor-pointer items-center justify-center border-2 border-dashed",
          "border-muted-foreground/25 bg-muted/50 transition-colors",
          "hover:border-primary/50 hover:bg-muted",
          compact ? "h-24" : circular ? "h-32 w-32 mx-auto" : "h-32",
          circular ? "rounded-full" : "rounded-lg",
          preview ? "p-0 border-solid border-primary/30 overflow-hidden" : "p-4"
        )}
        data-testid={`upload-${id}`}
      >
        {preview ? (
          <div className="w-full h-full overflow-hidden">
            <img
              src={preview}
              alt={label}
              className={cn(
                "w-full h-full object-cover transition-transform",
                circular && "rounded-full"
              )}
              style={{
                transform: `scale(${transform.scale}) translate(${transform.positionX}%, ${transform.positionY}%)`,
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-6 w-6" />
            <span className="text-xs">Click to upload</span>
          </div>
        )}
        <input
          type="file"
          id={id}
          accept="image/*"
          onChange={onChange}
          className="hidden"
          data-testid={`input-${id}`}
        />
      </label>

      {preview && showCropControls && onTransformChange && (
        <div className="space-y-3 pt-2 px-1">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-3 h-3" /> Zoom
              </span>
              <span>{transform.scale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.1"
              value={transform.scale}
              onChange={(e) => onTransformChange({
                ...transform,
                scale: parseFloat(e.target.value)
              })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              data-testid={`slider-zoom-${id}`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MoveHorizontal className="w-3 h-3" /> Horizontal
              </span>
              <span>{transform.positionX}%</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={transform.positionX}
              onChange={(e) => onTransformChange({
                ...transform,
                positionX: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              data-testid={`slider-horizontal-${id}`}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MoveVertical className="w-3 h-3" /> Vertical
              </span>
              <span>{transform.positionY}%</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="1"
              value={transform.positionY}
              onChange={(e) => onTransformChange({
                ...transform,
                positionY: parseInt(e.target.value)
              })}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
              data-testid={`slider-vertical-${id}`}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            data-testid={`button-reset-${id}`}
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </Button>
        </div>
      )}

      {availablePhotos && availablePhotos.length > 0 && onSelectPhoto && (
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1"
              data-testid={`button-gallery-${id}`}
            >
              <Images className="w-3 h-3" />
              Choose from MLS Photos ({availablePhotos.length})
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Select Photo for {label}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[60vh] p-1">
              {availablePhotos.map((photo, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectFromGallery(photo.url)}
                  className={cn(
                    "relative aspect-video rounded-md overflow-hidden border-2 transition-all hover-elevate",
                    preview === photo.url
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent"
                  )}
                  data-testid={`gallery-photo-${index}`}
                >
                  <img
                    src={photo.url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {preview === photo.url && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                    {photo.classification} · {photo.quality}%
                  </div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
