import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CmaProperty } from '../types';

interface TimeToSellWidgetProps {
  comparables: CmaProperty[];
  averageDaysOnMarket: number;
  averageListPricePercent?: number;
}

export function TimeToSellWidget({ 
  comparables, 
  averageDaysOnMarket,
  averageListPricePercent = 89.07 
}: TimeToSellWidgetProps) {
  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('closed')) return 'bg-green-500';
    if (s.includes('active') && !s.includes('under')) return 'bg-red-500';
    if (s.includes('pending') || s.includes('under')) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(price);
  };

  const closedComps = comparables.filter(c => c.status.toLowerCase().includes('closed'));
  const activeComps = comparables.filter(c => c.status.toLowerCase() === 'active');
  const pendingComps = comparables.filter(c => 
    c.status.toLowerCase().includes('pending') || c.status.toLowerCase().includes('under')
  );

  return (
    <div className="flex flex-col h-full bg-background" data-testid="time-to-sell-widget">
      <div className="bg-gray-900 text-white py-3 px-4 text-center flex-shrink-0">
        <span className="font-bold tracking-wider text-sm uppercase">
          TIME TO SELL
        </span>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-center gap-8 flex-wrap">
            <div className="text-center">
              <span className="text-4xl font-bold text-[#F37216]">{averageDaysOnMarket}</span>
              <p className="text-sm text-muted-foreground mt-1">DAYS ON MARKET</p>
            </div>
            <div className="text-3xl text-muted-foreground">|</div>
            <div className="text-center">
              <span className="text-4xl font-bold text-[#F37216]">{averageListPricePercent.toFixed(2)}%</span>
              <p className="text-sm text-muted-foreground mt-1">OF LIST PRICE</p>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4 max-w-2xl mx-auto">
            Sold homes were on the market for an average of {averageDaysOnMarket} days before they accepted an offer. 
            These homes sold for an average of {averageListPricePercent.toFixed(2)}% of list price.
          </p>
        </div>

        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-72 border-r overflow-auto max-h-[400px]">
            {closedComps.length > 0 && (
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-sm font-medium">Closed ({closedComps.length})</span>
                </div>
                {closedComps.slice(0, 5).map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-muted-foreground">{comp.daysOnMarket} days</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {pendingComps.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="text-sm font-medium">Pending ({pendingComps.length})</span>
                </div>
                {pendingComps.slice(0, 3).map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-muted-foreground">{comp.daysOnMarket} days</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {activeComps.length > 0 && (
              <div className="p-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-sm font-medium">Active ({activeComps.length})</span>
                </div>
                {activeComps.slice(0, 3).map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-muted-foreground">{comp.daysOnMarket} days</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Price vs Days on Market Chart</p>
              <p className="text-sm">Scatter plot visualization coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
