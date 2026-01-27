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
import { autoSelectPhotosWithInfo, formatPrice, formatAddress, formatNumber, generateDefaultHeadline, type PhotoSelectionInfo } from '@/lib/flyer-utils';
import { extractSqft, extractBeds, extractBaths } from '@/lib/cma-data-utils';
import type { FlyerData, FlyerImages, ImageTransforms } from '@/lib/flyer-types';
import { DEFAULT_TRANSFORMS } from '@/lib/flyer-types';
import { apiRequest } from '@/lib/queryClient';

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
  const [allMlsPhotos, setAllMlsPhotos] = useState<Array<{ url: string; classification: string; quality: number }>>([]);

  // Description management for AI summarize
  const [originalDescription, setOriginalDescription] = useState<string>('');
  const [previousDescription, setPreviousDescription] = useState<string>('');
  const [hasUsedAISummarize, setHasUsedAISummarize] = useState(false);

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

  // Effect for MLS/property data - runs when transaction changes
  useEffect(() => {
    if (transaction) {
      const mlsData = transaction.mlsData || {};

      // Extract data using robust utility functions that handle Repliers API field variations
      const listPrice = transaction.listPrice || mlsData.listPrice || mlsData.price || mlsData.ListPrice;
      
      // extractBeds/extractBaths return 'N/A' if not found - handle this with comprehensive fallbacks
      const rawBeds = extractBeds(mlsData);
      const rawBaths = extractBaths(mlsData);
      const rawSqft = extractSqft(mlsData);
      
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

      // Get photos from mlsData - handle various Repliers API formats
      const photos = mlsData.photos || mlsData.images || mlsData.Media || [];
      
      if (photos.length > 0) {
        const selected = autoSelectPhotosWithInfo(photos);
        setImages(prev => ({
          ...prev,
          mainImage: selected.mainPhoto,
          kitchenImage: selected.kitchenPhoto,
          roomImage: selected.roomPhoto,
        }));
        setPhotoSelectionInfo(selected.selectionInfo);
        setAllMlsPhotos(selected.allPhotos);
      }
    }
  }, [transaction, form]);

  // Effect for agent data - runs when agent profile or marketing profile loads
  useEffect(() => {
    const user = agentProfile?.user;
    
    // Build agent name from settings or fallback to transaction
    const agentName = user?.marketingDisplayName 
      || `${user?.firstName || ''} ${user?.lastName || ''}`.trim()
      || transaction?.agentName 
      || '';

    const agentTitle = user?.marketingTitle || marketingProfile?.agentTitle || 'REALTOR®';
    const phone = user?.marketingPhone || transaction?.agentPhone || '';

    // Only update if we have values (don't overwrite with empty)
    if (agentName) form.setValue('agentName', agentName);
    if (agentTitle) form.setValue('agentTitle', agentTitle);
    if (phone) form.setValue('phone', phone);
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
            onClick={() => exportMutation.mutate('png')}
            disabled={exportMutation.isPending}
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
            disabled={exportMutation.isPending}
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
