import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  ScatterChart, Scatter, Cell, CartesianGrid
} from 'recharts';
import { BarChart3, ChevronLeft, ChevronRight, FileText, Home, TrendingUp, X } from "lucide-react";
import type { CMAComparable, PropertyStatistics } from "@shared/schema";
import { PropertyDetailModal } from "./cma/PropertyDetailModal";

interface StatsViewProps {
  comparables: CMAComparable[];
  subjectProperty: any;
  statistics: PropertyStatistics;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null || isNaN(price)) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function normalizeStatus(status: string | null | undefined): string {
  const lower = (status || '').toLowerCase().trim();
  if (!lower) return 'unknown';
  if (lower.includes('active under contract') || lower.includes('under contract')) return 'activeUnderContract';
  if (lower.includes('closed') || lower.includes('sold')) return 'closed';
  if (lower.includes('pending')) return 'pending';
  if (lower.includes('active')) return 'active';
  return 'unknown';
}

function formatStatusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'activeUnderContract': return 'Under Contract';
    case 'pending': return 'Pending';
    case 'closed': return 'Closed';
    default: return 'Unknown';
  }
}

function SummaryCards({ statistics }: { statistics: PropertyStatistics }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Average Price</div>
          <div className="text-2xl sm:text-3xl font-bold text-primary">
            {formatPrice(Math.round(statistics.price.average))}
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Range: {formatPrice(statistics.price.range.min)} - {formatPrice(statistics.price.range.max)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Price Per Sqft</div>
          <div className="text-2xl sm:text-3xl font-bold">
            ${Math.round(statistics.pricePerSqFt.average)}
            <span className="text-lg text-muted-foreground">/sqft</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Range: ${Math.round(statistics.pricePerSqFt.range.min)} - ${Math.round(statistics.pricePerSqFt.range.max)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">Avg Living Area</div>
          <div className="text-2xl sm:text-3xl font-bold">
            {Math.round(statistics.livingArea.average).toLocaleString()}
            <span className="text-lg text-muted-foreground"> sqft</span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {statistics.bedrooms.average.toFixed(1)} beds / {statistics.bathrooms.average.toFixed(1)} baths avg
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ExtendedStats extends PropertyStatistics {
  yearBuilt: { range: { min: number; max: number }; average: number; median: number };
}

function StatisticsSummaryTable({ statistics, propertyCount }: { statistics: PropertyStatistics; propertyCount: number }) {
  const yearBuiltData = (statistics as ExtendedStats).yearBuilt || { range: { min: 0, max: 0 }, average: 0, median: 0 };
  
  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          Statistics Summary ({propertyCount} Properties)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-sm text-muted-foreground">
              <tr className="border-b">
                <th className="text-left p-4 font-medium">Metric</th>
                <th className="text-left p-4 font-medium">Range</th>
                <th className="text-left p-4 font-medium">Average</th>
                <th className="text-left p-4 font-medium">Median</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b">
                <td className="p-4">Price</td>
                <td className="p-4">{formatPrice(statistics.price.range.min)} - {formatPrice(statistics.price.range.max)}</td>
                <td className="p-4 font-semibold">{formatPrice(Math.round(statistics.price.average))}</td>
                <td className="p-4">{formatPrice(Math.round(statistics.price.median))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4">Price/SqFt</td>
                <td className="p-4">${Math.round(statistics.pricePerSqFt.range.min)} - ${Math.round(statistics.pricePerSqFt.range.max)}</td>
                <td className="p-4 font-semibold">${Math.round(statistics.pricePerSqFt.average)}</td>
                <td className="p-4">${Math.round(statistics.pricePerSqFt.median)}</td>
              </tr>
              <tr className="border-b">
                <td className="p-4">Living Area</td>
                <td className="p-4">{statistics.livingArea.range.min.toLocaleString()} - {statistics.livingArea.range.max.toLocaleString()} sqft</td>
                <td className="p-4 font-semibold">{Math.round(statistics.livingArea.average).toLocaleString()} sqft</td>
                <td className="p-4">{Math.round(statistics.livingArea.median).toLocaleString()} sqft</td>
              </tr>
              <tr className="border-b">
                <td className="p-4">Days on Market</td>
                <td className="p-4">{statistics.daysOnMarket.range.min} - {statistics.daysOnMarket.range.max} days</td>
                <td className="p-4 font-semibold">{Math.round(statistics.daysOnMarket.average)} days</td>
                <td className="p-4">{Math.round(statistics.daysOnMarket.median)} days</td>
              </tr>
              {yearBuiltData.average > 0 && (
                <tr>
                  <td className="p-4">Year Built</td>
                  <td className="p-4">{yearBuiltData.range.min} - {yearBuiltData.range.max}</td>
                  <td className="p-4 font-semibold">{Math.round(yearBuiltData.average)}</td>
                  <td className="p-4">{Math.round(yearBuiltData.median)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceComparisonChart({ comparables }: { comparables: CMAComparable[] }) {
  const chartData = useMemo(() => {
    return comparables.slice(0, 10).map(comp => ({
      name: comp.address?.split(' ').slice(0, 3).join(' ') || 'Unknown',
      price: comp.price || 0,
      fullAddress: comp.address || 'Unknown Address',
    }));
  }, [comparables]);

  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  if (chartData.length === 0) return null;

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Price Comparison</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={80}
                tick={{ fontSize: 11 }}
                className="fill-foreground"
              />
              <YAxis 
                tickFormatter={formatYAxis} 
                tick={{ fontSize: 11 }}
                className="fill-foreground"
              />
              <Tooltip 
                formatter={(value: number) => [formatPrice(value), 'Price']}
                labelFormatter={(label, payload) => payload?.[0]?.payload?.fullAddress || label}
                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="price" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function CMAMarketReview({ statistics, comparables }: { statistics: PropertyStatistics; comparables: CMAComparable[] }) {
  const statusCounts = useMemo(() => {
    return comparables.reduce((acc, comp) => {
      const status = normalizeStatus(comp.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [comparables]);

  const statusSummary = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${formatStatusLabel(status)}`)
    .join(', ');

  return (
    <Card className="mx-4 mb-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">CMA Market Review</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="font-semibold mb-2">Market Overview</div>
            <p className="text-sm text-muted-foreground">
              Based on {comparables.length} comparable properties, the average price is{' '}
              <span className="font-semibold text-foreground">{formatPrice(Math.round(statistics.price.average))}</span>{' '}
              with a median of <span className="font-semibold text-foreground">{formatPrice(Math.round(statistics.price.median))}</span>.{' '}
              Prices range from {formatPrice(statistics.price.range.min)} to {formatPrice(statistics.price.range.max)}.
            </p>
          </div>

          <div>
            <div className="font-semibold mb-2">Price Per Square Foot</div>
            <p className="text-sm text-muted-foreground">
              Average price per square foot is{' '}
              <span className="font-semibold text-foreground">${statistics.pricePerSqFt.average.toFixed(2)}</span>{' '}
              across comparable properties. This ranges from ${statistics.pricePerSqFt.range.min.toFixed(2)} to ${statistics.pricePerSqFt.range.max.toFixed(2)}/sqft.
            </p>
          </div>

          <div>
            <div className="font-semibold mb-2">Days on Market</div>
            <p className="text-sm text-muted-foreground">
              Average: <span className="font-semibold text-foreground">{Math.round(statistics.daysOnMarket.average)} days</span>
            </p>
          </div>

          <div>
            <div className="font-semibold mb-2">Property Size</div>
            <p className="text-sm text-muted-foreground">
              Avg: <span className="font-semibold text-foreground">{Math.round(statistics.livingArea.average).toLocaleString()} sqft</span>
            </p>
          </div>

          <div>
            <div className="font-semibold mb-2">Bed/Bath</div>
            <p className="text-sm text-muted-foreground">
              Avg: <span className="font-semibold text-foreground">{statistics.bedrooms.average.toFixed(1)} beds / {statistics.bathrooms.average.toFixed(1)} baths</span>
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t text-sm text-muted-foreground italic">
          This analysis is based on {statusSummary} properties in your selection.
        </div>
      </CardContent>
    </Card>
  );
}

function DaysOnMarketSection({ comparables }: { comparables: CMAComparable[] }) {
  const [selectedProperty, setSelectedProperty] = useState<CMAComparable | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const closedProperties = useMemo(() => {
    return comparables.filter(c => 
      normalizeStatus(c.status) === 'closed' && c.price
    );
  }, [comparables]);

  const getColor = (percent: number) => {
    if (percent >= 100) return '#22c55e';
    if (percent >= 95) return '#eab308';
    return '#ef4444';
  };

  const chartData = useMemo(() => {
    return closedProperties.map((comp, idx) => {
      const soldPrice = comp.closePrice || comp.price;
      const listPrice = comp.listPrice || comp.price;
      const hasValidPrices = listPrice > 0 && soldPrice > 0;
      const percent = hasValidPrices ? (soldPrice / listPrice) * 100 : null;
      return {
        dom: comp.daysOnMarket || 0,
        price: soldPrice,
        percent,
        percentDisplay: percent !== null ? percent.toFixed(2) : 'N/A',
        address: comp.address || 'Unknown',
        photo: comp.photos?.[0] || comp.imageUrl || '',
        mlsId: comp.mlsNumber || '',
        fill: percent !== null ? getColor(percent) : '#9ca3af',
        originalIndex: idx,
      };
    });
  }, [closedProperties]);

  const handlePropertyClick = (idx: number) => {
    setSelectedProperty(closedProperties[idx]);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProperty(null);
  };

  if (closedProperties.length === 0) return null;

  const avgDom = Math.round(
    closedProperties.reduce((sum, c) => sum + (c.daysOnMarket || 0), 0) / closedProperties.length
  );
  
  const propertiesWithValidPercent = useMemo(() => {
    return chartData.filter(d => d.percent !== null);
  }, [chartData]);
  
  const avgListPricePercent = useMemo(() => {
    if (propertiesWithValidPercent.length === 0) return null;
    const total = propertiesWithValidPercent.reduce((sum, d) => sum + (d.percent || 0), 0);
    return total / propertiesWithValidPercent.length;
  }, [propertiesWithValidPercent]);

  const hasValidPercentData = avgListPricePercent !== null;

  return (
    <Card className="mx-4 mb-4">
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <div className="text-2xl font-bold">
            {avgDom} <span className="text-sm font-normal text-muted-foreground">DAYS ON MARKET</span>
          </div>
          {hasValidPercentData && (
            <div className="text-2xl font-bold text-primary">
              {avgListPricePercent.toFixed(2)}% <span className="text-sm font-normal text-muted-foreground">OF LIST PRICE</span>
            </div>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Sold homes were on the market for an average of <span className="font-semibold text-foreground">{avgDom} days</span> before they accepted an offer.
          {hasValidPercentData && (
            <> These homes sold for an average of <span className="font-semibold text-foreground">{avgListPricePercent.toFixed(2)}%</span> of list price.</>
          )}
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-1/3">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">
                {closedProperties.length}
              </span>
              <span className="font-semibold">Closed</span>
            </div>
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {chartData.slice(0, 5).map((data) => (
                <div 
                  key={data.mlsId || data.originalIndex} 
                  onClick={() => handlePropertyClick(data.originalIndex)}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`property-card-${data.mlsId || data.originalIndex}`}
                >
                  {data.photo ? (
                    <img 
                      src={data.photo} 
                      alt={data.address}
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                      <Home className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{data.address}</div>
                    <div className="text-xs text-muted-foreground">
                      {data.dom} Days{data.percentDisplay !== 'N/A' ? ` • ${data.percentDisplay}%` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:w-2/3 h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="dom" 
                  name="Days" 
                  type="number"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Days on Market', position: 'bottom', offset: 0, fontSize: 11 }}
                  className="fill-foreground"
                />
                <YAxis 
                  dataKey="price" 
                  name="Price"
                  tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`}
                  tick={{ fontSize: 11 }}
                  className="fill-foreground"
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'Price') return [formatPrice(value), 'Price'];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                />
                <Scatter data={chartData}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">≥100% of list</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span className="text-sm text-muted-foreground">95-99% of list</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-sm text-muted-foreground">&lt;95% of list</span>
          </div>
        </div>
      </CardContent>

      {selectedProperty && (() => {
        const parseSqft = (value: string | number | undefined): number | undefined => {
          if (value === undefined || value === null) return undefined;
          if (typeof value === 'number') return value;
          const cleaned = String(value).replace(/[^0-9.]/g, '');
          const parsed = parseFloat(cleaned);
          return isNaN(parsed) ? undefined : parsed;
        };
        const sqft = parseSqft(selectedProperty.sqft);
        const price = selectedProperty.closePrice || selectedProperty.price;
        const pricePerSqft = sqft && sqft > 0 ? price / sqft : undefined;
        
        return (
          <PropertyDetailModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            property={{
              mlsNumber: selectedProperty.mlsNumber,
              address: selectedProperty.address || 'Unknown Address',
              price,
              pricePerSqft,
              beds: selectedProperty.bedrooms,
              baths: selectedProperty.bathrooms,
              sqft,
              yearBuilt: selectedProperty.yearBuilt,
              daysOnMarket: selectedProperty.daysOnMarket,
              closeDate: selectedProperty.closeDate,
              listDate: selectedProperty.listDate,
              status: selectedProperty.status || 'Closed',
              photos: selectedProperty.photos || [],
              percentOfList: chartData.find(d => d.mlsId === selectedProperty.mlsNumber)?.percentDisplay,
            }}
          />
        );
      })()}
    </Card>
  );
}

interface PropertyData {
  mlsNumber: string;
  address: string;
  city?: string;
  zip?: string;
  price: number;
  pricePerSqft: number;
  beds: number;
  baths: number;
  sqft: number;
  lotSize?: string;
  garageSpaces?: number;
  origPrice?: number;
  listPrice: number;
  soldPrice?: number;
  soldPricePercent?: number;
  status: string;
  photos: string[];
  isSubject: boolean;
}

function AveragePricePerSqftSection({ comparables, subjectProperty }: { comparables: CMAComparable[]; subjectProperty: any }) {
  const [selectedProperty, setSelectedProperty] = useState<PropertyData | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showSubjectOnChart, setShowSubjectOnChart] = useState(true);

  const closedProperties = useMemo(() => {
    return comparables.filter(c => normalizeStatus(c.status) === 'closed');
  }, [comparables]);

  const parseSqft = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0;
    if (typeof value === 'number') return value;
    const cleaned = String(value).replace(/[^0-9.]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const allProperties = useMemo(() => {
    const props: PropertyData[] = [];
    
    if (subjectProperty) {
      const sqft = parseSqft(subjectProperty.livingArea || subjectProperty.sqft);
      const price = subjectProperty.listPrice || 0;
      if (sqft > 0 && price > 0) {
        props.push({
          mlsNumber: subjectProperty.mlsNumber || 'subject',
          address: subjectProperty.address?.unparsedAddress || subjectProperty.address || 'Subject Property',
          city: subjectProperty.address?.city || subjectProperty.city,
          zip: subjectProperty.address?.postalCode || subjectProperty.zip,
          price,
          pricePerSqft: Math.round(price / sqft),
          beds: subjectProperty.bedroomsTotal || subjectProperty.bedrooms || 0,
          baths: subjectProperty.bathroomsTotalInteger || subjectProperty.bathrooms || 0,
          sqft,
          lotSize: subjectProperty.lotSizeArea || undefined,
          garageSpaces: subjectProperty.garageSpaces,
          listPrice: price,
          status: subjectProperty.standardStatus || subjectProperty.status || 'Active',
          photos: subjectProperty.photos || [],
          isSubject: true,
        });
      }
    }
    
    closedProperties.forEach(comp => {
      const sqftValue = parseSqft(comp.sqft);
      const price = comp.closePrice || comp.price || 0;
      const listPrice = comp.listPrice || price;
      if (sqftValue > 0 && price > 0) {
        props.push({
          mlsNumber: comp.mlsNumber || `comp-${comp.address}`,
          address: comp.address || 'Unknown',
          price,
          pricePerSqft: Math.round(price / sqftValue),
          beds: comp.bedrooms || 0,
          baths: comp.bathrooms || 0,
          sqft: sqftValue,
          origPrice: listPrice,
          listPrice,
          soldPrice: comp.closePrice,
          soldPricePercent: comp.closePrice && listPrice ? (comp.closePrice / listPrice) * 100 : undefined,
          status: comp.status || 'Closed',
          photos: comp.photos || (comp.imageUrl ? [comp.imageUrl] : []),
          isSubject: false,
        });
      }
    });
    
    return props;
  }, [closedProperties, subjectProperty]);

  const chartData = useMemo(() => {
    return allProperties
      .filter(p => showSubjectOnChart || !p.isSubject)
      .map(p => ({
        x: p.sqft,
        y: p.price,
        property: p,
      }));
  }, [allProperties, showSubjectOnChart]);

  const avgPsf = useMemo(() => {
    const compsOnly = allProperties.filter(p => !p.isSubject);
    if (compsOnly.length === 0) return 0;
    return Math.round(compsOnly.reduce((sum, c) => sum + c.pricePerSqft, 0) / compsOnly.length);
  }, [allProperties]);

  const handlePropertySelect = (property: PropertyData) => {
    setSelectedProperty(property);
    setCurrentPhotoIndex(0);
  };

  const handleCloseDetail = () => {
    setSelectedProperty(null);
  };

  const safePhotoIndex = selectedProperty?.photos?.length 
    ? Math.min(currentPhotoIndex, selectedProperty.photos.length - 1) 
    : 0;

  const nextPhoto = () => {
    if (selectedProperty?.photos?.length) {
      setCurrentPhotoIndex((prev) => (prev + 1) % selectedProperty.photos.length);
    }
  };

  const prevPhoto = () => {
    if (selectedProperty?.photos?.length) {
      setCurrentPhotoIndex((prev) => (prev - 1 + selectedProperty.photos.length) % selectedProperty.photos.length);
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = status?.toLowerCase();
    if (normalized === 'closed' || normalized === 'sold') return 'bg-zinc-700 dark:bg-zinc-600';
    if (normalized === 'active') return 'bg-green-500';
    if (normalized === 'pending') return 'bg-gray-500';
    if (normalized?.includes('under contract')) return 'bg-orange-500';
    return 'bg-zinc-700 dark:bg-zinc-600';
  };

  if (allProperties.length === 0) return null;

  const hasSubject = allProperties.some(d => d.isSubject);

  return (
    <Card className="mx-4 mb-4">
      <CardContent className="pt-4">
        <div className="font-bold text-lg mb-1">AVERAGE PRICE/SQ. FT.</div>
        <div className="text-sm text-muted-foreground mb-4">
          {hasSubject ? '1 Subject, ' : ''}{closedProperties.length} Closed
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          {/* LEFT PANEL - Property List */}
          <div className="lg:w-56 flex-shrink-0 space-y-2 max-h-[400px] overflow-y-auto">
            {allProperties.map((property) => (
              <div
                key={property.mlsNumber}
                onClick={() => handlePropertySelect(property)}
                data-testid={`psf-property-${property.mlsNumber}`}
                className={`
                  flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all
                  ${selectedProperty?.mlsNumber === property.mlsNumber
                    ? 'ring-2 ring-primary bg-muted'
                    : 'hover:bg-muted/50'
                  }
                `}
              >
                <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
                  {property.isSubject ? (
                    <div className="w-full h-full flex items-center justify-center bg-blue-500">
                      <Home className="h-6 w-6 text-white" />
                    </div>
                  ) : property.photos?.[0] ? (
                    <img
                      src={property.photos[0]}
                      alt={property.address}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {property.isSubject && (
                      <span className="text-xs text-green-500 font-medium">Subject:</span>
                    )}
                    <span className="text-sm font-medium truncate">
                      {property.address?.split(',')[0]?.substring(0, 14)}
                      {(property.address?.split(',')[0]?.length || 0) > 14 ? '...' : ''}
                    </span>
                  </div>
                  <div className="text-primary text-sm font-semibold">
                    ${property.pricePerSqft} / sq. ft.
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CENTER PANEL - Chart */}
          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-primary">${avgPsf}</span>
                <span className="text-lg text-muted-foreground">/ Sq. Ft.</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Comparable homes sold for an average of{' '}
                <span className="text-primary font-semibold">${avgPsf}</span>/sq. ft.
                Many factors such as location, use of space, condition, quality,
                and amenities determine the market value per square foot.
              </p>
            </div>

            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Square feet"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.toLocaleString()}
                    label={{ value: 'Square feet', position: 'bottom', offset: 0, fontSize: 11 }}
                    className="fill-foreground"
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Price"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`}
                    className="fill-foreground"
                  />
                  <Tooltip
                    content={({ payload }) => {
                      if (payload && payload.length > 0) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border rounded p-2 text-sm shadow-lg">
                            <div className="font-medium">{data.property?.address}</div>
                            <div className="text-muted-foreground">
                              {formatPrice(data.y)} • {data.x?.toLocaleString()} sqft
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Scatter 
                    data={chartData}
                    onClick={(data: any) => {
                      if (data?.payload?.property) handlePropertySelect(data.payload.property);
                    }}
                  >
                    {chartData.map((entry, index) => {
                      const isSelected = selectedProperty?.mlsNumber === entry.property?.mlsNumber;
                      return (
                        <Cell
                          key={index}
                          fill={entry.property?.isSubject ? '#3b82f6' : '#ef4444'}
                          stroke={isSelected ? '#f97316' : entry.property?.isSubject ? '#1d4ed8' : '#dc2626'}
                          strokeWidth={isSelected ? 3 : 2}
                          r={entry.property?.isSubject ? 12 : 8}
                          style={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3">
              {hasSubject && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSubjectOnChart}
                    onChange={(e) => setShowSubjectOnChart(e.target.checked)}
                    className="w-4 h-4 rounded border-blue-500 text-blue-500 focus:ring-blue-500"
                  />
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                    <Home className="h-2.5 w-2.5 text-white" />
                  </div>
                  <span className="text-sm text-muted-foreground">Subject Property</span>
                </label>
              )}
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-sm text-muted-foreground">Closed Comparables</span>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Property Detail */}
          {selectedProperty && (
            <div className="lg:w-64 flex-shrink-0 bg-muted rounded-lg overflow-hidden">
              <div className="relative">
                <Badge
                  className={`absolute top-3 left-3 z-10 ${getStatusColor(selectedProperty.status)} text-white border-0`}
                >
                  {selectedProperty.status}
                </Badge>
                <button
                  onClick={handleCloseDetail}
                  data-testid="button-close-psf-detail"
                  className="absolute top-3 right-3 z-10 text-zinc-400 hover:text-white bg-black/40 rounded-full p-1"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="relative h-40 bg-zinc-700">
                  {selectedProperty.photos?.length > 0 ? (
                    <img
                      src={selectedProperty.photos[safePhotoIndex]}
                      alt={selectedProperty.address}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Home className="w-12 h-12 text-zinc-500" />
                    </div>
                  )}

                  {selectedProperty.photos?.length > 1 && (
                    <>
                      <button
                        onClick={prevPhoto}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1"
                      >
                        <ChevronLeft className="h-4 w-4 text-white" />
                      </button>
                      <button
                        onClick={nextPhoto}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1"
                      >
                        <ChevronRight className="h-4 w-4 text-white" />
                      </button>
                      <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded text-white text-xs">
                        {safePhotoIndex + 1} / {selectedProperty.photos.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4">
                <div className="mb-3">
                  <div className="font-medium text-sm">{selectedProperty.address}</div>
                  {(selectedProperty.city || selectedProperty.zip) && (
                    <div className="text-muted-foreground text-xs">
                      {[selectedProperty.city, selectedProperty.zip].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>

                <div className="text-xl font-bold text-primary mb-3">
                  {formatPrice(selectedProperty.soldPrice || selectedProperty.price)}
                </div>

                <div className="space-y-1.5 text-xs border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Beds</span>
                    <span>{selectedProperty.beds || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Baths</span>
                    <span>{selectedProperty.baths || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sq. Ft.</span>
                    <span>{selectedProperty.sqft?.toLocaleString() || '—'}</span>
                  </div>
                  {selectedProperty.lotSize && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lot Size</span>
                      <span>{selectedProperty.lotSize}</span>
                    </div>
                  )}
                </div>

                {!selectedProperty.isSubject && (
                  <div className="space-y-1.5 text-xs border-t pt-3 mt-3">
                    <div className="font-medium text-sm mb-2">Listing Details</div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">List Price</span>
                      <span>{formatPrice(selectedProperty.listPrice)}</span>
                    </div>
                    {selectedProperty.soldPrice && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Sold Price
                          {selectedProperty.soldPricePercent && (
                            <span className="text-muted-foreground/70 ml-1">
                              ({selectedProperty.soldPricePercent.toFixed(1)}%)
                            </span>
                          )}
                        </span>
                        <span>{formatPrice(selectedProperty.soldPrice)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Price per Sq. Ft.</span>
                      <span>${selectedProperty.pricePerSqft}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function CMAStatsView({ comparables, subjectProperty, statistics }: StatsViewProps) {
  return (
    <div className="pb-4" data-testid="cma-stats-view">
      <SummaryCards statistics={statistics} />
      <StatisticsSummaryTable statistics={statistics} propertyCount={comparables.length} />
      <PriceComparisonChart comparables={comparables} />
      <CMAMarketReview statistics={statistics} comparables={comparables} />
      <DaysOnMarketSection comparables={comparables} />
      <AveragePricePerSqftSection comparables={comparables} subjectProperty={subjectProperty} />
    </div>
  );
}
