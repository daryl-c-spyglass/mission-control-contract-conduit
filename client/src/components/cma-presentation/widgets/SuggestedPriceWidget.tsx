import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CmaProperty } from '../types';

interface SuggestedPriceWidgetProps {
  subjectProperty?: CmaProperty;
  comparables: CmaProperty[];
  suggestedPrice?: number;
  onPriceUpdate?: (newPrice: number) => void;
}

export function SuggestedPriceWidget({ 
  subjectProperty, 
  comparables,
  suggestedPrice,
  onPriceUpdate
}: SuggestedPriceWidgetProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'sold' | 'active'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number>(0);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const closedComps = comparables.filter(c => c.status.toLowerCase().includes('closed'));
  const activeComps = comparables.filter(c => c.status.toLowerCase() === 'active');

  const calculateSuggestedPrice = () => {
    if (suggestedPrice) return suggestedPrice;
    
    if (closedComps.length === 0 || !subjectProperty) return 0;
    
    const avgPricePerSqft = closedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / closedComps.length;
    return Math.round(avgPricePerSqft * (subjectProperty.sqft || 0));
  };

  useEffect(() => {
    const price = calculateSuggestedPrice();
    setDisplayPrice(price);
    setEditedPrice(price);
  }, [suggestedPrice, closedComps.length, subjectProperty?.sqft]);

  useEffect(() => {
    fetch('/api/mapbox-token')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.token) setMapToken(data.token);
        else setMapError(data.error || 'Failed to load map token');
      })
      .catch((err) => setMapError(`Failed to load map: ${err.message}`));
  }, []);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!subjectProperty?.latitude || !subjectProperty?.longitude) return;
    if (!mapToken) return;
    
    mapboxgl.accessToken = mapToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [subjectProperty.longitude, subjectProperty.latitude],
      zoom: 14,
    });
    
    new mapboxgl.Marker({ color: '#EF4923' })
      .setLngLat([subjectProperty.longitude, subjectProperty.latitude])
      .addTo(map.current);
    
    map.current.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [subjectProperty?.latitude, subjectProperty?.longitude, mapToken]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatPriceShort = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    }
    return `$${Math.round(price / 1000)}K`;
  };

  const getFilteredComps = () => {
    if (activeFilter === 'sold') return closedComps;
    if (activeFilter === 'active') return activeComps;
    return comparables;
  };

  const filteredComps = getFilteredComps();
  const avgPrice = filteredComps.length > 0 
    ? filteredComps.reduce((sum, c) => sum + (c.soldPrice || c.price), 0) / filteredComps.length 
    : 0;
  const avgPricePerSqft = filteredComps.length > 0
    ? filteredComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / filteredComps.length
    : 0;
  
  const prices = filteredComps.map(c => c.soldPrice || c.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const handleSavePrice = () => {
    setDisplayPrice(editedPrice);
    setIsEditing(false);
    onPriceUpdate?.(editedPrice);
  };

  const handleCancelEdit = () => {
    setEditedPrice(displayPrice);
    setIsEditing(false);
  };

  const hasCoordinates = subjectProperty?.latitude && subjectProperty?.longitude;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden" data-testid="suggested-price-widget">
      <div className="flex-1 flex flex-col p-3 sm:p-4 md:p-6 min-h-0 overflow-auto">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 flex-1 min-h-0">
          
          <div className="flex flex-col justify-center items-center text-center order-1 py-2 sm:py-4">
            {subjectProperty && (
              <div className="mb-3 sm:mb-4 md:mb-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">
                  {subjectProperty.address}
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-muted-foreground">
                  {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zipCode}
                </p>
              </div>
            )}
            
            <div className="bg-[#EF4923]/10 dark:bg-[#EF4923]/20 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-xs sm:max-w-sm">
              {isEditing ? (
                <div className="space-y-3 sm:space-y-4">
                  <div className="relative">
                    <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-xl sm:text-2xl text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={editedPrice}
                      onChange={(e) => setEditedPrice(Number(e.target.value))}
                      className="w-full text-2xl sm:text-3xl md:text-4xl font-bold text-center text-[#EF4923] 
                                 bg-background border-2 border-[#EF4923] rounded-xl 
                                 py-2 sm:py-3 pl-8 sm:pl-10 pr-3 sm:pr-4 focus:outline-none focus:ring-2 focus:ring-[#EF4923]"
                      autoFocus
                      data-testid="price-edit-input"
                    />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleSavePrice}
                      size="sm"
                      className="min-w-[44px] min-h-[44px] bg-green-500 hover:bg-green-600 text-white"
                      data-testid="button-save-price"
                    >
                      <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline ml-1">Save</span>
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="min-w-[44px] min-h-[44px]"
                      data-testid="button-cancel-price"
                    >
                      <X className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="hidden sm:inline ml-1">Cancel</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p 
                    className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#EF4923]"
                    data-testid="suggested-price-display"
                  >
                    {displayPrice > 0 ? formatPrice(displayPrice) : '$---'}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground">Suggested List Price</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="mt-2 text-[#EF4923] hover:text-[#EF4923]/80 hover:bg-[#EF4923]/10"
                    data-testid="button-edit-price"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit Price
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="order-2 flex flex-col min-h-[150px] sm:min-h-[180px] lg:min-h-0 lg:h-full">
            {hasCoordinates && mapToken && !mapError ? (
              <div 
                ref={mapContainer}
                className="flex-1 w-full rounded-lg overflow-hidden bg-muted min-h-[150px] sm:min-h-[180px]"
                data-testid="map-container"
              />
            ) : (
              <div 
                className="flex-1 w-full rounded-lg overflow-hidden bg-muted min-h-[150px] sm:min-h-[180px] flex items-center justify-center text-center text-muted-foreground p-4"
                data-testid="map-placeholder"
              >
                <div>
                  <p className="font-medium text-sm sm:text-base">Subject Property Map</p>
                  <p className="text-xs sm:text-sm">
                    {mapError ? mapError : !hasCoordinates ? 'No coordinates available' : 'Loading map...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-3 sm:mt-4 md:mt-6 space-y-3 sm:space-y-4 flex-shrink-0">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-center">Compare pricing with the comps</h3>
          
          <div className="flex justify-center gap-1 sm:gap-2 flex-wrap">
            {(['all', 'sold', 'active'] as const).map((filter) => (
              <Button
                key={filter}
                variant={activeFilter === filter ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter(filter)}
                className="capitalize min-h-[36px] sm:min-h-[40px] text-xs sm:text-sm px-3 sm:px-4"
                data-testid={`button-filter-${filter}`}
              >
                {filter}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
            <Card className="p-2 sm:p-3 md:p-4 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Average Price</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold" data-testid="stat-avg-price">
                {formatPrice(avgPrice)}
              </p>
            </Card>
            <Card className="p-2 sm:p-3 md:p-4 text-center">
              <p className="text-xs sm:text-sm text-muted-foreground">Avg $/sq. ft.</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold" data-testid="stat-avg-sqft">
                ${avgPricePerSqft.toFixed(0)}
              </p>
            </Card>
            <Card className="p-2 sm:p-3 md:p-4 text-center col-span-2 sm:col-span-1">
              <p className="text-xs sm:text-sm text-muted-foreground">Price Range</p>
              <p className="text-base sm:text-lg md:text-2xl font-bold" data-testid="stat-price-range">
                {minPrice > 0 && maxPrice > 0 
                  ? `${formatPriceShort(minPrice)} - ${formatPriceShort(maxPrice)}`
                  : '$--- - $---'
                }
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
