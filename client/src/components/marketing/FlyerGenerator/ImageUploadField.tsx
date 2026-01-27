import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, ZoomIn, MoveHorizontal, MoveVertical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImageTransform } from '@/lib/flyer-types';

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
}: ImageUploadFieldProps) {
  const handleReset = () => {
    onTransformChange?.({ scale: 1, positionX: 0, positionY: 0 });
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium uppercase tracking-wide">
        {label}
      </Label>

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
    </div>
  );
}
