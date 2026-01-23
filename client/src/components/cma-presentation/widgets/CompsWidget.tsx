import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CmaProperty } from '../types';

interface CompsWidgetProps {
  comparables: CmaProperty[];
  subjectProperty?: CmaProperty;
}

export function CompsWidget({ comparables, subjectProperty }: CompsWidgetProps) {
  const [activeTab, setActiveTab] = useState('compare');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredComps = comparables.filter(comp => {
    if (statusFilter === 'all') return true;
    return comp.status.toLowerCase().includes(statusFilter.toLowerCase());
  });

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

  return (
    <div className="flex flex-col h-full bg-background" data-testid="comps-widget">
      <div className="flex items-center justify-end p-3 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="compare" className="text-xs">Compare</TabsTrigger>
            <TabsTrigger value="map" className="text-xs">Map</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'compare' && (
          <div className="p-4">
            <div className="flex gap-4 overflow-x-auto pb-4">
              {subjectProperty && (
                <Card className="min-w-[280px] flex-shrink-0 border-2 border-[#EF4923]">
                  <div className="p-4">
                    <Badge className="bg-[#EF4923] text-white mb-2">Subject</Badge>
                    <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                      {subjectProperty.photos?.[0] ? (
                        <img 
                          src={subjectProperty.photos[0]} 
                          alt={subjectProperty.address}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No Photo
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-sm">{subjectProperty.address}</h4>
                    <p className="text-xs text-muted-foreground">
                      {subjectProperty.city}, {subjectProperty.state}
                    </p>
                    <p className="text-lg font-bold mt-2">{formatPrice(subjectProperty.price)}</p>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{subjectProperty.beds} bd</span>
                      <span>{subjectProperty.baths} ba</span>
                      <span>{subjectProperty.sqft.toLocaleString()} sqft</span>
                    </div>
                  </div>
                </Card>
              )}
              
              {filteredComps.map((comp) => (
                <Card key={comp.id} className="min-w-[280px] flex-shrink-0">
                  <div className="p-4">
                    <Badge className={`${getStatusColor(comp.status)} text-white mb-2`}>
                      {comp.status}
                    </Badge>
                    <div className="aspect-video bg-muted rounded-lg mb-3 overflow-hidden">
                      {comp.photos?.[0] ? (
                        <img 
                          src={comp.photos[0]} 
                          alt={comp.address}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          No Photo
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-sm">{comp.address}</h4>
                    <p className="text-xs text-muted-foreground">
                      {comp.city}, {comp.state}
                    </p>
                    <p className="text-lg font-bold mt-2">
                      {formatPrice(comp.soldPrice || comp.price)}
                    </p>
                    <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                      <span>{comp.beds} bd</span>
                      <span>{comp.baths} ba</span>
                      <span>{comp.sqft.toLocaleString()} sqft</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ${comp.pricePerSqft.toFixed(0)}/sqft
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="p-4 h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Map View</p>
              <p className="text-sm">Mapbox integration coming soon</p>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="p-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'closed', 'active', 'pending'].map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(filter)}
                  className="capitalize"
                >
                  {filter}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Low Price</p>
                <p className="font-bold">
                  {formatPrice(Math.min(...filteredComps.map(c => c.soldPrice || c.price)))}
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">High Price</p>
                <p className="font-bold">
                  {formatPrice(Math.max(...filteredComps.map(c => c.soldPrice || c.price)))}
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg Price</p>
                <p className="font-bold">
                  {formatPrice(
                    filteredComps.reduce((sum, c) => sum + (c.soldPrice || c.price), 0) / filteredComps.length || 0
                  )}
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Median</p>
                <p className="font-bold">
                  {formatPrice(
                    filteredComps.length > 0 
                      ? [...filteredComps].sort((a, b) => (a.soldPrice || a.price) - (b.soldPrice || b.price))[Math.floor(filteredComps.length / 2)]?.soldPrice || 0
                      : 0
                  )}
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg $/SqFt</p>
                <p className="font-bold">
                  ${(filteredComps.reduce((sum, c) => sum + c.pricePerSqft, 0) / filteredComps.length || 0).toFixed(0)}
                </p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Avg DOM</p>
                <p className="font-bold">
                  {Math.round(filteredComps.reduce((sum, c) => sum + c.daysOnMarket, 0) / filteredComps.length || 0)}
                </p>
              </Card>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Address</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">$/SqFt</th>
                    <th className="text-center p-2">Beds</th>
                    <th className="text-center p-2">Baths</th>
                    <th className="text-right p-2">SqFt</th>
                    <th className="text-right p-2">DOM</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredComps.map((comp) => (
                    <tr key={comp.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">{comp.address}</td>
                      <td className="p-2">
                        <Badge className={`${getStatusColor(comp.status)} text-white text-xs`}>
                          {comp.status}
                        </Badge>
                      </td>
                      <td className="text-right p-2">{formatPrice(comp.soldPrice || comp.price)}</td>
                      <td className="text-right p-2">${comp.pricePerSqft.toFixed(0)}</td>
                      <td className="text-center p-2">{comp.beds}</td>
                      <td className="text-center p-2">{comp.baths}</td>
                      <td className="text-right p-2">{comp.sqft.toLocaleString()}</td>
                      <td className="text-right p-2">{comp.daysOnMarket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
