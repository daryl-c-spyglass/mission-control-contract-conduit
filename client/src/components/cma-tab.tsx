import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStatusBadgeStyle, getStatusLabel, getStatusColor } from "@/lib/utils/status-colors";
import { CMAMap } from "@/components/cma-map";
import type { Transaction, CMAComparable, Cma, PropertyStatistics, CmaStatMetric, Property } from "@shared/schema";
import { useLocation } from "wouter";
import { 
  Activity, 
  Share2, 
  Link2, 
  Copy, 
  Check, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Home,
  Square,
  Bed,
  Bath,
  MapPin,
  Calendar,
  BarChart3,
  Grid3X3,
  Map as MapIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Hash,
  Plus,
  Search,
  Table2,
  LayoutGrid,
  List,
  Menu
} from "lucide-react";

const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'closed', label: 'Closed' },
  { id: 'activeUnderContract', label: 'Active Under Contract' },
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
] as const;

type StatusFilterType = typeof STATUS_FILTERS[number]['id'];
type NormalizedStatusType = 'active' | 'closed' | 'activeUnderContract' | 'pending' | 'unknown';

function normalizeStatus(status: string | null | undefined): NormalizedStatusType {
  const lower = (status || '').toLowerCase().trim();
  if (!lower) {
    return 'unknown';
  }
  if (lower.includes('active under contract') || lower.includes('under contract')) {
    return 'activeUnderContract';
  }
  if (lower.includes('closed') || lower.includes('sold')) {
    return 'closed';
  }
  if (lower.includes('pending')) {
    return 'pending';
  }
  if (lower.includes('active')) {
    return 'active';
  }
  return 'unknown';
}

