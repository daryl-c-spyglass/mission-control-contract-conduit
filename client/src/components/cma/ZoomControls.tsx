import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  showSlider?: boolean;
  showFitButton?: boolean;
  onFitToWidth?: () => void;
}

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 200];

export function ZoomControls({
  zoom,
  onZoomChange,
  minZoom = 50,
  maxZoom = 200,
  className,
  showSlider = true,
  showFitButton = false,
  onFitToWidth,
}: ZoomControlsProps) {
  const zoomStep = 10;

  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex === -1) {
      const nextLevel = ZOOM_LEVELS.find((l) => l > zoom);
      onZoomChange(nextLevel || maxZoom);
    } else if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoom);
    if (currentIndex === -1) {
      const prevLevel = [...ZOOM_LEVELS].reverse().find((l) => l < zoom);
      onZoomChange(prevLevel || minZoom);
    } else if (currentIndex > 0) {
      onZoomChange(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleReset = () => {
    onZoomChange(100);
  };

  const handleFitToWidth = () => {
    if (onFitToWidth) {
      onFitToWidth();
    } else {
      onZoomChange(100);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 p-2 bg-background border-t",
        "flex-wrap sm:flex-nowrap",
        className
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomOut}
        disabled={zoom <= minZoom}
        className="touch-manipulation"
        title="Zoom Out"
        data-testid="button-zoom-out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      {showSlider && (
        <div className="hidden sm:flex items-center gap-2 w-20 md:w-28">
          <Slider
            value={[zoom]}
            min={minZoom}
            max={maxZoom}
            step={zoomStep}
            onValueChange={([value]) => onZoomChange(value)}
            className="w-full touch-manipulation"
            data-testid="slider-zoom"
          />
        </div>
      )}

      <div className="px-2.5 py-1.5 bg-muted rounded text-sm font-medium text-muted-foreground min-w-[52px] text-center tabular-nums select-none">
        {zoom}%
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleZoomIn}
        disabled={zoom >= maxZoom}
        className="touch-manipulation"
        title="Zoom In"
        data-testid="button-zoom-in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="hidden md:block w-px h-5 bg-border mx-1" />

      {showFitButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFitToWidth}
          className="hidden md:flex touch-manipulation"
          title="Fit to Width"
          data-testid="button-fit-width"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={zoom === 100}
        className="touch-manipulation"
        title="Reset to 100%"
        data-testid="button-zoom-reset"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="text-xs hidden sm:inline">Reset</span>
      </Button>
    </div>
  );
}
