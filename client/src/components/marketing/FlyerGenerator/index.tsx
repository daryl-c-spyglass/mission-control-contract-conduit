import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
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
import { autoSelectPhotos, formatPrice, formatAddress, formatNumber, generateDefaultHeadline } from '@/lib/flyer-utils';
import type { FlyerData, FlyerImages, ImageTransforms, ImageTransform } from '@/lib/flyer-types';
import { DEFAULT_TRANSFORMS } from '@/lib/flyer-types';
import { apiRequest } from '@/lib/queryClient';

interface FlyerGeneratorProps {
  transactionId: string;
  transaction: any;
  onBack: () => void;
}

export function FlyerGenerator({ transactionId, transaction, onBack }: FlyerGeneratorProps) {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);

  const [showGrid, setShowGrid] = useState(false);
  const [scale, setScale] = useState<string>('fit');
  const [imageTransforms, setImageTransforms] = useState<ImageTransforms>({ ...DEFAULT_TRANSFORMS });

  const { data: marketingProfile } = useMarketingProfile();

  const [images, setImages] = useState<FlyerImages>({
    mainImage: null,
    kitchenImage: null,
    roomImage: null,
    agentPhoto: null,
    companyLogo: null,
    secondaryLogo: null,
    qrCode: null,
  });

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

  useEffect(() => {
    if (transaction) {
      const mlsData = transaction.mlsData || {};

      form.reset({
        price: formatPrice(transaction.listPrice || mlsData.listPrice),
        address: formatAddress(transaction, mlsData),
        bedrooms: String(mlsData.beds || mlsData.bedroomsTotal || ''),
        bathrooms: String(mlsData.baths || mlsData.bathroomsTotalInteger || ''),
        sqft: formatNumber(mlsData.sqft || mlsData.livingArea || mlsData.buildingAreaTotal),
        introHeading: generateDefaultHeadline(transaction, mlsData),
        introDescription: mlsData.publicRemarks || mlsData.remarks || '',
        agentName: marketingProfile?.agentTitle ? '' : (transaction.agentName || ''),
        agentTitle: marketingProfile?.agentTitle || 'REALTOR®',
        phone: transaction.agentPhone || '',
      });

      const photos = mlsData.photos || mlsData.images || [];
      if (photos.length > 0) {
        const selected = autoSelectPhotos(photos);
        setImages(prev => ({
          ...prev,
          mainImage: selected.mainPhoto,
          kitchenImage: selected.kitchenPhoto,
          roomImage: selected.roomPhoto,
        }));
      }
    }
  }, [transaction, form, marketingProfile]);

  useEffect(() => {
    if (marketingProfile) {
      setImages(prev => ({
        ...prev,
        agentPhoto: marketingProfile.agentPhoto || null,
        qrCode: marketingProfile.qrCode || null,
        companyLogo: marketingProfile.companyLogoUseDefault
          ? '/logos/SpyglassRealty_Logo_Black.png'
          : marketingProfile.companyLogo || '/logos/SpyglassRealty_Logo_Black.png',
        secondaryLogo: marketingProfile.secondaryLogoUseDefault
          ? '/logos/lre-sgr-black.png'
          : marketingProfile.secondaryLogo || '/logos/lre-sgr-black.png',
      }));
    }
  }, [marketingProfile]);

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

  const handleTransformChange = (field: keyof ImageTransforms) => (transform: ImageTransform) => {
    setImageTransforms(prev => ({ ...prev, [field]: transform }));
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
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[420px] min-w-[420px] border-r border-border bg-card">
          <ScrollArea className="h-full">
            <FlyerForm
              form={form}
              images={images}
              imageTransforms={imageTransforms}
              onImageUpload={handleImageUpload}
              onTransformChange={handleTransformChange}
              transactionId={transactionId}
              mlsData={transaction?.mlsData}
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
