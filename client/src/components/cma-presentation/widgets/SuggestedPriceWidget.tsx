import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, Info, Star, Camera, MapPin, BarChart3, Home, TrendingUp, Lightbulb, Undo2 } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { CmaProperty } from '../types';

interface ImageInsight {
  url: string;
  classification?: { imageOf?: string; prediction?: number };
  quality?: { quantitative?: number; qualitative?: string };
}

interface SuggestedPriceWidgetProps {
  subjectProperty?: CmaProperty;
  comparables: CmaProperty[];
  suggestedPrice?: number;
  onPriceUpdate?: (newPrice: number) => void;
  imageInsights?: ImageInsight[];
  mlsNumber?: string;
}

function PriceTooltipContent({ 
  suggestedPrice, 
  avgCompPrice, 
  sqft, 
  beds, 
  baths, 
  avgDom, 
  listToSaleRatio,
}: { 
  suggestedPrice: number;
  avgCompPrice: number;
  sqft: number;
  beds: number;
  baths: number;
  avgDom: number;
  listToSaleRatio: number;
}) {
  const adjustmentFactor = avgCompPrice > 0 ? (suggestedPrice / avgCompPrice).toFixed(3) : '1.000';
  
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground border-b border-border pb-2">
        <Info className="w-3.5 h-3.5 text-[#EF4923]" />
        How is this price calculated?
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div>
          <h5 className="font-medium text-foreground flex items-center gap-1 mb-0.5 text-xs">
            <BarChart3 className="w-3 h-3 text-[#EF4923]" /> Sales Analysis
          </h5>
          <ul className="text-muted-foreground space-y-0 ml-4" style={{ fontSize: '10px' }}>
            <li>• Avg sold price of comps</li>
            <li>• Size/age adjustments</li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-medium text-foreground flex items-center gap-1 mb-0.5 text-xs">
            <MapPin className="w-3 h-3 text-[#EF4923]" /> Location
          </h5>
          <ul className="text-muted-foreground space-y-0 ml-4" style={{ fontSize: '10px' }}>
            <li>• Market trends</li>
            <li>• Recent area sales</li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-medium text-foreground flex items-center gap-1 mb-0.5 text-xs">
            <Home className="w-3 h-3 text-[#EF4923]" /> Property
          </h5>
          <ul className="text-muted-foreground space-y-0 ml-4" style={{ fontSize: '10px' }}>
            <li>• {sqft.toLocaleString()} sq ft</li>
            <li>• {beds} bed / {baths} bath</li>
          </ul>
        </div>
        
        <div>
          <h5 className="font-medium text-foreground flex items-center gap-1 mb-0.5 text-xs">
            <TrendingUp className="w-3 h-3 text-[#EF4923]" /> Market
          </h5>
          <ul className="text-muted-foreground space-y-0 ml-4" style={{ fontSize: '10px' }}>
            <li>• {avgDom} days avg DOM</li>
            <li>• {(listToSaleRatio * 100).toFixed(0)}% list-to-sale</li>
          </ul>
        </div>
      </div>
      
      <div className="pt-1.5 border-t border-border">
        <div className="bg-muted rounded p-1.5 font-mono" style={{ fontSize: '10px' }}>
          <div className="text-muted-foreground">Avg Comp × Adjustment</div>
          <div className="text-foreground font-semibold">
            ${avgCompPrice.toLocaleString()} × {adjustmentFactor} = ${suggestedPrice.toLocaleString()}
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-1.5 text-muted-foreground bg-[#EF4923]/10 rounded p-1.5" style={{ fontSize: '10px' }}>
        <Lightbulb className="w-3 h-3 flex-shrink-0 text-[#EF4923] mt-0.5" />
        <span>Suggested starting point. Click "Edit" to adjust.</span>
      </div>
    </div>
  );
}

