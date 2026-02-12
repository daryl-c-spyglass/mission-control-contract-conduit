import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Download, Grid3X3, Loader2 } from 'lucide-react';
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
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Scroll all panes to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    // Reset left pane scroll (ScrollArea viewport)
    if (leftPaneRef.current) {
      const viewport = leftPaneRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = 0;
      }
    }
    // Reset right pane scroll
    if (rightPaneRef.current) {
      rightPaneRef.current.scrollTop = 0;
    }
  }, []);

  const [containerWidth, setContainerWidth] = useState(500);
  
  // Track preview container size for dynamic scaling
  useEffect(() => {
    const container = rightPaneRef.current;
    if (!container) return;
    
    const updateSize = () => {
      // Subtract space for header, controls, padding
      setContainerHeight(container.clientHeight - 150);
      setContainerWidth(container.clientWidth - 64); // 32px padding each side
    };
    
    updateSize();
    
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const [showGrid, setShowGrid] = useState(false);
  const [scale, setScale] = useState<string>('1'); // Default to 100% (fits view)
  const [imageTransforms, setImageTransforms] = useState<ImageTransforms>({ ...DEFAULT_TRANSFORMS });

  const { data: marketingProfile } = useMarketingProfile();
  
  // Fetch agent profile for name, phone, etc. (auto-refresh on mount/focus for Settings sync)
  const { data: agentProfile } = useQuery<AgentProfileResponse>({
    queryKey: ['/api/agent/profile'],
    staleTime: 0,               // Always consider stale - refetch on mount
    refetchOnMount: true,       // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
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
  const [isGeneratingShareableLink, setIsGeneratingShareableLink] = useState(false);
  

  // Logo controls state
  const [logoScales, setLogoScales] = useState({ primary: 1, secondary: 1 });
  const [dividerPosition, setDividerPosition] = useState(148);
  const [secondaryLogoOffsetY, setSecondaryLogoOffsetY] = useState(0);
  const [useDefaultCompanyLogo, setUseDefaultCompanyLogo] = useState(true);
  const [useDefaultSecondaryLogo, setUseDefaultSecondaryLogo] = useState(true);
  
  // Store previous custom logos when switching to defaults
  const [previousCompanyLogo, setPreviousCompanyLogo] = useState<string | null>(null);
  const [previousSecondaryLogo, setPreviousSecondaryLogo] = useState<string | null>(null);

  const form = useForm<FlyerData>({
    defaultValues: {
      price: '',
      address: '',
      city: '',
      state: '',
      zip: '',
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
      form.setValue('city', mlsData.city || mlsData.City || '');
      form.setValue('state', mlsData.state || mlsData.StateOrProvince || 'TX');
      form.setValue('zip', mlsData.zipCode || mlsData.postalCode || mlsData.PostalCode || '');
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
      const mlsPhotoUrls = mlsData.photos || mlsData.images || mlsData.Media || [];
      
      // Get user-uploaded photos from transaction.propertyImages (for off-market transactions)
      const userUploadedPhotos = ((transaction.propertyImages || []) as string[]).filter(
        (url: string) => url && !url.includes('cdn.repliers.io') && !url.includes('repliers.io')
      );
      
      // Combine: user uploads first, then MLS photos
      const photoUrls = [...userUploadedPhotos, ...mlsPhotoUrls];
      
      console.log('[Flyer Debug] Photo sources:', {
        userUploads: userUploadedPhotos.length,
        mlsPhotos: mlsPhotoUrls.length,
        total: photoUrls.length
      });
      
      // Get imageInsights from mlsData (added to server response), with fallback to rawData
      const imageInsights = mlsData.imageInsights || mlsData.rawData?.imageInsights;
      
      if (photoUrls.length > 0) {
        console.log(`[Flyer AI] Processing ${photoUrls.length} photos for selection (${userUploadedPhotos.length} uploads, ${mlsPhotoUrls.length} MLS)...`);
        
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
      
      // Set default toggles from marketing profile
      const companyDefault = marketingProfile?.companyLogoUseDefault !== false;
      const secondaryDefault = marketingProfile?.secondaryLogoUseDefault !== false;
      setUseDefaultCompanyLogo(companyDefault);
      setUseDefaultSecondaryLogo(secondaryDefault);
      
      setImages(prev => ({
        ...prev,
        // Use marketing profile photo, fall back to user's marketing headshot or profile image
        agentPhoto: marketingProfile?.agentPhoto || user?.marketingHeadshotUrl || user?.profileImageUrl || null,
        companyLogo: companyDefault
          ? '/logos/SpyglassRealty_Logo_Black.png'
          : marketingProfile?.companyLogo || '/logos/SpyglassRealty_Logo_Black.png',
        secondaryLogo: secondaryDefault
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

  // Handle generating shareable link - creates flyer in database and returns QR code
  const handleGenerateShareableLink = async (): Promise<{ flyerUrl: string; qrCode: string } | null> => {
    setIsGeneratingShareableLink(true);
    try {
      const values = form.getValues();
      
      // Build flyer payload from current form state
      const flyerPayload = {
        propertyAddress: values.address || '',
        propertyCity: transaction?.mlsData?.city || '',
        propertyState: transaction?.mlsData?.state || 'TX',
        propertyZip: transaction?.mlsData?.zipCode || '',
        listPrice: values.price?.replace(/[^0-9.]/g, '') || null,
        bedrooms: values.bedrooms ? parseInt(values.bedrooms) : null,
        bathrooms: values.bathrooms || null,
        squareFeet: values.sqft ? parseInt(values.sqft.replace(/,/g, '')) : null,
        headline: values.introHeading || '',
        description: values.introDescription || '',
        mainPhoto: images.mainImage || null,
        kitchenPhoto: images.kitchenImage || null,
        roomPhoto: images.roomImage || null,
        additionalPhotos: transaction?.mlsData?.photos?.slice(0, 10) || [],
        agentName: values.agentName || '',
        agentTitle: values.agentTitle || '',
        agentPhone: values.phone || '',
        agentEmail: agentProfile?.user?.marketingEmail || agentProfile?.user?.email || '',
        agentPhoto: images.agentPhoto || null,
        companyLogo: images.companyLogo || null,
        secondaryLogo: images.secondaryLogo || null,
        logoScales: logoScales,
        dividerPosition: dividerPosition,
        secondaryLogoOffsetY: secondaryLogoOffsetY,
        transactionId: transactionId,
        mlsNumber: transaction?.mlsNumber || null,
      };

      const response = await apiRequest('POST', '/api/flyers', flyerPayload);
      const data = await response.json() as { success: boolean; flyerUrl?: string; qrCode?: string };

      if (data.success && data.flyerUrl && data.qrCode) {
        const qrCodeImage = data.qrCode;
        // Update the QR code URL and image
        setQrCodeUrl(data.flyerUrl);
        setImages(prev => ({ ...prev, qrCode: qrCodeImage }));
        
        toast({
          title: 'Shareable Link Created',
          description: 'Your flyer is now accessible via the QR code.',
        });

        return { flyerUrl: data.flyerUrl, qrCode: data.qrCode };
      } else {
        throw new Error('Failed to create shareable link');
      }
    } catch (error: any) {
      console.error('[Flyer] Error generating shareable link:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate shareable link. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsGeneratingShareableLink(false);
    }
  };

  const exportMutation = useMutation({
    mutationFn: async (format: 'png' | 'cmyk' | 'pdf') => {
      const exportData = {
        ...watchedValues,
        ...images,
        imageTransforms,
        logoScales,
        dividerPosition,
        secondaryLogoOffsetY,
      };
      
      const response = await apiRequest('POST', `/api/transactions/${transactionId}/export-flyer?format=${format}`, exportData);
      if (!response.ok) throw new Error('Export failed');
      return response.blob();
    },
    onSuccess: (blob, format) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeAddress = watchedValues.address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property';
      const ext = format === 'png' ? 'png' : format === 'cmyk' ? 'tiff' : 'pdf';
      a.download = `flyer-${safeAddress}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Flyer Exported', description: `Your flyer has been downloaded as ${ext.toUpperCase()}.` });
    },
    onError: () => {
      toast({ title: 'Export Failed', description: 'Please try again.', variant: 'destructive' });
    },
  });

  const saveAssetMutation = useMutation({
    mutationFn: async () => {
      // The export-flyer endpoint already saves to marketing assets internally
      const exportData = {
        ...watchedValues,
        ...images,
        imageTransforms,
        // Branding controls - ensure these are included
        logoScales,
        dividerPosition,
        secondaryLogoOffsetY,
      };
      
      const response = await apiRequest('POST', `/api/transactions/${transactionId}/export-flyer?format=png&saveOnly=true`, exportData);
      
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

  // Combined Save & Download mutation (saves to My Assets AND downloads PNG)
  const saveAndDownloadMutation = useMutation({
    mutationFn: async () => {
      const exportData = {
        ...watchedValues,
        ...images,
        imageTransforms,
        logoScales,
        dividerPosition,
        secondaryLogoOffsetY,
      };
      
      // Call export endpoint which saves to assets and returns the blob for download
      // Always pass postToSlack=true to let server check user notification preferences
      const response = await apiRequest('POST', `/api/transactions/${transactionId}/export-flyer?format=png&postToSlack=true`, exportData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Save & Download failed:', errorText);
        throw new Error('Failed to save and download flyer');
      }
      
      return response.blob();
    },
    onSuccess: (blob) => {
      // Download the PNG file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeAddress = watchedValues.address?.replace(/[^a-zA-Z0-9]/g, '-') || 'property';
      a.download = `flyer-${safeAddress}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Invalidate the marketing assets query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${transactionId}/marketing-assets`] });
      
      toast({ 
        title: 'Flyer Saved & Downloaded', 
        description: 'Your flyer has been saved to My Assets and downloaded.'
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Save & Download Failed', 
        description: error.message || 'Please try again.', 
        variant: 'destructive' 
      });
    },
  });

  // Dynamically calculate base scale to fit flyer (816x1056) in container
  const FLYER_WIDTH = 816;
  const FLYER_HEIGHT = 1056;
  const scaleForHeight = containerHeight / FLYER_HEIGHT;
  const scaleForWidth = containerWidth / FLYER_WIDTH;
  const baseScale = Math.min(scaleForHeight, scaleForWidth, 1); // Fit both dimensions, max 1
  
  const getPreviewScale = () => {
    // All scales are relative to the base fit scale
    // 100% = fits perfectly in container (no scrollbars)
    const multiplier = parseFloat(scale) || 1;
    return baseScale * multiplier;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Scrolls with content (NOT sticky) */}
      <header className="border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 text-muted-foreground"
              data-testid="button-back-to-marketing"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Marketing
            </Button>
            <div className="h-8 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Flyer Generator</h1>
              <p className="text-sm text-muted-foreground">Create stunning property flyers</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={onBack}
                variant="outline"
                className="gap-2"
                disabled={saveAndDownloadMutation.isPending || exportMutation.isPending}
                data-testid="button-cancel-flyer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => saveAndDownloadMutation.mutate()}
                disabled={saveAndDownloadMutation.isPending || exportMutation.isPending}
                className="gap-2 bg-[#F37216] hover:bg-[#E06510] text-white"
                data-testid="button-save-download"
              >
                {saveAndDownloadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Save & Download
              </Button>
              <Button
                onClick={() => exportMutation.mutate('pdf')}
                disabled={exportMutation.isPending || saveAndDownloadMutation.isPending}
                variant="outline"
                className="gap-2"
                data-testid="button-export-pdf"
              >
                {exportMutation.isPending && exportMutation.variables === 'pdf' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export PDF
              </Button>
              <Button
                onClick={() => exportMutation.mutate('cmyk')}
                disabled={exportMutation.isPending || saveAndDownloadMutation.isPending}
                variant="outline"
                className="gap-2"
                data-testid="button-export-cmyk"
              >
                {exportMutation.isPending && exportMutation.variables === 'cmyk' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export TIFF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Two Column Layout */}
      <div className="flex flex-col lg:flex-row">
        {/* Left Pane - Scrollable Form Panel */}
        <div ref={leftPaneRef} className="w-full lg:w-[420px] lg:min-w-[420px] border-r border-border bg-card">
          <ScrollArea className="h-[calc(100vh-64px)]">
            <FlyerForm
              form={form}
              images={images}
              onImageUpload={handleImageUpload}
              onImageChange={handleImageChange}
              transactionId={transactionId}
              mlsData={transaction?.mlsData}
              isOffMarket={!transaction?.mlsNumber}
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
              onGenerateShareableLink={handleGenerateShareableLink}
              isGeneratingShareableLink={isGeneratingShareableLink}
              logoScales={logoScales}
              onLogoScalesChange={setLogoScales}
              dividerPosition={dividerPosition}
              onDividerPositionChange={setDividerPosition}
              secondaryLogoOffsetY={secondaryLogoOffsetY}
              onSecondaryLogoOffsetYChange={setSecondaryLogoOffsetY}
              useDefaultCompanyLogo={useDefaultCompanyLogo}
              onUseDefaultCompanyLogoChange={(checked) => {
                setUseDefaultCompanyLogo(checked);
                if (checked) {
                  // Store current custom logo before switching to default
                  if (images.companyLogo && images.companyLogo !== '/logos/SpyglassRealty_Logo_Black.png') {
                    setPreviousCompanyLogo(images.companyLogo);
                  }
                  setImages(prev => ({ ...prev, companyLogo: '/logos/SpyglassRealty_Logo_Black.png' }));
                } else {
                  // Restore previous custom logo if available
                  setImages(prev => ({ ...prev, companyLogo: previousCompanyLogo }));
                }
              }}
              useDefaultSecondaryLogo={useDefaultSecondaryLogo}
              onUseDefaultSecondaryLogoChange={(checked) => {
                setUseDefaultSecondaryLogo(checked);
                if (checked) {
                  // Store current custom logo before switching to default
                  if (images.secondaryLogo && images.secondaryLogo !== '/logos/lre-sgr-black.png') {
                    setPreviousSecondaryLogo(images.secondaryLogo);
                  }
                  setImages(prev => ({ ...prev, secondaryLogo: '/logos/lre-sgr-black.png' }));
                } else {
                  // Restore previous custom logo if available
                  setImages(prev => ({ ...prev, secondaryLogo: previousSecondaryLogo }));
                }
              }}
              onResetLogoControls={() => {
                setLogoScales({ primary: 1, secondary: 1 });
                setDividerPosition(148);
                setSecondaryLogoOffsetY(0);
              }}
              imageTransforms={imageTransforms}
              onImageTransformChange={(field, transform) => {
                setImageTransforms(prev => ({
                  ...prev,
                  [field]: transform,
                }));
              }}
            />
          </ScrollArea>
        </div>

        {/* Right Pane - Live Preview (Sticky) */}
        <div ref={rightPaneRef} className="flex-1 bg-muted/30 p-6 lg:p-8 overflow-auto">
          <div className="sticky top-24">
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
                      <SelectItem value="0.75">75%</SelectItem>
                      <SelectItem value="1">100%</SelectItem>
                      <SelectItem value="1.25">125%</SelectItem>
                      <SelectItem value="1.5">150%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg shadow-2xl bg-white">
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
                  logoScales={logoScales}
                  dividerPosition={dividerPosition}
                  secondaryLogoOffsetY={secondaryLogoOffsetY}
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
