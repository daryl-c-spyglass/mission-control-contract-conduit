import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Settings2 } from "lucide-react";
import type { CmaAdjustmentsData, CmaAdjustmentRates } from "@shared/schema";
import { DEFAULT_ADJUSTMENT_RATES } from "@shared/cma-defaults";
import { calculateAllAdjustments, type PropertyForAdjustment, type CompAdjustmentResult } from "@/lib/adjustmentCalculations";

interface AdjustmentsSectionProps {
  adjustments: CmaAdjustmentsData | null;
  onChange: (adjustments: CmaAdjustmentsData) => void;
  subjectProperty?: PropertyForAdjustment;
  comparables?: PropertyForAdjustment[];
}

export function AdjustmentsSection({
  adjustments,
  onChange,
  subjectProperty,
  comparables = [],
}: AdjustmentsSectionProps) {
  const [isRatesOpen, setIsRatesOpen] = useState(false);

  const enabled = adjustments?.enabled ?? false;
  const rates = adjustments?.rates ?? DEFAULT_ADJUSTMENT_RATES;
  const compAdjustments = adjustments?.compAdjustments ?? {};

  const handleToggle = (checked: boolean) => {
    onChange({
      enabled: checked,
      rates: rates,
      compAdjustments: compAdjustments,
    });
  };

  const handleRateChange = (key: keyof CmaAdjustmentRates, value: number) => {
    onChange({
      enabled,
      rates: { ...rates, [key]: value },
      compAdjustments,
    });
  };

  const calculatedAdjustments: CompAdjustmentResult[] = subjectProperty && enabled
    ? calculateAllAdjustments(subjectProperty, comparables, rates, compAdjustments)
    : [];

  const formatCurrency = (value: number) => {
    const prefix = value >= 0 ? '+' : '';
    return prefix + '$' + Math.abs(value).toLocaleString();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Property Adjustments</CardTitle>
            <CardDescription>Calculate adjusted values based on property differences</CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            data-testid="switch-enable-adjustments"
          />
        </div>
      </CardHeader>
      
      {enabled && (
        <CardContent className="space-y-4">
          <Collapsible open={isRatesOpen} onOpenChange={setIsRatesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between gap-2" data-testid="button-toggle-rates">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" />
                  Adjustment Rates
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${isRatesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sqftRate">$/Sq Ft</Label>
                  <Input
                    id="sqftRate"
                    type="number"
                    value={rates.sqftPerUnit}
                    onChange={(e) => handleRateChange('sqftPerUnit', Number(e.target.value))}
                    data-testid="input-rate-sqft"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedroomRate">$/Bedroom</Label>
                  <Input
                    id="bedroomRate"
                    type="number"
                    value={rates.bedroomValue}
                    onChange={(e) => handleRateChange('bedroomValue', Number(e.target.value))}
                    data-testid="input-rate-bedroom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathroomRate">$/Bathroom</Label>
                  <Input
                    id="bathroomRate"
                    type="number"
                    value={rates.bathroomValue}
                    onChange={(e) => handleRateChange('bathroomValue', Number(e.target.value))}
                    data-testid="input-rate-bathroom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="poolRate">Pool Value</Label>
                  <Input
                    id="poolRate"
                    type="number"
                    value={rates.poolValue}
                    onChange={(e) => handleRateChange('poolValue', Number(e.target.value))}
                    data-testid="input-rate-pool"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garageRate">$/Garage Space</Label>
                  <Input
                    id="garageRate"
                    type="number"
                    value={rates.garagePerSpace}
                    onChange={(e) => handleRateChange('garagePerSpace', Number(e.target.value))}
                    data-testid="input-rate-garage"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearRate">$/Year Built Diff</Label>
                  <Input
                    id="yearRate"
                    type="number"
                    value={rates.yearBuiltPerYear}
                    onChange={(e) => handleRateChange('yearBuiltPerYear', Number(e.target.value))}
                    data-testid="input-rate-year"
                  />
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {calculatedAdjustments.length > 0 && (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead className="text-right">Sale Price</TableHead>
                    <TableHead className="text-right">Adjustment</TableHead>
                    <TableHead className="text-right">Adjusted Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculatedAdjustments.map((result) => (
                    <TableRow key={result.compId}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {result.compAddress}
                      </TableCell>
                      <TableCell className="text-right">
                        ${result.salePrice.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right ${result.totalAdjustment >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(result.totalAdjustment)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${result.adjustedPrice.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
