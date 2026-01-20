import { useMemo, useEffect } from 'react';
import { Check, Sparkles, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface CoverPhotoGridProps {
  photos: string[];
  selectedPhoto: string | null;
  source: 'ai' | 'manual';
  imageInsights?: any[];
  onSelect: (url: string) => void;
  onPreview: (url: string, label: string | null) => void;
}

const CDN_BASE = 'https://cdn.repliers.io/';

function ensureFullUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('unlock-mls/')) return `${CDN_BASE}${url}`;
  return url;
}

export function CoverPhotoGrid({
  photos,
  selectedPhoto,
  source,
  imageInsights,
  onSelect,
  onPreview,
}: CoverPhotoGridProps) {
  
  const normalizedPhotos = useMemo(() => 
    photos.filter(Boolean).map(ensureFullUrl), 
    [photos]
  );

  const aiRecommendation = useMemo(() => {
    if (!normalizedPhotos.length) return null;
    
    if (imageInsights?.length) {
      const priorities = ['front', 'exterior', 'facade'];
      
      for (const priority of priorities) {
        const match = imageInsights.find((img: any) => 
          img.classification?.imageOf?.toLowerCase().includes(priority)
        );
        if (match) {
          const index = match.originalIndex ?? imageInsights.indexOf(match);
          return { 
            url: normalizedPhotos[index], 
            label: match.classification?.imageOf,
            quality: match.quality?.qualitative,
            index 
          };
        }
      }
      
      const sorted = [...imageInsights].sort((a, b) => 
        (b.quality?.score || 0) - (a.quality?.score || 0)
      );
      if (sorted[0]) {
        const index = sorted[0].originalIndex ?? 0;
        return {
          url: normalizedPhotos[index],
          label: sorted[0].classification?.imageOf || 'Best Quality',
          quality: sorted[0].quality?.qualitative,
          index
        };
      }
    }
    
    return { url: normalizedPhotos[0], label: 'Primary Photo', quality: null, index: 0 };
  }, [imageInsights, normalizedPhotos]);

  useEffect(() => {
    if (source === 'ai' && aiRecommendation && !selectedPhoto) {
      onSelect(aiRecommendation.url);
    }
  }, [source, aiRecommendation, selectedPhoto, onSelect]);

  useEffect(() => {
    if (source === 'ai' && aiRecommendation) {
      onSelect(aiRecommendation.url);
    }
  }, [source, aiRecommendation, onSelect]);

  const getPhotoInfo = (index: number) => {
    if (!imageInsights?.[index]) return null;
    return {
      label: imageInsights[index].classification?.imageOf,
      quality: imageInsights[index].quality?.qualitative,
    };
  };

  if (!normalizedPhotos.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No photos available for this property
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {source === 'ai' && aiRecommendation && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            AI selected: <strong>{aiRecommendation.label || 'Best photo'}</strong>
            {aiRecommendation.quality && (
              <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 dark:bg-amber-800">
                {aiRecommendation.quality}
              </Badge>
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {normalizedPhotos.slice(0, 12).map((photo, idx) => {
          const isSelected = selectedPhoto === photo;
          const isAiPick = source === 'ai' && aiRecommendation?.index === idx;
          const info = getPhotoInfo(idx);
          
          return (
            <div key={idx} className="relative group">
              <button
                onClick={() => source === 'manual' && onSelect(photo)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all w-full",
                  isSelected 
                    ? "border-[#F37216] ring-2 ring-[#F37216]/30" 
                    : "border-muted",
                  source === 'manual' && "hover:border-[#F37216]/50 cursor-pointer",
                  source === 'ai' && !isSelected && "opacity-50 cursor-default"
                )}
                data-testid={`cover-photo-${idx}`}
              >
                <img 
                  src={photo} 
                  alt={info?.label || `Photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.opacity = '0';
                  }}
                />
                
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-[#F37216] rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                
                {isAiPick && (
                  <div className="absolute top-1.5 left-1.5">
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 shadow">
                      <Sparkles className="w-3 h-3" />
                    </Badge>
                  </div>
                )}
                
                {info?.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <span className="text-[11px] text-white font-medium truncate block">
                      {info.label}
                    </span>
                  </div>
                )}

                {info?.quality && !isAiPick && (
                  <div className={cn(
                    "absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full border border-white shadow",
                    info.quality === 'excellent' && "bg-green-500",
                    info.quality === 'above average' && "bg-blue-500",
                    info.quality === 'average' && "bg-yellow-500",
                  )} />
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(photo, info?.label || `Photo ${idx + 1}`);
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="Click to preview"
                data-testid={`preview-photo-${idx}`}
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            </div>
          );
        })}
      </div>

      {normalizedPhotos.length > 12 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing 12 of {normalizedPhotos.length} photos
        </p>
      )}

      {imageInsights && imageInsights.length > 0 && (
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <span className="font-medium">Quality:</span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Excellent
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Above Average
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Average
          </span>
        </div>
      )}
    </div>
  );
}

export default CoverPhotoGrid;
