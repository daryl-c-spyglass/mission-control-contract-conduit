import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X, Bed, Bath, Square, MapPin, Home } from "lucide-react";

interface PropertyDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    mlsNumber?: string;
    address: string;
    city?: string;
    zip?: string;
    price: number;
    pricePerSqft?: number;
    beds?: number;
    baths?: number;
    sqft?: number;
    propertyType?: string;
    yearBuilt?: number;
    subdivision?: string;
    daysOnMarket?: number;
    closeDate?: string;
    listDate?: string;
    status: string;
    photos: string[];
    percentOfList?: string;
  };
}

export function PropertyDetailModal({ isOpen, onClose, property }: PropertyDetailModalProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  const photos = property.photos?.length > 0 
    ? property.photos 
    : [];

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [property.mlsNumber, property.address]);

  const safePhotoIndex = photos.length > 0 
    ? Math.min(currentPhotoIndex, photos.length - 1) 
    : 0;
  
  const nextPhoto = () => {
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };
  
  const prevPhoto = () => {
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = status?.toLowerCase();
    if (normalized === 'closed' || normalized === 'sold') return 'bg-red-500';
    if (normalized === 'active') return 'bg-green-500';
    if (normalized === 'pending') return 'bg-gray-500';
    if (normalized === 'active under contract' || normalized === 'under contract') return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-2xl p-0 overflow-hidden bg-zinc-900 border-zinc-700 [&>button]:hidden">
        <div className="relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors touch-target-44"
            data-testid="button-close-property-modal"
          >
            <X className="h-5 w-5 text-white" />
          </button>
          
          <Badge className={`absolute top-3 left-3 z-10 ${getStatusColor(property.status)} text-white border-0`}>
            {property.status}
          </Badge>
          
          <div className="relative h-72 bg-zinc-800">
            {photos.length > 0 ? (
              <img
                src={photos[safePhotoIndex]}
                alt={`Property photo ${safePhotoIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Home className="w-16 h-16 text-zinc-600" />
              </div>
            )}
            
            {photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors touch-target-44"
                  data-testid="button-prev-photo"
                >
                  <ChevronLeft className="h-5 w-5 text-white" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-2 transition-colors touch-target-44"
                  data-testid="button-next-photo"
                >
                  <ChevronRight className="h-5 w-5 text-white" />
                </button>
                
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 px-3 py-1 rounded-full text-white text-sm">
                  {safePhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <div className="text-3xl font-bold text-orange-500">
              {formatPrice(property.price)}
            </div>
            {property.pricePerSqft && (
              <div className="text-zinc-400 text-sm">
                ${property.pricePerSqft.toFixed(0)}/sqft
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-2 mb-6">
            <MapPin className="h-5 w-5 text-zinc-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-white font-medium">{property.address}</div>
              {(property.city || property.zip) && (
                <div className="text-zinc-400 text-sm">
                  {property.city}{property.city && property.zip ? ', ' : ''}{property.zip}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-around py-4 border-y border-zinc-700 mb-6">
            <div className="text-center">
              <Bed className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
              <div className="text-xl font-semibold text-white">{property.beds ?? '—'}</div>
              <div className="text-xs text-zinc-400">Beds</div>
            </div>
            <div className="text-center">
              <Bath className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
              <div className="text-xl font-semibold text-white">{property.baths ?? '—'}</div>
              <div className="text-xs text-zinc-400">Baths</div>
            </div>
            <div className="text-center">
              <Square className="h-5 w-5 text-zinc-400 mx-auto mb-1" />
              <div className="text-xl font-semibold text-white">{property.sqft?.toLocaleString() ?? '—'}</div>
              <div className="text-xs text-zinc-400">Sq Ft</div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Property Type</span>
              <span className="text-white">{property.propertyType || '—'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Year Built</span>
              <span className="text-white">{property.yearBuilt || '—'}</span>
            </div>
            {property.subdivision && (
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Subdivision</span>
                <span className="text-white">{property.subdivision}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Days on Market</span>
              <span className="text-white">{property.daysOnMarket ?? '—'}</span>
            </div>
            {property.percentOfList && property.percentOfList !== 'N/A' && (
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">% of List Price</span>
                <span className="text-white">{property.percentOfList}%</span>
              </div>
            )}
            {property.status?.toLowerCase() === 'closed' && property.closeDate && (
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Close Date</span>
                <span className="text-white">{formatDate(property.closeDate)}</span>
              </div>
            )}
            {property.status?.toLowerCase() === 'active' && property.listDate && (
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">List Date</span>
                <span className="text-white">{formatDate(property.listDate)}</span>
              </div>
            )}
            {property.mlsNumber && (
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">MLS #</span>
                <span className="text-white font-mono text-sm">{property.mlsNumber}</span>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
