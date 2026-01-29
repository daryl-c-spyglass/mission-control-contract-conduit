import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Upload, ZoomIn, MoveHorizontal, MoveVertical, RotateCcw, Sparkles, Images, Check, AlertCircle, Crop } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageTransform } from '@/lib/flyer-types';
import type { PhotoSelectionInfo } from '@/lib/flyer-utils';
import { CropModal } from './CropModal';

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
  disabled?: boolean;
  aiSelectionInfo?: PhotoSelectionInfo | null;
  availablePhotos?: Array<{ 
    url: string; 
    classification: string;
    displayClassification?: string;
    confidence?: number;
    quality: number;
  }>;
  onSelectPhoto?: (url: string) => void;
  expectedCategory?: string;
  isMissing?: boolean;
  isOffMarket?: boolean;
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
  disabled = false,
  aiSelectionInfo,
  availablePhotos,
  onSelectPhoto,
  expectedCategory,
  isMissing = false,
  isOffMarket = false,
}: ImageUploadFieldProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [cropModalOpen, setCropModalOpen] = useState(false);

  const handleReset = () => {
    onTransformChange?.({ scale: 1, positionX: 0, positionY: 0 });
  };

  const handleSelectFromGallery = (url: string) => {
    onSelectPhoto?.(url);
    setGalleryOpen(false);
  };

  const handleCropApply = (position: { x: number; y: number }, zoom: number) => {
    if (onTransformChange) {
      onTransformChange({
        scale: zoom,
        positionX: (position.x - 50) * -1,
        positionY: (position.y - 50) * -1,
      });
    }
    setCropModalOpen(false);
  };

  // Get unique categories from available photos
  const categories = availablePhotos 
    ? ['all', ...Array.from(new Set(availablePhotos.map(p => p.displayClassification || p.classification).filter(Boolean)))]
    : ['all'];

  // Filter photos by category
  const filteredPhotos = availablePhotos?.filter(p => {
    if (categoryFilter === 'all') return true;
    return (p.displayClassification || p.classification) === categoryFilter;
  }) || [];

  // Check if category is missing (AI couldn't find a matching photo)
  // Don't show warning if AI successfully selected a photo for this slot
  const showMissingWarning = isMissing && !aiSelectionInfo?.isAISelected;
  
  // Check if AI selected a photo that doesn't match expected category
  const showCategoryMismatchWarning = aiSelectionInfo?.categoryMismatch === true;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium uppercase tracking-wide">
          {label}
        </Label>
        {aiSelectionInfo?.isAISelected && !showCategoryMismatchWarning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-green-600 dark:text-green-400 border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-950/30 cursor-help"
                data-testid={`ai-selection-trigger-${id}`}
              >
                <Sparkles className="w-3 h-3" />
                AI {aiSelectionInfo.confidence}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs" data-testid={`ai-selection-tooltip-${id}`}>
              <div className="space-y-1 text-xs">
                <p className="font-medium">{aiSelectionInfo.reason}</p>
                <p className="text-muted-foreground">
                  Type: {aiSelectionInfo.displayClassification || aiSelectionInfo.classification} | 
                  Confidence: {aiSelectionInfo.confidence}% | 
                  Quality: {aiSelectionInfo.quality}%
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {showCategoryMismatchWarning && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 cursor-help"
                data-testid={`category-mismatch-${id}`}
              >
                <AlertCircle className="w-3 h-3" />
                Not a {expectedCategory?.toLowerCase()} photo
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs" data-testid={`category-mismatch-tooltip-${id}`}>
              <div className="space-y-1.5 text-xs">
                <p className="font-medium">This doesn't appear to be a {expectedCategory?.toLowerCase()} photo</p>
                <p className="text-muted-foreground">
                  Please select a better photo from {isOffMarket ? 'your saved photos' : 'the MLS gallery'} below, or upload your own.
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {showMissingWarning && (
          <Badge
            variant="outline"
            className="text-[10px] gap-1 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30"
            data-testid={`missing-warning-${id}`}
          >
            <AlertCircle className="w-3 h-3" />
            No {expectedCategory || 'matching'} photo
          </Badge>
        )}
      </div>

      <label
        htmlFor={disabled ? undefined : id}
        className={cn(
          "flex items-center justify-center border-2 border-dashed",
          "border-muted-foreground/25 bg-muted/50 transition-colors",
          compact ? "h-24" : circular ? "h-32 w-32 mx-auto" : "h-32",
          circular ? "rounded-full" : "rounded-lg",
          preview ? "p-0 border-solid border-primary/30 overflow-hidden" : "p-4",
          showMissingWarning && !preview && "border-amber-400/50",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover-elevate"
        )}
        data-testid={`upload-${id}`}
      >
        {preview ? (
          <div className="w-full h-full overflow-hidden relative group">
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
            {onTransformChange && !disabled && (
              <div className={cn(
                "absolute invisible group-hover:visible",
                circular ? "top-3 right-3" : "top-1 right-1"
              )}>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={cn(
                    circular ? "h-6 w-6 rounded-full" : "h-7 w-7"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCropModalOpen(true);
                  }}
                  data-testid={`button-crop-${id}`}
                >
                  <Crop className={cn(circular ? "h-3 w-3" : "h-3.5 w-3.5")} />
                </Button>
              </div>
            )}
            {!disabled && aiSelectionInfo?.isAISelected ? (
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1.5 invisible group-hover:visible">
                <div className="flex justify-between items-center">
                  <span className="truncate">{aiSelectionInfo.displayClassification || aiSelectionInfo.classification}</span>
                  <span className="text-green-400 ml-1 whitespace-nowrap">{aiSelectionInfo.confidence}%</span>
                </div>
              </div>
            ) : !disabled && showMissingWarning && (
              <div className="absolute bottom-0 left-0 right-0 bg-amber-900/80 text-amber-100 text-xs p-1.5 invisible group-hover:visible">
                <div className="flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">Fallback - no {expectedCategory} found</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            {showMissingWarning ? (
              <>
                <AlertCircle className="h-6 w-6 text-amber-500" />
                <span className="text-xs text-center text-amber-600">
                  No {expectedCategory || 'matching'} photo found
                  <br />
                  <span className="text-muted-foreground">Click to upload or choose from {isOffMarket ? 'saved photos' : 'MLS'}</span>
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6" />
                <span className="text-xs">Click to upload</span>
              </>
            )}
          </div>
        )}
        <input
          type="file"
          id={id}
          accept="image/*"
          onChange={onChange}
          className="hidden"
          disabled={disabled}
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

      {/* Category mismatch warning message */}
      {showCategoryMismatchWarning && (
        <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium">This doesn't look like a {expectedCategory?.toLowerCase()} photo</p>
            <p className="text-amber-600 dark:text-amber-400">
              Select a better photo from {isOffMarket ? 'saved photos' : 'MLS gallery'} or upload your own below.
            </p>
          </div>
        </div>
      )}

      {availablePhotos && availablePhotos.length > 0 && onSelectPhoto && (
        <Dialog open={galleryOpen} onOpenChange={(open) => {
          setGalleryOpen(open);
          if (!open) setCategoryFilter('all');
        }}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-7 text-xs gap-1"
              data-testid={`button-gallery-${id}`}
            >
              <Images className="w-3 h-3" />
              {isOffMarket ? `Choose from Saved Photos (${availablePhotos.length})` : `Choose from MLS Photos (${availablePhotos.length})`}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Select Photo for {label}</DialogTitle>
              <DialogDescription>
                {expectedCategory && (
                  <span className="text-amber-600 dark:text-amber-400">
                    Looking for: {expectedCategory} photo
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            {categories.length > 2 && (
              <div className="flex gap-1.5 flex-wrap py-2 border-b">
                {categories.map(cat => (
                  <Button
                    key={cat}
                    type="button"
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryFilter(cat)}
                    className="h-7 text-xs"
                  >
                    {cat === 'all' ? 'All Photos' : cat}
                    {cat !== 'all' && (
                      <span className="ml-1 opacity-60">
                        ({availablePhotos.filter(p => (p.displayClassification || p.classification) === cat).length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto flex-1 p-1">
              {filteredPhotos.map((photo, index) => (
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
                  <div className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[10px] px-1.5 py-0.5">
                    <div className="flex justify-between items-center">
                      <span className="truncate">{photo.displayClassification || photo.classification}</span>
                      {(photo.confidence !== undefined && photo.confidence > 0) ? (
                        <span className="text-green-400 ml-1 whitespace-nowrap">{photo.confidence}%</span>
                      ) : (
                        <span className="text-muted-foreground ml-1 whitespace-nowrap">Q:{photo.quality}%</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filteredPhotos.length === 0 && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No {categoryFilter !== 'all' ? categoryFilter : ''} photos found
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {preview && onTransformChange && (
        <CropModal
          isOpen={cropModalOpen}
          onClose={() => setCropModalOpen(false)}
          imageUrl={preview}
          aspectRatio={circular ? 1 : 16 / 9}
          onApply={handleCropApply}
          initialPosition={{ 
            x: 50 - transform.positionX, 
            y: 50 - transform.positionY 
          }}
          initialZoom={transform.scale}
          title={`Crop ${label}`}
        />
      )}
    </div>
  );
}
