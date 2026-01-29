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
  dividerPosition = 148,
  secondaryLogoOffsetY = 0,
}: FlyerPreviewProps) {
  const accentColor = "#8b7d6b";

  // Use objectPosition + scale approach to match CropModal exactly
  // positionX/Y are in range -50 to 50, where 0 is center
  // Convert back to objectPosition format (0-100, where 50 is center)
  const getTransformStyle = (transform: { scale: number; positionX: number; positionY: number }) => {
    const objPosX = 50 - transform.positionX;
    const objPosY = 50 - transform.positionY;
    return {
      objectPosition: `${objPosX}% ${objPosY}%`,
      transform: `scale(${transform.scale})`,
      transformOrigin: `${objPosX}% ${objPosY}%`,
    };
  };

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

      {/* Main Photo - Exact coordinates from reference project */}
      {/* Position: x: 48, y: 156, width: 720, height: 360 */}
      <div 
        className="absolute left-[48px] top-[156px] w-[720px] h-[360px] rounded-lg overflow-hidden bg-gray-200"
        data-layout-id="main-photo"
      >
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

      {/* Bottom Photos - Exact coordinates from reference project */}
      {/* photo-2: x: 48, y: 530, width: 355, height: 230 */}
      {/* photo-3: x: 413 (48 + 355 + 10 gap), y: 530, width: 355, height: 230 */}
      <div 
        className="absolute left-[48px] top-[530px] w-[720px] flex gap-[10px]"
        data-layout-id="secondary-photos-row"
      >
        <div 
          className="w-[355px] h-[230px] rounded-lg overflow-hidden bg-gray-200"
          data-layout-id="photo-2"
        >
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
        <div 
          className="w-[355px] h-[230px] rounded-lg overflow-hidden bg-gray-200"
          data-layout-id="photo-3"
        >
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

      {/* Bottom Section - Reference: top: 766 + 24 bleed = 790, height: 270 */}
      {/* Position: x: 48, y: 790, width: 720, height: 270 */}
      {/* Stats: 150.72px | Divider1 (4px + 42px margin) | Description: 432px (pl-32px, pr-10px) | Divider2 (4px + 21px margin) | Agent: remaining */}
      <div 
        className="absolute left-[48px] top-[790px] w-[720px] h-[270px] flex"
        data-layout-id="bottom-section"
      >
        {/* Column 1: Property Details (150.72px per reference) */}
        <div className="w-[150.72px] pt-[20px] pl-2 flex-shrink-0" data-layout-id="stats">
          <div className="flex items-center gap-2 mb-4 text-[12pt] whitespace-nowrap">
            <svg className="w-[28px] h-[28px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
            </svg>
            <span>{data.bedrooms || '0'} bedrooms</span>
          </div>
          <div className="flex items-center gap-2 mb-4 text-[12pt] whitespace-nowrap">
            <svg className="w-[28px] h-[28px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
              <line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/>
            </svg>
            <span>{data.bathrooms || '0'} bathrooms</span>
          </div>
          <div className="flex items-center gap-2 mb-4 text-[12pt] whitespace-nowrap">
            <svg className="w-[28px] h-[28px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5">
              <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>
            </svg>
            <span>{data.sqft || '0'} sq. ft</span>
          </div>
        </div>

        {/* STATIC Divider 1 (after Stats): 4px width, 147.84px height, 34.56px margin-top, 42px margin-left */}
        <div
          className="flex-shrink-0"
          style={{ 
            width: '4px', 
            height: '147.84px', 
            marginTop: '34.56px', 
            marginLeft: '42px',
            backgroundColor: accentColor 
          }}
          data-layout-id="divider-1"
        />

        {/* Description column: 432px width, padding left 32px, right 10px */}
        {/* Added flex-shrink-0 and overflow-hidden to prevent content from pushing dividers */}
        <div 
          className="w-[432px] flex-shrink-0 overflow-hidden" 
          style={{ paddingLeft: '32px', paddingRight: '10px' }}
          data-layout-id="description-column"
        >
          {/* Headline: 11pt, weight 500, uppercase, letter-spacing 2px, line-height 1.3, mt 7.68px, mb 16.32px */}
          {/* Added line-clamp-2 to limit headline to 2 lines max */}
          <h3 
            className="text-gray-700 uppercase line-clamp-2"
            style={{
              fontSize: '11pt',
              fontWeight: 500,
              letterSpacing: '2px',
              lineHeight: 1.3,
              marginTop: '7.68px',
              marginBottom: '16.32px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            data-layout-id="headline"
          >
            {data.introHeading || 'Property Headline'}
          </h3>
          {/* Description: 11pt, line-height 1.5, immediately below headline */}
          {/* Line clamp 6 for max 6 lines */}
          <p 
            className="line-clamp-6"
            style={{
              fontSize: '11pt',
              lineHeight: 1.5,
              overflow: 'hidden',
            }}
            data-layout-id="description"
          >
            {data.introDescription || 'Property description will appear here...'}
          </p>
        </div>

        {/* STATIC Divider 2 (after Description): 4px width, 147.84px height, 34.56px margin-top, 21px margin-left */}
        <div
          className="flex-shrink-0"
          style={{ 
            width: '4px', 
            height: '147.84px', 
            marginTop: '34.56px', 
            marginLeft: '21px',
            backgroundColor: accentColor 
          }}
          data-layout-id="divider-2"
        />

        {/* Agent card: remaining width - restructured to match reference layout */}
        {/* Reference shows: photo on left, name/title stacked, QR on right side */}
        <div className="flex-1 pl-3 pt-4 relative overflow-hidden" data-layout-id="agent-card">
          <div className="flex items-start gap-2">
            {/* Agent Photo */}
            <div className="w-[70px] h-[70px] rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0">
              {images.agentPhoto ? (
                <img
                  src={images.agentPhoto}
                  alt="Agent"
                  className="w-full h-full object-cover"
                  style={getTransformStyle(imageTransforms.agentPhoto)}
                />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            {/* Agent Info + QR stacked vertically */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-[11pt] font-bold leading-tight mb-0.5 truncate">
                {data.agentName || ''}
              </div>
              <div className="text-[7pt] leading-[1.3] text-gray-600">
                <div className="truncate">{data.agentTitle || ''}</div>
                <div className="truncate">{data.phone || ''}</div>
              </div>
            </div>
          </div>
          {/* QR Code positioned at bottom right */}
          <div className="absolute bottom-2 right-2 w-[55px] h-[55px] border border-black p-[1px]">
            {images.qrCode ? (
              <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-full h-full text-gray-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
