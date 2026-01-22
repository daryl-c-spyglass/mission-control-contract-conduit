import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

  return (
    <div 
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        onClick && "cursor-pointer hover:border-primary/50 hover:bg-muted/30"
      )}
      onClick={handleClick}
      data-testid={`preview-section-${sectionId}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm text-muted-foreground">{title}</span>
        </div>
        
        {sourceUrl && onSourceClick && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSourceClick}
                  className="text-[10px] text-primary"
                  data-testid={`button-source-${sectionId}`}
                >
                  <span>Source</span>
                  <ExternalLink className="h-2.5 w-2.5 ml-1" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">Data from: {sourceLabel || 'External Source'}</p>
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
