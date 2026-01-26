import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Bed, Bath, Square, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { CmaProperty } from '../types';

interface PropertyDetailModalProps {
  property: CmaProperty;
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

const getStatusColor = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('closed')) return 'bg-green-500';
  if (s.includes('active') && !s.includes('under')) return 'bg-red-500';
  if (s.includes('pending') || s.includes('under')) return 'bg-yellow-500';
  return 'bg-gray-500';
};

function DetailItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div data-testid={`detail-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <p className="text-sm text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export function PropertyDetailModal({ property, onClose }: PropertyDetailModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = property.photos || [];
  
  const handlePrevPhoto = () => {
    setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };
  
  const handleNextPhoto = () => {
    setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && photos.length > 1) handlePrevPhoto();
      if (e.key === 'ArrowRight' && photos.length > 1) handleNextPhoto();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length]);
  
  const pricePerSqft = property.pricePerSqft || 
    (property.sqft > 0 ? Math.round((property.soldPrice || property.price) / property.sqft) : 0);
  
  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-[80]"
        onClick={onClose}
        data-testid="modal-backdrop"
      />
      
      <div 
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                   md:w-full md:max-w-2xl md:max-h-[90vh] 
                   bg-background rounded-xl shadow-2xl z-[80] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid="property-detail-modal"
      >
        <div className="flex items-start justify-between p-4 border-b flex-wrap gap-2">
          <div className="min-w-0 flex-1">
            <h2 id="modal-title" className="text-xl font-bold truncate" data-testid="modal-address">
              {property.address}
            </h2>
            <p className="text-sm text-muted-foreground" data-testid="modal-location">
              {property.city}, {property.state} {property.zipCode}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="modal-mls">
              MLS# {property.id}
            </p>
          </div>
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
        </div>
        
        <div className="relative flex-shrink-0">
          <div className="relative aspect-[16/10] bg-muted">
            {photos.length > 0 ? (
              <img
                src={photos[currentPhotoIndex]}
                alt={`${property.address} - Photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover"
                data-testid="modal-main-photo"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No photos available
              </div>
            )}
            
            {photos.length > 1 && (
              <div 
                className="absolute bottom-3 left-1/2 -translate-x-1/2 
                           px-3 py-1 bg-black/60 text-white text-sm rounded-full"
                data-testid="photo-counter"
              >
                {currentPhotoIndex + 1} / {photos.length}
              </div>
            )}
            
            {photos.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handlePrevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg"
                  aria-label="Previous photo"
                  data-testid="button-prev-photo"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleNextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white shadow-lg"
                  aria-label="Next photo"
                  data-testid="button-next-photo"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
          
          {photos.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto" data-testid="thumbnail-strip">
              {photos.slice(0, 10).map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden 
                              border-2 transition-colors ${
                                index === currentPhotoIndex 
                                  ? 'border-[#EF4923]' 
                                  : 'border-transparent hover:border-muted-foreground/50'
                              }`}
                  data-testid={`thumbnail-${index}`}
                >
                  <img
                    src={photo}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {photos.length > 10 && (
                <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  +{photos.length - 10}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="p-4 overflow-y-auto flex-1" data-testid="property-details">
          <div className="grid grid-cols-2 gap-4">
            <DetailItem 
              label="Price" 
              value={formatCurrency(property.soldPrice || property.price)} 
            />
            <DetailItem 
              label="Price/SqFt" 
              value={`$${pricePerSqft}`} 
            />
            <DetailItem 
              label="Bedrooms" 
              value={property.beds.toString()} 
              icon={<Bed className="w-3 h-3" />}
            />
            <DetailItem 
              label="Bathrooms" 
              value={property.baths.toString()} 
              icon={<Bath className="w-3 h-3" />}
            />
            <DetailItem 
              label="Square Feet" 
              value={property.sqft.toLocaleString()} 
              icon={<Square className="w-3 h-3" />}
            />
            <DetailItem 
              label="Days on Market" 
              value={property.daysOnMarket.toString()} 
              icon={<Clock className="w-3 h-3" />}
            />
            <div data-testid="detail-status">
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={`${property.isSubject ? 'bg-[#EF4923]' : getStatusColor(property.status)} text-white mt-1`}>
                {property.isSubject ? 'Subject' : property.status}
              </Badge>
            </div>
            {property.yearBuilt && (
              <DetailItem 
                label="Year Built" 
                value={property.yearBuilt.toString()} 
                icon={<Calendar className="w-3 h-3" />}
              />
            )}
            {property.soldDate && (
              <DetailItem 
                label="Sold Date" 
                value={new Date(property.soldDate).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                })} 
              />
            )}
            {property.lotSize && (
              <DetailItem 
                label="Lot Size" 
                value={`${property.lotSize.toLocaleString()} sqft`} 
              />
            )}
            {property.acres && (
              <DetailItem 
                label="Acres" 
                value={property.acres.toFixed(2)} 
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
