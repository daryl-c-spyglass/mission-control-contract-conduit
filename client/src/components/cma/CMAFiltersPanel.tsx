import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SlidersHorizontal, RotateCcw, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface CMAFilters {
  radius: number;
  minPrice?: number;
  maxPrice?: number;
  minSqft?: number;
  maxSqft?: number;
  minYearBuilt?: number;
  maxYearBuilt?: number;
  minBeds?: number;
  maxBeds?: number;
  minBaths?: number;
  maxBaths?: number;
  statuses: string[];
  maxResults: number;
  soldWithinMonths?: number;
}

interface CMAFiltersPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: number | string;
  mlsNumber: string;
  currentFilters?: Partial<CMAFilters>;
  subjectProperty?: {
    listPrice?: number;
    sqft?: number;
    yearBuilt?: number;
    beds?: number;
    baths?: number;
  };
  onFiltersApplied: () => void;
}

const DEFAULT_FILTERS: CMAFilters = {
  radius: 2,
  statuses: ['Closed', 'Active', 'Active Under Contract', 'Pending'],
  maxResults: 10,
  soldWithinMonths: 6,
};

const RADIUS_OPTIONS = [
  { value: 0.5, label: '0.5 mi' },
  { value: 1, label: '1 mi' },
  { value: 2, label: '2 mi' },
  { value: 5, label: '5 mi' },
  { value: 10, label: '10 mi' },
];

const STATUS_OPTIONS = [
  { value: 'Closed', label: 'Closed' },
  { value: 'Active', label: 'Active' },
  { value: 'Active Under Contract', label: 'Active Under Contract' },
  { value: 'Pending', label: 'Pending' },
];