export function SuggestedPriceWidget({ 
  subjectProperty, 
  comparables,
  suggestedPrice,
  onPriceUpdate,
  imageInsights,
  mlsNumber
}: SuggestedPriceWidgetProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'sold' | 'active'>('all');
  const [isEditing, setIsEditing] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<number>(0);
  const [editedPrice, setEditedPrice] = useState<number>(0);
  const [originalPrice, setOriginalPrice] = useState<number>(0);
  const [hasBeenEdited, setHasBeenEdited] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [fetchedInsights, setFetchedInsights] = useState<ImageInsight[]>([]);
  
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const originalPriceInitialized = useRef(false);

  const closedComps = comparables.filter(c => c.status.toLowerCase().includes('closed'));
  const activeComps = comparables.filter(c => c.status.toLowerCase() === 'active');

  const calculateSuggestedPrice = () => {
    if (suggestedPrice) return suggestedPrice;
    if (closedComps.length === 0 || !subjectProperty) return 0;
    
    // Filter to only closed comps with valid pricePerSqft
    const validPricePerSqfts = closedComps
      .map(c => {
        if (c.pricePerSqft && !isNaN(c.pricePerSqft) && c.pricePerSqft > 0) return c.pricePerSqft;
        // Calculate from price and sqft if pricePerSqft is invalid
        const price = c.soldPrice ?? c.price ?? c.listPrice;
        const sqft = c.sqft || (c as any).livingArea;
        if (price && sqft && sqft > 0 && !isNaN(price) && !isNaN(sqft)) return price / sqft;
        return null;
      })
      .filter((p): p is number => p !== null && p > 0);
    
    if (validPricePerSqfts.length === 0) return 0;
    const avgPricePerSqft = validPricePerSqfts.reduce((sum, p) => sum + p, 0) / validPricePerSqfts.length;
    return Math.round(avgPricePerSqft * (subjectProperty.sqft || 0));
  };

  useEffect(() => {
    const price = calculateSuggestedPrice();
    
    if (!originalPriceInitialized.current) {
      setOriginalPrice(price);
      originalPriceInitialized.current = true;
    }
    
    if (!hasBeenEdited) {
      setDisplayPrice(price);
      setEditedPrice(price);
    }
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
    if (imageInsights && imageInsights.length > 0) {
      setFetchedInsights(imageInsights);
      return;
    }
    
    const listingId = mlsNumber || subjectProperty?.mlsNumber;
    if (!listingId) return;
    
    fetch(`/api/repliers/listing/${listingId}/image-insights`)
      .then(res => res.json())
      .then(data => {
        if (data.available && data.images) {
          setFetchedInsights(data.images);
        }
      })
      .catch(() => {});
  }, [mlsNumber, subjectProperty?.mlsNumber, imageInsights]);

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
  
  // Safe helper to get a valid price from a comparable
  const getValidPrice = (c: CmaProperty): number | null => {
    const price = c.soldPrice ?? c.price ?? c.listPrice ?? null;
    if (price === null || price === undefined || isNaN(price) || price <= 0) return null;
    return price;
  };
  
  // Safe helper to get valid price per sqft
  const getValidPricePerSqft = (c: CmaProperty): number | null => {
    if (c.pricePerSqft && !isNaN(c.pricePerSqft) && c.pricePerSqft > 0) return c.pricePerSqft;
    const price = getValidPrice(c);
    const sqft = c.sqft || (c as any).livingArea;
    if (price && sqft && sqft > 0) return price / sqft;
    return null;
  };
  
  // Calculate avgPrice from valid prices only
  const validPrices = filteredComps.map(getValidPrice).filter((p): p is number => p !== null);
  const avgPrice = validPrices.length > 0 
    ? validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length 
    : 0;
  
  // Calculate avgPricePerSqft from valid values only
  const validPricePerSqft = filteredComps.map(getValidPricePerSqft).filter((p): p is number => p !== null);
  const avgPricePerSqft = validPricePerSqft.length > 0
    ? validPricePerSqft.reduce((sum, p) => sum + p, 0) / validPricePerSqft.length
    : 0;
  
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : 0;
  
  const soldComps = closedComps.filter(c => c.soldPrice && c.soldPrice > 0);
  // Calculate listToSaleRatio only from comps with valid both soldPrice AND listPrice
  const validListToSaleRatios = soldComps
    .map(c => {
      const listPrice = c.listPrice || c.price;
      if (listPrice && listPrice > 0 && !isNaN(listPrice) && c.soldPrice && !isNaN(c.soldPrice)) {
        return c.soldPrice / listPrice;
      }
      return null;
    })
    .filter((r): r is number => r !== null);
  const listToSaleRatio = validListToSaleRatios.length > 0
    ? validListToSaleRatios.reduce((sum, r) => sum + r, 0) / validListToSaleRatios.length
    : 0.97;
  
  // Calculate avgDom from valid values
  const validDom = filteredComps.map(c => c.daysOnMarket).filter(d => d !== undefined && d !== null && !isNaN(d) && d >= 0);
  const avgDom = validDom.length > 0
    ? Math.round(validDom.reduce((sum, d) => sum + d, 0) / validDom.length)
    : 0;

  const handleSavePrice = () => {
    setDisplayPrice(editedPrice);
    setIsEditing(false);
    setHasBeenEdited(true);
    onPriceUpdate?.(editedPrice);
  };

  const handleCancelEdit = () => {
    setEditedPrice(displayPrice);
    setIsEditing(false);
  };

  const handleUndo = () => {
    setDisplayPrice(originalPrice);
    setEditedPrice(originalPrice);
    setHasBeenEdited(false);
    onPriceUpdate?.(originalPrice);
  };

  const hasCoordinates = subjectProperty?.latitude && subjectProperty?.longitude;

  const aiPhotos: ImageInsight[] = fetchedInsights.length > 0
    ? fetchedInsights
        .filter(img => (img.quality?.quantitative || 0) > 0)
        .sort((a, b) => (b.quality?.quantitative || 0) - (a.quality?.quantitative || 0))
        .slice(0, 3)
    : [];
  
  const fallbackPhotos: ImageInsight[] = (subjectProperty?.photos || []).slice(0, 3).map(url => ({ url }));
  
  const photosToShow: ImageInsight[] = aiPhotos.length > 0 ? aiPhotos : fallbackPhotos;
  const currentPhoto: ImageInsight | undefined = photosToShow[currentPhotoIndex];

  const formatImageLabel = (imageOf?: string) => {
    if (!imageOf) return 'Photo';
    return imageOf.split(/[_\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden" data-testid="suggested-price-widget">
      <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 lg:p-4">
        
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          
          <div className="relative rounded-xl overflow-hidden shadow-lg bg-muted min-h-[120px] md:min-h-0">
            {photosToShow.length > 0 && currentPhoto ? (
              <>
                <img
                  src={currentPhoto.url}
                  alt="Property"
                  className="w-full h-full object-cover"
                  data-testid="property-photo"
                />
                
                {currentPhoto.quality?.quantitative && currentPhoto.quality.quantitative > 0 && (
                  <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-sm text-white 
                                  px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-medium shadow-lg"
                       data-testid="ai-best-photo-badge">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span>AI Best Photo</span>
                    <span className="bg-green-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {Math.round(currentPhoto.quality.quantitative * 20)}%
                    </span>
                  </div>
                )}
                
                {currentPhoto.classification?.imageOf && (
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white 
                                  px-2 py-1 rounded text-[10px] sm:text-xs">
                    {formatImageLabel(currentPhoto.classification.imageOf)}
                  </div>
                )}
                
                {photosToShow.length > 1 && (
                  <div className="absolute bottom-2 right-2 flex gap-1">
                    {photosToShow.map((photo, idx) => (
                      <div
                        key={idx}
                        className={`rounded-md ${currentPhotoIndex === idx ? 'ring-2 ring-[#EF4923]' : ''}`}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCurrentPhotoIndex(idx)}
                          data-testid={`photo-thumbnail-${idx}`}
                        >
                          <img src={photo.url} alt="" className="w-full h-full object-cover" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <Camera className="w-10 h-10" />
              </div>
            )}
          </div>
          
          <div className="flex flex-col justify-center items-center text-center py-1 sm:py-2">
            {subjectProperty && (
              <div className="mb-2 sm:mb-3">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-foreground leading-tight">
                  {subjectProperty.address}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zipCode}
                </p>
              </div>
            )}
            
            <div className="bg-[#EF4923]/10 dark:bg-[#EF4923]/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 w-full max-w-[280px]">
              {isEditing ? (
                <div className="space-y-2 sm:space-y-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg sm:text-xl text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={editedPrice}
                      onChange={(e) => setEditedPrice(Number(e.target.value))}
                      className="w-full text-xl sm:text-2xl lg:text-3xl font-bold text-center text-[#EF4923] 
                                 bg-background border-2 border-[#EF4923] rounded-xl 
                                 py-2 pl-7 pr-3 focus:outline-none focus:ring-2 focus:ring-[#EF4923]"
                      autoFocus
                      data-testid="price-edit-input"
                    />
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={handleSavePrice}
                      size="sm"
                      className="min-w-[44px] min-h-[40px] bg-green-500 text-white"
                      data-testid="button-save-price"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Save</span>
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="min-w-[44px] min-h-[40px]"
                      data-testid="button-cancel-price"
                    >
                      <X className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Cancel</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p 
                    className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#EF4923]"
                    data-testid="suggested-price-display"
                  >
                    {displayPrice > 0 ? formatPrice(displayPrice) : '$---'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Suggested List Price</p>
                  
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Popover open={showTooltip} onOpenChange={setShowTooltip}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground"
                          aria-label="How is this price calculated?"
                          data-testid="button-price-info"
                        >
                          <Info className="w-4 h-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-80 p-3" 
                        side="top"
                        sideOffset={5}
                        collisionPadding={16}
                        avoidCollisions={true}
                      >
                        <PriceTooltipContent
                          suggestedPrice={displayPrice}
                          avgCompPrice={avgPrice}
                          sqft={subjectProperty?.sqft || 0}
                          beds={subjectProperty?.beds || 0}
                          baths={subjectProperty?.baths || 0}
                          avgDom={avgDom}
                          listToSaleRatio={listToSaleRatio}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="text-[#EF4923] min-h-[36px] text-xs"
                      data-testid="button-edit-price"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    
                    {hasBeenEdited && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUndo}
                        className="text-muted-foreground min-h-[36px] text-xs"
                        title={`Restore original: ${formatPrice(originalPrice)}`}
                        data-testid="button-undo-price"
                      >
                        <Undo2 className="w-3 h-3 mr-1" />
                        Undo
                      </Button>
                    )}
                  </div>
                  
                  {hasBeenEdited && (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Original: {formatPrice(originalPrice)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="relative rounded-xl overflow-hidden shadow-lg bg-muted min-h-[120px] md:min-h-0">
            {hasCoordinates && mapToken && !mapError ? (
              <div 
                ref={mapContainer}
                className="w-full h-full min-h-[120px]"
                data-testid="map-container"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-3">
                <MapPin className="w-8 h-8 mb-2" />
                <p className="font-medium text-sm">Subject Property Map</p>
                <p className="text-xs">
                  {mapError ? 'Map unavailable' : !hasCoordinates ? 'No coordinates' : 'Loading...'}
                </p>
              </div>
            )}
            
            {hasCoordinates && (
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white 
                              px-2 py-1 rounded text-[10px] font-mono z-10">
                {subjectProperty?.latitude?.toFixed(4)}°N, {Math.abs(subjectProperty?.longitude || 0).toFixed(4)}°W
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-2 sm:mt-3 space-y-2 flex-shrink-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-bold">Compare pricing with the comps</h3>
            
            <div className="flex gap-1">
              {(['all', 'sold', 'active'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className="capitalize min-h-[32px] text-[10px] sm:text-xs px-2 sm:px-3"
                  data-testid={`button-filter-${filter}`}
                >
                  {filter}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1 sm:gap-2">
            <Card className="p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-xs text-muted-foreground">Avg Price</p>
              <p className="text-xs sm:text-sm lg:text-base font-bold" data-testid="stat-avg-price">
                {formatPriceShort(avgPrice)}
              </p>
            </Card>
            <Card className="p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-xs text-muted-foreground">Avg $/sqft</p>
              <p className="text-xs sm:text-sm lg:text-base font-bold" data-testid="stat-avg-sqft">
                ${avgPricePerSqft.toFixed(0)}
              </p>
            </Card>
            <Card className="p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-xs text-muted-foreground">Price Range</p>
              <p className="text-xs sm:text-sm lg:text-base font-bold" data-testid="stat-price-range">
                {minPrice > 0 && maxPrice > 0 
                  ? `${formatPriceShort(minPrice)}-${formatPriceShort(maxPrice)}`
                  : '$---'
                }
              </p>
            </Card>
            <Card className="p-1.5 sm:p-2 text-center">
              <p className="text-[9px] sm:text-xs text-muted-foreground"># Comps</p>
              <p className="text-xs sm:text-sm lg:text-base font-bold" data-testid="stat-comps-count">
                {filteredComps.length}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
