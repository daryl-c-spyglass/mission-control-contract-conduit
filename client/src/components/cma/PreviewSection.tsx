import { cn } from "@/lib/utils";
import { ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isPdfImplemented, getSectionSource } from "@/lib/cma-section-sources";

interface PreviewSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  sectionId?: string;
  onClick?: (sectionId: string) => void;
  compact?: boolean;
  sourceUrl?: string;
  sourceLabel?: string;
  onSourceClick?: (url: string) => void;
}

export function PreviewSection({
  title,
  icon: Icon,
  children,
  sectionId,
  onClick,
  compact = false,
  sourceUrl,
  sourceLabel,
  onSourceClick,
}: PreviewSectionProps) {
  const handleClick = () => {
    if (sectionId && onClick) onClick(sectionId);
  };

  const handleSourceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceUrl && onSourceClick) {
      onSourceClick(sourceUrl);
    }
  };

  const pdfImplemented = sectionId ? isPdfImplemented(sectionId) : true;
  const source = sectionId ? getSectionSource(sectionId) : null;
  const isClickable = onClick && sectionId;
  const hasSource = sourceUrl && onSourceClick;

  return (
    <div 
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isClickable && "cursor-pointer hover:border-primary/50 active:bg-muted/50"
      )}
      onClick={handleClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      data-testid={`preview-section-${sectionId}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-muted/50 border-b min-h-[44px]">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="font-medium text-sm text-muted-foreground">{title}</span>
          
          {!pdfImplemented && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
            >
              Preview Only
            </Badge>
          )}
        </div>
        
        {hasSource && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSourceClick}
                  className="touch-manipulation"
                  data-testid={`button-source-${sectionId}`}
                >
                  {source?.navigateTo ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : (
                    <Info className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs font-medium">Data from: {sourceLabel || source?.label || 'External Source'}</p>
                <p className="text-[10px] text-muted-foreground">Click to view/edit</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className={cn("bg-background", compact ? "p-3" : "p-4")}>
        {children}
      </div>
    </div>
  );
}