export function CMAFiltersPanel({
  open,
  onOpenChange,
  transactionId,
  mlsNumber,
  currentFilters,
  subjectProperty,
  onFiltersApplied,
}: CMAFiltersPanelProps) {
  const { toast } = useToast();
  
  const [filters, setFilters] = useState<CMAFilters>(() => ({
    ...DEFAULT_FILTERS,
    ...currentFilters,
  }));

  useEffect(() => {
    if (open && currentFilters) {
      setFilters({ ...DEFAULT_FILTERS, ...currentFilters });
    }
  }, [open, currentFilters]);

  const applyFiltersMutation = useMutation({
    mutationFn: async (newFilters: CMAFilters) => {
      const response = await fetch(`/api/transactions/${transactionId}/cma/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          mlsNumber,
          filters: newFilters,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refresh comparables');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Comparables updated',
        description: `Found ${data.comparablesCount} comparable properties.`,
      });
      onFiltersApplied();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleApplyFilters = () => {
    applyFiltersMutation.mutate(filters);
  };

  const handleResetToDefaults = () => {
    const smartDefaults: CMAFilters = {
      ...DEFAULT_FILTERS,
    };
    
    if (subjectProperty?.listPrice) {
      smartDefaults.minPrice = Math.round(subjectProperty.listPrice * 0.8);
      smartDefaults.maxPrice = Math.round(subjectProperty.listPrice * 1.2);
    }
    
    if (subjectProperty?.sqft) {
      smartDefaults.minSqft = Math.round(subjectProperty.sqft * 0.75);
      smartDefaults.maxSqft = Math.round(subjectProperty.sqft * 1.25);
    }
    
    if (subjectProperty?.yearBuilt) {
      smartDefaults.minYearBuilt = subjectProperty.yearBuilt - 10;
      smartDefaults.maxYearBuilt = new Date().getFullYear();
    }
    
    setFilters(smartDefaults);
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      statuses: checked
        ? [...prev.statuses, status]
        : prev.statuses.filter(s => s !== status),
    }));
  };

  const formatCurrency = (value: number | undefined) => {
    if (!value) return '';
    return value.toString();
  };

  const parseCurrency = (value: string) => {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''));
    return isNaN(parsed) ? undefined : parsed;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            Adjust CMA Filters
          </SheetTitle>
          <SheetDescription>
            Refine search criteria to find better comparable properties. Changes will re-fetch comparables from MLS.
          </SheetDescription>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Search Radius</Label>
            <RadioGroup
              value={filters.radius.toString()}
              onValueChange={(value) => setFilters(prev => ({ ...prev, radius: parseFloat(value) }))}
              className="flex flex-wrap gap-2"
            >
              {RADIUS_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center">
                  <RadioGroupItem
                    value={option.value.toString()}
                    id={`radius-${option.value}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`radius-${option.value}`}
                    className="px-3 py-2 rounded-md border cursor-pointer peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground peer-data-[state=checked]:border-primary hover:bg-muted transition-colors"
                    data-testid={`radio-radius-${option.value}`}
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Sold Within</Label>
            <Select
              value={filters.soldWithinMonths?.toString() || '6'}
              onValueChange={(value) => setFilters(prev => ({ ...prev, soldWithinMonths: parseInt(value) }))}
            >
              <SelectTrigger data-testid="select-sold-within">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="9">Last 9 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
                <SelectItem value="24">Last 24 months</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Price Range</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minPrice" className="text-sm text-muted-foreground">Min Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="minPrice"
                    type="text"
                    placeholder="No min"
                    className="pl-7"
                    value={formatCurrency(filters.minPrice)}
                    onChange={(e) => setFilters(prev => ({ ...prev, minPrice: parseCurrency(e.target.value) }))}
                    data-testid="input-min-price"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxPrice" className="text-sm text-muted-foreground">Max Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="maxPrice"
                    type="text"
                    placeholder="No max"
                    className="pl-7"
                    value={formatCurrency(filters.maxPrice)}
                    onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: parseCurrency(e.target.value) }))}
                    data-testid="input-max-price"
                  />
                </div>
              </div>
            </div>
            {subjectProperty?.listPrice && (
              <p className="text-xs text-muted-foreground">
                Subject property: ${subjectProperty.listPrice.toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Square Footage</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minSqft" className="text-sm text-muted-foreground">Min Sq Ft</Label>
                <Input
                  id="minSqft"
                  type="number"
                  placeholder="No min"
                  value={filters.minSqft || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, minSqft: e.target.value ? parseInt(e.target.value) : undefined }))}
                  data-testid="input-min-sqft"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxSqft" className="text-sm text-muted-foreground">Max Sq Ft</Label>
                <Input
                  id="maxSqft"
                  type="number"
                  placeholder="No max"
                  value={filters.maxSqft || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxSqft: e.target.value ? parseInt(e.target.value) : undefined }))}
                  data-testid="input-max-sqft"
                />
              </div>
            </div>
            {subjectProperty?.sqft && (
              <p className="text-xs text-muted-foreground">
                Subject property: {subjectProperty.sqft.toLocaleString()} sq ft
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Year Built</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minYearBuilt" className="text-sm text-muted-foreground">Min Year</Label>
                <Input
                  id="minYearBuilt"
                  type="number"
                  placeholder="e.g., 2000"
                  value={filters.minYearBuilt || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, minYearBuilt: e.target.value ? parseInt(e.target.value) : undefined }))}
                  data-testid="input-min-year"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxYearBuilt" className="text-sm text-muted-foreground">Max Year</Label>
                <Input
                  id="maxYearBuilt"
                  type="number"
                  placeholder="e.g., 2024"
                  value={filters.maxYearBuilt || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxYearBuilt: e.target.value ? parseInt(e.target.value) : undefined }))}
                  data-testid="input-max-year"
                />
              </div>
            </div>
            {subjectProperty?.yearBuilt && (
              <p className="text-xs text-muted-foreground">
                Subject property: Built {subjectProperty.yearBuilt}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Beds & Baths</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="minBeds" className="text-sm text-muted-foreground">Min Beds</Label>
                <Select
                  value={filters.minBeds?.toString() || ''}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, minBeds: value ? parseInt(value) : undefined }))}
                >
                  <SelectTrigger data-testid="select-min-beds">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {[1, 2, 3, 4, 5, 6].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}+</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="minBaths" className="text-sm text-muted-foreground">Min Baths</Label>
                <Select
                  value={filters.minBaths?.toString() || ''}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, minBaths: value ? parseInt(value) : undefined }))}
                >
                  <SelectTrigger data-testid="select-min-baths">
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any</SelectItem>
                    {[1, 2, 3, 4, 5].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num}+</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(subjectProperty?.beds || subjectProperty?.baths) && (
              <p className="text-xs text-muted-foreground">
                Subject property: {subjectProperty.beds} beds, {subjectProperty.baths} baths
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Property Status</Label>
            <div className="grid grid-cols-2 gap-2">
              {STATUS_OPTIONS.map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={filters.statuses.includes(status.value)}
                    onCheckedChange={(checked) => handleStatusChange(status.value, checked as boolean)}
                    data-testid={`checkbox-status-${status.value.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  <Label
                    htmlFor={`status-${status.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {status.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Maximum Results</Label>
            <Select
              value={filters.maxResults.toString()}
              onValueChange={(value) => setFilters(prev => ({ ...prev, maxResults: parseInt(value) }))}
            >
              <SelectTrigger data-testid="select-max-results">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 comparables</SelectItem>
                <SelectItem value="10">10 comparables</SelectItem>
                <SelectItem value="15">15 comparables</SelectItem>
                <SelectItem value="20">20 comparables</SelectItem>
                <SelectItem value="25">25 comparables</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleResetToDefaults}
            className="w-full sm:w-auto"
            data-testid="button-smart-defaults"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Smart Defaults
          </Button>
          <Button
            onClick={handleApplyFilters}
            disabled={applyFiltersMutation.isPending || filters.statuses.length === 0}
            className="w-full sm:w-auto"
            data-testid="button-apply-filters"
          >
            {applyFiltersMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              'Apply Filters'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
