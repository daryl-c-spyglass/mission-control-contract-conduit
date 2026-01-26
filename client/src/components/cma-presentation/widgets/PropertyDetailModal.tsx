import { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Bed, Bath, Square, Calendar, Car, Maximize, Camera, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CmaProperty } from '../types';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface PropertyDetailModalProps {
  property: CmaProperty;
  subjectProperty?: CmaProperty;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  if (!value || isNaN(value)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const getStatusColor = (status: string, isSubject?: boolean) => {
  if (isSubject) return 'bg-blue-500';
  const s = status?.toLowerCase() || '';
  if (s.includes('closed') || s.includes('sold')) return 'bg-red-500';
  if (s.includes('active under') || s.includes('under contract')) return 'bg-orange-500';
  if (s.includes('active')) return 'bg-green-500';
  if (s.includes('pending')) return 'bg-gray-500';
  return 'bg-gray-500';
};

const getStatusLabel = (status: string, isSubject?: boolean) => {
  if (isSubject) return 'Subject';
  return status || 'Unknown';
};

export function PropertyDetailModal({ property, subjectProperty, onClose }: PropertyDetailModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  
  const photos = property.photos || [];
  const hasCoordinates = property.latitude && property.longitude;
  
  const handlePrevPhoto = () => {
    setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };
  
  const handleNextPhoto = () => {
    setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };
  
  useEffect(() => {
    if (!mapContainer.current || map.current || !hasCoordinates) return;
    
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn('VITE_MAPBOX_TOKEN not configured');
      return;
    }
    
    mapboxgl.accessToken = token;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [property.longitude!, property.latitude!],
      zoom: 14,
    });
    
    new mapboxgl.Marker({ color: '#EF4923' })
      .setLngLat([property.longitude!, property.latitude!])
      .addTo(map.current);
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [property.latitude, property.longitude, hasCoordinates]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && photos.length > 1) handlePrevPhoto();
      if (e.key === 'ArrowRight' && photos.length > 1) handleNextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length]);
  
  const calcDiff = (propVal: number | null | undefined, subjectVal: number | null | undefined) => {
    if (!propVal || !subjectVal || subjectVal === 0) return null;
    const diff = ((propVal - subjectVal) / subjectVal) * 100;
    return { text: `${diff >= 0 ? '↑' : '↓'}${Math.abs(diff).toFixed(0)}%`, positive: diff >= 0 };
  };
  
  const sqftDiff = calcDiff(property.sqft, subjectProperty?.sqft);
  const lotDiff = calcDiff(property.lotSize, subjectProperty?.lotSize);
  
  const pricePerSqft = property.pricePerSqft || 
    (property.sqft > 0 ? Math.round((property.soldPrice || property.price) / property.sqft) : 0);

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/70 z-[80]"
        onClick={onClose}
        data-testid="modal-backdrop"
      />
      
      <div 
        className="fixed inset-4 lg:inset-8 bg-background rounded-xl shadow-2xl z-[80] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid="property-detail-modal"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="flex-shrink-0"
            aria-label="Close modal"
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-lg font-bold truncate" data-testid="modal-address">
              {property.address}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="modal-location">
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-12 h-full">
            
            {/* LEFT COLUMN - Map + Stats + Description */}
            <div className="col-span-12 lg:col-span-4 border-r overflow-y-auto">
              
              {/* Mapbox Map */}
              <div className="relative h-48 border-b">
                {hasCoordinates ? (
                  <>
                    <div ref={mapContainer} className="w-full h-full" />
                    <div className="absolute top-2 left-2 bg-background/95 backdrop-blur rounded shadow-md p-2 text-xs z-10" data-testid="map-coordinates-overlay">
                      <div className="font-mono text-muted-foreground" data-testid="text-coordinates">
                        {property.latitude!.toFixed(4)}°N {Math.abs(property.longitude!).toFixed(4)}°W
                      </div>
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 mt-1"
                        data-testid="link-directions"
                      >
                        <Navigation className="w-3 h-3" /> Directions
                      </a>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground" data-testid="map-placeholder">
                    No location data
                  </div>
                )}
              </div>
              
              {/* Stats Grid - 2x3 */}
              <div className="grid grid-cols-2 border-b" data-testid="stats-grid">
                <div className="p-3 border-r border-b text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Bed className="w-3 h-3" /> BEDROOMS
                  </div>
                  <div className="text-xl font-bold" data-testid="text-bedrooms">
                    {property.beds ?? 'N/A'}
                  </div>
                </div>
                <div className="p-3 border-b text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Bath className="w-3 h-3" /> BATHROOMS
                  </div>
                  <div className="text-xl font-bold" data-testid="text-bathrooms">
                    {property.baths ?? 'N/A'}
                  </div>
                </div>
                <div className="p-3 border-r border-b text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Square className="w-3 h-3" /> HOME SIZE
                    {sqftDiff && (
                      <span className={sqftDiff.positive ? 'text-green-500' : 'text-red-500'}>
                        {sqftDiff.text}
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold" data-testid="text-sqft">
                    {property.sqft?.toLocaleString() ?? 'N/A'} <span className="text-sm font-normal">sqft</span>
                  </div>
                </div>
                <div className="p-3 border-b text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Calendar className="w-3 h-3" /> YEAR BUILT
                  </div>
                  <div className="text-xl font-bold" data-testid="text-year-built">
                    {property.yearBuilt ?? 'N/A'}
                  </div>
                </div>
                <div className="p-3 border-r text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Car className="w-3 h-3" /> GARAGES
                  </div>
                  <div className="text-xl font-bold" data-testid="text-garages">
                    {property.garageSpaces ?? 'N/A'}
                  </div>
                </div>
                <div className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs mb-1">
                    <Maximize className="w-3 h-3" /> LOT SIZE
                    {lotDiff && (
                      <span className={lotDiff.positive ? 'text-green-500' : 'text-red-500'}>
                        {lotDiff.text}
                      </span>
                    )}
                  </div>
                  <div className="text-xl font-bold" data-testid="text-lot-size">
                    {property.lotSize?.toLocaleString() ?? 'N/A'}
                  </div>
                </div>
              </div>
              
              {/* Property Description */}
              {property.description && (
                <div className="p-4" data-testid="description-section">
                  <h3 className="text-sm font-semibold mb-2">
                    Property Description
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6" data-testid="text-description">
                    {property.description}
                  </p>
                </div>
              )}
            </div>
            
            {/* MIDDLE COLUMN - Photo Gallery */}
            <div className="col-span-12 lg:col-span-5 bg-muted/50 relative flex items-center justify-center">
              {photos.length > 0 ? (
                <>
                  <img 
                    src={photos[currentPhotoIndex]} 
                    alt={`${property.address} - Photo ${currentPhotoIndex + 1}`}
                    className="w-full h-full object-contain"
                    data-testid="modal-main-photo"
                  />
                  
                  {photos.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevPhoto}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full"
                        aria-label="Previous photo"
                        data-testid="button-prev-photo"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextPhoto}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full"
                        aria-label="Next photo"
                        data-testid="button-next-photo"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </Button>
                    </>
                  )}
                  
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 bg-black/60 text-white text-sm rounded" data-testid="photo-count-badge">
                    <Camera className="w-4 h-4" />
                    <span data-testid="text-photo-count">{photos.length}</span>
                  </div>
                  
                  <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 text-white text-sm rounded" data-testid="photo-counter">
                    <span data-testid="text-photo-current">{currentPhotoIndex + 1}</span> / <span data-testid="text-photo-total">{photos.length}</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground" data-testid="no-photos-placeholder">
                  No photos available
                </div>
              )}
            </div>
            
            {/* RIGHT COLUMN - Pricing & Details */}
            <div className="col-span-12 lg:col-span-3 bg-muted/30 overflow-y-auto">
              
              {/* Status + Price Header */}
              <div className="p-4 border-b bg-background" data-testid="price-section">
                <div className="flex items-center gap-2 mb-2">
                  <span 
                    className={`px-2 py-1 ${getStatusColor(property.status, property.isSubject)} text-white text-xs font-semibold rounded`}
                    data-testid="status-badge"
                  >
                    {getStatusLabel(property.status, property.isSubject)}
                  </span>
                  <span className="text-sm text-muted-foreground" data-testid="days-on-market">
                    {property.daysOnMarket} DAYS
                  </span>
                </div>
                <div className="text-2xl font-bold" data-testid="text-price">
                  {formatCurrency(property.soldPrice || property.price)}
                </div>
                <div className="text-sm text-muted-foreground" data-testid="text-price-per-sqft">
                  ${pricePerSqft}/sqft
                </div>
                <div className="text-sm text-muted-foreground mt-2" data-testid="text-property-summary">
                  {property.beds} beds · {property.baths} baths · {property.sqft?.toLocaleString()} sqft
                </div>
                {property.soldDate && (
                  <div className="text-sm text-muted-foreground mt-1" data-testid="row-header-sold-date">
                    Sold: <span data-testid="text-header-sold-date">{new Date(property.soldDate).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              
              {/* Price History */}
              <div className="p-4 border-b bg-background" data-testid="price-history-section">
                <h3 className="text-sm font-semibold mb-3">
                  Price History
                </h3>
                <div className="space-y-2">
                  {property.originalPrice && property.originalPrice !== property.listPrice && (
                    <div className="flex justify-between text-sm" data-testid="row-original-price">
                      <span className="text-muted-foreground">Orig. Price</span>
                      <span className="font-medium" data-testid="text-original-price">
                        {formatCurrency(property.originalPrice)}
                      </span>
                    </div>
                  )}
                  {property.listPrice && (
                    <div className="flex justify-between text-sm" data-testid="row-list-price">
                      <span className="text-muted-foreground">List Price</span>
                      <span className="font-medium" data-testid="text-list-price">
                        {formatCurrency(property.listPrice)}
                      </span>
                    </div>
                  )}
                  {property.soldPrice && (
                    <div className="flex justify-between text-sm" data-testid="row-sold-price">
                      <span className="text-muted-foreground">Sold Price</span>
                      <span className="font-medium text-[#EF4923]" data-testid="text-sold-price">
                        {formatCurrency(property.soldPrice)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Listing Details */}
              <div className="p-4 border-b bg-background" data-testid="listing-details-section">
                <h3 className="text-sm font-semibold mb-3">
                  Listing Details
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm" data-testid="row-price-sqft">
                    <span className="text-muted-foreground">Price/Sq Ft</span>
                    <span className="font-medium" data-testid="text-details-price-sqft">${pricePerSqft}</span>
                  </div>
                  <div className="flex justify-between text-sm" data-testid="row-dom">
                    <span className="text-muted-foreground">Days on Market</span>
                    <span className="font-medium" data-testid="text-details-dom">{property.daysOnMarket}</span>
                  </div>
                  {property.listDate && (
                    <div className="flex justify-between text-sm" data-testid="row-list-date">
                      <span className="text-muted-foreground">Listed</span>
                      <span className="font-medium" data-testid="text-list-date">
                        {new Date(property.listDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {property.soldDate && (
                    <div className="flex justify-between text-sm" data-testid="row-sold-date">
                      <span className="text-muted-foreground">Sold</span>
                      <span className="font-medium" data-testid="text-sold-date">
                        {new Date(property.soldDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* MLS Info */}
              <div className="p-4 bg-background" data-testid="mls-info-section">
                <div className="text-sm text-muted-foreground" data-testid="text-mls-number">
                  MLS# {property.mlsNumber || property.id}
                </div>
                {property.city && property.zipCode && (
                  <div className="text-sm text-muted-foreground mt-1" data-testid="text-mls-location">
                    {property.city}, {property.state} {property.zipCode}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
