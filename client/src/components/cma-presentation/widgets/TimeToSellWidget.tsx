import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Info, Home, ChevronLeft, ChevronRight, Bed, Bath, Ruler, Calendar, Car, MapPin, LandPlot } from 'lucide-react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CmaProperty } from '../types';

interface TimeToSellWidgetProps {
  comparables: CmaProperty[];
  averageDaysOnMarket: number;
  averageListPricePercent?: number;
  subjectProperty?: CmaProperty;
}

interface PropertySidebarItemProps {
  property: CmaProperty;
  showPercentOfList?: boolean;
  onClick: () => void;
}

type StatusColor = 'red' | 'green' | 'orange' | 'blue' | 'gray';

function getStatusColor(status: string): StatusColor {
  const s = status?.toLowerCase() || '';
  if (s.includes('closed') || s.includes('sold')) return 'red';
  if (s === 'active') return 'green';
  if (s.includes('pending') || s.includes('under contract') || s.includes('active under')) return 'orange';
  if (s.includes('expired') || s.includes('canceled') || s.includes('withdrawn')) return 'blue';
  return 'green';
}

function getStatusColorHex(statusColor: StatusColor): string {
  switch (statusColor) {
    case 'red': return '#ef4444';
    case 'green': return '#22c55e';
    case 'orange': return '#f97316';
    case 'blue': return '#3b82f6';
    default: return '#6b7280';
  }
}

function getStatusColorClass(statusColor: StatusColor): string {
  switch (statusColor) {
    case 'red': return 'text-red-500';
    case 'green': return 'text-green-500';
    case 'orange': return 'text-orange-500';
    case 'blue': return 'text-blue-500';
    default: return 'text-gray-500';
  }
}

