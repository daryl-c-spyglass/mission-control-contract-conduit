import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Map as MapIcon, TrendingUp, List, LayoutGrid, Table2, Bed, Bath, Square, Clock, MapPin } from 'lucide-react';
import { CMAMap } from '@/components/cma-map';
import { PropertyDetailModal } from './PropertyDetailModal';
import { extractPrice, extractSqft, extractDOM, calculatePricePerSqft, getCityState } from '@/lib/cma-data-utils';
import type { CmaProperty } from '../types';
import type { Property } from '@shared/schema';

interface CompsWidgetProps {
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
}

interface CmaStatMetric {
  range: { min: number; max: number };
  average: number;
  median: number;
}

interface PropertyStatistics {
  price: CmaStatMetric;
  pricePerSqFt: CmaStatMetric;
  daysOnMarket: CmaStatMetric;
}

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'closed', label: 'Closed' },
  { id: 'activeUnderContract', label: 'Active Under Contract' },
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
] as const;

// Safe helper to get display price using utility functions
function getDisplayPrice(property: CmaProperty): number {
  // Use the robust extractPrice utility that checks multiple field names
  const price = extractPrice(property);
  return price ?? 0;
}

// Safe helper to calculate price per sqft avoiding NaN
// Returns formatted string without trailing "/sqft" - caller adds it
function getSafePricePerSqft(property: CmaProperty): string {
  // First check if pricePerSqft is valid
  if (property.pricePerSqft && !isNaN(property.pricePerSqft) && property.pricePerSqft > 0) {
    return `$${Math.round(property.pricePerSqft)}`;
  }
  // Use the robust utility that checks multiple field names
  const pricePerSqft = calculatePricePerSqft(property);
  if (pricePerSqft && pricePerSqft > 0) {
    return `$${Math.round(pricePerSqft)}`;
  }
  return '--';
}

function calculateStatistics(comparables: CmaProperty[]): PropertyStatistics | null {
  if (!comparables || comparables.length === 0) return null;
  
  const calculateMetric = (values: number[]): CmaStatMetric => {
    const filtered = values.filter(v => v != null && !isNaN(v) && v > 0);
    if (filtered.length === 0) {
      return { range: { min: 0, max: 0 }, average: 0, median: 0 };
    }
    const sorted = [...filtered].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    
    return {
      range: { min: sorted[0], max: sorted[sorted.length - 1] },
      average: sum / sorted.length,
      median
    };
  };
  
  // Filter for valid price/sqft values before calculation - use extractPrice for robust field matching
  const pricePerSqFts = comparables
    .map(c => {
      const sqft = extractSqft(c);
      const price = extractPrice(c);
      if (price && sqft && sqft > 0) return price / sqft;
      return NaN;
    })
    .filter(v => !isNaN(v));
  
  // Filter for valid prices and DOM values - use extractPrice for robust field matching
  const validPrices = comparables
    .map(c => extractPrice(c))
    .filter((p): p is number => p !== null && p > 0);
  const validDom = comparables
    .map(c => extractDOM(c) ?? c.daysOnMarket)
    .filter((d): d is number => d !== undefined && d !== null && !isNaN(d) && d >= 0);
  
  return {
    price: calculateMetric(validPrices),
    pricePerSqFt: calculateMetric(pricePerSqFts),
    daysOnMarket: calculateMetric(validDom),
  };
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

// Contract Conduit Standard: Closed=RED, Active=GREEN, Under Contract=ORANGE, Pending=GRAY
const getStatusColor = (status: string) => {
  const s = status?.toLowerCase() || '';
  if (s.includes('closed') || s.includes('sold')) return 'bg-red-500';  // RED for Closed/Sold
  if (s.includes('active under') || s.includes('under contract')) return 'bg-orange-500';  // ORANGE for Under Contract
  if (s.includes('active')) return 'bg-green-500';  // GREEN for Active
  if (s.includes('pending')) return 'bg-gray-500';  // GRAY for Pending
  return 'bg-gray-500';
};

const normalizeStatus = (status: string): string => {
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('sold')) return 'closed';
  if (s.includes('active under') || s.includes('under contract')) return 'activeUnderContract';
  if (s.includes('pending')) return 'pending';
  if (s.includes('active')) return 'active';
  return 'unknown';
};

