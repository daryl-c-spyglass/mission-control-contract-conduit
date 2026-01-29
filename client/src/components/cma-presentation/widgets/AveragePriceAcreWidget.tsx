import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Info, Home, TrendingUp } from 'lucide-react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';
import type { CmaProperty } from '../types';
import { PropertyDetailModal } from './PropertyDetailModal';
import { extractLotAcres, extractPrice } from '@/lib/cma-data-utils';

// Linear regression calculation for trendline
function calculateLinearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  if (points.length < 2) return null;
  
  const n = points.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumX2 += p.x * p.x;
  }
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  return { slope, intercept };
}

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

interface SubjectHouseProps {
  cx?: number;
  cy?: number;
  payload?: PropertyWithAcreage;
}

function SubjectHouse({ cx, cy }: SubjectHouseProps) {
  if (cx === undefined || cy === undefined) return null;
  const size = 18; // Size of the house icon
  
  // House shape: roof triangle on top, square body below
  return (
    <g>
      {/* Invisible hit area for touch targets */}
      <circle cx={cx} cy={cy} r={22} fill="transparent" />
      {/* House body (rectangle) */}
      <rect
        x={cx - size/2.5}
        y={cy - size/6}
        width={size * 0.8}
        height={size * 0.6}
        fill={STATUS_COLORS.subject}
        stroke="white"
        strokeWidth={2}
      />
      {/* Roof (triangle) */}
      <polygon
        points={`${cx},${cy - size/1.5} ${cx - size/2},${cy - size/6} ${cx + size/2},${cy - size/6}`}
        fill={STATUS_COLORS.subject}
        stroke="white"
        strokeWidth={2}
      />
      {/* Door (small rectangle) */}
      <rect
        x={cx - size/8}
        y={cy + size/10}
        width={size/4}
        height={size/4}
        fill="white"
      />
    </g>
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

  // Helper to calculate acres using the improved utility function
  const getAcres = (p: CmaProperty): number => {
    const acres = extractLotAcres(p);
    return acres ?? 0;
  };

  // Helper to get price using utility function
  const getPrice = (p: CmaProperty): number => {
    return extractPrice(p) ?? 0;
  };

  // Include all properties with acreage data (CloudCMA-style - no exclusions)
  const propertiesWithAcreage = useMemo<PropertyWithAcreage[]>(() => {
    const withAcreage = comparables
      .filter(p => {
        if (p.type === 'Lease') return false;
        const acres = getAcres(p);
        return acres > 0;
      })
      .map(p => {
        const acres = getAcres(p);
        const price = getPrice(p);
        // Calculate price per acre with existing value fallback
        const pricePerAcre = p.pricePerAcre ?? (acres && acres > 0 && price > 0 ? Math.round(price / acres) : 0);
        
        return {
          ...p,
          lotSizeAcres: acres as number,
          pricePerAcre: pricePerAcre as number,
        };
      })
      // Filter out properties with zero price
      .filter(p => p.pricePerAcre > 0);
    
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
    const acres = getAcres(subjectProperty);
    if (!acres || acres <= 0) return null;
    const price = getPrice(subjectProperty) || (avgPricePerAcre * acres);
    const pricePerAcre = subjectProperty.pricePerAcre ?? (price > 0 ? Math.round(price / acres) : 0);
    return {
      ...subjectProperty,
      lotSizeAcres: acres,
      pricePerAcre: pricePerAcre,
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

  // Calculate linear regression from CLOSED/SOLD listings only (CloudCMA-style)
  const regressionData = useMemo(() => {
    const closedData = chartData.filter(d => getStatusCategory(d.status) === 'closed');
    if (closedData.length < 2) return null;
    
    const points = closedData.map(d => ({ x: d.x, y: d.y }));
    return calculateLinearRegression(points);
  }, [chartData]);

  const { minAcres, maxAcres, minPrice, maxPrice, trendlineData } = useMemo(() => {
    const allAcres = chartData.map(d => d.x);
    const allPrices = chartData.map(d => d.y);
    if (subjectChartData.length > 0) {
      allAcres.push(subjectChartData[0].x);
      allPrices.push(subjectChartData[0].y);
    }
    
    if (allAcres.length === 0) {
      return { minAcres: 0, maxAcres: 1, minPrice: 0, maxPrice: 1, trendlineData: [] };
    }
    
    const minA = Math.min(...allAcres) * 0.9;
    const maxA = Math.max(...allAcres) * 1.1;
    
    // Calculate trendline endpoints using linear regression: y = mx + b
    let trendMinY = 0, trendMaxY = 0;
    if (regressionData) {
      trendMinY = regressionData.slope * minA + regressionData.intercept;
      trendMaxY = regressionData.slope * maxA + regressionData.intercept;
    }
    
    // Include trendline endpoints in price range calculation (if positive)
    const pricesWithTrend = [...allPrices];
    if (trendMinY > 0) pricesWithTrend.push(trendMinY);
    if (trendMaxY > 0) pricesWithTrend.push(trendMaxY);
    
    const validPrices = pricesWithTrend.filter(p => p > 0);
    const minP = validPrices.length > 0 ? Math.min(...validPrices) * 0.9 : 0;
    const maxP = validPrices.length > 0 ? Math.max(...validPrices) * 1.1 : 1;
    
    // Create trendline data points (two points define the line)
    const trendline = regressionData ? [
      { x: minA, y: Math.max(0, trendMinY) },
      { x: maxA, y: Math.max(0, trendMaxY) },
    ] : [];
    
    return {
      minAcres: minA,
      maxAcres: maxA,
      minPrice: minP,
      maxPrice: maxP,
      trendlineData: trendline,
    };
  }, [chartData, subjectChartData, regressionData]);

  const handlePropertyClick = (property: CmaProperty) => {
    setSelectedProperty(property);
  };

  const handleScatterClick = (data: any) => {
    if (data) {
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
                <p className="font-medium mb-1">No Lot Data Available</p>
                <p className="text-xs text-muted-foreground/70">
                  Lot size not reported in MLS for this area
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 p-4 lg:p-6 flex flex-col overflow-hidden">
          <div className="mb-3">
            <div className="flex items-start gap-2">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-[#EF4923]">
                  {formatFullPrice(avgPricePerAcre)} <span className="text-lg lg:text-xl text-muted-foreground">/ ACRE</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Comparable land sold for an average of <span className="text-[#EF4923] font-medium">{formatFullPrice(avgPricePerAcre)}</span> / acre.
                </p>
              </div>
              
              <div className="relative group">
                <button 
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-price-acre-info"
                >
                  <Info className="w-4 h-4" />
                </button>
                <div className="absolute left-0 top-full mt-1 w-72 p-3 bg-popover 
                                rounded-lg shadow-lg border border-border
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible 
                                transition-all z-50 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">PRICE/ACRE SCATTER CHART</p>
                  <p>
                    The price/acre scatter chart is a way to visualize the trend between the price and acreage of the home.
                  </p>
                  <p className="mt-2">
                    A trendline will be drawn to show the <span className="font-medium text-foreground">correlation between price and acreage</span> across the sold listings.
                  </p>
                  <p className="mt-2 text-muted-foreground/70">
                    The average $/acre is calculated by dividing each sold property's price by its lot size in acres, then averaging the results.
                  </p>
                </div>
              </div>
            </div>
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
                  
                  {showTrendline && trendlineData.length === 2 && (
                    <Scatter
                      data={trendlineData}
                      line={{
                        stroke: '#9CA3AF',
                        strokeWidth: 3,
                        strokeDasharray: '8 4',
                      }}
                      shape={() => <></>}
                      isAnimationActive={false}
                      legendType="none"
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
                          r={12}
                        />
                      ))}
                    </Scatter>
                  )}

                  {subjectChartData.length > 0 && (
                    <Scatter
                      name="Subject"
                      data={subjectChartData}
                      shape={<SubjectHouse />}
                      cursor="pointer"
                      onClick={(data) => handleScatterClick(data)}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingUp className="w-6 h-6 text-amber-500" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-1">Lot Size Data Unavailable</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Lot size information is not available for comparable properties in this area. 
                    This data may not be reported in the MLS for this property type or location.
                  </p>
                  {comparables.length > 0 && (
                    <p className="text-xs text-muted-foreground/70">
                      {comparables.length} comparable{comparables.length !== 1 ? 's' : ''} found, 
                      but none include lot size data.
                    </p>
                  )}
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
              <Home className="w-4 h-4 text-blue-500" />
              <span className="text-muted-foreground">Subject Property</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox 
                checked={showTrendline} 
                onCheckedChange={(checked) => setShowTrendline(checked === true)}
                data-testid="checkbox-show-trendline"
              />
              <span className="w-6 h-0.5 bg-muted-foreground border-t border-dashed" />
              <span className="text-muted-foreground">Trendline represents average price per acre of SOLD listings.</span>
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