function getStatusBgClass(statusColor: StatusColor): string {
  switch (statusColor) {
    case 'red': return 'bg-red-500';
    case 'green': return 'bg-green-500';
    case 'orange': return 'bg-orange-500';
    case 'blue': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
}

function PropertySidebarItem({ property, showPercentOfList = false, onClick }: PropertySidebarItemProps) {
  const percentOfList = property.soldPrice && property.originalPrice
    ? ((property.soldPrice / property.originalPrice) * 100).toFixed(0)
    : property.soldPrice && property.price
    ? ((property.soldPrice / property.price) * 100).toFixed(0)
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 
                 cursor-pointer mb-1 transition-colors text-left min-h-[60px]"
      data-testid={`button-property-sidebar-item-${property.id}`}
      aria-label={`View details for ${property.address}`}
    >
      <div className="w-16 h-12 rounded-md overflow-hidden flex-shrink-0 bg-muted">
        {property.photos?.[0] ? (
          <img
            src={property.photos[0]}
            alt={property.address}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Home className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {property.address}
        </p>
        <p className="text-xs text-muted-foreground">
          {property.daysOnMarket || 0} Days
          {showPercentOfList && percentOfList && (
            <span className="ml-1">• {percentOfList}%</span>
          )}
        </p>
      </div>
    </button>
  );
}

function TimeToSellInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-4">
          <h2 className="text-xl font-bold">TIME TO SELL SCATTER CHART</h2>
          <p className="text-muted-foreground">
            The time to sell scatter chart is a way to visualize how long the listings took to sell.
            Not only can you see the relationship between the price and days on market, but you can
            also see the difference between the original list price and the sold price. If the listing
            isn't sold, you can see if the price has dropped.
          </p>
          <p className="text-muted-foreground">
            This chart shows that pricing the home correctly from the beginning will help reduce the 
            days on market.
          </p>
          <div className="space-y-2">
            <h4 className="font-semibold">How to read the chart:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><span className="text-red-500 font-medium">Red dots</span> represent closed/sold properties</li>
              <li><span className="text-green-500 font-medium">Green dots</span> represent active listings</li>
              <li><span className="text-orange-500 font-medium">Orange dots</span> represent properties under contract</li>
              <li><span className="text-blue-500 font-medium">Blue dots</span> represent expired/canceled listings</li>
            </ul>
          </div>
          <button
            onClick={() => onClose()}
            className="w-full py-3 bg-[#EF4923] hover:bg-[#d94420] text-white rounded-lg 
                       font-medium transition-colors min-h-[44px]"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ComparisonDiff {
  value: string;
  isPositive: boolean;
}

function calcPercentDiff(propValue: number | undefined, subjectValue: number | undefined): ComparisonDiff | null {
  if (!propValue || !subjectValue || subjectValue === 0) return null;
  const diff = ((propValue - subjectValue) / subjectValue) * 100;
  return {
    value: Math.abs(diff).toFixed(1),
    isPositive: diff >= 0
  };
}

function TimeToSellPropertyModal({ 
  property, 
  subjectProperty,
  onClose 
}: { 
  property: CmaProperty; 
  subjectProperty?: CmaProperty;
  onClose: () => void;
}) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = property.photos || [];
  const statusColor = getStatusColor(property.status);
  const statusColorClass = getStatusColorClass(statusColor);

  const sqftDiff = calcPercentDiff(property.sqft, subjectProperty?.sqft);
  const lotSizeDiff = calcPercentDiff(property.lotSize, subjectProperty?.lotSize);
  const garageDiff = property.garageSpaces !== undefined && subjectProperty?.garageSpaces !== undefined
    ? property.garageSpaces - subjectProperty.garageSpaces
    : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && photos.length > 1) {
        setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
      }
      if (e.key === 'ArrowRight' && photos.length > 1) {
        setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photos.length, onClose]);

  const handlePrevPhoto = () => {
    setCurrentPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const handleNextPhoto = () => {
    setCurrentPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const displayPrice = property.soldPrice || property.listPrice || property.price;
  const currentListPrice = property.listPrice || property.price;
  const soldPercent = property.soldPrice && currentListPrice
    ? Math.round((property.soldPrice / currentListPrice) * 100)
    : null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 z-[80] backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 
                      md:-translate-x-1/2 md:-translate-y-1/2 
                      md:w-full md:max-w-md lg:max-w-lg
                      bg-background rounded-xl shadow-2xl z-[80] 
                      overflow-hidden flex flex-col max-h-[90vh]">
        
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 
                     min-w-[44px] min-h-[44px] 
                     flex items-center justify-center
                     bg-black/50 hover:bg-black/70 
                     text-white rounded-full transition-colors"
          aria-label="Close modal"
          data-testid="button-close-property-modal"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="relative w-full aspect-video bg-muted flex-shrink-0">
          {photos.length > 0 ? (
            <>
              <img 
                src={photos[currentPhotoIndex]} 
                alt={`${property.address} - Photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover"
              />
              
              {photos.length > 1 && (
                <>
                  <button
                    onClick={handlePrevPhoto}
                    className="absolute left-3 top-1/2 -translate-y-1/2 
                               min-w-[44px] min-h-[44px] 
                               flex items-center justify-center
                               bg-black/50 hover:bg-black/70 
                               text-white rounded-full transition-colors"
                    aria-label="Previous photo"
                    data-testid="button-prev-photo"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <button
                    onClick={handleNextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 
                               min-w-[44px] min-h-[44px] 
                               flex items-center justify-center
                               bg-black/50 hover:bg-black/70 
                               text-white rounded-full transition-colors"
                    aria-label="Next photo"
                    data-testid="button-next-photo"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                  
                  <div className="absolute bottom-3 right-3 
                                  px-3 py-1 bg-black/60 text-white text-sm rounded-full">
                    {currentPhotoIndex + 1} / {photos.length}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Home className="w-16 h-16" />
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground uppercase truncate">
                  {property.address}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {property.city}, {property.state} {property.zipCode}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(displayPrice)}
                </p>
                <p className={`text-sm font-medium ${statusColorClass}`}>
                  {property.status}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 border-b">
            <div className="p-3 border-r">
              <p className="text-xs text-muted-foreground">Beds</p>
              <p className="text-lg font-semibold text-foreground">
                {property.beds ?? '-'}
              </p>
            </div>
            <div className="p-3 border-r">
              <p className="text-xs text-muted-foreground">Baths</p>
              <p className="text-lg font-semibold text-foreground">
                {property.baths ?? '-'}
              </p>
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground">
                Sq. Ft.
                {sqftDiff && (
                  <span className={`ml-1 ${sqftDiff.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {sqftDiff.isPositive ? '↑' : '↓'}{sqftDiff.value}%
                  </span>
                )}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {property.sqft?.toLocaleString() ?? '-'}
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 border-b">
            <div className="p-3 border-r">
              <p className="text-xs text-muted-foreground">
                Lot Size
                {lotSizeDiff && (
                  <span className={`ml-1 ${lotSizeDiff.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {lotSizeDiff.isPositive ? '↑' : '↓'}{lotSizeDiff.value}%
                  </span>
                )}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {property.lotSize?.toLocaleString() ?? '-'}
              </p>
            </div>
            <div className="p-3 border-r">
              <p className="text-xs text-muted-foreground">
                Garage
                {garageDiff !== null && garageDiff !== 0 && (
                  <span className={`ml-1 ${garageDiff >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {garageDiff >= 0 ? '↑' : '↓'}{Math.abs(garageDiff)}
                  </span>
                )}
              </p>
              <p className="text-lg font-semibold text-foreground">
                {property.garageSpaces ?? '-'}
              </p>
            </div>
            <div className="p-3">
              <p className="text-xs text-muted-foreground">Year Built</p>
              <p className="text-lg font-semibold text-foreground">
                {property.yearBuilt ?? '-'}
              </p>
            </div>
          </div>
          
          <div className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              Listing Details
            </h3>
            
            <div className="space-y-0">
              {property.originalPrice && property.originalPrice !== currentListPrice && (
                <div className="flex justify-between items-center py-2.5 border-b border-muted">
                  <span className="text-sm text-muted-foreground">Orig. Price</span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(property.originalPrice)}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2.5 border-b border-muted">
                <span className="text-sm text-muted-foreground">List Price</span>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(currentListPrice)}
                </span>
              </div>
              
              {property.soldPrice && (
                <div className="flex justify-between items-center py-2.5 border-b border-muted">
                  <span className="text-sm text-muted-foreground">
                    Sold Price {soldPercent && <span className="text-muted-foreground/60">{soldPercent}%</span>}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(property.soldPrice)}
                  </span>
                </div>
              )}
              
              {property.pricePerSqft > 0 && (
                <div className="flex justify-between items-center py-2.5 border-b border-muted">
                  <span className="text-sm text-muted-foreground">Price per Sq. Ft.</span>
                  <span className="text-sm font-medium text-foreground">
                    ${property.pricePerSqft.toLocaleString()}
                  </span>
                </div>
              )}
              
              {property.soldDate && (
                <div className="flex justify-between items-center py-2.5 border-b border-muted">
                  <span className="text-sm text-muted-foreground">Sold Date</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(property.soldDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {property.listDate && (
                <div className="flex justify-between items-center py-2.5 border-b border-muted">
                  <span className="text-sm text-muted-foreground">List Date</span>
                  <span className="text-sm font-medium text-foreground">
                    {new Date(property.listDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center py-2.5 border-b border-muted">
                <span className="text-sm text-muted-foreground">Days on Market</span>
                <span className="text-sm font-medium text-foreground">
                  {property.daysOnMarket}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2.5">
                <span className="text-sm text-muted-foreground">MLS #</span>
                <span className="text-sm font-medium text-foreground">
                  {property.mlsNumber || property.id}
                </span>
              </div>
            </div>
          </div>
          
          {property.description && (
            <div className="p-4 border-t">
              <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{property.description}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function TimeToSellWidget({
  comparables,
  averageDaysOnMarket,
  averageListPricePercent,
  subjectProperty
}: TimeToSellWidgetProps) {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<CmaProperty | null>(null);

  const closedComps = useMemo(() =>
    comparables.filter(c => {
      const s = c.status?.toLowerCase() || '';
      return s.includes('closed') || s.includes('sold');
    }), [comparables]);

  const underContractComps = useMemo(() =>
    comparables.filter(c => {
      const s = c.status?.toLowerCase() || '';
      return s.includes('under contract') || s.includes('active under') || s.includes('pending');
    }), [comparables]);

  const activeComps = useMemo(() =>
    comparables.filter(c => {
      const s = c.status?.toLowerCase() || '';
      return s === 'active' || (s.includes('active') && !s.includes('under'));
    }), [comparables]);

  const expiredComps = useMemo(() =>
    comparables.filter(c => {
      const s = c.status?.toLowerCase() || '';
      return s.includes('expired') || s.includes('canceled') || s.includes('withdrawn');
    }), [comparables]);

  const calculatedAvgDaysOnMarket = useMemo(() => {
    if (closedComps.length === 0) return averageDaysOnMarket;
    const total = closedComps.reduce((sum, p) => sum + (p.daysOnMarket || 0), 0);
    return Math.round(total / closedComps.length);
  }, [closedComps, averageDaysOnMarket]);

  const calculatedAvgPercentOfList = useMemo(() => {
    if (averageListPricePercent) return averageListPricePercent;
    const validComps = closedComps.filter(p => {
      const soldPrice = p.soldPrice || p.price;
      const originalListPrice = p.originalPrice || p.price;
      return soldPrice && originalListPrice && originalListPrice > 0;
    });
    if (validComps.length === 0) return 100;
    const total = validComps.reduce((sum, p) => {
      const soldPrice = p.soldPrice || p.price || 0;
      const originalListPrice = p.originalPrice || p.price || 1;
      return sum + (soldPrice / originalListPrice) * 100;
    }, 0);
    return total / validComps.length;
  }, [closedComps, averageListPricePercent]);

  const chartData = useMemo(() => {
    return comparables.map(p => {
      const statusColor = getStatusColor(p.status);
      return {
        id: p.id,
        address: p.address,
        daysOnMarket: p.daysOnMarket || 0,
        originalPrice: p.originalPrice || p.price || 0,
        currentPrice: p.soldPrice || p.listPrice || p.price || 0,
        statusColor,
      };
    }).filter(d => d.daysOnMarket >= 0 && d.currentPrice > 0);
  }, [comparables]);

  const formatPrice = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg shadow-lg border">
          <p className="font-medium text-sm truncate max-w-[200px]">{data.address}</p>
          <p className="text-xs text-muted-foreground">{data.daysOnMarket} Days on Market</p>
          <p className="text-xs text-muted-foreground">
            Price: {formatPrice(data.currentPrice)}
          </p>
          {data.originalPrice !== data.currentPrice && (
            <p className="text-xs text-muted-foreground">
              Original: {formatPrice(data.originalPrice)}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full bg-background" data-testid="time-to-sell-widget">
      <TimeToSellInfoModal isOpen={showInfoModal} onClose={() => setShowInfoModal(false)} />
      
      {selectedProperty && (
        <TimeToSellPropertyModal
          property={selectedProperty}
          subjectProperty={subjectProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
            <div className="text-center">
              <span className="text-4xl font-bold text-foreground">{calculatedAvgDaysOnMarket}</span>
              <span className="text-xl text-muted-foreground ml-2">DAYS ON MARKET</span>
            </div>
            <div className="text-3xl text-muted-foreground/50">|</div>
            <div className="text-center">
              <span className="text-4xl font-bold text-[#EF4923]">{calculatedAvgPercentOfList.toFixed(2)}%</span>
              <span className="text-xl text-muted-foreground ml-2">OF LIST PRICE</span>
            </div>
          </div>

          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            Sold homes were on the market for an average of{' '}
            <span className="text-[#EF4923] font-medium">{calculatedAvgDaysOnMarket} days</span>{' '}
            before they accepted an offer. These homes sold for an average of{' '}
            <span className="text-[#EF4923] font-medium">{calculatedAvgPercentOfList.toFixed(2)}%</span>{' '}
            of list price.{' '}
            <button
              onClick={() => setShowInfoModal(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full
                         bg-muted hover:bg-muted/80 text-muted-foreground ml-1"
              aria-label="Learn more about this chart"
              data-testid="button-info-tooltip"
            >
              <Info className="w-3 h-3" />
            </button>
          </p>
        </div>

        <div className="flex flex-col md:flex-row min-h-[400px]">
          <div className="w-full md:w-64 lg:w-72 border-r overflow-auto max-h-[500px] flex-shrink-0">
            {closedComps.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold">
                    {closedComps.length}
                  </span>
                  <span className="font-semibold text-foreground">Closed</span>
                </div>
                {closedComps.map((comp) => (
                  <PropertySidebarItem
                    key={comp.id}
                    property={comp}
                    showPercentOfList={true}
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}

            {underContractComps.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {underContractComps.length}
                  </span>
                  <span className="font-semibold text-foreground">Active Under Contract</span>
                </div>
                {underContractComps.map((comp) => (
                  <PropertySidebarItem
                    key={comp.id}
                    property={comp}
                    showPercentOfList={false}
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}

            {activeComps.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold">
                    {activeComps.length}
                  </span>
                  <span className="font-semibold text-foreground">Active</span>
                </div>
                {activeComps.map((comp) => (
                  <PropertySidebarItem
                    key={comp.id}
                    property={comp}
                    showPercentOfList={false}
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}

            {expiredComps.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                    {expiredComps.length}
                  </span>
                  <span className="font-semibold text-foreground">Expired/Canceled</span>
                </div>
                {expiredComps.map((comp) => (
                  <PropertySidebarItem
                    key={comp.id}
                    property={comp}
                    showPercentOfList={false}
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}

            {closedComps.length === 0 && underContractComps.length === 0 && activeComps.length === 0 && expiredComps.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No comparable properties</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col">
            {chartData.length >= 3 ? (
              <>
                <div className="flex-1 min-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="daysOnMarket"
                        name="Days on Market"
                        type="number"
                        tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                        label={{
                          value: 'Days on market',
                          position: 'bottom',
                          offset: 20,
                          style: { fontSize: 12, fill: 'var(--muted-foreground)' }
                        }}
                      />
                      <YAxis
                        dataKey="currentPrice"
                        name="Price"
                        type="number"
                        tickFormatter={formatPrice}
                        tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                        width={70}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Scatter name="Properties" data={chartData} fill="#8884d8">
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getStatusColorHex(entry.statusColor)} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-muted-foreground">Closed</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500" />
                    <span className="text-sm text-muted-foreground">Under Contract</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-muted-foreground">Active</span>
                  </div>
                  {expiredComps.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm text-muted-foreground">Expired/Canceled</span>
                    </div>
                  )}
                </div>
              </>
            ) : chartData.length > 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium">Insufficient data</p>
                  <p className="text-sm">Minimum 3 properties required for chart</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium">No data available</p>
                  <p className="text-sm">Add comparable properties to see the chart</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
