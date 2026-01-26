import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Info, Home, ChevronLeft, ChevronRight, Bed, Bath, Ruler, Calendar, Car, MapPin } from 'lucide-react';
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
}

interface PropertySidebarItemProps {
  property: CmaProperty;
  showPercentOfList?: boolean;
  onClick: () => void;
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
                 cursor-pointer mb-1 transition-colors text-left"
      data-testid={`button-property-sidebar-item-${property.id}`}
    >
      <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
        {property.photos?.[0] ? (
          <img
            src={property.photos[0]}
            alt={property.address}
            className="w-full h-full object-cover"
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
            <span> • {percentOfList}%</span>
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
          <div className="space-y-2">
            <h4 className="font-semibold">How to read the chart:</h4>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li><span className="text-red-500 font-medium">Red dots</span> represent closed/sold properties</li>
              <li><span className="text-green-500 font-medium">Green dots</span> represent active listings</li>
              <li><span className="text-orange-500 font-medium">Orange dots</span> represent properties under contract</li>
              <li>Vertical lines show price changes from original list to final price</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="text-center p-3 bg-background rounded-lg border">
      <div className="flex justify-center text-muted-foreground mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TimeToSellPropertyModal({ property, onClose }: { property: CmaProperty; onClose: () => void }) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const photos = property.photos || [];

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

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('closed') || s.includes('sold')) return 'text-red-500';
    if (s.includes('active') && !s.includes('under')) return 'text-green-500';
    if (s.includes('under') || s.includes('pending')) return 'text-orange-500';
    return 'text-gray-500';
  };

  const priceDiff = property.originalPrice && property.price && property.originalPrice !== property.price
    ? property.originalPrice - property.price
    : 0;

  const soldPricePercent = property.originalPrice && property.soldPrice
    ? ((property.soldPrice / property.originalPrice) * 100).toFixed(0)
    : null;

