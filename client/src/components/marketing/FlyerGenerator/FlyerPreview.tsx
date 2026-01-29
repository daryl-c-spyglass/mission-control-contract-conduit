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
      {/* Reference layout (overflows by design): Stats: 150.72px | Divider1 @ 240.72px | Description: 432px | Divider2 @ 697.72px | Agent: 335px */}
      {/* Total: 988.72px - overflow is intentional to match reference positioning */}
      <div 
        className="absolute left-[48px] top-[790px] h-[270px] flex overflow-visible"
        data-layout-id="bottom-section"
      >
        {/* Column 1: Property Details - 150.72px */}
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

        {/* Divider 1 @ 240.72px: 4px width, 42px margin-left (per reference) */}
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

        {/* Description column: 156px width to fit divider at Grid 15 line (~408px) */}
        <div 
          className="w-[156px] flex-shrink-0 overflow-hidden" 
          style={{ paddingLeft: '8px', paddingRight: '4px' }}
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

        {/* Divider 2 at Grid 15 line (~408px): 4px width, 4px margin-left */}
        <div
          className="flex-shrink-0"
          style={{ 
            width: '4px', 
            height: '147.84px', 
            marginTop: '34.56px', 
            marginLeft: '4px',
            backgroundColor: accentColor 
          }}
          data-layout-id="divider-2"
        />

        {/* Agent Card Container: fills remaining space after divider 2 (~408px to 768px = 360px) */}
        {/* Photo centered in Grid 15, QR at right of Grid 16 */}
        <div 
          className="relative flex-1"
          style={{ 
            paddingTop: '16.32px',
          }}
          data-layout-id="agent-card"
        >
          {/* Agent Photo - positioned center of Grid 15 area */}
          {/* Grid 15 = 408-612px, center = 510px, photo 105.6px, left edge = 510 - 52.8 = 457.2px */}
          {/* From agent card start (~412px): 457.2 - 412 = 45.2px offset */}
          <div 
            className="absolute rounded-full overflow-hidden bg-gray-200 flex items-center justify-center"
            style={{ 
              width: '105.6px', 
              height: '105.6px',
              left: '45px',
              top: '16px',
            }}
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
          
          {/* QR Code - positioned at right side of Grid 16 */}
          {/* Grid 16 right edge = 768px (from section start), QR 73.92px, left edge = 768 - 73.92 - 8px margin = ~686px */}
          {/* From agent card start (~412px): 686 - 412 = 274px offset */}
          <div 
            className="absolute flex items-center justify-center"
            style={{ 
              width: '73.92px', 
              height: '73.92px', 
              border: '2px solid #000',
              padding: '2.88px',
              left: '274px',
              top: '32px',
            }}
          >
            {images.qrCode ? (
              <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-full h-full text-gray-400" />
            )}
          </div>
          
          {/* Agent Name - positioned below photo, centered between photo and QR */}
          <div 
            className="absolute font-bold text-center"
            style={{ 
              fontSize: '16pt', 
              left: '20px',
              right: '80px',
              top: '130px',
            }}
          >
            {data.agentName || ''}
          </div>
          
          {/* Agent Title & Phone - below name */}
          <div 
            className="absolute text-center"
            style={{ 
              fontSize: '9pt', 
              lineHeight: 1.4,
              left: '20px',
              right: '80px',
              top: '155px',
            }}
          >
            <div>{data.agentTitle || ''}</div>
            <div>{data.phone || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
