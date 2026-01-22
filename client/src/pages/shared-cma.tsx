import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getStatusBadgeStyle, getStatusLabel } from "@/lib/utils/status-colors";
import type { Cma, CMAComparable } from "@shared/schema";
import { 
  Home,
  DollarSign, 
  Clock, 
  Bed, 
  Bath, 
  Square,
  MapPin,
  Hash,
  Calendar,
  AlertCircle
} from "lucide-react";

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

function calculateStats(comparables: CMAComparable[]) {
  if (!comparables || comparables.length === 0) return null;
  
  const prices = comparables.map(c => c.price).filter(p => p != null);
  const sqfts = comparables.map(c => typeof c.sqft === 'number' ? c.sqft : parseFloat(c.sqft as string) || 0).filter(s => s > 0);
  const doms = comparables.map(c => c.daysOnMarket).filter(d => d != null);
  
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const avgSqft = sqfts.length ? sqfts.reduce((a, b) => a + b, 0) / sqfts.length : 0;
  const avgPricePerSqft = avgSqft > 0 ? avgPrice / avgSqft : 0;
  const avgDom = doms.length ? doms.reduce((a, b) => a + b, 0) / doms.length : 0;
  
  return { avgPrice, avgSqft, avgPricePerSqft, avgDom };
}

export default function SharedCMAPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  
  const { data: cma, isLoading, error } = useQuery<Cma>({
    queryKey: ['/api/shared/cma', token],
    enabled: !!token,
  });
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-12 w-1/2" />
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !cma) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">CMA Not Found</h2>
            <p className="text-muted-foreground">
              This CMA link may have expired or is no longer available.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const comparables = (cma.propertiesData || []) as CMAComparable[];
  const stats = calculateStats(comparables);
  
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Home className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">{cma.name}</h1>
              <p className="text-sm text-muted-foreground">
                Comparative Market Analysis
              </p>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {stats && (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg Price</span>
                </div>
                <p className="text-lg font-semibold">{formatPrice(stats.avgPrice)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg $/SqFt</span>
                </div>
                <p className="text-lg font-semibold">{formatPrice(stats.avgPricePerSqft)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Square className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg SqFt</span>
                </div>
                <p className="text-lg font-semibold">{Math.round(stats.avgSqft).toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg DOM</span>
                </div>
                <p className="text-lg font-semibold">{Math.round(stats.avgDom)} days</p>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Comparable Properties ({comparables.length})
          </h2>
          
          {comparables.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {comparables.map((comp, index) => (
                <Card key={index} data-testid={`card-shared-cma-${index}`}>
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
                    {/* Row 1: Distance Badge */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {comp.distance.toFixed(1)} mi
                      </Badge>
                    </div>
                    
                    {/* Row 2: Address */}
                    <p className="font-medium text-sm truncate">{comp.address}</p>
                    
                    {/* Row 3: Price */}
                    <p className="text-lg font-semibold">{formatPrice(comp.price)}</p>
                    
                    {/* Row 4: Property Stats */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
                        {typeof comp.sqft === 'number' ? comp.sqft.toLocaleString() : comp.sqft} sqft
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
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MapPin className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No comparable properties available.</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        {cma.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cma.notes}</p>
            </CardContent>
          </Card>
        )}
        
        <footer className="text-center text-xs text-muted-foreground pt-8 pb-4">
          <p>Generated on {formatDate(cma.createdAt)}</p>
          {cma.expiresAt && (
            <p>This link expires on {formatDate(cma.expiresAt)}</p>
          )}
        </footer>
      </main>
    </div>
  );
}
