import { useState, useCallback, useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  FileText, DollarSign, BedDouble, Bath, Ruler, User, Phone, MapPin,
  Image as ImageIcon, Check, Sparkles, QrCode, X, Loader2
} from 'lucide-react';
import { ImageUploadField } from './ImageUploadField';
import { AIHeadlineButton } from './AIHeadlineButton';
import { AISummarizeButton } from './AISummarizeButton';
import { CharacterCounter } from './CharacterCounter';
import type { FlyerData, FlyerImages } from '@/lib/flyer-types';
import type { PhotoSelectionInfo } from '@/lib/flyer-utils';
import QRCode from 'qrcode';

const MAX_DESCRIPTION_LENGTH = 150;

interface FlyerFormProps {
  form: UseFormReturn<FlyerData>;
  images: FlyerImages;
  onImageUpload: (field: keyof FlyerImages) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageChange: (field: keyof FlyerImages, url: string | null) => void;
  transactionId: string;
  mlsData: any;
  photoSelectionInfo?: {
    mainImage: PhotoSelectionInfo | null;
    kitchenImage: PhotoSelectionInfo | null;
    roomImage: PhotoSelectionInfo | null;
  };
  allMlsPhotos?: Array<{ 
    url: string; 
    classification: string;
    displayClassification?: string;
    confidence?: number;
    quality: number;
  }>;
  onSelectPhoto?: (field: keyof FlyerImages, url: string) => void;
  originalDescription?: string;
  previousDescription?: string;
  hasUsedAISummarize?: boolean;
  onSummarized?: (summary: string) => void;
  onRevertDescription?: (type: 'previous' | 'original') => void;
  missingCategories?: string[];
  selectionMethod?: string;
  qrCodeUrl?: string;
  onQrCodeUrlChange?: (url: string) => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {children}
      <Separator className="mt-6" />
    </div>
  );
}

function FormField({
  icon,
  label,
  value,
  onChange,
  ...inputProps
}: {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </Label>
      <Input value={value || ''} onChange={onChange} {...inputProps} className="h-9" />
    </div>
  );
}

