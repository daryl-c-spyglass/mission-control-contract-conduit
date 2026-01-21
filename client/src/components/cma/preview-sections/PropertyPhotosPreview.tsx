import { cn } from "@/lib/utils";

interface PropertyPhotosPreviewProps {
  photos: string[];
  compact?: boolean;
}

export function PropertyPhotosPreview({ photos, compact }: PropertyPhotosPreviewProps) {
  const displayCount = compact ? 6 : 12;
  const displayPhotos = photos.slice(0, displayCount);
  const remainingCount = photos.length - displayCount;

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
      {remainingCount > 0 && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          +{remainingCount} more photos in full report
        </p>
      )}
    </div>
  );
}
