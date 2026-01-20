import { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Check, Image as ImageIcon, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Property {
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
  properties: Property[];
  photoSource: string;
  photosPerProperty: number;
  onSelectionChange: (selections: Record<string, string[]>) => void;
}

interface ImageInfo {
  url: string;
  originalIndex: number;
  classification?: { imageOf?: string; prediction?: number; confidence?: number } | null;
  quality?: { qualitative?: string; quantitative?: number; score?: number } | null;
  score?: number;
}

export function PhotoSelectionPreview({
  properties,
  photoSource,
  photosPerProperty,
  onSelectionChange,
}: PhotoSelectionPreviewProps) {
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [aiRecommendations, setAiRecommendations] = useState<Record<string, ImageInfo[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightsAvailable, setInsightsAvailable] = useState(true);
  
  const hasFetchedRef = useRef(false);
  const lastPhotoSourceRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const getPropertyPhotos = useCallback((property: Property): string[] => {
    const photos = property.photos || property.images || [];
    return photos.filter(Boolean);
  }, []);

  const getTopPhotos = useCallback((images: ImageInfo[], count: number): ImageInfo[] => {
    const priorityOrder = [
      'front', 'exterior', 'facade',
      'kitchen', 
      'living room', 'living', 'family room',
      'pool', 'backyard', 'patio',
      'master bedroom', 'bedroom',
      'bathroom', 'master bath',
      'dining', 'dining room',
    ];
    
    const scored = images.map((img, index) => {
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
      
      return { 
        ...img, 
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
    const autoSelections: Record<string, string[]> = {};
    
    properties.filter(Boolean).forEach(property => {
      const propertyId = property.listingId || property.mlsNumber || property.id || '';
      const photos = getPropertyPhotos(property);
      autoSelections[propertyId] = photos.slice(0, photosPerProperty);
    });
    
    setSelections(autoSelections);
    onSelectionChange(autoSelections);
  }, [properties, photosPerProperty, getPropertyPhotos, onSelectionChange]);

  const fetchAiRecommendations = useCallback(async (forceRefresh = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setLoading(true);
    setError(null);
    
    try {
      const recommendations: Record<string, ImageInfo[]> = {};
      const validProperties = properties.filter(Boolean);
      let anyInsightsAvailable = false;
      
      for (let i = 0; i < validProperties.length; i++) {
        if (signal.aborted) return;
        
        const property = validProperties[i];
        const propertyId = property.listingId || property.mlsNumber || property.id;
        if (!propertyId) continue;
        
        const photos = getPropertyPhotos(property);
        
        if (property.imageInsights?.images && property.imageInsights.images.length > 0) {
          recommendations[propertyId] = getTopPhotos(
            property.imageInsights.images.map((img, idx) => ({
              url: photos[idx] || img.image || '',
              originalIndex: idx,
              classification: img.classification,
              quality: img.quality,
            })),
            photosPerProperty
          );
          anyInsightsAvailable = true;
          continue;
        }
        
        try {
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          if (signal.aborted) return;
          
          const response = await fetch(`/api/repliers/listing/${propertyId}/image-insights`, { signal });
          
          if (!response.ok) {
            recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
              url,
              originalIndex: idx,
              classification: null,
              quality: null,
            }));
            continue;
          }
          
          const data = await response.json();
          
          if (data.available && data.images?.length > 0) {
            anyInsightsAvailable = true;
            recommendations[propertyId] = getTopPhotos(data.images, photosPerProperty);
          } else {
            recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
              url,
              originalIndex: idx,
              classification: null,
              quality: null,
            }));
          }
        } catch (fetchError: any) {
          if (fetchError.name === 'AbortError') return;
          recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
            url,
            originalIndex: idx,
            classification: null,
            quality: null,
          }));
        }
      }
      
      if (signal.aborted) return;
      
      setInsightsAvailable(anyInsightsAvailable);
      setAiRecommendations(recommendations);
      
      const autoSelections: Record<string, string[]> = {};
      for (const [propId, propPhotos] of Object.entries(recommendations)) {
        autoSelections[propId] = propPhotos.map(p => p.url).filter(Boolean);
      }
      setSelections(autoSelections);
      onSelectionChange(autoSelections);
      
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Failed to fetch AI recommendations:', err);
      setError(err instanceof Error ? err.message : 'Failed to analyze photos');
      autoSelectPhotos();
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [properties, photosPerProperty, getPropertyPhotos, getTopPhotos, autoSelectPhotos, onSelectionChange]);

  useEffect(() => {
    if (photoSource !== lastPhotoSourceRef.current) {
      hasFetchedRef.current = false;
      lastPhotoSourceRef.current = photoSource;
    }
    
    if (photoSource === 'ai_suggested' && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchAiRecommendations();
    } else if (photoSource === 'custom') {
      autoSelectPhotos();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [photoSource, fetchAiRecommendations, autoSelectPhotos]);

  const handleRetry = useCallback(() => {
    hasFetchedRef.current = false;
    fetchAiRecommendations(true);
  }, [fetchAiRecommendations]);

  const togglePhotoSelection = useCallback((propertyId: string, photoUrl: string) => {
    setSelections(prev => {
      const current = prev[propertyId] || [];
      let updated: string[];
      
      if (current.includes(photoUrl)) {
        updated = current.filter(url => url !== photoUrl);
      } else if (current.length < photosPerProperty) {
        updated = [...current, photoUrl];
      } else {
        updated = [...current.slice(1), photoUrl];
      }
      
      const newSelections = { ...prev, [propertyId]: updated };
      onSelectionChange(newSelections);
      return newSelections;
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
            : `Select up to ${photosPerProperty} photo(s) per property.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-h-96 overflow-y-auto">
        {properties.filter(Boolean).map((property) => {
          const propertyId = property.listingId || property.mlsNumber || property.id || '';
          const photos = getPropertyPhotos(property);
          const selectedPhotos = selections[propertyId] || [];
          const aiRecs = aiRecommendations[propertyId] || [];
          
          if (!photos.length) return null;
          
          return (
            <div key={propertyId} className="border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-sm">
                    {property.unparsedAddress?.split(',')[0] || property.address || 'Property'}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {photos.length} available &bull; {selectedPhotos.length}/{photosPerProperty} selected
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {photos.slice(0, 12).map((photo: string, idx: number) => {
                  const isSelected = selectedPhotos.includes(photo);
                  const aiRec = aiRecs.find(r => r.url === photo || r.originalIndex === idx);
                  const classification = aiRec?.classification?.imageOf;
                  const quality = aiRec?.quality?.qualitative;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => togglePhotoSelection(propertyId, photo)}
                      className={cn(
                        "relative aspect-square rounded-lg overflow-hidden border-2 transition-all",
                        isSelected 
                          ? "border-[#F37216] ring-2 ring-[#F37216]/20" 
                          : "border-transparent hover:border-muted-foreground/50"
                      )}
                      title={classification ? `${classification} (${quality || 'unknown quality'})` : `Photo ${idx + 1}`}
                      data-testid={`photo-select-${propertyId}-${idx}`}
                    >
                      <img 
                        src={photo} 
                        alt={classification || `Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
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
          );
        })}
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