export function FlyerForm({
  form,
  images,
  onImageUpload,
  onImageChange,
  transactionId,
  mlsData,
  photoSelectionInfo,
  allMlsPhotos,
  onSelectPhoto,
  originalDescription = '',
  previousDescription = '',
  hasUsedAISummarize = false,
  onSummarized,
  onRevertDescription,
  missingCategories = [],
  selectionMethod,
  qrCodeUrl = '',
  onQrCodeUrlChange,
}: FlyerFormProps) {
  const { register, setValue, watch } = form;
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [localQrUrl, setLocalQrUrl] = useState(qrCodeUrl);
  const lastGeneratedQrUrlRef = useRef<string>('');

  const generateQRCode = useCallback(async (url: string) => {
    if (!url.trim()) {
      onImageChange('qrCode', null);
      lastGeneratedQrUrlRef.current = '';
      return;
    }
    
    if (lastGeneratedQrUrlRef.current === url) {
      return;
    }
    
    setIsGeneratingQR(true);
    try {
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      onImageChange('qrCode', qrDataUrl);
      lastGeneratedQrUrlRef.current = url;
    } catch (error) {
      console.error('[Flyer] QR code generation failed:', error);
    } finally {
      setIsGeneratingQR(false);
    }
  }, [onImageChange]);

  useEffect(() => {
    setLocalQrUrl(qrCodeUrl);
    if (qrCodeUrl.trim()) {
      generateQRCode(qrCodeUrl);
    } else {
      onImageChange('qrCode', null);
      lastGeneratedQrUrlRef.current = '';
    }
  }, [qrCodeUrl, generateQRCode, onImageChange]);

  const handleQrUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setLocalQrUrl(url);
    onQrCodeUrlChange?.(url);
  };

  const handleClearQR = () => {
    setLocalQrUrl('');
    onQrCodeUrlChange?.('');
    onImageChange('qrCode', null);
  };
  
  // Watch all form values for controlled inputs
  const priceValue = watch('price') || '';
  const bedroomsValue = watch('bedrooms') || '';
  const bathroomsValue = watch('bathrooms') || '';
  const sqftValue = watch('sqft') || '';
  const headlineValue = watch('introHeading') || '';
  const descriptionValue = watch('introDescription') || '';
  const agentNameValue = watch('agentName') || '';
  const agentTitleValue = watch('agentTitle') || '';
  const phoneValue = watch('phone') || '';
  const addressValue = watch('address') || '';

  return (
    <div className="p-6 space-y-6">
      <Section icon={<FileText className="w-5 h-5 text-primary" />} title="Property Details">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Check className="w-4 h-4" />
          Auto-filled from MLS
        </div>

        <div className="space-y-4">
          <FormField
            icon={<DollarSign className="w-3 h-3" />}
            label="Listed Price"
            value={priceValue}
            onChange={(e) => setValue('price', e.target.value)}
            data-testid="input-flyer-price"
          />

          <div className="grid grid-cols-3 gap-3">
            <FormField
              icon={<BedDouble className="w-3 h-3" />}
              label="Beds"
              value={bedroomsValue}
              onChange={(e) => setValue('bedrooms', e.target.value)}
              data-testid="input-flyer-beds"
            />
            <FormField
              icon={<Bath className="w-3 h-3" />}
              label="Baths"
              value={bathroomsValue}
              onChange={(e) => setValue('bathrooms', e.target.value)}
              data-testid="input-flyer-baths"
            />
            <FormField
              icon={<Ruler className="w-3 h-3" />}
              label="Sq Ft"
              value={sqftValue}
              onChange={(e) => setValue('sqft', e.target.value)}
              data-testid="input-flyer-sqft"
            />
          </div>
        </div>
      </Section>

      <Section icon={<FileText className="w-5 h-5 text-primary" />} title="Description">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide">
                Headline
              </Label>
              <AIHeadlineButton
                transactionId={transactionId}
                mlsData={mlsData}
                onGenerated={(headline) => setValue('introHeading', headline)}
              />
            </div>
            <Input
              value={headlineValue}
              onChange={(e) => setValue('introHeading', e.target.value)}
              placeholder="Prime Opportunity in Travis County"
              data-testid="input-flyer-headline"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium uppercase tracking-wide">
                Property Description
              </Label>
              {onSummarized && onRevertDescription && (
                <AISummarizeButton
                  currentDescription={descriptionValue}
                  originalDescription={originalDescription}
                  previousDescription={previousDescription}
                  propertyAddress={addressValue}
                  maxLength={MAX_DESCRIPTION_LENGTH}
                  onSummarized={onSummarized}
                  onRevert={onRevertDescription}
                  hasUsedAI={hasUsedAISummarize}
                />
              )}
            </div>
            <Textarea
              value={descriptionValue}
              onChange={(e) => setValue('introDescription', e.target.value)}
              placeholder="Describe the property..."
              className="min-h-[100px] resize-none"
              data-testid="input-flyer-description"
            />
            <CharacterCounter
              current={descriptionValue.length}
              max={MAX_DESCRIPTION_LENGTH}
            />
            <p className="text-[10px] text-muted-foreground">
              Click "AI Summarize" to create a concise summary. Click again for different variations.
            </p>
          </div>
        </div>
      </Section>

      <Section icon={<User className="w-5 h-5 text-primary" />} title="Agent Details">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Check className="w-4 h-4" />
          Using data from Settings
        </div>

        <div className="space-y-4">
          <FormField
            label="Agent Name"
            value={agentNameValue}
            onChange={(e) => setValue('agentName', e.target.value)}
            data-testid="input-flyer-agent-name"
          />
          <FormField
            label="Title"
            value={agentTitleValue}
            onChange={(e) => setValue('agentTitle', e.target.value)}
            data-testid="input-flyer-agent-title"
          />
          <FormField
            icon={<Phone className="w-3 h-3" />}
            label="Phone Number"
            value={phoneValue}
            onChange={(e) => setValue('phone', e.target.value)}
            data-testid="input-flyer-phone"
          />
        </div>
      </Section>

      <Section icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Branding & Logos">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Check className="w-4 h-4" />
          Using saved marketing profile
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField
            label="Company Logo"
            id="companyLogo"
            preview={images.companyLogo}
            onChange={onImageUpload('companyLogo')}
            compact
          />
          <ImageUploadField
            label="Secondary Logo"
            id="secondaryLogo"
            preview={images.secondaryLogo}
            onChange={onImageUpload('secondaryLogo')}
            compact
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <ImageUploadField
            label="Agent Photo"
            id="agentPhoto"
            preview={images.agentPhoto}
            onChange={onImageUpload('agentPhoto')}
            circular
          />
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide">
              QR Code
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter URL for QR code..."
                value={localQrUrl}
                onChange={handleQrUrlChange}
                className="flex-1 h-9"
                data-testid="input-qr-url"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => generateQRCode(localQrUrl)}
                disabled={!localQrUrl.trim() || isGeneratingQR}
                data-testid="button-generate-qr"
              >
                {isGeneratingQR ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
              </Button>
            </div>
            {images.qrCode && (
              <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-white">
                <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={handleClearQR}
                  data-testid="button-clear-qr"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Property Images">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Sparkles className="w-4 h-4" />
          {selectionMethod === 'coverImage' && 'Auto-selected using Repliers AI'}
          {selectionMethod === 'imageInsights' && 'Auto-selected using image classification'}
          {selectionMethod === 'diversified' && 'Auto-selected from available photos'}
          {!selectionMethod && 'Auto-selected using Repliers AI'}
        </div>

        <div className="space-y-4">
          <FormField
            icon={<MapPin className="w-3 h-3" />}
            label="Property Address"
            value={addressValue}
            onChange={(e) => setValue('address', e.target.value)}
            data-testid="input-flyer-address"
          />

          <div className="space-y-4">
            <ImageUploadField
              label="Main Property Photo"
              id="mainImage"
              preview={images.mainImage}
              onChange={onImageUpload('mainImage')}
              aiSelectionInfo={photoSelectionInfo?.mainImage}
              availablePhotos={allMlsPhotos}
              onSelectPhoto={(url) => onSelectPhoto?.('mainImage', url)}
              expectedCategory="Exterior"
              isMissing={missingCategories.includes('Exterior')}
            />

            <ImageUploadField
              label="Kitchen Photo"
              id="kitchenImage"
              preview={images.kitchenImage}
              onChange={onImageUpload('kitchenImage')}
              aiSelectionInfo={photoSelectionInfo?.kitchenImage}
              availablePhotos={allMlsPhotos}
              onSelectPhoto={(url) => onSelectPhoto?.('kitchenImage', url)}
              expectedCategory="Kitchen"
              isMissing={missingCategories.includes('Kitchen')}
            />

            <ImageUploadField
              label="Room Photo"
              id="roomImage"
              preview={images.roomImage}
              onChange={onImageUpload('roomImage')}
              aiSelectionInfo={photoSelectionInfo?.roomImage}
              availablePhotos={allMlsPhotos}
              onSelectPhoto={(url) => onSelectPhoto?.('roomImage', url)}
              expectedCategory="Living Room"
              isMissing={missingCategories.includes('Living Room')}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
