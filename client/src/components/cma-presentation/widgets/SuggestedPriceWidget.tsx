import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { CmaProperty } from '../types';

interface SuggestedPriceWidgetProps {
  subjectProperty?: CmaProperty;
  comparables: CmaProperty[];
  suggestedPrice?: number;
}

export function SuggestedPriceWidget({ 
  subjectProperty, 
  comparables,
  suggestedPrice 
}: SuggestedPriceWidgetProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'sold' | 'active'>('all');

  const closedComps = comparables.filter(c => c.status.toLowerCase().includes('closed'));
  const activeComps = comparables.filter(c => c.status.toLowerCase() === 'active');

  const calculateSuggestedPrice = () => {
    if (suggestedPrice) return suggestedPrice;
    
    if (closedComps.length === 0 || !subjectProperty) return 0;
    
    const avgPricePerSqft = closedComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / closedComps.length;
    return avgPricePerSqft * (subjectProperty.sqft || 0);
  };

  const price = calculateSuggestedPrice();

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(amount);
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

  return (
    <div className="flex flex-col h-full bg-background" data-testid="suggested-price-widget">
      <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
        <span className="font-bold tracking-wider text-sm uppercase">
          SUGGESTED LIST PRICE
        </span>
      </div>
      
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {subjectProperty && (
            <div className="text-center">
              <p className="text-lg text-muted-foreground">{subjectProperty.address}</p>
              <p className="text-sm text-muted-foreground">
                {subjectProperty.city}, {subjectProperty.state} {subjectProperty.zipCode}
              </p>
            </div>
          )}

          <div className="text-center">
            <div className="inline-block bg-[#EF4923]/10 rounded-2xl px-12 py-8">
              <p className="text-5xl md:text-6xl font-bold text-[#EF4923]">
                {price > 0 ? formatPrice(price) : '$---'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">Suggested List Price</p>
            </div>
          </div>

          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="font-medium">Subject Property Map</p>
              <p className="text-sm">Mapbox integration coming soon</p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-center">Compare pricing with the comps</h3>
            
            <div className="flex justify-center gap-2">
              {(['all', 'sold', 'active'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={activeFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveFilter(filter)}
                  className="capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Average Price</p>
                <p className="text-2xl font-bold">{formatPrice(avgPrice)}</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Avg $/sq. ft.</p>
                <p className="text-2xl font-bold">${avgPricePerSqft.toFixed(0)}</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