function convertToProperty(cmaProperty: CmaProperty): Property {
  return {
    mlsNumber: cmaProperty.id,
    address: cmaProperty.address,
    city: cmaProperty.city,
    state: cmaProperty.state,
    postalCode: cmaProperty.zipCode,
    price: cmaProperty.price,
    soldPrice: cmaProperty.soldPrice,
    listPrice: cmaProperty.originalPrice || cmaProperty.price,
    bedrooms: cmaProperty.beds,
    bathrooms: cmaProperty.baths,
    sqft: cmaProperty.sqft,
    livingArea: cmaProperty.sqft,
    lotSize: cmaProperty.lotSize,
    yearBuilt: cmaProperty.yearBuilt,
    status: cmaProperty.status,
    standardStatus: cmaProperty.status,
    daysOnMarket: cmaProperty.daysOnMarket,
    photos: cmaProperty.photos,
    latitude: cmaProperty.latitude,
    longitude: cmaProperty.longitude,
  } as Property;
}

function StatItem({ 
  label, 
  value, 
  subtext, 
  subtextColor = 'text-muted-foreground' 
}: { 
  label: string; 
  value: string; 
  subtext?: string;
  subtextColor?: string;
}) {
  const testId = `stat-${label.toLowerCase().replace(/[\s/]+/g, '-')}`;
  return (
    <div className="text-center" data-testid={testId}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider" data-testid={`${testId}-label`}>
        {label}
      </p>
      <p className="text-lg font-bold" data-testid={`${testId}-value`}>{value}</p>
      {subtext && (
        <p className={`text-xs ${subtextColor}`}>{subtext}</p>
      )}
    </div>
  );
}

