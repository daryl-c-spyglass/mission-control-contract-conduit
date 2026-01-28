import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, Grid3X3, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FlyerForm } from './FlyerForm';
import { FlyerPreview } from './FlyerPreview';
import { GridOverlay } from './GridOverlay';
import { useMarketingProfile } from '@/hooks/useMarketingProfile';
import { autoSelectPhotosWithInfo, formatPrice, formatAddress, formatNumber, generateDefaultHeadline, doesClassificationMatchCategory, type PhotoSelectionInfo } from '@/lib/flyer-utils';
import { extractSqft, extractBeds, extractBaths } from '@/lib/cma-data-utils';
import type { FlyerData, FlyerImages, ImageTransforms } from '@/lib/flyer-types';
import { DEFAULT_TRANSFORMS } from '@/lib/flyer-types';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface AgentProfileResponse {
  profile: any;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImageUrl: string;
    marketingPhone: string;
    marketingEmail: string;
    marketingDisplayName: string;
    marketingTitle: string;
    marketingHeadshotUrl: string;
  } | null;
}

interface FlyerGeneratorProps {
  transactionId: string;
  transaction: any;
  onBack: () => void;
}

export function FlyerGenerator({ transactionId, transaction, onBack }: FlyerGeneratorProps) {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const [showGrid, setShowGrid] = useState(false);
  const [scale, setScale] = useState<string>('1'); // Default to 100%
  const [imageTransforms, setImageTransforms] = useState<ImageTransforms>({ ...DEFAULT_TRANSFORMS });

  const { data: marketingProfile } = useMarketingProfile();
  
  // Fetch agent profile for name, phone, etc.
  const { data: agentProfile } = useQuery<AgentProfileResponse>({
    queryKey: ['/api/agent/profile'],
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  // Fetch AI-selected photos using Repliers coverImage parameter
  const mlsNumber = transaction?.mlsNumber;
  const { data: aiPhotoData, isLoading: aiPhotosLoading } = useQuery<{
    aiSelected: {
      mainPhoto: { url: string; classification: string; confidence: number; quality: number } | null;
      kitchenPhoto: { url: string; classification: string; confidence: number; quality: number } | null;
      roomPhoto: { url: string; classification: string; confidence: number; quality: number } | null;
    };
    allPhotos: Array<{ url: string; classification: string; confidence: number; quality: number; index: number }>;
    totalPhotos: number;
    selectionMethod: string;
  }>({
    queryKey: [`/api/listings/${mlsNumber}/ai-photos`],
    enabled: !!mlsNumber,
    staleTime: 300000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const [images, setImages] = useState<FlyerImages>({
    mainImage: null,
    kitchenImage: null,
    roomImage: null,
    agentPhoto: null,
    companyLogo: null,
    secondaryLogo: null,
    qrCode: null,
  });

  // Photo selection info for AI tooltips
  const [photoSelectionInfo, setPhotoSelectionInfo] = useState<{
    mainImage: PhotoSelectionInfo | null;
    kitchenImage: PhotoSelectionInfo | null;
    roomImage: PhotoSelectionInfo | null;
  }>({
    mainImage: null,
    kitchenImage: null,
    roomImage: null,
  });

  // All available MLS photos for gallery selection
  const [allMlsPhotos, setAllMlsPhotos] = useState<Array<{ 
    url: string; 
    classification: string;
    displayClassification?: string;
    confidence?: number;
    quality: number;
    index?: number;
  }>>([]);

  // Missing photo categories from AI selection
  const [missingCategories, setMissingCategories] = useState<string[]>([]);

  // Description management for AI summarize
  const [originalDescription, setOriginalDescription] = useState<string>('');
  const [previousDescription, setPreviousDescription] = useState<string>('');
  const [hasUsedAISummarize, setHasUsedAISummarize] = useState(false);

  // QR Code URL state
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  const form = useForm<FlyerData>({
    defaultValues: {
      price: '',
      address: '',
      bedrooms: '',
      bathrooms: '',
      sqft: '',
      introHeading: '',
      introDescription: '',
      agentName: '',
      agentTitle: '',
      phone: '',
    },
  });

  const watchedValues = form.watch();

  // Debug logging at component mount / when key data loads
  useEffect(() => {
    console.log('=== FLYER GENERATOR DEBUG ===');
    console.log('[Flyer] Transaction ID:', transactionId);
    console.log('[Flyer] Transaction:', transaction);
    console.log('[Flyer] Has MLS #:', transaction?.mlsNumber);
    console.log('[Flyer] MLS Data exists:', !!transaction?.mlsData);
    console.log('[Flyer] MLS Photos count:', transaction?.mlsData?.photos?.length || 0);
    console.log('[Flyer] Marketing Profile:', marketingProfile);
    console.log('[Flyer] Agent Profile:', agentProfile);
    console.log('=============================');
  }, [transaction, marketingProfile, agentProfile, transactionId]);

  // Effect for MLS/property data - runs when transaction changes
  useEffect(() => {
    console.log('[Flyer Debug] Transaction effect triggered:', { 
      hasTransaction: !!transaction,
      mlsNumber: transaction?.mlsNumber,
      listPrice: transaction?.listPrice
    });
    
    if (transaction) {
      const mlsData = transaction.mlsData || {};
      console.log('[Flyer Debug] MLS Data keys:', Object.keys(mlsData));
      console.log('[Flyer Debug] MLS Data sample fields:', {
        bedrooms: mlsData.bedrooms,
        beds: mlsData.beds,
        bathrooms: mlsData.bathrooms,
        baths: mlsData.baths,
        sqft: mlsData.sqft,
        listPrice: mlsData.listPrice,
        rawData_exists: !!mlsData.rawData,
        details_exists: !!mlsData.rawData?.details
      });

      // Extract data using robust utility functions that handle Repliers API field variations
      const listPrice = transaction.listPrice || mlsData.listPrice || mlsData.price || mlsData.ListPrice;
      
      // extractBeds/extractBaths return 'N/A' if not found - handle this with comprehensive fallbacks
      const rawBeds = extractBeds(mlsData);
      const rawBaths = extractBaths(mlsData);
      const rawSqft = extractSqft(mlsData);
      
      console.log('[Flyer Debug] Extracted raw values:', { rawBeds, rawBaths, rawSqft, listPrice });
      
      // Comprehensive Repliers field fallbacks with all known field variations
      const bedsValue = rawBeds !== 'N/A' && rawBeds !== null && rawBeds !== undefined
        ? rawBeds 
        : (mlsData.beds ?? mlsData.bedrooms ?? mlsData.bedroomsTotal ?? mlsData.BedroomsTotal ?? 
           mlsData.numBedrooms ?? mlsData.BedroomsTotalInteger ?? mlsData.bedroomsTotalInteger ?? null);
      const beds = bedsValue !== null && bedsValue !== undefined ? bedsValue : '';
      
      const bathsValue = rawBaths !== 'N/A' && rawBaths !== null && rawBaths !== undefined
        ? rawBaths 
        : (mlsData.baths ?? mlsData.bathrooms ?? mlsData.bathroomsTotalInteger ?? mlsData.BathroomsTotalInteger ?? 
           mlsData.bathroomsTotal ?? mlsData.BathroomsTotal ?? mlsData.numBathrooms ?? mlsData.bathroomsFull ?? 
           mlsData.BathroomsFull ?? null);
      const baths = bathsValue !== null && bathsValue !== undefined ? bathsValue : '';
      
      // Handle sqft with all variations, preserving 0 as valid value
      const sqftValue = rawSqft ?? mlsData.sqft ?? mlsData.livingArea ?? mlsData.LivingArea ?? 
                        mlsData.buildingAreaTotal ?? mlsData.BuildingAreaTotal ?? mlsData.size ?? 
                        mlsData.squareFeet ?? mlsData.SquareFeet ?? null;
      const sqft = sqftValue !== null && sqftValue !== undefined ? sqftValue : '';
      
      console.log('[Flyer Debug] Final form values to set:', { 
        beds, baths, sqft, listPrice,
        formattedPrice: formatPrice(listPrice),
        formattedSqft: sqft ? formatNumber(sqft) : ''
      });

      // Store original description for AI summarize feature
      const fullDescription = mlsData.publicRemarks || mlsData.remarks || mlsData.description || '';
      setOriginalDescription(fullDescription);

      // Set property-related form values
      form.setValue('price', formatPrice(listPrice));
      form.setValue('address', formatAddress(transaction, mlsData));
      form.setValue('bedrooms', beds !== null && beds !== undefined && beds !== '' ? String(beds) : '');
      form.setValue('bathrooms', baths !== null && baths !== undefined && baths !== '' ? String(baths) : '');
      form.setValue('sqft', sqft !== null && sqft !== undefined && sqft !== '' ? formatNumber(sqft) : '');
      form.setValue('introHeading', generateDefaultHeadline(transaction, mlsData));
      form.setValue('introDescription', fullDescription);
      
      // Verify the form values were set
      setTimeout(() => {
        console.log('[Flyer Debug] Form values after setValue:', form.getValues());
      }, 100);

      // Get photos from mlsData - handle various Repliers API formats
      const photoUrls = mlsData.photos || mlsData.images || mlsData.Media || [];
      
      // Get imageInsights from mlsData (added to server response), with fallback to rawData
      const imageInsights = mlsData.imageInsights || mlsData.rawData?.imageInsights;
      
      if (photoUrls.length > 0) {
        console.log(`[Flyer AI] Processing ${photoUrls.length} MLS photos for AI selection...`);
        
        // Helper function to extract canonical image identifier from URL
        const extractImageId = (url: string): string => {
          if (!url) return '';
          // Remove query params and hash
          let cleanUrl = url.split('?')[0].split('#')[0];
          // Remove CDN base URL variations
          cleanUrl = cleanUrl.replace(/^https?:\/\/cdn\.repliers\.io\/?/i, '');
          cleanUrl = cleanUrl.replace(/^https?:\/\/[^/]+\/?/i, '');
          // Remove leading slashes and common prefixes
          cleanUrl = cleanUrl.replace(/^\/+/, '').replace(/^area\//i, '');
          // Get filename or use full path
          const filename = cleanUrl.split('/').pop() || cleanUrl;
          return filename.toLowerCase();
        };
        
        // Merge photo URLs with imageInsights data if available
        let photosWithInsights = photoUrls;
        if (imageInsights?.images && Array.isArray(imageInsights.images)) {
          console.log(`[Flyer AI] Found ${imageInsights.images.length} photos with AI classification data`);
          
          // Build maps from multiple possible identifiers to insights
          const insightByFilename = new Map<string, typeof imageInsights.images[0]>();
          const insightByFullPath = new Map<string, typeof imageInsights.images[0]>();
          const insightByIndex = new Map<number, typeof imageInsights.images[0]>();
          
          imageInsights.images.forEach((insight: typeof imageInsights.images[0], index: number) => {
            const imgUrl = insight.image || insight.url || '';
            const imgId = extractImageId(imgUrl);
            if (imgId) {
              insightByFilename.set(imgId, insight);
            }
            // Also store by full normalized path for fallback
            const normalizedPath = imgUrl.replace(/^https?:\/\/[^/]+\/?/i, '').toLowerCase();
            if (normalizedPath) {
              insightByFullPath.set(normalizedPath, insight);
            }
            // Store by index as last resort
            insightByIndex.set(index, insight);
          });
          
          let matchedCount = 0;
          
          // Map photo URLs to objects with embedded insights
          photosWithInsights = photoUrls.map((url: string, index: number) => {
            const urlId = extractImageId(url);
            const normalizedUrl = url.replace(/^https?:\/\/[^/]+\/?/i, '').toLowerCase();
            
            // Try multiple matching strategies
            let insight = insightByFilename.get(urlId) || 
                          insightByFullPath.get(normalizedUrl) ||
                          insightByIndex.get(index); // Fall back to index-based match
            
            if (insight) {
              matchedCount++;
              return {
                url,
                imageInsights: {
                  classification: insight.classification,
                  quality: insight.quality,
                },
              };
            }
            return url; // Return as plain string if no matching insight
          });
          
          console.log(`[Flyer AI] Matched ${matchedCount}/${photoUrls.length} photos with AI insights`);
        }
        
        const selected = autoSelectPhotosWithInfo(photosWithInsights);
        
        // Only set photos from imageInsights if we don't have coverImage API data
        // coverImage API provides better AI selection and takes priority
        if (!aiPhotoData?.aiSelected) {
          setImages(prev => ({
            ...prev,
            mainImage: selected.mainPhoto,
            kitchenImage: selected.kitchenPhoto,
            roomImage: selected.roomPhoto,
          }));
          setPhotoSelectionInfo(selected.selectionInfo);
        }
        
        // Always set allMlsPhotos from imageInsights for gallery selection
        setAllMlsPhotos(selected.allPhotos);
        setMissingCategories(selected.missingCategories || []);
      }
    }
  }, [transaction, form, aiPhotoData]);

  // Effect for AI-selected photos from coverImage API (takes priority over imageInsights)
  useEffect(() => {
    console.log('[Flyer Debug] AI Photos effect triggered:', { 
      aiPhotoData, 
      aiPhotosLoading,
      hasAiSelected: !!aiPhotoData?.aiSelected 
    });
    
    if (aiPhotoData?.aiSelected && !aiPhotosLoading) {
      const { mainPhoto, kitchenPhoto, roomPhoto } = aiPhotoData.aiSelected;
      
      console.log(`[Flyer AI] Using coverImage API selection (method: ${aiPhotoData.selectionMethod})`);
      console.log('[Flyer Debug] Setting images from AI:', { mainPhoto, kitchenPhoto, roomPhoto });
      
      // Set images from coverImage API selection
      setImages(prev => ({
        ...prev,
        mainImage: mainPhoto?.url || prev.mainImage,
        kitchenImage: kitchenPhoto?.url || prev.kitchenImage,
        roomImage: roomPhoto?.url || prev.roomImage,
      }));
      
      // Update selection info with coverImage API data
      const buildSelectionInfo = (
        photo: typeof mainPhoto, 
        expectedCategory: 'Kitchen' | 'Living Room' | 'Exterior'
      ): PhotoSelectionInfo | null => {
        if (!photo) return null;
        
        // Check if the photo's classification matches the expected category
        const matchesCategory = doesClassificationMatchCategory(photo.classification, expectedCategory);
        
        // Consider it a mismatch if:
        // 1. Classification doesn't match expected category, OR
        // 2. Low confidence score (below 50%)
        // This applies regardless of selection method
        const isCategoryMismatch = !matchesCategory || photo.confidence < 50;
        
        return {
          classification: photo.classification.toLowerCase(),
          displayClassification: photo.classification,
          confidence: photo.confidence,
          quality: photo.quality,
          reason: matchesCategory 
            ? `AI detected: ${photo.classification}` 
            : `Selected from available photos (not a ${expectedCategory.toLowerCase()} photo)`,
          isAISelected: photo.confidence >= 70 && matchesCategory,
          categoryMismatch: isCategoryMismatch,
          expectedCategory,
        };
      };
      
      setPhotoSelectionInfo({
        mainImage: buildSelectionInfo(mainPhoto, 'Exterior'),
        kitchenImage: buildSelectionInfo(kitchenPhoto, 'Kitchen'),
        roomImage: buildSelectionInfo(roomPhoto, 'Living Room'),
      });
      
      // Track missing categories
      const missing: string[] = [];
      if (!mainPhoto) missing.push('Exterior');
      if (!kitchenPhoto) missing.push('Kitchen');
      if (!roomPhoto) missing.push('Living Room');
      setMissingCategories(missing);
      
      // Use allPhotos from coverImage API if available
      if (aiPhotoData.allPhotos && aiPhotoData.allPhotos.length > 0) {
        setAllMlsPhotos(aiPhotoData.allPhotos.map(p => ({
          ...p,
          displayClassification: p.classification,
        })));
      }
    }
  }, [aiPhotoData, aiPhotosLoading]);

  // Effect for agent data - runs when agent profile or marketing profile loads
  useEffect(() => {
    console.log('[Flyer Debug] Agent effect triggered:', { 
      agentProfile, 
      marketingProfile,
      user: agentProfile?.user 
    });
    
    const user = agentProfile?.user;
    
    // Build agent name - try user settings first, then transaction data
    let agentName = '';
    if (user?.marketingDisplayName) {
      agentName = user.marketingDisplayName;
    } else if (user?.firstName || user?.lastName) {
      agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    } else if (transaction?.agentName) {
      agentName = transaction.agentName;
    }

    // Agent title - user settings, marketing profile, or default
    const agentTitle = user?.marketingTitle || marketingProfile?.agentTitle || 'REALTOR®';
    
    // Phone - user settings or transaction
    const phone = user?.marketingPhone || transaction?.agentPhone || '';

    // Set values - always update when we have any data source
    form.setValue('agentName', agentName);
    form.setValue('agentTitle', agentTitle);
    form.setValue('phone', phone);
  }, [agentProfile, marketingProfile, transaction, form]);

  useEffect(() => {
    if (marketingProfile || agentProfile) {
      const user = agentProfile?.user;
      setImages(prev => ({
        ...prev,
        // Use marketing profile photo, fall back to user's marketing headshot or profile image
        agentPhoto: marketingProfile?.agentPhoto || user?.marketingHeadshotUrl || user?.profileImageUrl || null,
        qrCode: marketingProfile?.qrCode || null,
        companyLogo: marketingProfile?.companyLogoUseDefault !== false
          ? '/logos/SpyglassRealty_Logo_Black.png'
          : marketingProfile?.companyLogo || '/logos/SpyglassRealty_Logo_Black.png',
        secondaryLogo: marketingProfile?.secondaryLogoUseDefault !== false
          ? '/logos/lre-sgr-black.png'
          : marketingProfile?.secondaryLogo || '/logos/lre-sgr-black.png',
      }));
    }
  }, [marketingProfile, agentProfile]);

  const handleImageUpload = (field: keyof FlyerImages) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle direct image URL changes (for QR codes, etc.)
  const handleImageChange = (field: keyof FlyerImages, url: string | null) => {
    setImages(prev => ({ ...prev, [field]: url }));
  };

  // Handle AI summarization
  const handleSummarized = (summary: string) => {
    const currentDescription = form.getValues('introDescription') || '';
    setPreviousDescription(currentDescription);
    form.setValue('introDescription', summary);
    setHasUsedAISummarize(true);
  };

  // Handle revert to previous or original description
  const handleRevertDescription = (type: 'previous' | 'original') => {
    if (type === 'previous' && previousDescription) {
      form.setValue('introDescription', previousDescription);
    } else if (type === 'original') {
      form.setValue('introDescription', originalDescription);
      setHasUsedAISummarize(false);
    }
  };

  const exportMutation = useMutation({
    mutationFn: async (format: 'png' | 'cmyk') => {
      const response = await apiRequest('POST', `/api/transactions/${transactionId}/export-flyer?format=${format}`, {
        ...watchedValues,
        ...images,
        imageTransforms,
      });
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    },
    onSuccess: (blob, format) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeAddress = watchedValues.address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property';
      a.download = `flyer-${safeAddress}.${format === 'cmyk' ? 'tiff' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Flyer Exported', description: 'Your flyer has been downloaded and saved.' });
    },
    onError: () => {
      toast({ title: 'Export Failed', description: 'Please try again.', variant: 'destructive' });
    },
  });

  const saveAssetMutation = useMutation({
    mutationFn: async () => {
      // The export-flyer endpoint already saves to marketing assets internally
      const response = await apiRequest('POST', `/api/transactions/${transactionId}/export-flyer?format=png&saveOnly=true`, {
        ...watchedValues,
        ...images,
        imageTransforms,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save failed:', errorText);
        throw new Error('Failed to save flyer');
      }
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transactionId}/marketing-assets`] });
      toast({ 
        title: 'Saved to My Assets', 
        description: 'Your flyer has been saved to My Assets.' 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Save Failed', 
        description: error.message || 'Please try again.', 
        variant: 'destructive' 
      });
    },
  });

  const getPreviewScale = () => {
    if (scale === 'fit') return 0.55;
    return parseFloat(scale);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-background overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-back-to-marketing"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketing
        </button>
        <div className="flex gap-2">
          <Button
            onClick={() => saveAssetMutation.mutate()}
            disabled={saveAssetMutation.isPending || exportMutation.isPending}
            variant="outline"
            className="gap-2"
            data-testid="button-save-to-assets"
          >
            {saveAssetMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save to My Assets
          </Button>
          <Button
            onClick={() => exportMutation.mutate('png')}
            disabled={exportMutation.isPending || saveAssetMutation.isPending}
            className="gap-2"
            data-testid="button-export-png"
          >
            {exportMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Export PNG
          </Button>
          <Button
            onClick={() => exportMutation.mutate('cmyk')}
            disabled={exportMutation.isPending || saveAssetMutation.isPending}
            variant="outline"
            className="gap-2"
            data-testid="button-export-cmyk"
          >
            <Download className="w-4 h-4" />
            Export CMYK (Print)
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-[420px] min-w-[420px] border-r border-border bg-card flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 h-full [&>[data-radix-scroll-area-viewport]]:h-full">
            <FlyerForm
              form={form}
              images={images}
              onImageUpload={handleImageUpload}
              onImageChange={handleImageChange}
              transactionId={transactionId}
              mlsData={transaction?.mlsData}
              photoSelectionInfo={photoSelectionInfo}
              allMlsPhotos={allMlsPhotos}
              onSelectPhoto={(field, url) => setImages(prev => ({ ...prev, [field]: url }))}
              originalDescription={originalDescription}
              previousDescription={previousDescription}
              hasUsedAISummarize={hasUsedAISummarize}
              onSummarized={handleSummarized}
              onRevertDescription={handleRevertDescription}
              missingCategories={missingCategories}
              selectionMethod={aiPhotoData?.selectionMethod}
              qrCodeUrl={qrCodeUrl}
              onQrCodeUrlChange={setQrCodeUrl}
            />
          </ScrollArea>
        </div>

        <div className="flex-1 bg-muted/30 p-6 overflow-auto">
          <div className="sticky top-0">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-muted-foreground">Live Preview</h2>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="grid-toggle" className="text-xs text-muted-foreground cursor-pointer">
                    Grid
                  </Label>
                  <Switch
                    id="grid-toggle"
                    checked={showGrid}
                    onCheckedChange={setShowGrid}
                    data-testid="switch-grid-overlay"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Scale:</Label>
                  <Select value={scale} onValueChange={setScale}>
                    <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-preview-scale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fit">Fit to screen</SelectItem>
                      <SelectItem value="0.5">50%</SelectItem>
                      <SelectItem value="0.75">75%</SelectItem>
                      <SelectItem value="1">100%</SelectItem>
                      <SelectItem value="1.25">125%</SelectItem>
                      <SelectItem value="1.5">150%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="overflow-auto rounded-lg shadow-2xl bg-white">
              <div
                ref={previewRef}
                className="origin-top-left relative"
                style={{
                  transform: `scale(${getPreviewScale()})`,
                  transformOrigin: 'top left',
                  width: '816px',
                }}
              >
                <FlyerPreview
                  data={watchedValues}
                  images={images}
                  imageTransforms={imageTransforms}
                />
                {showGrid && <GridOverlay />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
