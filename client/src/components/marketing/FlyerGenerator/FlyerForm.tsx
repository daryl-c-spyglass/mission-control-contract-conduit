import { UseFormReturn } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  FileText, DollarSign, BedDouble, Bath, Ruler, User, Phone, MapPin,
  Image as ImageIcon, Check
} from 'lucide-react';
import { ImageUploadField } from './ImageUploadField';
import { AIHeadlineButton } from './AIHeadlineButton';
import type { FlyerData, FlyerImages, ImageTransforms, ImageTransform } from '@/lib/flyer-types';

interface FlyerFormProps {
  form: UseFormReturn<FlyerData>;
  images: FlyerImages;
  imageTransforms: ImageTransforms;
  onImageUpload: (field: keyof FlyerImages) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTransformChange: (field: keyof ImageTransforms) => (transform: ImageTransform) => void;
  transactionId: string;
  mlsData: any;
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
  imageTransforms,
  onImageUpload,
  onTransformChange,
  transactionId,
  mlsData,
}: FlyerFormProps) {
  const { register, setValue } = form;

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
            <Label className="text-xs font-medium uppercase tracking-wide">
              Property Description
            </Label>
            <Textarea
              {...register('introDescription')}
              placeholder="Describe the property..."
              className="min-h-[120px] resize-none"
              data-testid="input-flyer-description"
            />
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
            transform={imageTransforms.agentPhoto}
            onTransformChange={onTransformChange('agentPhoto')}
            showCropControls
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
          <Check className="w-4 h-4" />
          Auto-selected using image quality
        </div>

        <div className="space-y-4">
          <FormField
            icon={<MapPin className="w-3 h-3" />}
            label="Property Address"
            {...register('address')}
            data-testid="input-flyer-address"
          />

          <ImageUploadField
            label="Main Property Photo"
            id="mainImage"
            preview={images.mainImage}
            onChange={onImageUpload('mainImage')}
            transform={imageTransforms.mainImage}
            onTransformChange={onTransformChange('mainImage')}
            showCropControls
          />

          <div className="grid grid-cols-2 gap-3">
            <ImageUploadField
              label="Kitchen Photo"
              id="kitchenImage"
              preview={images.kitchenImage}
              onChange={onImageUpload('kitchenImage')}
              transform={imageTransforms.kitchenImage}
              onTransformChange={onTransformChange('kitchenImage')}
              showCropControls
            />
            <ImageUploadField
              label="Room Photo"
              id="roomImage"
              preview={images.roomImage}
              onChange={onImageUpload('roomImage')}
              transform={imageTransforms.roomImage}
              onTransformChange={onTransformChange('roomImage')}
              showCropControls
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
