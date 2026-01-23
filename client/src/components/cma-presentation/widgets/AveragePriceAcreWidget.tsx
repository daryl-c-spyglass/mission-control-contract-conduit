import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CmaProperty } from '../types';

interface AveragePriceAcreWidgetProps {
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
  averagePricePerAcre?: number;
}

export function AveragePriceAcreWidget({ 
  comparables, 
  subjectProperty,
  averagePricePerAcre 
}: AveragePriceAcreWidgetProps) {
  const compsWithAcres = comparables.filter(c => c.acres && c.acres > 0);
  
  const calculatedAvg = compsWithAcres.length > 0
    ? compsWithAcres.reduce((sum, c) => sum + ((c.soldPrice || c.price) / (c.acres || 1)), 0) / compsWithAcres.length
    : 0;

  const avgPrice = averagePricePerAcre || calculatedAvg;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(price);
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('closed')) return 'bg-green-500';
    if (s.includes('active') && !s.includes('under')) return 'bg-red-500';
    if (s.includes('pending') || s.includes('under')) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  const closedComps = compsWithAcres.filter(c => c.status.toLowerCase().includes('closed'));
  const activeComps = compsWithAcres.filter(c => c.status.toLowerCase() === 'active');
  const pendingComps = compsWithAcres.filter(c => 
    c.status.toLowerCase().includes('pending') || c.status.toLowerCase().includes('under')
  );

  return (
    <div className="flex flex-col h-full bg-background" data-testid="average-price-acre-widget">
      <div className="flex-1 overflow-auto">
        <div className="p-6 border-b text-center">
          <p className="text-sm text-muted-foreground">
            Based on {compsWithAcres.length} comparable properties with acreage data
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
                {closedComps.map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-[#EF4923] font-medium">
                          {formatPrice((comp.soldPrice || comp.price) / (comp.acres || 1))}/acre
                        </p>
                        <p className="text-xs text-muted-foreground">{comp.acres?.toFixed(2)} acres</p>
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
                {pendingComps.map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-[#EF4923] font-medium">
                          {formatPrice((comp.soldPrice || comp.price) / (comp.acres || 1))}/acre
                        </p>
                        <p className="text-xs text-muted-foreground">{comp.acres?.toFixed(2)} acres</p>
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
                {activeComps.map((comp) => (
                  <Card key={comp.id} className="p-2 mb-2 cursor-pointer hover-elevate">
                    <div className="flex gap-2">
                      <div className="w-16 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                        {comp.photos?.[0] ? (
                          <img src={comp.photos[0]} alt="" className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.address}</p>
                        <p className="text-xs text-[#EF4923] font-medium">
                          {formatPrice((comp.soldPrice || comp.price) / (comp.acres || 1))}/acre
                        </p>
                        <p className="text-xs text-muted-foreground">{comp.acres?.toFixed(2)} acres</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Price vs Acres Chart</p>
              <p className="text-sm">Scatter plot visualization coming soon</p>
              {subjectProperty && (
                <div className="mt-4 p-4 bg-[#EF4923]/10 rounded-lg">
                  <p className="text-sm font-medium text-[#EF4923]">Subject Property</p>
                  <p className="text-xs">{subjectProperty.acres?.toFixed(2) || '---'} acres</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
