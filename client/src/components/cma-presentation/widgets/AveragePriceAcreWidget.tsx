import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';
import type { CmaProperty } from '../types';
import { PropertyDetailModal } from './PropertyDetailModal';

interface AveragePriceAcreWidgetProps {
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  averagePricePerAcre?: number;
}

interface PropertyWithAcreage extends CmaProperty {
  lotSizeAcres: number;
  pricePerAcre: number;
}

const STATUS_COLORS = {
  closed: '#EF4444',
  active: '#22C55E',
  pending: '#F59E0B',
  subject: '#3B82F6',
};

const formatPrice = (price: number) => {
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  if (price >= 1000) {
    return `$${(price / 1000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(price);
};

const formatFullPrice = (price: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    maximumFractionDigits: 0 
  }).format(price);
};

const getStatusCategory = (status: string): 'closed' | 'active' | 'pending' => {
  const s = status.toLowerCase();
  if (s.includes('closed') || s.includes('sold')) return 'closed';
  if (s.includes('pending') || s.includes('under')) return 'pending';
  return 'active';
};

const getStatusColor = (status: string, isSubject?: boolean) => {
  if (isSubject) return STATUS_COLORS.subject;
  return STATUS_COLORS[getStatusCategory(status)];
};

interface PropertySidebarItemProps {
  property: PropertyWithAcreage;
  isSelected: boolean;
  onClick: () => void;
}

function PropertySidebarItem({ property, isSelected, onClick }: PropertySidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 p-2 transition-colors text-left
        ${isSelected ? 'bg-[#EF4923]/10 ring-2 ring-[#EF4923] ring-inset rounded-md' : 'hover-elevate rounded-md'}`}
      data-testid={`sidebar-property-${property.id}`}
    >
      <div className="w-12 h-10 flex-shrink-0 rounded overflow-hidden bg-muted">
        {property.photos?.[0] ? (
          <img src={property.photos[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No img
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{property.address}</p>
        <p className="text-xs text-[#EF4923] font-semibold">
          {formatFullPrice(property.pricePerAcre)} / acre
        </p>
      </div>
    </button>
  );
}

interface StatusGroupProps {
  title: string;
  items: PropertyWithAcreage[];
  color: string;
  selectedId: string | null;
  onSelect: (property: PropertyWithAcreage) => void;
}

function StatusGroup({ title, items, color, selectedId, onSelect }: StatusGroupProps) {
  if (items.length === 0) return null;
  
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 px-2 mb-1.5">
        <span className={`w-2.5 h-2.5 rounded-full`} style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {items.length} {title}
        </span>
      </div>
      <div className="space-y-1">
        {items.map(p => (
          <PropertySidebarItem 
            key={p.id} 
            property={p} 
            isSelected={selectedId === p.id}
            onClick={() => onSelect(p)}
          />
        ))}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: PropertyWithAcreage & { x: number; y: number };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  
  const data = payload[0].payload;
  const isSubject = data.isSubject;
  
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 max-w-xs">
      <p className="font-medium text-sm truncate">{data.address}</p>
      <div className="mt-1.5 space-y-0.5 text-xs">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Price:</span>
          <span className="font-medium">{formatFullPrice(data.soldPrice || data.price)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Acres:</span>
          <span className="font-medium">{data.lotSizeAcres.toFixed(2)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Price/Acre:</span>
          <span className="font-medium text-[#EF4923]">{formatFullPrice(data.pricePerAcre)}</span>
        </div>
        {!isSubject && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Status:</span>
            <Badge 
              className="text-white text-[10px] py-0"
              style={{ backgroundColor: getStatusColor(data.status) }}
            >
              {data.status}
            </Badge>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 italic">Click for details</p>
    </div>
  );
}

interface SubjectDiamondProps {
  cx?: number;
  cy?: number;
  payload?: PropertyWithAcreage;
}

function SubjectDiamond({ cx, cy }: SubjectDiamondProps) {
  if (cx === undefined || cy === undefined) return null;
  const size = 10;
  return (
    <polygon
      points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
      fill={STATUS_COLORS.subject}
      stroke="white"
      strokeWidth={2}
    />
  );
}

export function AveragePriceAcreWidget({ 
  comparables, 
  subjectProperty,
  averagePricePerAcre 
}: AveragePriceAcreWidgetProps) {
  const [selectedProperty, setSelectedProperty] = useState<CmaProperty | null>(null);
  const [showSubject, setShowSubject] = useState(true);
  const [showTrendline, setShowTrendline] = useState(true);

  const propertiesWithAcreage = useMemo<PropertyWithAcreage[]>(() => {
    console.log('=== [AVERAGE PRICE/ACRE] Widget Data Pipeline ===');
    console.log('Total comparables received:', comparables.length);
    
    const withAcreage = comparables
      .filter(p => {
        if (p.type === 'Lease') return false;
        const acres = p.lotSizeAcres ?? p.lot?.acres ?? p.acres ?? (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : 0) ?? (p.lotSize ? p.lotSize / 43560 : 0);
        return acres !== null && acres !== undefined && acres > 0;
      })
      .map(p => {
        const acres = p.lotSizeAcres ?? p.lot?.acres ?? p.acres ?? (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : 0) ?? (p.lotSize ? p.lotSize / 43560 : 0);
        const price = p.soldPrice || p.price;
        const pricePerAcre = p.pricePerAcre ?? (acres && acres > 0 ? Math.round(price / acres) : 0);
        return {
          ...p,
          lotSizeAcres: acres as number,
          pricePerAcre: pricePerAcre as number,
        };
      });
    
    console.log('Properties with valid acreage:', withAcreage.length);
    if (withAcreage.length > 0) {
      console.log('Sample acreage data:', withAcreage.slice(0, 3).map(p => ({
        mlsNumber: p.mlsNumber,
        acres: p.lotSizeAcres?.toFixed(2),
        price: p.soldPrice || p.price,
        pricePerAcre: p.pricePerAcre,
        status: p.status,
      })));
    } else if (comparables.length > 0) {
      console.log('⚠️ NO PROPERTIES WITH ACREAGE DATA');
      console.log('Sample lot fields:', comparables.slice(0, 3).map(p => ({
        mlsNumber: p.mlsNumber,
        lotSizeAcres: p.lotSizeAcres,
        lot: p.lot,
        acres: p.acres,
        lotSize: p.lotSize,
      })));
    }
    
    return withAcreage;
  }, [comparables]);

  const groupedProperties = useMemo(() => {
    const closed = propertiesWithAcreage.filter(p => getStatusCategory(p.status) === 'closed');
    const pending = propertiesWithAcreage.filter(p => getStatusCategory(p.status) === 'pending');
    const active = propertiesWithAcreage.filter(p => getStatusCategory(p.status) === 'active');
    return { closed, pending, active };
  }, [propertiesWithAcreage]);

  const avgPricePerAcre = useMemo(() => {
    if (averagePricePerAcre) return averagePricePerAcre;
    const closedProps = propertiesWithAcreage.filter(p => getStatusCategory(p.status) === 'closed');
    if (closedProps.length === 0) {
      if (propertiesWithAcreage.length === 0) return 0;
      const total = propertiesWithAcreage.reduce((sum, p) => sum + p.pricePerAcre, 0);
      return Math.round(total / propertiesWithAcreage.length);
    }
    const total = closedProps.reduce((sum, p) => sum + p.pricePerAcre, 0);
    return Math.round(total / closedProps.length);
  }, [propertiesWithAcreage, averagePricePerAcre]);

  const subjectWithAcreage = useMemo<PropertyWithAcreage | null>(() => {
    if (!subjectProperty) return null;
    const acres = subjectProperty.lotSizeAcres ?? subjectProperty.lot?.acres ?? subjectProperty.acres ?? (subjectProperty.lotSizeSquareFeet ? subjectProperty.lotSizeSquareFeet / 43560 : 0) ?? (subjectProperty.lotSize ? subjectProperty.lotSize / 43560 : 0);
    console.log('[AVERAGE PRICE/ACRE] Subject property acres:', acres, 'lotSizeAcres:', subjectProperty.lotSizeAcres, 'lot:', subjectProperty.lot);
    if (!acres || acres <= 0) return null;
    const price = subjectProperty.soldPrice || subjectProperty.price || (avgPricePerAcre * acres);
    return {
      ...subjectProperty,
      lotSizeAcres: acres as number,
      pricePerAcre: subjectProperty.pricePerAcre ?? Math.round(price / acres),
      isSubject: true,
    };
  }, [subjectProperty, avgPricePerAcre]);

  const chartData = useMemo(() => {
    return propertiesWithAcreage.map(p => ({
      ...p,
      x: p.lotSizeAcres,
      y: p.soldPrice || p.price,
    }));
  }, [propertiesWithAcreage]);

  const subjectChartData = useMemo(() => {
    if (!subjectWithAcreage || !showSubject) return [];
    return [{
      ...subjectWithAcreage,
      x: subjectWithAcreage.lotSizeAcres,
      y: subjectWithAcreage.soldPrice || subjectWithAcreage.price || (avgPricePerAcre * subjectWithAcreage.lotSizeAcres),
    }];
  }, [subjectWithAcreage, showSubject, avgPricePerAcre]);

  const { minAcres, maxAcres, minPrice, maxPrice, trendlineSlope } = useMemo(() => {
    const allAcres = chartData.map(d => d.x);
    const allPrices = chartData.map(d => d.y);
    if (subjectChartData.length > 0) {
      allAcres.push(subjectChartData[0].x);
      allPrices.push(subjectChartData[0].y);
    }
    
    const minA = Math.min(...allAcres) * 0.9;
    const maxA = Math.max(...allAcres) * 1.1;
    const minP = Math.min(...allPrices) * 0.9;
    const maxP = Math.max(...allPrices) * 1.1;
    
    return {
      minAcres: minA,
      maxAcres: maxA,
      minPrice: minP,
      maxPrice: maxP,
      trendlineSlope: avgPricePerAcre,
    };
  }, [chartData, subjectChartData, avgPricePerAcre]);

  const handlePropertyClick = (property: CmaProperty) => {
    setSelectedProperty(property);
  };

  const handleScatterClick = (data: any) => {
    if (data && !data.isSubject) {
      setSelectedProperty(data);
    }
  };
  
  const hasChartData = propertiesWithAcreage.length > 0 || (subjectChartData.length > 0 && showSubject);

  return (
    <div className="flex flex-col h-full bg-background" data-testid="average-price-acre-widget">
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="w-56 lg:w-64 flex-shrink-0 border-r border-border bg-card overflow-y-auto">
          <div className="p-2">
            <StatusGroup 
              title="Closed" 
              items={groupedProperties.closed} 
              color={STATUS_COLORS.closed}
              selectedId={selectedProperty?.id || null}
              onSelect={handlePropertyClick}
            />
            <StatusGroup 
              title="Under Contract" 
              items={groupedProperties.pending} 
              color={STATUS_COLORS.pending}
              selectedId={selectedProperty?.id || null}
              onSelect={handlePropertyClick}
            />
            <StatusGroup 
              title="Active" 
              items={groupedProperties.active} 
              color={STATUS_COLORS.active}
              selectedId={selectedProperty?.id || null}
              onSelect={handlePropertyClick}
            />
            
            {propertiesWithAcreage.length === 0 && (
              <div className="text-center text-muted-foreground text-sm p-4">
                No properties with acreage data
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 lg:p-6 flex flex-col overflow-hidden">
          <div className="mb-3">
            <h2 className="text-3xl lg:text-4xl font-bold text-[#EF4923]">
              {formatFullPrice(avgPricePerAcre)} <span className="text-lg lg:text-xl text-muted-foreground">/ ACRE</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Comparable land sold for an average of <span className="text-[#EF4923] font-medium">{formatFullPrice(avgPricePerAcre)}</span> / acre.
            </p>
          </div>

          <Card className="flex-1 min-h-0 p-3 lg:p-4 overflow-hidden">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 20, right: 30, bottom: 40, left: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Acres"
                    domain={[minAcres, maxAcres]}
                    tickFormatter={(v) => v.toFixed(2)}
                    label={{ 
                      value: 'Acres', 
                      position: 'bottom', 
                      offset: 0,
                      style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 }
                    }}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Price"
                    domain={[minPrice, maxPrice]}
                    tickFormatter={formatPrice}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    width={65}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {showTrendline && (
                    <ReferenceLine
                      segment={[
                        { x: minAcres, y: minAcres * trendlineSlope },
                        { x: maxAcres, y: maxAcres * trendlineSlope },
                      ]}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="5 5"
                      strokeWidth={1.5}
                    />
                  )}

                  {chartData.length > 0 && (
                    <Scatter 
                      name="Properties" 
                      data={chartData} 
                      cursor="pointer"
                      onClick={(data) => handleScatterClick(data)}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={getStatusColor(entry.status)}
                          stroke="white"
                          strokeWidth={2}
                          r={8}
                        />
                      ))}
                    </Scatter>
                  )}

                  {subjectChartData.length > 0 && (
                    <Scatter
                      name="Subject"
                      data={subjectChartData}
                      shape={<SubjectDiamond />}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium">No Acreage Data Available</p>
                  <p className="text-sm">Properties need lot size information to display this chart</p>
                </div>
              </div>
            )}
          </Card>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={showSubject} 
                onCheckedChange={(checked) => setShowSubject(checked === true)}
                data-testid="checkbox-show-subject"
              />
              <span className="w-3 h-3 bg-blue-500 rotate-45" />
              <span className="text-muted-foreground">Subject Property</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={showTrendline} 
                onCheckedChange={(checked) => setShowTrendline(checked === true)}
                data-testid="checkbox-show-trendline"
              />
              <span className="w-6 h-0.5 bg-muted-foreground border-t border-dashed" />
              <span className="text-muted-foreground">Trendline (avg price/acre of SOLD)</span>
            </label>
            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.closed }} />
                <span className="text-muted-foreground">Closed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.pending }} />
                <span className="text-muted-foreground">Under Contract</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.active }} />
                <span className="text-muted-foreground">Active</span>
              </div>
            </div>
          </div>
        </div>
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