  const displayPrice = property.soldPrice || property.price;
  const pricePerSqft = property.sqft && displayPrice ? Math.round(displayPrice / property.sqft) : null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <div className="flex items-center gap-4 p-4 border-b bg-background">
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
            data-testid="button-close-property-modal"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{property.address}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {property.city}, {property.state} {property.zipCode}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="flex flex-col lg:flex-row">
            <div className="flex-1 p-4">
              <div className="relative rounded-lg overflow-hidden bg-muted mb-6">
                <div className="aspect-[16/10]">
                  {photos.length > 0 ? (
                    <img
                      src={photos[currentPhotoIndex]}
                      alt={`${property.address} - Photo ${currentPhotoIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Home className="w-16 h-16" />
                    </div>
                  )}
                </div>

                {photos.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevPhoto}
                      className="absolute left-4 top-1/2 -translate-y-1/2 
                                 min-w-[48px] min-h-[48px] bg-black/50 hover:bg-black/70 
                                 text-white rounded-full flex items-center justify-center shadow-lg
                                 transition-colors"
                      data-testid="button-prev-photo"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                      onClick={handleNextPhoto}
                      className="absolute right-4 top-1/2 -translate-y-1/2 
                                 min-w-[48px] min-h-[48px] bg-black/50 hover:bg-black/70 
                                 text-white rounded-full flex items-center justify-center shadow-lg
                                 transition-colors"
                      data-testid="button-next-photo"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>

                    <div className="absolute bottom-4 left-4 flex gap-2">
                      <span className="px-3 py-1.5 bg-black/60 text-white text-sm rounded-lg flex items-center gap-1">
                        {currentPhotoIndex + 1} / {photos.length}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                <StatBox icon={<Bed className="w-5 h-5" />} label="BEDROOMS" value={property.beds || '—'} />
                <StatBox icon={<Bath className="w-5 h-5" />} label="BATHROOMS" value={property.baths || '—'} />
                <StatBox icon={<Ruler className="w-5 h-5" />} label="HOME SIZE" value={property.sqft ? `${property.sqft.toLocaleString()} sqft` : '—'} />
                <StatBox icon={<Calendar className="w-5 h-5" />} label="YEAR BUILT" value={property.yearBuilt || '—'} />
                <StatBox icon={<Car className="w-5 h-5" />} label="GARAGES" value={property.garageSpaces || '—'} />
              </div>

              {property.description && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{property.description}</p>
                </div>
              )}
            </div>

            <div className="lg:w-80 p-4 lg:border-l bg-muted/30">
              <div className="mb-4">
                <span className={`font-bold ${getStatusColor(property.status)}`}>
                  {property.status?.toUpperCase()}
                </span>
                <span className="text-muted-foreground ml-2">• {property.daysOnMarket || 0} DAYS</span>
              </div>

              <div className="mb-4">
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(displayPrice)}
                </p>
                {pricePerSqft && (
                  <p className="text-muted-foreground">
                    ${pricePerSqft}/sqft
                  </p>
                )}
              </div>

              <p className="text-muted-foreground mb-4">
                {property.beds} beds · {property.baths} baths · {property.sqft?.toLocaleString()} sqft
              </p>

              {(property.listDate || property.soldDate) && (
                <p className="text-sm text-muted-foreground mb-4">
                  {property.listDate && <span>Listed: {formatDate(property.listDate)}</span>}
                  {property.listDate && property.soldDate && <span> · </span>}
                  {property.soldDate && <span>Sold: {formatDate(property.soldDate)}</span>}
                </p>
              )}

              <div className="space-y-3 border-t pt-4">
                {property.originalPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original List Price</span>
                    <span className="font-medium">{formatCurrency(property.originalPrice)}</span>
                  </div>
                )}

                {property.price && property.originalPrice && property.price !== property.originalPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      List Price{' '}
                      {priceDiff > 0 && (
                        <span className="text-red-500">↓{formatCurrency(priceDiff)}</span>
                      )}
                    </span>
                    <span className="font-medium">{formatCurrency(property.price)}</span>
                  </div>
                )}

                {property.soldPrice && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Sold Price{' '}
                      {soldPricePercent && <span className="text-muted-foreground">{soldPricePercent}%</span>}
                    </span>
                    <span className="font-medium">{formatCurrency(property.soldPrice)}</span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  MLS # {property.mlsNumber || property.id}
                </p>
                {property.lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Last Updated {new Date(property.lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TimeToSellWidget({
  comparables,
  averageDaysOnMarket,
  averageListPricePercent
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
      const status = p.status?.toLowerCase() || '';
      let statusCategory = 'active';
      if (status.includes('closed') || status.includes('sold')) statusCategory = 'closed';
      else if (status.includes('under') || status.includes('pending')) statusCategory = 'underContract';

      return {
        id: p.id,
        address: p.address,
        daysOnMarket: p.daysOnMarket || 0,
        originalPrice: p.originalPrice || p.price || 0,
        currentPrice: p.soldPrice || p.price || 0,
        status: statusCategory,
      };
    }).filter(d => d.daysOnMarket >= 0 && d.currentPrice > 0);
  }, [comparables]);

  const formatPrice = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value}`;
  };

  const getChartStatusColor = (status: string) => {
    switch (status) {
      case 'closed': return '#ef4444';
      case 'underContract': return '#f97316';
      case 'active': return '#22c55e';
      default: return '#6b7280';
    }
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
            <span className="text-[#EF4923] font-medium">{calculatedAvgDaysOnMarket}</span>{' '}
            days before they accepted an offer. These homes sold for an average of{' '}
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
          <div className="w-full md:w-56 border-r overflow-auto max-h-[500px] flex-shrink-0">
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

            {closedComps.length === 0 && underContractComps.length === 0 && activeComps.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <p className="text-sm">No comparable properties</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col">
            {chartData.length > 0 ? (
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
                          <Cell key={`cell-${index}`} fill={getChartStatusColor(entry.status)} />
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
                </div>
              </>
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
