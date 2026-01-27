import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  FileText, DollarSign, BedDouble, Bath, Ruler, User, Phone, MapPin,
  Image as ImageIcon, Check, Sparkles
} from 'lucide-react';
import { ImageUploadField } from './ImageUploadField';
import { AIHeadlineButton } from './AIHeadlineButton';
import { AISummarizeButton } from './AISummarizeButton';
import { CharacterCounter } from './CharacterCounter';
import type { FlyerData, FlyerImages } from '@/lib/flyer-types';
import type { PhotoSelectionInfo } from '@/lib/flyer-utils';

const MAX_DESCRIPTION_LENGTH = 150;

interface FlyerFormProps {
  form: UseFormReturn<FlyerData>;
  images: FlyerImages;
  onImageUpload: (field: keyof FlyerImages) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  transactionId: string;
  mlsData: any;
  photoSelectionInfo?: {
    mainImage: PhotoSelectionInfo | null;
    kitchenImage: PhotoSelectionInfo | null;
    roomImage: PhotoSelectionInfo | null;
  };
  allMlsPhotos?: Array<{ url: string; classification: string; quality: number }>;
  onSelectPhoto?: (field: keyof FlyerImages, url: string) => void;
  originalDescription?: string;
  previousDescription?: string;
  hasUsedAISummarize?: boolean;
  onSummarized?: (summary: string) => void;
  onRevertDescription?: (type: 'previous' | 'original') => void;
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
  ...inputProps
}: {
  icon?: React.ReactNode;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
      </Label>
      <Input {...inputProps} className="h-9" />
    </div>
  );
}

export function FlyerForm({
  form,
  images,
  onImageUpload,
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
}: FlyerFormProps) {
  const { register, setValue, watch } = form;
  const descriptionValue = watch('introDescription') || '';
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
            {...register('price')}
            data-testid="input-flyer-price"
          />

          <div className="grid grid-cols-3 gap-3">
            <FormField
              icon={<BedDouble className="w-3 h-3" />}
              label="Beds"
              {...register('bedrooms')}
              data-testid="input-flyer-beds"
            />
            <FormField
              icon={<Bath className="w-3 h-3" />}
              label="Baths"
              {...register('bathrooms')}
              data-testid="input-flyer-baths"
            />
            <FormField
              icon={<Ruler className="w-3 h-3" />}
              label="Sq Ft"
              {...register('sqft')}
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
              {...register('introHeading')}
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
              {...register('introDescription')}
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
            {...register('agentName')}
            data-testid="input-flyer-agent-name"
          />
          <FormField
            label="Title"
            {...register('agentTitle')}
            data-testid="input-flyer-agent-title"
          />
          <FormField
            icon={<Phone className="w-3 h-3" />}
            label="Phone Number"
            {...register('phone')}
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
          <ImageUploadField
            label="QR Code"
            id="qrCode"
            preview={images.qrCode}
            onChange={onImageUpload('qrCode')}
            compact
          />
        </div>
      </Section>

      <Section icon={<ImageIcon className="w-5 h-5 text-primary" />} title="Property Images">
        <div className="flex items-center gap-2 text-green-500 text-sm mb-4">
          <Sparkles className="w-4 h-4" />
          Auto-selected using Repliers AI
        </div>

        <div className="space-y-4">
          <FormField
            icon={<MapPin className="w-3 h-3" />}
            label="Property Address"
            {...register('address')}
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
            />

            <ImageUploadField
              label="Kitchen Photo"
              id="kitchenImage"
              preview={images.kitchenImage}
              onChange={onImageUpload('kitchenImage')}
              aiSelectionInfo={photoSelectionInfo?.kitchenImage}
              availablePhotos={allMlsPhotos}
              onSelectPhoto={(url) => onSelectPhoto?.('kitchenImage', url)}
            />

            <ImageUploadField
              label="Room Photo"
              id="roomImage"
              preview={images.roomImage}
              onChange={onImageUpload('roomImage')}
              aiSelectionInfo={photoSelectionInfo?.roomImage}
              availablePhotos={allMlsPhotos}
              onSelectPhoto={(url) => onSelectPhoto?.('roomImage', url)}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
