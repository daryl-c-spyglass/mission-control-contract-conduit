import { useState, useCallback, useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText, DollarSign, BedDouble, Bath, Ruler, User, Phone, MapPin,
  Image as ImageIcon, Check, Sparkles, QrCode, X, Loader2, Palette, Upload
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
  onGenerateShareableLink?: () => Promise<{ flyerUrl: string; qrCode: string } | null>;
  isGeneratingShareableLink?: boolean;
  logoScales?: { primary: number; secondary: number };
  onLogoScalesChange?: (scales: { primary: number; secondary: number }) => void;
  dividerPosition?: number;
  onDividerPositionChange?: (position: number) => void;
  secondaryLogoOffsetY?: number;
  onSecondaryLogoOffsetYChange?: (offset: number) => void;
  useDefaultCompanyLogo?: boolean;
  onUseDefaultCompanyLogoChange?: (checked: boolean) => void;
  useDefaultSecondaryLogo?: boolean;
  onUseDefaultSecondaryLogoChange?: (checked: boolean) => void;
  onResetLogoControls?: () => void;
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
  onGenerateShareableLink,
  isGeneratingShareableLink = false,
  logoScales = { primary: 1, secondary: 1 },
  onLogoScalesChange,
  dividerPosition = 148,
  onDividerPositionChange,
  secondaryLogoOffsetY = 0,
  onSecondaryLogoOffsetYChange,
  useDefaultCompanyLogo = true,
  onUseDefaultCompanyLogoChange,
  useDefaultSecondaryLogo = true,
  onUseDefaultSecondaryLogoChange,
  onResetLogoControls,
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

      <Section icon={<Palette className="w-5 h-5 text-primary" />} title="Branding & Logos">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Check className="w-4 h-4" />
          Using saved marketing profile
        </div>

        {/* Logo Upload Areas */}
        <div className="grid grid-cols-2 gap-4">
          {/* Company Logo */}
          <div className="space-y-2">
            <ImageUploadField
              label="Company Logo"
              id="companyLogo"
              preview={images.companyLogo}
              onChange={onImageUpload('companyLogo')}
              compact
              disabled={useDefaultCompanyLogo}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="useDefaultCompany"
                checked={useDefaultCompanyLogo}
                onCheckedChange={(checked) => onUseDefaultCompanyLogoChange?.(!!checked)}
                data-testid="checkbox-default-company-logo"
              />
              <Label htmlFor="useDefaultCompany" className="text-xs text-muted-foreground cursor-pointer">
                Use Spyglass Default
              </Label>
            </div>
          </div>
          
          {/* Secondary Logo */}
          <div className="space-y-2">
            <ImageUploadField
              label="Secondary Logo"
              id="secondaryLogo"
              preview={images.secondaryLogo}
              onChange={onImageUpload('secondaryLogo')}
              compact
              disabled={useDefaultSecondaryLogo}
            />
            <div className="flex items-center gap-2">
              <Checkbox
                id="useDefaultSecondary"
                checked={useDefaultSecondaryLogo}
                onCheckedChange={(checked) => onUseDefaultSecondaryLogoChange?.(!!checked)}
                data-testid="checkbox-default-secondary-logo"
              />
              <Label htmlFor="useDefaultSecondary" className="text-xs text-muted-foreground cursor-pointer">
                Use Leading RE Default
              </Label>
            </div>
          </div>
        </div>

        {/* Logo Size & Position Sliders */}
        <div className="space-y-4 pt-4">
          {/* Primary Logo Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Primary Logo Size</Label>
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round(logoScales.primary * 100)}%
              </span>
            </div>
            <Slider
              value={[logoScales.primary]}
              onValueChange={([value]) => onLogoScalesChange?.({ ...logoScales, primary: value })}
              min={0.5}
              max={2}
              step={0.05}
              className="py-2"
              data-testid="slider-primary-logo-size"
            />
          </div>
          
          {/* Secondary Logo Size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Secondary Logo Size</Label>
              <span className="text-xs text-muted-foreground font-medium">
                {Math.round(logoScales.secondary * 100)}%
              </span>
            </div>
            <Slider
              value={[logoScales.secondary]}
              onValueChange={([value]) => onLogoScalesChange?.({ ...logoScales, secondary: value })}
              min={0.5}
              max={2}
              step={0.05}
              className="py-2"
              data-testid="slider-secondary-logo-size"
            />
          </div>
          
          {/* Divider Position */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Divider Position</Label>
              <span className="text-xs text-muted-foreground font-medium">
                {dividerPosition}px
              </span>
            </div>
            <Slider
              value={[dividerPosition]}
              onValueChange={([value]) => onDividerPositionChange?.(value)}
              min={100}
              max={200}
              step={1}
              className="py-2"
              data-testid="slider-divider-position"
            />
          </div>
          
          {/* Secondary Logo Y Position */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Secondary Logo Y Position</Label>
              <span className="text-xs text-muted-foreground font-medium">
                {secondaryLogoOffsetY}px
              </span>
            </div>
            <Slider
              value={[secondaryLogoOffsetY]}
              onValueChange={([value]) => onSecondaryLogoOffsetYChange?.(value)}
              min={-20}
              max={20}
              step={1}
              className="py-2"
              data-testid="slider-secondary-logo-y"
            />
          </div>
          
          {/* Reset to Default Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetLogoControls}
            className="w-full mt-2"
            data-testid="button-reset-logo-controls"
          >
            Reset to Default
          </Button>
        </div>
      </Section>

      {/* Agent Photo & QR Code Section */}
      <Section icon={<User className="w-5 h-5 text-primary" />} title="Agent Photo & QR Code">
        <div className="grid grid-cols-2 gap-3">
          <ImageUploadField
            label="Agent Photo"
            id="agentPhoto"
            preview={images.agentPhoto}
            onChange={onImageUpload('agentPhoto')}
            circular
          />
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide">
              Shareable Flyer Link
            </Label>
            {images.qrCode && localQrUrl ? (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border/50">
                <div className="relative flex-shrink-0">
                  <img 
                    src={images.qrCode} 
                    alt="QR Code" 
                    className="w-16 h-16 rounded border bg-white"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                    onClick={handleClearQR}
                    title="Remove QR Code"
                    data-testid="button-clear-qr"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Link Ready</p>
                  <p className="text-xs text-muted-foreground truncate" title={localQrUrl}>
                    {localQrUrl}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generate a shareable link for this flyer. The QR code will open a mobile-friendly property page.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onGenerateShareableLink}
                  disabled={isGeneratingShareableLink}
                  className="w-full"
                  data-testid="button-generate-shareable-link"
                >
                  {isGeneratingShareableLink ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Generate Shareable Link
                    </>
                  )}
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
