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

const getStatusColor = (status: string, isSubject?: boolean) => {
  if (isSubject) return 'bg-blue-500';  // BLUE for Subject
  const s = status?.toLowerCase() || '';
  if (s.includes('closed') || s.includes('sold')) return 'bg-red-500';  // RED for Closed/Sold
  if (s.includes('active under') || s.includes('under contract')) return 'bg-orange-500';  // ORANGE for Under Contract
  if (s.includes('active')) return 'bg-green-500';  // GREEN for Active
  if (s.includes('pending')) return 'bg-gray-500';  // GRAY for Pending
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
        
        <div className="flex-1 overflow-y-auto">
          <div className="relative w-full aspect-video bg-muted">
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                      aria-label="Previous photo"
                      data-testid="button-prev-photo"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNextPhoto}
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full"
                      aria-label="Next photo"
                      data-testid="button-next-photo"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                    <div 
                      className="absolute bottom-2 right-2 bg-black/50 text-white text-sm px-2 py-1 rounded"
                      data-testid="photo-counter"
                    >
                      {currentPhotoIndex + 1} / {photos.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                No photos available
              </div>
            )}
          </div>
          
          <div className="p-4 border-t">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-3xl font-bold" data-testid="modal-price">
                  {formatCurrency(property.soldPrice || property.price)}
                </p>
                <p className="text-sm text-muted-foreground" data-testid="modal-price-per-sqft">
                  ${pricePerSqft}/sqft
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold" data-testid="modal-beds-baths">
                  {property.beds} beds • {property.baths} baths
                </p>
                <p className="text-muted-foreground" data-testid="modal-sqft">
                  {property.sqft.toLocaleString()} sqft
                </p>
              </div>
            </div>
            
            {property.listPrice && property.listPrice !== property.soldPrice && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg" data-testid="price-history">
                <p className="text-sm font-medium mb-2">Price History</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  {property.originalPrice && property.originalPrice !== property.listPrice && (
                    <div>
                      <span className="text-muted-foreground">Original: </span>
                      <span className="line-through">{formatCurrency(property.originalPrice)}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">List: </span>
                    <span>{formatCurrency(property.listPrice)}</span>
                  </div>
                  {property.soldPrice && (
                    <div>
                      <span className="text-muted-foreground">Sold: </span>
                      <span className="text-green-600 font-medium">{formatCurrency(property.soldPrice)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t">
            <h3 className="text-sm font-medium mb-3 text-muted-foreground">Property Details</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
              <Badge className={`${getStatusColor(property.status, property.isSubject)} text-white mt-1`}>
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
      </div>
    </>
  );
}
