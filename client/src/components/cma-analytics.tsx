import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, TrendingUp, Clock, 
  Home, Ruler, ArrowUpRight, ArrowDownRight 
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Property, PropertyStatistics } from "@shared/schema";

interface CMAAnalyticsProps {
  statistics: PropertyStatistics;
  subjectProperty?: Property | null;
  comparableCount: number;
  variant?: 'full' | 'compact';
}

export function CMAAnalytics({ 
  statistics, 
  subjectProperty, 
  comparableCount,
  variant = 'full' 
}: CMAAnalyticsProps) {
  
  const subjectAny = subjectProperty as any;
  const subjectPrice = subjectAny?.listPrice || 0;
  const subjectSqft = subjectAny?.sqft || subjectAny?.livingArea || subjectAny?.details?.sqft || 0;
  const subjectPricePerSqft = subjectSqft > 0 ? subjectPrice / subjectSqft : 0;
  
  const priceVsMarket = statistics.price.average > 0 
    ? ((subjectPrice - statistics.price.average) / statistics.price.average) * 100 
    : 0;
  
  const pricePerSqftVsMarket = statistics.pricePerSqFt.average > 0
    ? ((subjectPricePerSqft - statistics.pricePerSqFt.average) / statistics.pricePerSqFt.average) * 100
    : 0;

  if (variant === 'compact') {
    return (
      <div data-testid="cma-analytics-compact" className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{comparableCount} comps</Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CompactStatCard
            label="Avg Price"
            value={`$${Math.round(statistics.price.average).toLocaleString()}`}
            comparison={subjectPrice > 0 ? priceVsMarket : undefined}
            subjectValue={subjectPrice > 0 ? `Your: $${subjectPrice.toLocaleString()}` : undefined}
          />
          <CompactStatCard
            label="Avg $/SqFt"
            value={`$${Math.round(statistics.pricePerSqFt.average)}`}
            comparison={subjectPricePerSqft > 0 ? pricePerSqftVsMarket : undefined}
            subjectValue={subjectPricePerSqft > 0 ? `Your: $${Math.round(subjectPricePerSqft)}` : undefined}
          />
          <CompactStatCard
            label="Avg DOM"
            value={`${Math.round(statistics.daysOnMarket.average)} days`}
          />
          <CompactStatCard
            label="Price Range"
            value={`$${(statistics.price.range.min / 1000).toFixed(0)}K - $${(statistics.price.range.max / 1000).toFixed(0)}K`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="cma-analytics-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Average Price"
          value={`$${Math.round(statistics.price.average).toLocaleString()}`}
          subtitle={`Median: $${Math.round(statistics.price.median).toLocaleString()}`}
          range={`$${statistics.price.range.min.toLocaleString()} - $${statistics.price.range.max.toLocaleString()}`}
        />
        <StatCard
          icon={Ruler}
          label="Avg Price/SqFt"
          value={`$${Math.round(statistics.pricePerSqFt.average)}`}
          subtitle={`Median: $${Math.round(statistics.pricePerSqFt.median)}`}
          range={`$${Math.round(statistics.pricePerSqFt.range.min)} - $${Math.round(statistics.pricePerSqFt.range.max)}`}
        />
        <StatCard
          icon={Clock}
          label="Avg Days on Market"
          value={Math.round(statistics.daysOnMarket.average).toString()}
          subtitle={`Median: ${Math.round(statistics.daysOnMarket.median)}`}
          range={`${statistics.daysOnMarket.range.min} - ${statistics.daysOnMarket.range.max} days`}
        />
        <StatCard
          icon={Home}
          label="Avg Square Feet"
          value={Math.round(statistics.livingArea.average).toLocaleString()}
          subtitle={`Median: ${Math.round(statistics.livingArea.median).toLocaleString()}`}
          range={`${statistics.livingArea.range.min.toLocaleString()} - ${statistics.livingArea.range.max.toLocaleString()}`}
        />
      </div>

      {subjectProperty && subjectPrice > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold mb-4">Your Listing vs Market</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ComparisonRow
                label="List Price"
                subjectValue={`$${subjectPrice.toLocaleString()}`}
                marketValue={`$${Math.round(statistics.price.average).toLocaleString()}`}
                percentDiff={priceVsMarket}
              />
              <ComparisonRow
                label="Price/SqFt"
                subjectValue={subjectPricePerSqft > 0 ? `$${Math.round(subjectPricePerSqft)}` : 'N/A'}
                marketValue={`$${Math.round(statistics.pricePerSqFt.average)}`}
                percentDiff={subjectPricePerSqft > 0 ? pricePerSqftVsMarket : 0}
              />
              <ComparisonRow
                label="Square Feet"
                subjectValue={subjectSqft > 0 ? subjectSqft.toLocaleString() : 'N/A'}
                marketValue={Math.round(statistics.livingArea.average).toLocaleString()}
                percentDiff={statistics.livingArea.average > 0 && subjectSqft > 0
                  ? ((subjectSqft - statistics.livingArea.average) / statistics.livingArea.average) * 100 
                  : 0}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <MiniStatCard
          label="Avg Bedrooms"
          value={statistics.bedrooms.average.toFixed(1)}
        />
        <MiniStatCard
          label="Avg Bathrooms"
          value={statistics.bathrooms.average.toFixed(1)}
        />
        <MiniStatCard
          label="Avg Year Built"
          value={Math.round(statistics.yearBuilt.average).toString()}
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle: string;
  range: string;
}

function StatCard({ icon: Icon, label, value, subtitle, range }: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          <span className="text-sm">{label}</span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{range}</p>
      </CardContent>
    </Card>
  );
}

interface CompactStatCardProps {
  label: string;
  value: string;
  comparison?: number;
  subjectValue?: string;
}

function CompactStatCard({ label, value, comparison, subjectValue }: CompactStatCardProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {comparison !== undefined && comparison !== 0 && (
        <div className={cn(
          "flex items-center gap-1 text-xs",
          comparison > 0 ? "text-red-500" : "text-green-500"
        )}>
          {comparison > 0 ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          <span>{Math.abs(comparison).toFixed(1)}% vs market</span>
        </div>
      )}
      {subjectValue && (
        <p className="text-xs text-muted-foreground">{subjectValue}</p>
      )}
    </div>
  );
}

interface ComparisonRowProps {
  label: string;
  subjectValue: string;
  marketValue: string;
  percentDiff: number;
}

function ComparisonRow({ label, subjectValue, marketValue, percentDiff }: ComparisonRowProps) {
  const isAboveMarket = percentDiff > 0;
  
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{subjectValue}</span>
        {percentDiff !== 0 && (
          <Badge 
            variant="secondary" 
            className={cn(
              "text-xs",
              isAboveMarket ? "text-red-600" : "text-green-600"
            )}
          >
            {isAboveMarket ? '+' : ''}{percentDiff.toFixed(1)}%
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">Market avg: {marketValue}</span>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-3 text-center">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
