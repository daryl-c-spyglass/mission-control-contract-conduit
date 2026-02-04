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
      {/* Accent Bar - positioned absolutely from canvas, left 48px aligned with photos */}
      {/* top: 25px, height: 83px, center at 66.5px */}
      <div
        className="absolute left-[48px] top-[25px] w-[6px] h-[83px]"
        style={{ backgroundColor: accentColor }}
      />

      {/* Header with Logos - centered vertically with accent bar center (66.5px) */}
      {/* Logo container height 50px, so top = 66.5 - 25 = 41.5px ≈ 42px */}
      {/* Left aligned with address line at 70px */}
      <div className="absolute left-[70px] top-[42px] right-6 h-[50px] flex items-center">
        {/* Company Logo Container */}
        <div 
          className="flex items-center justify-center h-full"
          style={{ width: `${dividerPosition}px` }}
        >
          {images.companyLogo ? (
            <img 
              src={images.companyLogo} 
              alt="Company Logo" 
              className="max-h-[50px] object-contain"
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
        <div className="absolute right-0 top-[-26px] w-[144px] h-[58px] bg-[#6b7b6e] flex flex-col justify-center items-center text-white">
          <span className="text-[7pt] tracking-[2px]">LISTED AT</span>
          <span className="text-[14pt] font-bold">{data.price || '$0'}</span>
        </div>
      </div>

      <div
        className="absolute left-[70px] top-[114px] text-[11pt] text-gray-700 tracking-[2px] uppercase font-medium"
      >
        {data.address || 'PROPERTY ADDRESS'}
        {(data.city || data.state || data.zip) && ', '}
        {[data.city, data.state, data.zip].filter(Boolean).join(', ')}
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
      {/* Bottom Section - Fixed 720px width layout with proper grid alignment */}
      {/* Grid: Stats (Grid 13) | Divider1 | Description (Grid 14) | Divider2 | Agent Card (Grids 15-16) */}
      {/* Total: 720px = 816px canvas - 48px padding each side */}
      <div 
        className="absolute left-[48px] top-[790px] h-[270px] flex overflow-hidden"
        style={{ width: '720px' }}
        data-layout-id="bottom-section"
      >
        {/* Column 1: Property Details - Grid 13 area (132px + 8px margin = 140px) */}
        {/* Uses explicit text colors to ensure visibility regardless of app dark mode */}
        <div 
          className="flex-shrink-0 pt-[20px] pl-2"
          style={{ width: '132px', marginRight: '8px' }}
          data-layout-id="stats"
        >
          <div className="flex items-center gap-2 mb-4 text-[11pt] whitespace-nowrap text-gray-800">
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
            </svg>
            <span>{data.bedrooms || '0'} beds</span>
          </div>
          <div className="flex items-center gap-2 mb-4 text-[11pt] whitespace-nowrap text-gray-800">
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
              <line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/>
            </svg>
            <span>{data.bathrooms || '0'} baths</span>
          </div>
          <div className="flex items-center gap-2 mb-4 text-[11pt] whitespace-nowrap text-gray-800">
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>
            </svg>
            <span>{data.sqft || '0'} sqft</span>
          </div>
        </div>

        {/* Divider 1 @ ~140px (Grid 13/14 boundary) */}
        <div
          className="flex-shrink-0"
          style={{ 
            width: '4px', 
            height: '147.84px', 
            marginTop: '34.56px', 
            marginLeft: '8px',
            marginRight: '8px',
            backgroundColor: accentColor 
          }}
          data-layout-id="divider-1"
        />

        {/* Description column: Grid 14 area (196px width) */}
        <div 
          className="flex-shrink-0 overflow-hidden" 
          style={{ width: '196px', paddingLeft: '8px', paddingRight: '8px' }}
          data-layout-id="description-column"
        >
          {/* Headline: 10pt to fit narrower column */}
          <h3 
            className="text-gray-700 uppercase line-clamp-2"
            style={{
              fontSize: '10pt',
              fontWeight: 600,
              letterSpacing: '1px',
              lineHeight: 1.3,
              marginTop: '7.68px',
              marginBottom: '8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            data-layout-id="headline"
          >
            {data.introHeading || 'Property Headline'}
          </h3>
          {/* Description: 9pt for narrower column */}
          <p 
            className="line-clamp-8"
            style={{
              fontSize: '9pt',
              lineHeight: 1.4,
              color: '#555',
              overflow: 'hidden',
            }}
            data-layout-id="description"
          >
            {data.introDescription || 'Property description will appear here...'}
          </p>
        </div>

        {/* Divider 2 - moved 3 subsquares right */}
        <div
          className="flex-shrink-0"
          style={{ 
            width: '4px', 
            height: '147.84px', 
            marginTop: '34.56px', 
            marginLeft: '32px',
            marginRight: '8px',
            backgroundColor: accentColor 
          }}
          data-layout-id="divider-2"
        />

        {/* Agent Card Container: Grids 15-16 (remaining ~308px) */}
        {/* Layout: Agent info positioned 75% right toward QR code, QR at right edge */}
        <div 
          className="relative flex-1 flex items-start justify-end gap-3 overflow-hidden"
          style={{ 
            paddingTop: '16px',
            minWidth: '280px',
            maxWidth: '308px',
          }}
          data-layout-id="agent-card"
        >
          {/* Agent Photo + Details - positioned 75% toward right */}
          <div 
            className="flex flex-col items-center"
            style={{ width: '140px' }}
            data-layout-id="agent-info"
          >
            {/* Agent Photo - 100px circular */}
            <div 
              className="rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0 mb-2"
              style={{ width: '100px', height: '100px' }}
            >
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
            
            {/* Agent Name */}
            <div 
              className="font-bold text-center truncate text-gray-800"
              style={{ 
                fontSize: '14pt', 
                maxWidth: '100%',
              }}
            >
              {data.agentName || ''}
            </div>
            
            {/* Agent Title & Phone */}
            <div 
              className="text-center"
              style={{ 
                fontSize: '9pt', 
                lineHeight: 1.4,
                color: '#555',
              }}
            >
              <div className="truncate">{data.agentTitle || ''}</div>
              <div>{data.phone || ''}</div>
            </div>
          </div>
          
          {/* Right side: QR Code - aligned to right edge */}
          <div 
            className="flex flex-col items-center flex-shrink-0"
            style={{ marginTop: '15px' }}
            data-layout-id="qr-section"
          >
            <div 
              className="flex items-center justify-center"
              style={{ 
                width: '80px', 
                height: '80px', 
                border: '2px solid #000',
                padding: '2px',
              }}
            >
              {images.qrCode ? (
                <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-full h-full text-gray-400" />
              )}
            </div>
            <span 
              className="text-center mt-1"
              style={{ fontSize: '7pt', color: '#666', letterSpacing: '0.5px' }}
            >
              SCAN FOR INFO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
