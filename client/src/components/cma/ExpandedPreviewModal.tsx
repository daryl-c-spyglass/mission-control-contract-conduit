import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ExpandedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sectionsEnabled: number;
}

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

export function ExpandedPreviewModal({
  isOpen,
  onClose,
  children,
  sectionsEnabled,
}: ExpandedPreviewModalProps) {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleReset = () => {
    setZoom(100);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>CMA Presentation Preview</DialogTitle>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              {sectionsEnabled} sections enabled
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 bg-muted/30">
          <div className="p-6">
            <div
              className="max-w-2xl mx-auto bg-background shadow-lg rounded-lg transition-transform duration-200 p-6"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <div className="space-y-6">{children}</div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 border-t bg-background">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Zoom Out"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-3 w-36">
            <Slider
              value={[zoom]}
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              onValueChange={([value]) => setZoom(value)}
              className="w-full"
              data-testid="slider-zoom"
            />
          </div>

          <span className="text-sm font-medium text-muted-foreground w-12 text-center">
            {zoom}%
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Zoom In"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-2" />

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            title="Reset to 100%"
            data-testid="button-zoom-reset"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
