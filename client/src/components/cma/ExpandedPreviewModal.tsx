import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <DialogContent className="max-w-4xl w-[90vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>CMA Presentation Preview</DialogTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                {sectionsEnabled} sections enabled
              </span>
              <Button variant="outline" size="sm" data-testid="button-save-template">
                Save as Template
              </Button>
            </div>
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

        <div className="flex-shrink-0 flex justify-center gap-2 px-6 py-4 border-t bg-background">
          <Button
            variant={zoom === 50 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setZoom(50)}
            data-testid="button-zoom-50"
          >
            50%
          </Button>
          <Button
            variant={zoom === 100 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setZoom(100)}
            data-testid="button-zoom-100"
          >
            100%
          </Button>
          <Button
            variant={zoom === 150 ? "secondary" : "outline"}
            size="sm"
            onClick={() => setZoom(150)}
            data-testid="button-zoom-150"
          >
            150%
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