function PropertyCard({ property, isSubject = false, onClick }: { property: CmaProperty; isSubject?: boolean; onClick?: () => void }) {
  return (
    <Card 
      className={`overflow-hidden cursor-pointer hover:shadow-lg transition-shadow ${isSubject ? 'border-[#EF4923] border-2' : ''}`}
      data-testid={`property-card-${property.id}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="relative aspect-[4/3]">
        {property.photos?.[0] ? (
          <img 
            src={property.photos[0]} 
            alt={property.address}
            className="w-full h-full object-cover"
            data-testid={`property-image-${property.id}`}
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
            No Photo
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2 flex-wrap">
          <span 
            className={`px-2 py-1 text-xs font-medium text-white rounded ${isSubject ? 'bg-[#EF4923]' : getStatusColor(property.status)}`}
            data-testid={`property-status-${property.id}`}
          >
            {isSubject ? 'Subject' : property.status}
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <p className="font-medium text-sm truncate" data-testid={`property-address-${property.id}`}>{property.address}</p>
        <p className="text-xs text-muted-foreground truncate">
          {getCityState(property) || 'Location unavailable'}
        </p>
        <div className="flex items-baseline justify-between gap-2 mt-2 flex-wrap">
          <p className="text-lg font-bold" data-testid={`property-price-${property.id}`}>
            {formatCurrency(getDisplayPrice(property))}
          </p>
          <p className="text-sm text-muted-foreground" data-testid={`property-ppsf-${property.id}`}>
            {getSafePricePerSqft(property)}/sqft
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1" data-testid={`property-beds-${property.id}`}>
            <Bed className="w-3 h-3" /> {property.beds}
          </span>
          <span className="flex items-center gap-1" data-testid={`property-baths-${property.id}`}>
            <Bath className="w-3 h-3" /> {property.baths}
          </span>
          <span className="flex items-center gap-1" data-testid={`property-sqft-${property.id}`}>
            <Square className="w-3 h-3" /> {property.sqft.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1" data-testid={`property-dom-${property.id}`}>
          <Clock className="w-3 h-3" /> {property.daysOnMarket} days on market
        </p>
      </div>
    </Card>
  );
}

function PropertyListItem({ property, isSubject = false, onClick }: { property: CmaProperty; isSubject?: boolean; onClick?: () => void }) {
  return (
    <Card 
      className={`p-4 flex gap-4 flex-wrap cursor-pointer hover:shadow-lg transition-shadow ${isSubject ? 'border-[#EF4923] border-2' : ''}`}
      data-testid={`property-list-${property.id}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="w-32 h-24 flex-shrink-0 rounded overflow-hidden">
        {property.photos?.[0] ? (
          <img 
            src={property.photos[0]} 
            alt={property.address}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
            No Photo
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge className={`${isSubject ? 'bg-[#EF4923]' : getStatusColor(property.status)} text-white text-xs`}>
            {isSubject ? 'Subject' : property.status}
          </Badge>
        </div>
        <p className="font-medium text-sm truncate" data-testid={`property-list-address-${property.id}`}>{property.address}</p>
        <p className="text-lg font-bold mt-1" data-testid={`property-list-price-${property.id}`}>
          {formatCurrency(getDisplayPrice(property))}
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {getSafePricePerSqft(property)}/sqft
          </span>
        </p>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
          <span>{property.beds} beds</span>
          <span>{property.baths} baths</span>
          <span>{property.sqft.toLocaleString()} sqft</span>
          <span>{property.daysOnMarket} DOM</span>
        </div>
      </div>
    </Card>
  );
}

function PropertyTable({ comparables, subjectProperty, onPropertyClick }: { comparables: CmaProperty[]; subjectProperty?: CmaProperty; onPropertyClick?: (property: CmaProperty) => void }) {
  const allProperties = subjectProperty ? [subjectProperty, ...comparables] : comparables;
  
  return (
    <div className="overflow-x-auto" data-testid="property-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 font-medium">Address</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="text-right p-3 font-medium">Price</th>
            <th className="text-right p-3 font-medium">$/SqFt</th>
            <th className="text-center p-3 font-medium">Beds</th>
            <th className="text-center p-3 font-medium">Baths</th>
            <th className="text-right p-3 font-medium">SqFt</th>
            <th className="text-right p-3 font-medium">DOM</th>
          </tr>
        </thead>
        <tbody>
          {allProperties.map((property, index) => (
            <tr 
              key={property.id} 
              className={`border-b hover:bg-muted/50 cursor-pointer ${property.isSubject ? 'bg-[#EF4923]/10' : ''}`}
              data-testid={`property-row-${property.id}`}
              onClick={() => onPropertyClick?.(property)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPropertyClick?.(property);
                }
              }}
            >
              <td className="p-3 max-w-[200px] truncate" data-testid={`table-address-${index}`}>{property.address}</td>
              <td className="p-3" data-testid={`table-status-${index}`}>
                <Badge className={`${property.isSubject ? 'bg-[#EF4923]' : getStatusColor(property.status)} text-white text-xs`}>
                  {property.isSubject ? 'Subject' : property.status}
                </Badge>
              </td>
              <td className="text-right p-3 font-medium" data-testid={`table-price-${index}`}>{formatCurrency(getDisplayPrice(property))}</td>
              <td className="text-right p-3" data-testid={`table-ppsf-${index}`}>{getSafePricePerSqft(property)}/sqft</td>
              <td className="text-center p-3" data-testid={`table-beds-${index}`}>{property.beds}</td>
              <td className="text-center p-3" data-testid={`table-baths-${index}`}>{property.baths}</td>
              <td className="text-right p-3" data-testid={`table-sqft-${index}`}>{property.sqft.toLocaleString()}</td>
              <td className="text-right p-3" data-testid={`table-dom-${index}`}>{property.daysOnMarket}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompsMapView({ comparables, subjectProperty }: { comparables: CmaProperty[]; subjectProperty?: CmaProperty }) {
  const normalizedSubject: Property | null = subjectProperty ? convertToProperty(subjectProperty) : null;
  const normalizedComparables: Property[] = comparables.map(convertToProperty);

  const hasSubjectCoords = normalizedSubject?.latitude && normalizedSubject?.longitude;
  const validComparables = normalizedComparables.filter(c => c.latitude && c.longitude);

  if (!hasSubjectCoords && validComparables.length === 0) {
    return (
      <div className="h-full min-h-[400px] flex items-center justify-center rounded-lg border bg-muted/30" data-testid="map-no-coords">
        <div className="text-center text-muted-foreground">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-lg font-medium">Map Unavailable</p>
          <p className="text-sm">No coordinates found for properties</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[400px]" data-testid="comps-map-view">
      <CMAMap
        properties={normalizedComparables}
        subjectProperty={normalizedSubject}
        showPolygon={false}
      />
    </div>
  );
}

export function CompsWidget({ comparables, subjectProperty }: CompsWidgetProps) {
  const [mainView, setMainView] = useState<'compare' | 'map' | 'stats' | 'list'>('compare');
  const [subView, setSubView] = useState<'grid' | 'list' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProperty, setSelectedProperty] = useState<CmaProperty | null>(null);

  const filteredComparables = useMemo(() => {
    if (statusFilter === 'all') return comparables;
    return comparables.filter(comp => normalizeStatus(comp.status) === statusFilter);
  }, [comparables, statusFilter]);

  const statistics = useMemo(() => calculateStatistics(filteredComparables), [filteredComparables]);

  return (
    <div className="flex flex-col h-full bg-background" data-testid="comps-widget">
      <div className="p-4 border-b space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-semibold" data-testid="comps-title">
              Comparable Properties
            </h2>
            <span className="text-sm text-muted-foreground" data-testid="comps-count">
              {filteredComparables.length} properties
            </span>
            <Badge variant="outline" className="text-xs" data-testid="badge-mls">
              MLS
            </Badge>
          </div>
          
          <Tabs value={mainView} onValueChange={(v) => setMainView(v as typeof mainView)} data-testid="main-view-tabs">
            <TabsList>
              <TabsTrigger value="compare" className="text-xs gap-1" data-testid="tab-compare">
                <BarChart3 className="w-3 h-3" /> Compare
              </TabsTrigger>
              <TabsTrigger value="map" className="text-xs gap-1" data-testid="tab-map">
                <MapIcon className="w-3 h-3" /> Map
              </TabsTrigger>
              <TabsTrigger value="stats" className="text-xs gap-1" data-testid="tab-stats">
                <TrendingUp className="w-3 h-3" /> Stats
              </TabsTrigger>
              <TabsTrigger value="list" className="text-xs gap-1" data-testid="tab-list">
                <List className="w-3 h-3" /> List
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap" data-testid="status-filters">
          {STATUS_FILTERS.map(filter => (
            <Button
              key={filter.id}
              variant={statusFilter === filter.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.id)}
              className="flex-shrink-0"
              data-testid={`filter-${filter.id}`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg" data-testid="stats-summary">
            <StatItem 
              label="LOW PRICE" 
              value={formatCurrency(statistics.price.range.min)} 
            />
            <StatItem 
              label="HIGH PRICE" 
              value={formatCurrency(statistics.price.range.max)} 
            />
            <StatItem 
              label="AVG PRICE" 
              value={formatCurrency(statistics.price.average)}
            />
            <StatItem 
              label="MEDIAN" 
              value={formatCurrency(statistics.price.median)} 
            />
            <StatItem 
              label="AVG $/SQFT" 
              value={`$${Math.round(statistics.pricePerSqFt.average)}`} 
            />
            <StatItem 
              label="AVG DOM" 
              value={`${Math.round(statistics.daysOnMarket.average)} days`} 
            />
          </div>
        )}
        
        {mainView === 'compare' && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="view-toggles">
            <span className="text-sm text-muted-foreground">View:</span>
            <Button
              variant={subView === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSubView('grid')}
              className="gap-1"
              data-testid="view-grid"
            >
              <LayoutGrid className="w-4 h-4" /> Grid
            </Button>
            <Button
              variant={subView === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSubView('list')}
              className="gap-1"
              data-testid="view-list"
            >
              <List className="w-4 h-4" /> List
            </Button>
            <Button
              variant={subView === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSubView('table')}
              className="gap-1"
              data-testid="view-table"
            >
              <Table2 className="w-4 h-4" /> Table
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-auto p-4" data-testid="content-area">
        {mainView === 'compare' && (
          <>
            {subView === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="grid-view">
                {subjectProperty && (
                  <PropertyCard 
                    property={{...subjectProperty, isSubject: true}} 
                    isSubject 
                    onClick={() => setSelectedProperty({...subjectProperty, isSubject: true})}
                  />
                )}
                {filteredComparables.map(comp => (
                  <PropertyCard 
                    key={comp.id} 
                    property={comp} 
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}
            {subView === 'list' && (
              <div className="space-y-3" data-testid="list-view">
                {subjectProperty && (
                  <PropertyListItem 
                    property={{...subjectProperty, isSubject: true}} 
                    isSubject 
                    onClick={() => setSelectedProperty({...subjectProperty, isSubject: true})}
                  />
                )}
                {filteredComparables.map(comp => (
                  <PropertyListItem 
                    key={comp.id} 
                    property={comp} 
                    onClick={() => setSelectedProperty(comp)}
                  />
                ))}
              </div>
            )}
            {subView === 'table' && (
              <PropertyTable 
                comparables={filteredComparables} 
                subjectProperty={subjectProperty ? {...subjectProperty, isSubject: true} : undefined}
                onPropertyClick={setSelectedProperty}
              />
            )}
          </>
        )}

        {mainView === 'map' && (
          <CompsMapView 
            comparables={filteredComparables}
            subjectProperty={subjectProperty}
          />
        )}

        {mainView === 'stats' && statistics && (
          <div className="space-y-6" data-testid="stats-view">
            <Card className="p-6" data-testid="stats-price-card">
              <h3 className="text-lg font-semibold mb-4">Price Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div data-testid="stats-price-avg">
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">{formatCurrency(statistics.price.average)}</p>
                </div>
                <div data-testid="stats-price-median">
                  <p className="text-sm text-muted-foreground">Median</p>
                  <p className="text-2xl font-bold">{formatCurrency(statistics.price.median)}</p>
                </div>
                <div data-testid="stats-price-range">
                  <p className="text-sm text-muted-foreground">Range</p>
                  <p className="text-lg font-medium">
                    {formatCurrency(statistics.price.range.min)} - {formatCurrency(statistics.price.range.max)}
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6" data-testid="stats-ppsf-card">
              <h3 className="text-lg font-semibold mb-4">Price Per Square Foot</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div data-testid="stats-ppsf-avg">
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">${Math.round(statistics.pricePerSqFt.average)}/sqft</p>
                </div>
                <div data-testid="stats-ppsf-median">
                  <p className="text-sm text-muted-foreground">Median</p>
                  <p className="text-2xl font-bold">${Math.round(statistics.pricePerSqFt.median)}/sqft</p>
                </div>
                <div data-testid="stats-ppsf-range">
                  <p className="text-sm text-muted-foreground">Range</p>
                  <p className="text-lg font-medium">
                    ${Math.round(statistics.pricePerSqFt.range.min)} - ${Math.round(statistics.pricePerSqFt.range.max)}/sqft
                  </p>
                </div>
              </div>
            </Card>
            
            <Card className="p-6" data-testid="stats-dom-card">
              <h3 className="text-lg font-semibold mb-4">Days on Market</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div data-testid="stats-dom-avg">
                  <p className="text-sm text-muted-foreground">Average</p>
                  <p className="text-2xl font-bold">{Math.round(statistics.daysOnMarket.average)} days</p>
                </div>
                <div data-testid="stats-dom-median">
                  <p className="text-sm text-muted-foreground">Median</p>
                  <p className="text-2xl font-bold">{Math.round(statistics.daysOnMarket.median)} days</p>
                </div>
                <div data-testid="stats-dom-range">
                  <p className="text-sm text-muted-foreground">Range</p>
                  <p className="text-lg font-medium">
                    {Math.round(statistics.daysOnMarket.range.min)} - {Math.round(statistics.daysOnMarket.range.max)} days
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {mainView === 'list' && (
          <PropertyTable 
            comparables={filteredComparables} 
            subjectProperty={subjectProperty ? {...subjectProperty, isSubject: true} : undefined}
            onPropertyClick={setSelectedProperty}
          />
        )}
      </div>

      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
        />
      )}
    </div>
  );
}
