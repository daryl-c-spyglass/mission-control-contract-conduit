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
          <button
            key={i}
            type="button"
            className="aspect-square rounded-lg overflow-hidden bg-muted relative group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-manipulation"
          >
            <img
              src={photo}
              alt={`Property ${i + 1}`}
              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </button>
        ))}
      </div>
      
      {hasMore && !showAll && (
        <Button
          variant="outline"
          size="default"
          onClick={() => setShowAll(true)}
          className="w-full mt-3 touch-manipulation"
          data-testid="button-show-more-photos"
        >
          <span>+{remainingCount} more photos</span>
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      )}
      
      {showAll && photos.length > displayCount && (
        <Button
          variant="ghost"
          size="default"
          onClick={() => setShowAll(false)}
          className="w-full mt-3 touch-manipulation"
          data-testid="button-show-less-photos"
        >
          <ChevronUp className="h-4 w-4 mr-1" />
          <span>Show less</span>
        </Button>
      )}
    </div>
  );
}
