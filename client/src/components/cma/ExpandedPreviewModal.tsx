import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ZoomControls } from "./ZoomControls";

interface ExpandedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  sectionsEnabled: number;
}

export function ExpandedPreviewModal({
  isOpen,
  onClose,
  children,
  sectionsEnabled,
}: ExpandedPreviewModalProps) {
  const [zoom, setZoom] = useState(100);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] sm:w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <DialogTitle className="text-base sm:text-lg">CMA Presentation Preview</DialogTitle>
            <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-1 rounded whitespace-nowrap">
              {sectionsEnabled} sections
            </span>
          </div>
          <DialogDescription className="sr-only">
            Full-screen preview of your CMA presentation with all enabled sections
          </DialogDescription>
        </DialogHeader>

        <ScrollArea 
          className="flex-1 bg-muted/30"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="p-4 sm:p-6">
            <div
              className="max-w-2xl mx-auto bg-background shadow-lg rounded-lg transition-transform duration-200 p-4 sm:p-6"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              <div className="space-y-4 sm:space-y-6">{children}</div>
            </div>
          </div>
        </ScrollArea>

        <ZoomControls
          zoom={zoom}
          onZoomChange={setZoom}
          showSlider={true}
          showFitButton={true}
          className="flex-shrink-0 px-4 sm:px-6 py-3"
        />
      </DialogContent>
    </Dialog>
  );
}
