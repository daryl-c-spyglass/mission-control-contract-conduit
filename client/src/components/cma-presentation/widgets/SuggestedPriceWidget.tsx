import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

function PriceTooltip({ 
  suggestedPrice, 
  avgCompPrice, 
  sqft, 
  beds, 
  baths, 
  avgDom, 
  listToSaleRatio,
  onClose
}: { 
  suggestedPrice: number;
  avgCompPrice: number;
  sqft: number;
  beds: number;
  baths: number;
  avgDom: number;
  listToSaleRatio: number;
  onClose: () => void;
}) {
  const adjustmentFactor = avgCompPrice > 0 ? (suggestedPrice / avgCompPrice).toFixed(3) : '1.000';
  
  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div className="absolute z-[100] top-full left-1/2 -translate-x-1/2 mt-2 
                      w-80 sm:w-96 bg-card rounded-xl shadow-2xl 
                      border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-muted border-b border-border">
          <h4 className="font-semibold text-foreground flex items-center gap-2">
            <Info className="w-4 h-4 text-[#EF4923]" />
            How is this price calculated?
          </h4>
          <Button 
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-close-tooltip"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="p-4 space-y-3 text-sm max-h-[50vh] overflow-y-auto">
          <div>
            <h5 className="font-medium text-foreground flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[#EF4923]" /> Comparable Sales Analysis
            </h5>
            <ul className="text-muted-foreground space-y-0.5 ml-6 text-xs">
              <li>• Average sold price of similar properties</li>
              <li>• Adjusted for size, age, and features</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-foreground flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 text-[#EF4923]" /> Location Factors
            </h5>
            <ul className="text-muted-foreground space-y-0.5 ml-6 text-xs">
              <li>• Neighborhood market trends</li>
              <li>• Recent sales within search radius</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-foreground flex items-center gap-2 mb-1">
              <Home className="w-4 h-4 text-[#EF4923]" /> Property Characteristics
            </h5>
            <ul className="text-muted-foreground space-y-0.5 ml-6 text-xs">
              <li>• Square footage: {sqft.toLocaleString()} sq ft</li>
              <li>• Beds/Baths: {beds} bed / {baths} bath</li>
            </ul>
          </div>
          
          <div>
            <h5 className="font-medium text-foreground flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-[#EF4923]" /> Market Conditions
            </h5>
            <ul className="text-muted-foreground space-y-0.5 ml-6 text-xs">
              <li>• Average days on market: {avgDom} days</li>
              <li>• List-to-sale price ratio: {(listToSaleRatio * 100).toFixed(0)}%</li>
            </ul>
          </div>
          
          <div className="pt-2 border-t border-border">
            <h5 className="font-medium text-foreground mb-1 text-xs">Calculation</h5>
            <div className="bg-muted rounded-lg p-2 font-mono text-xs">
              <div className="text-muted-foreground">Avg Comp Price × Adjustment</div>
              <div className="text-foreground font-semibold">
                ${avgCompPrice.toLocaleString()} × {adjustmentFactor} = ${suggestedPrice.toLocaleString()}
              </div>
            </div>
          </div>
          
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-[#EF4923]/10 rounded-lg p-2">
            <Lightbulb className="w-4 h-4 flex-shrink-0 text-[#EF4923]" />
            <span>This is a suggested starting point. Click "Edit Price" to adjust.</span>
          </div>
        </div>
      </div>
    </>
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
    const avgPricePerSqft = closedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / closedComps.length;
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
  const avgPrice = filteredComps.length > 0 
    ? filteredComps.reduce((sum, c) => sum + (c.soldPrice || c.price), 0) / filteredComps.length 
    : 0;
  const avgPricePerSqft = filteredComps.length > 0
    ? filteredComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / filteredComps.length
    : 0;
  
  const prices = filteredComps.map(c => c.soldPrice || c.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  
  const soldComps = closedComps.filter(c => c.soldPrice);
  const listToSaleRatio = soldComps.length > 0
    ? soldComps.reduce((sum, c) => sum + ((c.soldPrice || 0) / (c.listPrice || c.price)), 0) / soldComps.length
    : 0.97;
  
  const avgDom = filteredComps.length > 0
    ? Math.round(filteredComps.reduce((sum, c) => sum + c.daysOnMarket, 0) / filteredComps.length)
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
                  <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white 
                                  px-2 py-1 rounded-full flex items-center gap-1.5 text-[10px] sm:text-xs">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="hidden sm:inline">AI Selected</span>
                    <span className="bg-green-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
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
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowTooltip(!showTooltip)}
                        className="text-muted-foreground"
                        aria-label="How is this price calculated?"
                        data-testid="button-price-info"
                      >
                        <Info className="w-4 h-4" />
                      </Button>
                      
                      {showTooltip && (
                        <PriceTooltip
                          suggestedPrice={displayPrice}
                          avgCompPrice={avgPrice}
                          sqft={subjectProperty?.sqft || 0}
                          beds={subjectProperty?.beds || 0}
                          baths={subjectProperty?.baths || 0}
                          avgDom={avgDom}
                          listToSaleRatio={listToSaleRatio}
                          onClose={() => setShowTooltip(false)}
                        />
                      )}
                    </div>
                    
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
              <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white 
                              px-2 py-1 rounded text-[10px] font-mono">
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
