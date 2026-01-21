import { useMemo, useState, useEffect } from 'react';
import { Check, Sparkles, ZoomIn, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CoverPhotoGridProps {
  photos: string[];
  selectedPhoto: string | null;
  source: 'ai' | 'manual';
  imageInsights?: any[];
  isLoadingInsights?: boolean;
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
  isLoadingInsights = false,
  onSelect,
  onPreview,
}: CoverPhotoGridProps) {
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const INITIAL_PHOTO_COUNT = 12;
  
  const normalizedPhotos = useMemo(() => 
    photos.filter(Boolean).map(ensureFullUrl), 
    [photos]
  );

  const aiClassifiedPhotos = useMemo(() => {
    if (!imageInsights?.length) return [];
    
    return imageInsights
      .map((insight: any, index: number) => {
        if (!insight.classification?.imageOf) return null;
        const originalIndex = insight.originalIndex ?? index;
        const url = normalizedPhotos[originalIndex];
        if (!url) return null;
        
        return {
          url,
          classification: insight.classification.imageOf,
          quality: insight.quality?.qualitative,
          originalIndex,
        };
      })
      .filter(Boolean) as Array<{
        url: string;
        classification: string;
        quality: string | null;
        originalIndex: number;
      }>;
  }, [imageInsights, normalizedPhotos]);

  const aiRecommendation = useMemo(() => {
    if (!aiClassifiedPhotos.length) return null;
    
    const priorities = ['front', 'exterior', 'facade'];
    
    for (const priority of priorities) {
      const match = aiClassifiedPhotos.find((photo) => 
        photo.classification.toLowerCase().includes(priority)
      );
      if (match) return match;
    }
    
    return aiClassifiedPhotos[0];
  }, [aiClassifiedPhotos]);

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

  const displayedManualPhotos = useMemo(() => {
    return showAllPhotos ? normalizedPhotos : normalizedPhotos.slice(0, INITIAL_PHOTO_COUNT);
  }, [normalizedPhotos, showAllPhotos]);

  const hasMorePhotos = normalizedPhotos.length > INITIAL_PHOTO_COUNT;
  const remainingPhotoCount = normalizedPhotos.length - INITIAL_PHOTO_COUNT;

  if (!normalizedPhotos.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No photos available for this property
      </div>
    );
  }

  if (source === 'ai') {
    if (isLoadingInsights) {
      return (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
          <span className="text-sm text-muted-foreground">Analyzing photos with AI...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {aiRecommendation && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              AI selected: <strong>{aiClassifiedPhotos.find(p => p.url === selectedPhoto)?.classification || aiRecommendation.classification}</strong>
              {aiRecommendation.quality && (
                <Badge variant="secondary" className="ml-2 text-xs bg-amber-100 dark:bg-amber-800">
                  {aiRecommendation.quality}
                </Badge>
              )}
            </span>
          </div>
        )}

        {aiClassifiedPhotos.length > 0 ? (
          <>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {aiClassifiedPhotos.map((photo, idx) => {
                const isSelected = selectedPhoto === photo.url;
                const isAiPick = aiRecommendation?.url === photo.url;
                
                return (
                  <div key={idx} className="relative group">
                    <button
                      onClick={() => onSelect(photo.url)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all w-full cursor-pointer",
                        isSelected 
                          ? "border-[#F37216] ring-2 ring-[#F37216]/30" 
                          : "border-muted hover:border-[#F37216]/50"
                      )}
                      data-testid={`ai-cover-photo-${idx}`}
                    >
                      <img 
                        src={photo.url} 
                        alt={photo.classification}
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
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                        <span className="text-[11px] text-white font-medium truncate block">
                          {photo.classification}
                        </span>
                      </div>

                      {photo.quality && !isAiPick && (
                        <div className={cn(
                          "absolute top-1.5 left-1.5 w-2.5 h-2.5 rounded-full border border-white shadow",
                          photo.quality === 'excellent' && "bg-green-500",
                          photo.quality === 'above average' && "bg-blue-500",
                          photo.quality === 'average' && "bg-yellow-500",
                        )} />
                      )}
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(photo.url, photo.classification);
                      }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      title="Click to preview"
                      data-testid={`preview-ai-photo-${idx}`}
                    >
                      <ZoomIn className="w-4 h-4 text-white" />
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Showing {aiClassifiedPhotos.length} AI-analyzed photos
            </p>

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
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No AI-classified photos available.</p>
            <p className="text-sm mt-1">Switch to Manual Selection to see all photos.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
        {displayedManualPhotos.map((photo, displayIdx) => {
          const isSelected = selectedPhoto === photo;
          const actualIndex = normalizedPhotos.indexOf(photo);
          const info = actualIndex >= 0 && imageInsights?.[actualIndex] ? {
            label: imageInsights[actualIndex].classification?.imageOf,
            quality: imageInsights[actualIndex].quality?.qualitative,
          } : null;
          
          return (
            <div key={displayIdx} className="relative group">
              <button
                onClick={() => onSelect(photo)}
                className={cn(
                  "relative aspect-square rounded-lg overflow-hidden border-2 transition-all w-full cursor-pointer",
                  isSelected 
                    ? "border-[#F37216] ring-2 ring-[#F37216]/30" 
                    : "border-muted hover:border-[#F37216]/50"
                )}
                data-testid={`cover-photo-${displayIdx}`}
              >
                <img 
                  src={photo} 
                  alt={info?.label || `Photo ${displayIdx + 1}`}
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
                
                {info?.label && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                    <span className="text-[11px] text-white font-medium truncate block">
                      {info.label}
                    </span>
                  </div>
                )}

                {info?.quality && (
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
                  onPreview(photo, info?.label || `Photo ${displayIdx + 1}`);
                }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                title="Click to preview"
                data-testid={`preview-photo-${displayIdx}`}
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </button>
            </div>
          );
        })}
      </div>

      {hasMorePhotos && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowAllPhotos(!showAllPhotos)}
            className="gap-2"
            data-testid="button-load-more-photos"
          >
            {showAllPhotos ? (
              <>
                <ChevronUp className="w-4 h-4" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Load More ({remainingPhotoCount} more photos)
              </>
            )}
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Showing {displayedManualPhotos.length} of {normalizedPhotos.length} photos
      </p>

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