interface CMATabProps {
  transaction: Transaction;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return "N/A";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(date: string | Date | null): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function calculateStatistics(comparables: CMAComparable[]): PropertyStatistics | null {
  if (!comparables || comparables.length === 0) return null;
  
  const calculateMetric = (values: number[]): CmaStatMetric => {
    const filtered = values.filter(v => v != null && !isNaN(v));
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
  
  const prices = comparables.map(c => c.price);
  const sqfts = comparables.map(c => typeof c.sqft === 'number' ? c.sqft : parseFloat(c.sqft as string) || 0);
  const pricePerSqFts = comparables.map(c => {
    const sqft = typeof c.sqft === 'number' ? c.sqft : parseFloat(c.sqft as string) || 0;
    return sqft > 0 ? c.price / sqft : 0;
  }).filter(v => v > 0);
  const doms = comparables.map(c => c.daysOnMarket);
  const beds = comparables.map(c => c.bedrooms);
  const baths = comparables.map(c => c.bathrooms);
  
  return {
    price: calculateMetric(prices),
    livingArea: calculateMetric(sqfts),
    pricePerSqFt: calculateMetric(pricePerSqFts),
    daysOnMarket: calculateMetric(doms),
    bedrooms: calculateMetric(beds),
    bathrooms: calculateMetric(baths),
    lotSize: { range: { min: 0, max: 0 }, average: 0, median: 0 },
    acres: { range: { min: 0, max: 0 }, average: 0, median: 0 },
    yearBuilt: { range: { min: 0, max: 0 }, average: 0, median: 0 }
  };
}

function StatCard({ 
  title, 
  metric, 
  format = 'number',
  icon: Icon
}: { 
  title: string; 
  metric: CmaStatMetric; 
  format?: 'currency' | 'number' | 'decimal';
  icon: React.ElementType;
}) {
  const formatValue = (val: number) => {
    if (format === 'currency') return formatPrice(val);
    if (format === 'decimal') return val.toFixed(1);
    return Math.round(val).toLocaleString();
  };
  
  return (
    <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{title}</span>
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">{formatValue(metric.average)}</p>
          <p className="text-xs text-muted-foreground">
            Range: {formatValue(metric.range.min)} - {formatValue(metric.range.max)}
          </p>
          <p className="text-xs text-muted-foreground">
            Median: {formatValue(metric.median)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

type MainView = 'compare' | 'map' | 'stats' | 'list';
type SubView = 'grid' | 'list' | 'table';

const MAIN_VIEW_TABS = [
  { id: 'compare' as MainView, label: 'Compare', icon: BarChart3 },
  { id: 'map' as MainView, label: 'Map', icon: MapIcon },
  { id: 'stats' as MainView, label: 'Stats', icon: TrendingUp },
  { id: 'list' as MainView, label: 'List', icon: Home },
] as const;

export function CMATab({ transaction }: CMATabProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [mainView, setMainView] = useState<MainView>('compare');
  const [subView, setSubView] = useState<SubView>('table');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('all');
  const [selectedProperty, setSelectedProperty] = useState<CMAComparable | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [fullscreenPhoto, setFullscreenPhoto] = useState(false);
  
  const cmaData = transaction.cmaData as CMAComparable[] | null;
  
  const filteredComparables = useMemo(() => {
    if (!cmaData) return [];
    if (statusFilter === 'all') return cmaData;
    return cmaData.filter(comp => normalizeStatus(comp.status) === statusFilter);
  }, [cmaData, statusFilter]);
  
  const statistics = useMemo(() => calculateStatistics(filteredComparables), [filteredComparables]);
  
  const { data: savedCma } = useQuery<Cma | null>({
    queryKey: ['/api/transactions', transaction.id, 'cma'],
    enabled: !!transaction.id,
  });
  
  const createShareLinkMutation = useMutation({
    mutationFn: async () => {
      let cmaId = savedCma?.id;
      
      if (!cmaId) {
        const res = await apiRequest('POST', '/api/cmas', {
          name: `CMA for ${transaction.propertyAddress}`,
          transactionId: transaction.id,
          subjectPropertyId: transaction.mlsNumber,
          propertiesData: cmaData,
        });
        const newCma = await res.json() as Cma;
        cmaId = newCma.id;
      }
      
      const shareRes = await apiRequest('POST', `/api/cmas/${cmaId}/share`);
      const response = await shareRes.json() as { publicLink: string; expiresAt: string };
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/transactions', transaction.id, 'cma'] });
      toast({
        title: "Share link created",
        description: "The CMA can now be shared with clients."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create share link",
        variant: "destructive"
      });
    }
  });
  
  const copyShareLink = async () => {
    if (savedCma?.publicLink) {
      const url = `${window.location.origin}/shared/cma/${savedCma.publicLink}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Link copied",
        description: "Share link copied to clipboard"
      });
    }
  };
  
  const currentPhotos = selectedProperty?.photos || 
    (selectedProperty?.imageUrl ? [selectedProperty.imageUrl] : []);
  
  const handleCreateCMA = () => {
    const mlsData = transaction.mlsData as any;
    if (mlsData) {
      const normalizedSubject = {
        id: mlsData.mlsNumber || mlsData.id || '',
        mlsNumber: mlsData.mlsNumber || '',
        address: mlsData.address?.unparsedAddress || mlsData.address?.streetAddress || transaction.propertyAddress || '',
        city: mlsData.city || '',
        state: mlsData.stateOrProvince || mlsData.state || 'TX',
        postalCode: mlsData.postalCode || '',
        listPrice: mlsData.listPrice ? Number(mlsData.listPrice) : null,
        bedrooms: mlsData.bedrooms ? Number(mlsData.bedrooms) : null,
        bathrooms: mlsData.bathrooms ? Number(mlsData.bathrooms) : null,
        livingArea: mlsData.livingArea ? Number(mlsData.livingArea) : null,
        lotSizeAcres: mlsData.lotSizeAcres ? Number(mlsData.lotSizeAcres) : null,
        yearBuilt: mlsData.yearBuilt ? Number(mlsData.yearBuilt) : null,
        subdivisionName: mlsData.subdivisionName || '',
        standardStatus: mlsData.standardStatus || '',
        latitude: mlsData.latitude ? Number(mlsData.latitude) : null,
        longitude: mlsData.longitude ? Number(mlsData.longitude) : null,
        photos: mlsData.photos || [],
      };
      sessionStorage.setItem('cmaSubjectProperty', JSON.stringify(normalizedSubject));
      sessionStorage.setItem('cmaTransactionId', String(transaction.id));
    }
    setLocation('/cmas/new?fromTransaction=true');
  };

  if (!cmaData || cmaData.length === 0) {
    const mlsData = transaction.mlsData as any;
    const hasMLSData = !!mlsData && !!mlsData.listPrice;
    
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Comparative Market Analysis</h2>
        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-2">Create a CMA for this Property</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {hasMLSData 
                  ? "Use this property's details to find comparable listings and create a professional market analysis."
                  : "Once MLS data is available, you can create a comparative market analysis for this property."
                }
              </p>
              
              {hasMLSData && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
                  <p className="text-sm font-medium mb-2">Subject Property</p>
                  <p className="text-sm">{transaction.propertyAddress}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {mlsData.bedrooms && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-3 w-3" /> {mlsData.bedrooms} beds
                      </span>
                    )}
                    {mlsData.bathrooms && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-3 w-3" /> {mlsData.bathrooms} baths
                      </span>
                    )}
                    {mlsData.livingArea && (
                      <span className="flex items-center gap-1">
                        <Square className="h-3 w-3" /> {mlsData.livingArea.toLocaleString()} sqft
                      </span>
                    )}
                    {mlsData.listPrice && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" /> {formatPrice(mlsData.listPrice)}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              <Button 
                onClick={handleCreateCMA}
                disabled={!hasMLSData}
                data-testid="button-create-cma"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create CMA
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-0">
      {/* Dark Header Bar with Main View Tabs */}
      <div className="bg-zinc-800 dark:bg-zinc-900 px-4 py-3 flex items-center justify-between rounded-t-lg flex-wrap gap-3">
        <div className="flex items-center gap-2 text-white">
          <Menu className="w-5 h-5" />
          <span className="font-semibold">{filteredComparables.length} COMPARABLE HOMES</span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {MAIN_VIEW_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setMainView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium transition-colors ${
                  mainView === tab.id
                    ? 'bg-primary text-white'
                    : 'text-gray-300 hover:text-white hover:bg-zinc-700'
                }`}
                data-testid={`button-mainview-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShareDialogOpen(true)}
            className="border-zinc-600 text-white hover:bg-zinc-700"
            data-testid="button-share-cma"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
        </div>
      </div>
      
      {/* Status Filter Tabs - Only for Compare and List views */}
      {(mainView === 'compare' || mainView === 'list') && (
        <div className="flex gap-1 bg-zinc-700 dark:bg-zinc-800 p-2 overflow-x-auto">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-4 py-2 text-sm rounded transition-colors whitespace-nowrap ${
                statusFilter === filter.id
                  ? 'bg-white text-gray-900'
                  : 'text-gray-300 hover:text-white hover:bg-zinc-600'
              }`}
              data-testid={`button-filter-${filter.id}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}
      
      {/* Stats Summary Row - Only for Compare and List views */}
      {(mainView === 'compare' || mainView === 'list') && statistics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 bg-zinc-900 dark:bg-zinc-950 p-4 text-white">
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Low Price</div>
            <div className="text-lg sm:text-xl font-bold">{formatPrice(statistics.price.range.min)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">High Price</div>
            <div className="text-lg sm:text-xl font-bold">{formatPrice(statistics.price.range.max)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Avg Price</div>
            <div className="text-lg sm:text-xl font-bold">{formatPrice(Math.round(statistics.price.average))}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Median</div>
            <div className="text-lg sm:text-xl font-bold">{formatPrice(Math.round(statistics.price.median))}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Avg $/SqFt</div>
            <div className="text-lg sm:text-xl font-bold">${Math.round(statistics.pricePerSqFt.average)}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400 uppercase tracking-wide">Avg DOM</div>
            <div className="text-lg sm:text-xl font-bold">{Math.round(statistics.daysOnMarket.average)} Days</div>
          </div>
        </div>
      )}
      
      {/* Sub-View Toggle - Only for Compare and List views */}
      {(mainView === 'compare' || mainView === 'list') && (
        <div className="flex items-center gap-2 p-4 border-b bg-white dark:bg-zinc-900">
          <span className="text-sm text-muted-foreground">View:</span>
          <div className="flex rounded-lg overflow-hidden border">
            <button
              onClick={() => setSubView('grid')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${
                subView === 'grid' ? 'bg-primary text-white' : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
              data-testid="button-subview-grid"
            >
              <LayoutGrid className="w-4 h-4" />
              Grid
            </button>
            <button
              onClick={() => setSubView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l transition-colors ${
                subView === 'list' ? 'bg-primary text-white' : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
              data-testid="button-subview-list"
            >
              <List className="w-4 h-4" />
              List
            </button>
            <button
              onClick={() => setSubView('table')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-l transition-colors ${
                subView === 'table' ? 'bg-primary text-white' : 'bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700'
              }`}
              data-testid="button-subview-table"
            >
              <Table2 className="w-4 h-4" />
              Table
            </button>
          </div>
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="p-4 space-y-4">
        {/* MAP VIEW - No sub-views */}
        {mainView === 'map' && (
          <CMAMap
            properties={cmaData as unknown as Property[]}
            subjectProperty={transaction.mlsData as unknown as Property | null}
            onPropertyClick={(property) => {
              setSelectedProperty(property as unknown as CMAComparable);
              setPhotoIndex(0);
            }}
          />
        )}
        
        {/* STATS VIEW - No sub-views */}
        {mainView === 'stats' && statistics && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <StatCard 
              title="Avg Price" 
              metric={statistics.price} 
              format="currency"
              icon={DollarSign}
            />
            <StatCard 
              title="Price/SqFt" 
              metric={statistics.pricePerSqFt} 
              format="currency"
              icon={TrendingUp}
            />
            <StatCard 
              title="Days on Market" 
              metric={statistics.daysOnMarket} 
              format="number"
              icon={Clock}
            />
            <StatCard 
              title="Avg SqFt" 
              metric={statistics.livingArea} 
              format="number"
              icon={Square}
            />
            <StatCard 
              title="Avg Beds" 
              metric={statistics.bedrooms} 
              format="decimal"
              icon={Bed}
            />
            <StatCard 
              title="Avg Baths" 
              metric={statistics.bathrooms} 
              format="decimal"
              icon={Bath}
            />
          </div>
        )}
        
        {/* COMPARE and LIST VIEWS - With sub-views */}
        {(mainView === 'compare' || mainView === 'list') && (
          <>
            {/* Table Sub-View */}
            {subView === 'table' && (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="p-3 font-medium">Address</th>
                          <th className="p-3 font-medium">Status</th>
                          <th className="p-3 font-medium text-right">Price</th>
                          <th className="p-3 font-medium text-right">$/SqFt</th>
                          <th className="p-3 font-medium text-right">DOM</th>
                          <th className="p-3 font-medium text-center">Beds</th>
                          <th className="p-3 font-medium text-center">Baths</th>
                          <th className="p-3 font-medium text-right">SqFt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredComparables.map((comp, index) => {
                          const sqft = typeof comp.sqft === 'number' ? comp.sqft : parseFloat(comp.sqft as string) || 0;
                          const pricePerSqft = sqft > 0 ? comp.price / sqft : 0;
                          return (
                            <tr 
                              key={index} 
                              className="hover:bg-muted/50 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedProperty(comp);
                                setPhotoIndex(0);
                              }}
                              data-testid={`row-cma-${index}`}
                            >
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                                      normalizeStatus(comp.status) === 'active' ? 'bg-green-500' :
                                      normalizeStatus(comp.status) === 'closed' ? 'bg-red-500' :
                                      normalizeStatus(comp.status) === 'activeUnderContract' ? 'bg-orange-500' :
                                      normalizeStatus(comp.status) === 'pending' ? 'bg-blue-500' :
                                      normalizeStatus(comp.status) === 'unknown' ? 'bg-gray-400' :
                                      'bg-gray-500'
                                    }`}
                                  />
                                  <span className="truncate max-w-[200px]">{comp.address}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getStatusBadgeStyle(comp.status || '')}`}
                                >
                                  {getStatusLabel(comp.status || '')}
                                </Badge>
                              </td>
                              <td className="p-3 text-right font-medium">{formatPrice(comp.price)}</td>
                              <td className="p-3 text-right">{formatPrice(Math.round(pricePerSqft))}</td>
                              <td className="p-3 text-right">{comp.daysOnMarket ?? '-'}</td>
                              <td className="p-3 text-center">{comp.bedrooms}</td>
                              <td className="p-3 text-center">{comp.bathrooms}</td>
                              <td className="p-3 text-right">{sqft > 0 ? sqft.toLocaleString() : '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Grid Sub-View */}
            {subView === 'grid' && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredComparables.map((comp, index) => (
                  <Card 
                    key={index} 
                    className="cursor-pointer hover-elevate transition-all"
                    onClick={() => {
                      setSelectedProperty(comp);
                      setPhotoIndex(0);
                    }}
                    data-testid={`card-cma-${index}`}
                  >
                    {(comp.imageUrl || (comp.photos && comp.photos.length > 0)) && (
                      <div className="relative h-40 overflow-hidden rounded-t-lg">
                        <img
                          src={comp.photos?.[0] || comp.imageUrl}
                          alt={comp.address}
                          className="w-full h-full object-cover"
                        />
                        {comp.status && (
                          <Badge 
                            className={`absolute top-2 left-2 ${getStatusBadgeStyle(comp.status)}`}
                          >
                            {getStatusLabel(comp.status)}
                          </Badge>
                        )}
                      </div>
                    )}
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{comp.address}</p>
                          <p className="text-lg font-semibold">{formatPrice(comp.price)}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {comp.distance.toFixed(1)} mi
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Bed className="h-3.5 w-3.5" />
                          {comp.bedrooms}
                        </div>
                        <div className="flex items-center gap-1">
                          <Bath className="h-3.5 w-3.5" />
                          {comp.bathrooms}
                        </div>
                        <div className="flex items-center gap-1">
                          <Square className="h-3.5 w-3.5" />
                          {typeof comp.sqft === 'number' ? comp.sqft.toLocaleString() : comp.sqft}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {comp.daysOnMarket} days on market
                      </div>
                      {comp.mlsNumber && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Hash className="h-3 w-3" />
                          {comp.mlsNumber}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            
            {/* List Sub-View */}
            {subView === 'list' && (
              <div className="space-y-3">
                {filteredComparables.map((comp, index) => {
                  const sqft = typeof comp.sqft === 'number' ? comp.sqft : parseFloat(comp.sqft as string) || 0;
                  const pricePerSqft = sqft > 0 ? comp.price / sqft : 0;
                  return (
                    <Card 
                      key={index} 
                      className="cursor-pointer hover-elevate transition-all"
                      onClick={() => {
                        setSelectedProperty(comp);
                        setPhotoIndex(0);
                      }}
                      data-testid={`list-cma-${index}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {(comp.imageUrl || (comp.photos && comp.photos.length > 0)) && (
                            <div className="relative w-32 h-24 flex-shrink-0 overflow-hidden rounded-lg">
                              <img
                                src={comp.photos?.[0] || comp.imageUrl}
                                alt={comp.address}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                <p className="font-medium truncate">{comp.address}</p>
                                <p className="text-xl font-semibold">{formatPrice(comp.price)}</p>
                              </div>
                              <Badge className={getStatusBadgeStyle(comp.status || '')}>
                                {getStatusLabel(comp.status || '')}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5" />
                                {comp.bedrooms} beds
                              </div>
                              <div className="flex items-center gap-1">
                                <Bath className="h-3.5 w-3.5" />
                                {comp.bathrooms} baths
                              </div>
                              <div className="flex items-center gap-1">
                                <Square className="h-3.5 w-3.5" />
                                {sqft.toLocaleString()} sqft
                              </div>
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5" />
                                ${Math.round(pricePerSqft)}/sqft
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {comp.daysOnMarket} DOM
                              </div>
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {comp.distance.toFixed(1)} mi
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      
      <Dialog open={!!selectedProperty} onOpenChange={(open) => {
        if (!open) {
          setSelectedProperty(null);
          setPhotoIndex(0);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle>{selectedProperty?.address}</DialogTitle>
                {selectedProperty?.mlsNumber && (
                  <DialogDescription>
                    MLS# {selectedProperty.mlsNumber}
                  </DialogDescription>
                )}
              </div>
              <Badge variant="outline">
                {selectedProperty?.distance.toFixed(1)} mi away
              </Badge>
            </div>
          </DialogHeader>
          
          {selectedProperty && currentPhotos.length > 0 && (
            <div className="space-y-2">
              <div 
                className="relative aspect-video bg-muted rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setFullscreenPhoto(true)}
              >
                <img
                  src={currentPhotos[photoIndex]}
                  alt={selectedProperty.address}
                  className="w-full h-full object-cover"
                />
                {currentPhotos.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIndex(prev => prev === 0 ? currentPhotos.length - 1 : prev - 1);
                      }}
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoIndex(prev => prev === currentPhotos.length - 1 ? 0 : prev + 1);
                      }}
                    >
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {photoIndex + 1} / {currentPhotos.length}
                    </div>
                  </>
                )}
              </div>
              
              {currentPhotos.length > 1 && (
                <ScrollArea className="w-full">
                  <div className="flex gap-2 py-1">
                    {currentPhotos.slice(0, 8).map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setPhotoIndex(idx)}
                        className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden ${
                          idx === photoIndex ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`Photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
          
          {selectedProperty && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Price</p>
                <p className="text-xl font-semibold">{formatPrice(selectedProperty.price)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Price/SqFt</p>
                <p className="text-xl font-semibold">
                  {formatPrice(
                    selectedProperty.price / 
                    (typeof selectedProperty.sqft === 'number' 
                      ? selectedProperty.sqft 
                      : parseFloat(selectedProperty.sqft as string) || 1)
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bedrooms</p>
                <p className="font-medium">{selectedProperty.bedrooms}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bathrooms</p>
                <p className="font-medium">{selectedProperty.bathrooms}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Square Feet</p>
                <p className="font-medium">
                  {typeof selectedProperty.sqft === 'number' 
                    ? selectedProperty.sqft.toLocaleString() 
                    : selectedProperty.sqft}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days on Market</p>
                <p className="font-medium">{selectedProperty.daysOnMarket}</p>
              </div>
              {selectedProperty.status && (
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusBadgeStyle(selectedProperty.status)}>
                    {getStatusLabel(selectedProperty.status)}
                  </Badge>
                </div>
              )}
              {selectedProperty.listDate && (
                <div>
                  <p className="text-sm text-muted-foreground">List Date</p>
                  <p className="font-medium">{formatDate(selectedProperty.listDate)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share CMA Report</DialogTitle>
            <DialogDescription>
              Create a shareable link for your clients to view this CMA.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {savedCma?.publicLink ? (
              <div className="space-y-2">
                <Label>Share Link</Label>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`${window.location.origin}/shared/cma/${savedCma.publicLink}`}
                  />
                  <Button variant="outline" size="icon" onClick={copyShareLink}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {savedCma.expiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expires: {formatDate(savedCma.expiresAt)}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <Link2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground mb-4">
                  Generate a secure link to share this CMA with clients.
                </p>
                <Button 
                  onClick={() => createShareLinkMutation.mutate()}
                  disabled={createShareLinkMutation.isPending}
                  data-testid="button-generate-share-link"
                >
                  {createShareLinkMutation.isPending ? "Creating..." : "Create Share Link"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={fullscreenPhoto} onOpenChange={setFullscreenPhoto}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-50 text-white hover:bg-white/20"
            onClick={() => setFullscreenPhoto(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          
          {selectedProperty && currentPhotos.length > 0 && (
            <div className="relative w-full h-[90vh] flex items-center justify-center">
              <img
                src={currentPhotos[photoIndex]}
                alt={selectedProperty.address}
                className="max-w-full max-h-full object-contain"
              />
              {currentPhotos.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setPhotoIndex(prev => prev === 0 ? currentPhotos.length - 1 : prev - 1)}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => setPhotoIndex(prev => prev === currentPhotos.length - 1 ? 0 : prev + 1)}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-3 py-1.5 rounded">
                    {photoIndex + 1} / {currentPhotos.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
