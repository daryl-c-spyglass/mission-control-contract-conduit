import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  X, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut,
  Grid,
  Maximize2,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import { generatePreviewSlides, checkDataIssues, type PreviewSlide } from './preview-slides';
import type { AgentProfile, CmaProperty } from '../types';

interface CmaPrintPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onDownload: () => Promise<void>;
  propertyAddress: string;
  comparables: CmaProperty[];
  agent: AgentProfile;
  subjectProperty?: CmaProperty;
  averageDaysOnMarket?: number;
  suggestedListPrice?: number | null;
  avgPricePerAcre?: number | null;
}

export function CmaPrintPreview({
  isOpen,
  onClose,
  onDownload,
  propertyAddress,
  comparables,
  agent,
  subjectProperty,
  averageDaysOnMarket,
  suggestedListPrice,
  avgPricePerAcre,
}: CmaPrintPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [zoom, setZoom] = useState(100);
  const [isDownloading, setIsDownloading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const slides = generatePreviewSlides({
    propertyAddress,
    comparables,
    agent,
    subjectProperty,
    averageDaysOnMarket,
    suggestedListPrice,
    avgPricePerAcre,
  });

  const dataIssues = checkDataIssues({ comparables, agent, subjectProperty });

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
      setViewMode('single');
      setZoom(100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowLeft') goToSlide(currentSlide - 1);
      if (e.key === 'ArrowRight') goToSlide(currentSlide + 1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentSlide]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
      onClose();
    } finally {
      setIsDownloading(false);
    }
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(Math.max(0, Math.min(index, slides.length - 1)));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        hideCloseButton
        className={cn(
          "max-w-[95vw] w-[1400px] h-[90vh] p-0 flex flex-col",
          isDark ? "bg-zinc-900 border-zinc-700" : "bg-gray-100 border-gray-200"
        )}>
        <div className={cn(
          "flex items-center justify-between px-6 py-4 border-b",
          isDark ? "border-zinc-800" : "border-gray-200"
        )}>
          <div>
            <DialogTitle className={cn(
              "text-xl font-semibold",
              isDark ? "text-white" : "text-gray-900"
            )}>
              Preview
            </DialogTitle>
            <p className={cn(
              "text-sm mt-1",
              isDark ? "text-zinc-400" : "text-gray-600"
            )}>
              {propertyAddress} - {slides.length} slides
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-1 rounded-lg p-1",
              isDark ? "bg-zinc-800" : "bg-gray-200"
            )}>
              <Button
                variant={viewMode === 'single' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('single')}
                data-testid="button-view-single"
              >
                <Maximize2 className="w-4 h-4 mr-2" />
                Single
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <Grid className="w-4 h-4 mr-2" />
                Grid
              </Button>
            </div>

            {viewMode === 'single' && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(Math.max(50, zoom - 25))}
                  disabled={zoom <= 50}
                  data-testid="button-zoom-out"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className={cn("text-sm w-12 text-center", isDark ? "text-zinc-400" : "text-gray-600")}>{zoom}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setZoom(Math.min(150, zoom + 25))}
                  disabled={zoom >= 150}
                  data-testid="button-zoom-in"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            )}

            <Button
              onClick={handleDownload}
              disabled={isDownloading}
              className="bg-[#EF4923] text-white"
              data-testid="button-download-pdf-preview"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </>
              )}
            </Button>

            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              data-testid="button-close-preview"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {dataIssues.length > 0 && (
          <div className="mx-6 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  {dataIssues.length} potential issue{dataIssues.length > 1 ? 's' : ''} detected
                </p>
                <ul className="mt-1 text-xs text-yellow-400/80 space-y-1">
                  {dataIssues.slice(0, 3).map((issue: string, i: number) => (
                    <li key={i}>- {issue}</li>
                  ))}
                  {dataIssues.length > 3 && (
                    <li>- ...and {dataIssues.length - 3} more</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          <div className={cn("w-48 border-r flex-shrink-0", isDark ? "border-zinc-800" : "border-gray-200")}>
            <ScrollArea className="h-full">
              <div className="p-3 space-y-2">
                {slides.map((slide: PreviewSlide, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentSlide(index);
                      setViewMode('single');
                    }}
                    className={cn(
                      "w-full aspect-[11/8.5] rounded-lg border-2 overflow-visible",
                      currentSlide === index && viewMode === 'single'
                        ? "border-[#EF4923]"
                        : isDark ? "border-zinc-700 hover-elevate" : "border-gray-300 hover-elevate"
                    )}
                    data-testid={`thumbnail-slide-${index}`}
                  >
                    <div className="w-full h-full bg-white p-2 flex flex-col">
                      <div className="text-[6px] font-bold text-zinc-900 truncate text-left">
                        {slide.title}
                      </div>
                      <div className="flex-1 flex items-center justify-center">
                        {slide.hasIssue ? (
                          <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <div className="w-full h-full bg-zinc-100 rounded" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className={cn("flex-1 overflow-hidden", isDark ? "bg-zinc-950" : "bg-gray-200")}>
            {viewMode === 'single' ? (
              <div className="h-full flex flex-col">
                <div 
                  className="flex-1 flex items-center justify-center p-8 overflow-auto"
                  ref={scrollRef}
                >
                  <div 
                    className="bg-white shadow-2xl transition-transform origin-center"
                    style={{
                      width: `${11 * 60}px`,
                      minHeight: `${8.5 * 60}px`,
                      transform: `scale(${zoom / 100})`,
                    }}
                  >
                    <SlidePreview slide={slides[currentSlide]} />
                  </div>
                </div>

                <div className={cn("flex items-center justify-center gap-4 py-4 border-t", isDark ? "border-zinc-800" : "border-gray-300")}>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToSlide(currentSlide - 1)}
                    disabled={currentSlide === 0}
                    data-testid="button-prev-slide"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className={cn("text-sm", isDark ? "text-zinc-400" : "text-gray-600")}>
                    Slide {currentSlide + 1} of {slides.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => goToSlide(currentSlide + 1)}
                    disabled={currentSlide === slides.length - 1}
                    data-testid="button-next-slide"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-6 grid grid-cols-3 gap-6">
                  {slides.map((slide: PreviewSlide, index: number) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentSlide(index);
                        setViewMode('single');
                      }}
                      className="aspect-[11/8.5] bg-white rounded-lg shadow-lg overflow-visible hover-elevate"
                      data-testid={`grid-slide-${index}`}
                    >
                      <SlidePreview slide={slide} compact />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SlidePreview({ slide, compact = false }: { slide: PreviewSlide; compact?: boolean }) {
  const { title, content, hasIssue, issueMessage, slideNumber, totalSlides, type } = slide;

  if (type === 'cover') {
    return (
      <div className="w-full h-full">
        {content}
      </div>
    );
  }

  return (
    <div className={cn(
      "w-full h-full flex flex-col bg-white",
      compact ? "p-2" : "p-6"
    )}>
      <div className={cn(
        "border-b border-zinc-200 pb-2 mb-4",
        compact && "pb-1 mb-2"
      )}>
        <h3 className={cn(
          "font-bold text-zinc-900",
          compact ? "text-[8px]" : "text-lg"
        )}>
          {title}
        </h3>
      </div>

      {hasIssue && !compact && issueMessage && (
        <div className="mb-4 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          {issueMessage}
        </div>
      )}

      <div className={cn("flex-1 overflow-hidden", compact ? "text-[6px]" : "text-sm")}>
        {content}
      </div>

      <div className={cn(
        "border-t border-zinc-200 pt-2 mt-4 flex justify-between items-center text-zinc-500",
        compact ? "text-[6px] pt-1 mt-2" : "text-xs"
      )}>
        {slideNumber > 1 ? (
          <img 
            src="/logos/SpyglassRealty_Logo_Black.png"
            alt="Spyglass Realty"
            className={cn(compact ? "h-3" : "h-5")}
          />
        ) : (
          <span>Spyglass Realty</span>
        )}
        <span>Slide {slideNumber} of {totalSlides}</span>
      </div>
    </div>
  );
}
