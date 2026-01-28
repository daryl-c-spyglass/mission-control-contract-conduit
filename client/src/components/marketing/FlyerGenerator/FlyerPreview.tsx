import type { FlyerData, FlyerImages, ImageTransforms } from '@/lib/flyer-types';
import { User, QrCode } from 'lucide-react';

interface FlyerPreviewProps {
  data: FlyerData;
  images: FlyerImages;
  imageTransforms: ImageTransforms;
  logoScales?: { primary: number; secondary: number };
  dividerPosition?: number;
  secondaryLogoOffsetY?: number;
}

export function FlyerPreview({ 
  data, 
  images, 
  imageTransforms,
  logoScales = { primary: 1, secondary: 1 },
  dividerPosition = 200,
  secondaryLogoOffsetY = 0,
}: FlyerPreviewProps) {
  const accentColor = "#8b7d6b";

  const getTransformStyle = (transform: { scale: number; positionX: number; positionY: number }) => ({
    transform: `scale(${transform.scale}) translate(${transform.positionX}%, ${transform.positionY}%)`,
    transformOrigin: 'center center',
  });

  return (
    <div
      className="bg-white relative"
      style={{ width: '816px', height: '1056px', fontFamily: 'Arial, sans-serif' }}
      data-testid="flyer-preview"
    >
      {/* Header with Logos */}
      <div className="absolute left-6 top-4 right-6 h-[80px] flex items-center">
        {/* Accent Bar */}
        <div
          className="absolute left-0 top-0 w-[6px] h-[83px]"
          style={{ backgroundColor: accentColor }}
        />
        
        {/* Company Logo Container */}
        <div 
          className="flex items-center justify-center h-full ml-4"
          style={{ width: `${dividerPosition}px` }}
        >
          {images.companyLogo ? (
            <img 
              src={images.companyLogo} 
              alt="Company Logo" 
              className="max-h-[55px] object-contain"
              style={{ 
                transform: `scale(${logoScales.primary})`,
                transformOrigin: 'center center',
              }}
            />
          ) : (
            <span className="text-gray-400 text-xs">LOGO</span>
          )}
        </div>
        
        {/* Vertical Divider Line */}
        <div 
          className="h-[50px] bg-gray-400"
          style={{ 
            width: '1px',
            marginLeft: '8px',
            marginRight: '8px',
          }}
        />
        
        {/* Secondary Logo Container - positioned immediately after divider */}
        <div 
          className="flex items-center justify-start h-full"
          style={{ 
            transform: `translateY(${secondaryLogoOffsetY}px)`,
          }}
        >
          {images.secondaryLogo ? (
            <img 
              src={images.secondaryLogo} 
              alt="Secondary Logo" 
              className="max-h-[50px] object-contain"
              style={{ 
                transform: `scale(${logoScales.secondary})`,
                transformOrigin: 'left center',
              }}
            />
          ) : (
            <span className="text-gray-400 text-xs">SECONDARY LOGO</span>
          )}
        </div>
        
        {/* Price Badge */}
        <div className="absolute right-0 top-0 w-[144px] h-[58px] bg-[#6b7b6e] flex flex-col justify-center items-center text-white">
          <span className="text-[7pt] tracking-[2px]">LISTED AT</span>
          <span className="text-[14pt] font-bold">{data.price || '$0'}</span>
        </div>
      </div>

      <div
        className="absolute left-10 top-[89px] text-[11pt] text-gray-700 tracking-[2px] uppercase font-medium"
      >
        {data.address || 'PROPERTY ADDRESS'}
      </div>

      <div className="absolute left-6 top-[132px] w-[720px] h-[360px] rounded-lg overflow-hidden bg-gray-200">
        {images.mainImage ? (
          <img
            src={images.mainImage}
            alt="Main Property"
            className="w-full h-full object-cover"
            style={getTransformStyle(imageTransforms.mainImage)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Main Property Photo
          </div>
        )}
      </div>

      <div className="absolute left-6 top-[506px] w-[720px] flex gap-[10px]">
        <div className="w-[355px] h-[230px] rounded-lg overflow-hidden bg-gray-200">
          {images.kitchenImage ? (
            <img
              src={images.kitchenImage}
              alt="Kitchen"
              className="w-full h-full object-cover"
              style={getTransformStyle(imageTransforms.kitchenImage)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Kitchen Photo
            </div>
          )}
        </div>
        <div className="w-[355px] h-[230px] rounded-lg overflow-hidden bg-gray-200">
          {images.roomImage ? (
            <img
              src={images.roomImage}
              alt="Room"
              className="w-full h-full object-cover"
              style={getTransformStyle(imageTransforms.roomImage)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              Room Photo
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-6 top-[766px] right-6 h-[270px] flex">
        <div className="pt-[35px] pl-2">
          <div className="flex items-center gap-2.5 mb-5 text-[13.5pt] whitespace-nowrap">
            <svg className="w-[31px] h-[31px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
            </svg>
            <span>{data.bedrooms || '0'} bedrooms</span>
          </div>
          <div className="flex items-center gap-2.5 mb-5 text-[13.5pt] whitespace-nowrap">
            <svg className="w-[31px] h-[31px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
              <line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/>
            </svg>
            <span>{data.bathrooms || '0'} bathrooms</span>
          </div>
          <div className="flex items-center gap-2.5 mb-5 text-[13.5pt] whitespace-nowrap">
            <svg className="w-[31px] h-[31px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>
            </svg>
            <span>{data.sqft || '0'} sq. ft</span>
          </div>
        </div>

        <div
          className="w-1 h-[148px] mt-[35px] ml-[42px] flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />

        <div className="w-[432px] pl-8 pr-2.5">
          <h3 className="text-[11pt] font-medium uppercase tracking-[2px] leading-[1.3] mb-4 mt-2 text-gray-700">
            {data.introHeading || 'Property Headline'}
          </h3>
          <p className="text-[11pt] leading-[1.5] line-clamp-6">
            {data.introDescription || 'Property description will appear here...'}
          </p>
        </div>

        <div
          className="w-1 h-[148px] mt-[35px] ml-[22px] flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />

        <div className="w-[335px] pl-[27px] flex flex-col items-center pt-4">
          <div className="flex gap-4 items-center mb-2">
            <div className="w-[106px] h-[106px] rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
              {images.agentPhoto ? (
                <img
                  src={images.agentPhoto}
                  alt="Agent"
                  className="w-full h-full object-cover"
                  style={getTransformStyle(imageTransforms.agentPhoto)}
                />
              ) : (
                <User className="w-10 h-10 text-gray-400" />
              )}
            </div>
            <div className="w-[74px] h-[74px] border-2 border-black p-[3px]">
              {images.qrCode ? (
                <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-full h-full text-gray-400" />
              )}
            </div>
          </div>
          <div className="text-[21pt] font-bold text-center mb-1">
            {data.agentName || ''}
          </div>
          <div className="text-[10pt] text-center leading-[1.4]">
            <div>{data.agentTitle || ''}</div>
            <div>{data.phone || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
