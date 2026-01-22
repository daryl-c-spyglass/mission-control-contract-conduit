import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyPhotosPreviewProps {
  photos: string[];
  compact?: boolean;
}

export function PropertyPhotosPreview({ photos, compact }: PropertyPhotosPreviewProps) {
  const [showAll, setShowAll] = useState(false);
  
  const displayCount = compact ? 6 : 12;
  const displayPhotos = showAll ? photos : photos.slice(0, displayCount);
  const remainingCount = photos.length - displayCount;
  const hasMore = remainingCount > 0;

  if (!photos.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        No photos available
      </p>
    );
  }

  return (
    <div>
      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-4")}>
        {displayPhotos.map((photo, i) => (
          <div key={i} className="aspect-square rounded overflow-hidden bg-muted">
            <img
              src={photo}
              alt={`Property ${i + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ))}
      </div>
      
      {hasMore && !showAll && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(true)}
            className="text-xs"
            data-testid="button-show-more-photos"
          >
            <span>+{remainingCount} more photos</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </div>
      )}
      
      {showAll && photos.length > displayCount && (
        <div className="flex justify-center mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(false)}
            className="text-xs text-muted-foreground"
            data-testid="button-show-less-photos"
          >
            <ChevronUp className="h-3 w-3 mr-1" />
            <span>Show less</span>
          </Button>
        </div>
      )}
    </div>
  );
}
