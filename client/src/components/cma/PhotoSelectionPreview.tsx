import { useState, useEffect } from 'react';
import { Sparkles, Check, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
      };
      classification?: {
        imageOf?: string;
        prediction?: number;
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
  classification?: { imageOf?: string; prediction?: number };
  quality?: { qualitative?: string; quantitative?: number };
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

  useEffect(() => {
    if (photoSource === 'ai_suggested') {
      fetchAiRecommendations();
    }
  }, [photoSource, properties, photosPerProperty]);

  const fetchAiRecommendations = async () => {
    setLoading(true);
    try {
      const recommendations: Record<string, ImageInfo[]> = {};
      
      for (const property of properties.filter(Boolean)) {
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
        } else {
          try {
            const response = await fetch(`/api/repliers/listing/${propertyId}/image-insights`);
            if (response.ok) {
              const data = await response.json();
              if (data.available && data.images) {
                recommendations[propertyId] = getTopPhotos(data.images, photosPerProperty);
              } else {
                recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
                  url,
                  originalIndex: idx,
                }));
              }
            } else {
              recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
                url,
                originalIndex: idx,
              }));
            }
          } catch (error) {
            console.error('Failed to fetch image insights for', propertyId, error);
            recommendations[propertyId] = photos.slice(0, photosPerProperty).map((url, idx) => ({
              url,
              originalIndex: idx,
            }));
          }
        }
      }
      
      setAiRecommendations(recommendations);
      
      const autoSelections: Record<string, string[]> = {};
      for (const [propertyId, photos] of Object.entries(recommendations)) {
        autoSelections[propertyId] = photos.map(p => p.url);
      }
      setSelections(autoSelections);
      onSelectionChange(autoSelections);
      
    } catch (error) {
      console.error('Failed to fetch AI recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPropertyPhotos = (property: Property): string[] => {
    const photos = property.photos || property.images || [];
    return photos.filter(Boolean);
  };

  const getTopPhotos = (images: ImageInfo[], count: number): ImageInfo[] => {
    const priorityOrder = ['front', 'exterior', 'kitchen', 'living', 'pool', 'patio', 'backyard', 'bedroom', 'bathroom'];
    
    const scored = images.map((img, index) => {
      let score = 0;
      const classification = img.classification?.imageOf?.toLowerCase() || '';
      
      if (img.quality?.qualitative === 'excellent') score += 100;
      else if (img.quality?.qualitative === 'above average') score += 75;
      else if (img.quality?.qualitative === 'average') score += 50;
      else if (img.quality?.qualitative === 'below average') score += 25;
      
      if (img.quality?.quantitative) {
        score += img.quality.quantitative * 10;
      }
      
      const priorityIndex = priorityOrder.findIndex(p => classification.includes(p));
      if (priorityIndex !== -1) {
        score += (priorityOrder.length - priorityIndex) * 15;
      }
      
      if (classification.includes('front') || classification.includes('exterior')) {
        score += 50;
      }
      
      return { ...img, score, originalIndex: img.originalIndex ?? index };
    });
    
    return scored
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, count);
  };

  const togglePhotoSelection = (propertyId: string, photoUrl: string) => {
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
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#F37216]" />
            <span className="text-muted-foreground">Analyzing photos with AI...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {photoSource === 'ai_suggested' ? (
            <>
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <CardTitle className="text-base">AI Suggested Photos</CardTitle>
              <Badge variant="secondary" className="text-xs">Repliers Image Insights</Badge>
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
            ? 'AI has selected the best quality photos based on image classification and quality scores.'
            : `Select up to ${photosPerProperty} photo(s) per property.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
                      data-testid={`photo-select-${propertyId}-${idx}`}
                    >
                      <img 
                        src={photo} 
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-5 h-5 bg-[#F37216] rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                      
                      {aiRec && photoSource === 'ai_suggested' && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                          <span className="text-[10px] text-white font-medium truncate block">
                            {aiRec.classification?.imageOf || 'Best'}
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
