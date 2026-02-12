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

      {/* Bottom Section - 4-column grid matching reference (grids 13-16) */}
      {/* 720px = 816px canvas - 48px padding each side, each column = 180px */}
      <div 
        className="absolute left-[48px] top-[790px] h-[270px] overflow-hidden"
        style={{ width: '720px', display: 'grid', gridTemplateColumns: '180px 180px 180px 180px' }}
        data-layout-id="bottom-section"
      >
        {/* Grid 13: Property Stats — subsquare: items at rows 1.5, 4.5, 7.5 */}
        <div 
          className="relative pl-[18px] pr-[8px]"
          style={{ paddingTop: '52px' }}
          data-layout-id="stats"
        >
          <div className="flex items-center gap-2 text-[11pt] whitespace-nowrap text-gray-800" style={{ marginBottom: '33px' }}>
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>
            </svg>
            <span>{data.bedrooms || '0'} bedrooms</span>
          </div>
          <div className="flex items-center gap-2 text-[11pt] whitespace-nowrap text-gray-800" style={{ marginBottom: '33px' }}>
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>
              <line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/>
            </svg>
            <span>{data.bathrooms || '0'} bathrooms</span>
          </div>
          <div className="flex items-center gap-2 text-[11pt] whitespace-nowrap text-gray-800">
            <svg className="w-[24px] h-[24px] flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/>
            </svg>
            <span>{data.sqft ? `${Number(String(data.sqft).replace(/,/g, '')).toLocaleString()} sq. ft` : '0 sq. ft'}</span>
          </div>
          {/* Accent divider — subsquare: rows 1.5 to 7, right edge */}
          <div
            className="absolute right-[5px] top-[40px]"
            style={{ width: '2px', height: '160px', backgroundColor: accentColor }}
            data-layout-id="divider-1"
          />
        </div>

        {/* Grid 14: Headline + Description — subsquare: headline row 0.5, desc row 2.5 */}
        <div 
          className="relative overflow-visible"
          style={{ paddingLeft: '29px', paddingRight: '10px', width: '270px' }}
          data-layout-id="description-column"
        >
          <h3 
            className="text-gray-700 uppercase"
            style={{
              fontSize: '11.5pt',
              fontWeight: 600,
              letterSpacing: '1px',
              lineHeight: 1.3,
              marginTop: '4px',
              marginBottom: '8px',
            }}
            data-layout-id="headline"
          >
            {data.introHeading || 'Property Headline'}
          </h3>
          <p 
            className="line-clamp-8"
            style={{
              fontSize: '10.35pt',
              lineHeight: 1.4,
              color: '#555',
              overflow: 'hidden',
            }}
            data-layout-id="description"
          >
            {data.introDescription || 'Property description will appear here...'}
          </p>
        </div>
        {/* Accent divider 2 — positioned in bottom-section grid, after description column */}
        <div
          className="absolute top-[40px]"
          style={{ width: '2px', height: '160px', backgroundColor: accentColor, left: '477px' }}
          data-layout-id="divider-2"
        />

        {/* Grid 15: Agent Photo only — subsquare: centered at (5,5), ~4 subsquares dia */}
        <div 
          className="relative"
          style={{ paddingTop: '14px' }}
          data-layout-id="agent-photo-column"
        >
          <div 
            className="absolute rounded-full overflow-hidden bg-gray-200 flex items-center justify-center flex-shrink-0"
            style={{ width: '108px', height: '108px', right: '-79px' }}
          >
            {images.agentPhoto ? (
              <img
                src={images.agentPhoto}
                alt="Agent"
                className="w-full h-full object-cover"
                style={getTransformStyle(imageTransforms.agentPhoto)}
              />
            ) : (
              <User className="w-12 h-12 text-gray-400" />
            )}
          </div>
        </div>

        {/* Grid 16: QR Code + Agent Name/Title/Phone — subsquare: QR rows 0.5-3.5, name row 5.5 */}
        <div 
          className="flex flex-col items-center overflow-hidden"
          style={{ paddingTop: '28px' }}
          data-layout-id="qr-agent-section"
        >
          <div 
            className="flex items-center justify-center flex-shrink-0"
            style={{ 
              width: '76px', 
              height: '76px', 
              border: '2px solid #000',
              padding: '2px',
              marginLeft: '100px',
            }}
          >
            {images.qrCode ? (
              <img src={images.qrCode} alt="QR Code" className="w-full h-full object-contain" />
            ) : (
              <QrCode className="w-full h-full text-gray-400" />
            )}
          </div>
          <div 
            className="font-bold text-center truncate text-gray-800 w-full px-1"
            style={{ fontSize: '12.65pt', marginTop: '31px' }}
          >
            {data.agentName || ''}
          </div>
          <div 
            className="text-center w-full px-1"
            style={{ fontSize: '9.2pt', lineHeight: 1.4, color: '#555' }}
          >
            <div className="truncate">{data.agentTitle || ''}</div>
            <div>{data.phone || ''}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
