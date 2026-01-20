import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Sparkles, Check, Image as ImageIcon, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SubjectProperty {
  id?: string;
  listingId?: string;
  mlsNumber?: string;
  unparsedAddress?: string;
  address?: string;
  photos?: string[];
  images?: string[];
  imageInsights?: {
    images?: Array<{
      image?: string;
      quality?: {
        qualitative?: string;
        quantitative?: number;
        score?: number;
      };
      classification?: {
        imageOf?: string;
        prediction?: number;
        confidence?: number;
      };
    }>;
  };
}

interface PhotoSelectionPreviewProps {
  subjectProperty: SubjectProperty | null;
  photoSource: string;
  photosPerProperty: number;
  onSelectionChange: (selectedPhotos: string[]) => void;
}

interface ImageInfo {
  url: string;
  originalIndex: number;
  classification?: { imageOf?: string; prediction?: number; confidence?: number } | null;
  quality?: { qualitative?: string; quantitative?: number; score?: number } | null;
  score?: number;
}

const CDN_BASE = 'https://cdn.repliers.io/';

function ensureFullUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('unlock-mls/')) return `${CDN_BASE}${url}`;
  return url;
}

export function PhotoSelectionPreview({
  subjectProperty,
  photoSource,
  photosPerProperty,
  onSelectionChange,
}: PhotoSelectionPreviewProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [aiRecommendations, setAiRecommendations] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsAvailable, setInsightsAvailable] = useState(true);
  
  const hasFetchedRef = useRef(false);
  const lastPhotoSourceRef = useRef<string>('');

  const photos = useMemo(() => {
    if (!subjectProperty) return [];
    const rawPhotos = subjectProperty.photos || subjectProperty.images || [];
    return rawPhotos.filter(Boolean).map(ensureFullUrl);
  }, [subjectProperty]);

  const propertyId = subjectProperty?.listingId || subjectProperty?.mlsNumber || subjectProperty?.id || '';
  const propertyAddress = subjectProperty?.unparsedAddress?.split(',')[0] || 
                          subjectProperty?.address || 
                          'Subject Property';

  const getTopPhotos = useCallback((insights: any[], allPhotos: string[], count: number): ImageInfo[] => {
    const priorityOrder = [
      'front', 'exterior', 'facade',
      'kitchen', 
      'living room', 'living', 'family room',
      'pool', 'backyard', 'patio',
      'master bedroom', 'bedroom',
      'bathroom', 'master bath',
      'dining', 'dining room',
    ];
    
    const scored = insights.map((img, index) => {
      let score = 0;
      const classification = (img.classification?.imageOf || '').toLowerCase();
      
      if (img.quality?.qualitative === 'excellent') score += 100;
      else if (img.quality?.qualitative === 'above average') score += 75;
      else if (img.quality?.qualitative === 'average') score += 50;
      else if (img.quality?.qualitative === 'below average') score += 25;
      
      if (img.quality?.score) {
        score += (img.quality.score / 6) * 30;
      }
      
      for (let i = 0; i < priorityOrder.length; i++) {
        if (classification.includes(priorityOrder[i])) {
          score += (priorityOrder.length - i) * 5;
          break;
        }
      }
      
      if (img.classification?.confidence) {
        score += img.classification.confidence * 10;
      }
      
      const photoUrl = ensureFullUrl(img.url) || allPhotos[img.originalIndex] || allPhotos[index] || '';
      
      return { 
        ...img, 
        url: photoUrl,
        score, 
        originalIndex: img.originalIndex ?? index 
      };
    });
    
    return scored
      .filter(img => img.url)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, count);
  }, []);

  const autoSelectPhotos = useCallback(() => {
    const selected = photos.slice(0, photosPerProperty);
    setSelectedPhotos(selected);
    onSelectionChange(selected);
  }, [photos, photosPerProperty, onSelectionChange]);

  const fetchAiRecommendations = useCallback(async () => {
    if (!propertyId) {
      autoSelectPhotos();
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      if (subjectProperty?.imageInsights?.images && subjectProperty.imageInsights.images.length > 0) {
        const topPhotos = getTopPhotos(
          subjectProperty.imageInsights.images.map((img, idx) => ({
            url: photos[idx] || img.image || '',
            originalIndex: idx,
            classification: img.classification,
            quality: img.quality,
          })),
          photos,
          photosPerProperty
        );
        setAiRecommendations(topPhotos);
        setInsightsAvailable(true);
        
        const selected = topPhotos.map(p => p.url).filter(Boolean);
        setSelectedPhotos(selected);
        onSelectionChange(selected);
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/repliers/listing/${propertyId}/image-insights`);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.available && data.images?.length > 0) {
        setInsightsAvailable(true);
        const topPhotos = getTopPhotos(data.images, photos, photosPerProperty);
        setAiRecommendations(topPhotos);
        
        const selected = topPhotos.map(p => p.url).filter(Boolean);
        setSelectedPhotos(selected);
        onSelectionChange(selected);
      } else {
        setInsightsAvailable(false);
        autoSelectPhotos();
      }
      
    } catch (err) {
      console.error('Failed to fetch AI recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze photos');
      setInsightsAvailable(false);
      autoSelectPhotos();
    } finally {
      setLoading(false);
    }
  }, [propertyId, subjectProperty, photos, photosPerProperty, getTopPhotos, autoSelectPhotos, onSelectionChange]);

  useEffect(() => {
    if (photoSource !== lastPhotoSourceRef.current) {
      hasFetchedRef.current = false;
      lastPhotoSourceRef.current = photoSource;
    }
    
    if (photoSource === 'ai_suggested' && !hasFetchedRef.current && propertyId) {
      hasFetchedRef.current = true;
      fetchAiRecommendations();
    } else if (photoSource === 'custom') {
      setSelectedPhotos([]);
      onSelectionChange([]);
    } else if (photoSource !== 'ai_suggested') {
      autoSelectPhotos();
    }
  }, [photoSource, propertyId, fetchAiRecommendations, autoSelectPhotos, onSelectionChange]);

  const handleRetry = useCallback(() => {
    hasFetchedRef.current = false;
    fetchAiRecommendations();
  }, [fetchAiRecommendations]);

  const togglePhotoSelection = useCallback((photoUrl: string) => {
    setSelectedPhotos(prev => {
      let updated: string[];
      
      if (prev.includes(photoUrl)) {
        updated = prev.filter(url => url !== photoUrl);
      } else if (prev.length < photosPerProperty) {
        updated = [...prev, photoUrl];
      } else {
        updated = [...prev.slice(1), photoUrl];
      }
      
      onSelectionChange(updated);
      return updated;
    });
  }, [photosPerProperty, onSelectionChange]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#F37216]" />
            <span className="text-muted-foreground">Analyzing photos with AI...</span>
            <span className="text-xs text-muted-foreground/70">Using Repliers Image Insights API</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-6 h-6 text-amber-500" />
            <span className="text-foreground">Could not analyze photos</span>
            <span className="text-xs text-muted-foreground">{error}</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="mt-2"
              data-testid="button-retry-ai-analysis"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (photoSource !== 'ai_suggested' && photoSource !== 'custom') {
    return null;
  }

  if (!subjectProperty || photos.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="w-5 h-5" />
            <span>No photos available for subject property</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          {photoSource === 'ai_suggested' ? (
            <>
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <CardTitle className="text-base">AI Suggested Photos</CardTitle>
              {insightsAvailable ? (
                <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                  Repliers Image Insights
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Using default selection
                </Badge>
              )}
            </>
          ) : (
            <>
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="text-base">Custom Photo Selection</CardTitle>
            </>
          )}
        </div>
        <CardDescription>
          {photoSource === 'ai_suggested' 
            ? insightsAvailable
              ? 'AI has selected the best quality photos based on image classification and quality scores.'
              : 'Image Insights not available. Using first photos as default. You can manually adjust.'
            : `Select up to ${photosPerProperty} photo(s) for the subject property.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium text-sm">{propertyAddress}</h4>
              <span className="text-xs text-muted-foreground">
                {photos.length} available &bull; {selectedPhotos.length}/{photosPerProperty} selected
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {photos.slice(0, 12).map((photo: string, idx: number) => {
              const isSelected = selectedPhotos.includes(photo);
              const aiRec = aiRecommendations.find(r => r.url === photo || r.originalIndex === idx);
              const classification = aiRec?.classification?.imageOf;
              const quality = aiRec?.quality?.qualitative;
              
              return (
                <button
                  key={idx}
                  onClick={() => togglePhotoSelection(photo)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden border-2 transition-all bg-muted",
                    isSelected 
                      ? "border-[#F37216] ring-2 ring-[#F37216]/20" 
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  title={classification ? `${classification} (${quality || 'unknown quality'})` : `Photo ${idx + 1}`}
                  data-testid={`photo-select-subject-${idx}`}
                >
                  <img 
                    src={photo} 
                    alt={classification || `Photo ${idx + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.opacity = '0';
                    }}
                  />
                  
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-[#F37216] rounded-full flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                  
                  {classification && photoSource === 'ai_suggested' && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                      <span className="text-[10px] text-white font-medium truncate block">
                        {classification}
                      </span>
                    </div>
                  )}
                  
                  {quality && photoSource === 'ai_suggested' && (
                    <div className={cn(
                      "absolute top-1 left-1 w-2 h-2 rounded-full",
                      quality === 'excellent' && "bg-green-500",
                      quality === 'above average' && "bg-blue-500",
                      quality === 'average' && "bg-yellow-500",
                      quality === 'below average' && "bg-red-500",
                    )} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
      
      {photoSource === 'ai_suggested' && insightsAvailable && (
        <div className="px-6 py-4 border-t">
          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium">Quality:</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Excellent</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Above Average</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Average</span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default PhotoSelectionPreview;
