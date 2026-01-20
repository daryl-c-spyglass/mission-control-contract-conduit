import { Fragment } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, RotateCcw } from "lucide-react";
import type { CmaAdjustmentsData, CmaAdjustmentRates } from "@shared/schema";
import { DEFAULT_ADJUSTMENT_RATES } from "@shared/cma-defaults";

interface PropertyForAdjustment {
  mlsNumber?: string;
  address?: string;
  unparsedAddress?: string;
  sqft?: number | string;
  livingArea?: number;
  bedrooms?: number;
  bedroomsTotal?: number;
  bathrooms?: number;
  bathroomsTotalInteger?: number;
  pool?: string;
  hasPool?: boolean;
  poolFeatures?: string[];
  garage?: number;
  garageSpaces?: number;
  yearBuilt?: number | string;
  lotSize?: number;
  lotSizeSquareFeet?: number;
  listPrice?: number;
  soldPrice?: number;
  closePrice?: number;
}

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
  const rates = adjustments?.rates ?? DEFAULT_ADJUSTMENT_RATES;
  const compAdjustments = adjustments?.compAdjustments ?? {};

  const handleRateChange = (key: keyof CmaAdjustmentRates, value: number) => {
    onChange({
      enabled: true,
      rates: { ...rates, [key]: value },
      compAdjustments,
    });
  };

  const resetToDefaults = () => {
    onChange({
      enabled: true,
      rates: DEFAULT_ADJUSTMENT_RATES,
      compAdjustments,
    });
  };

  const getSqft = (p: PropertyForAdjustment) => {
    if (p.livingArea) return Number(p.livingArea);
    if (p.sqft) return Number(p.sqft);
    return 0;
  };

  const getBedrooms = (p: PropertyForAdjustment) => {
    return p.bedroomsTotal ?? p.bedrooms ?? 0;
  };

  const getBathrooms = (p: PropertyForAdjustment) => {
    return p.bathroomsTotalInteger ?? p.bathrooms ?? 0;
  };

  const hasPool = (p: PropertyForAdjustment) => {
    if (p.hasPool) return true;
    if (p.poolFeatures && p.poolFeatures.length > 0) return true;
    if (p.pool && p.pool.toLowerCase() !== 'none' && p.pool.toLowerCase() !== 'no') return true;
    return false;
  };

  const getGarageSpaces = (p: PropertyForAdjustment) => {
    return p.garageSpaces ?? p.garage ?? 0;
  };

  const getYearBuilt = (p: PropertyForAdjustment) => {
    return Number(p.yearBuilt) || 0;
  };

  const getLotSize = (p: PropertyForAdjustment) => {
    return p.lotSizeSquareFeet ?? p.lotSize ?? 0;
  };

  const getSalePrice = (p: PropertyForAdjustment) => {
    return p.closePrice ?? p.soldPrice ?? p.listPrice ?? 0;
  };

  const calculateAdjustments = (comp: PropertyForAdjustment) => {
    if (!subjectProperty) return { sqFt: 0, bedroom: 0, bathroom: 0, pool: 0, garage: 0, yearBuilt: 0, lotSize: 0, total: 0, adjustedPrice: 0 };

    const sqFtDiff = getSqft(subjectProperty) - getSqft(comp);
    const sqFtAdj = sqFtDiff * rates.sqftPerUnit;

    const bedDiff = getBedrooms(subjectProperty) - getBedrooms(comp);
    const bedAdj = bedDiff * rates.bedroomValue;

    const bathDiff = getBathrooms(subjectProperty) - getBathrooms(comp);
    const bathAdj = bathDiff * rates.bathroomValue;

    const subjectHasPool = hasPool(subjectProperty);
    const compHasPool = hasPool(comp);
    let poolAdj = 0;
    if (subjectHasPool && !compHasPool) poolAdj = rates.poolValue;
    else if (!subjectHasPool && compHasPool) poolAdj = -rates.poolValue;

    const garageDiff = getGarageSpaces(subjectProperty) - getGarageSpaces(comp);
    const garageAdj = garageDiff * rates.garagePerSpace;

    const yearDiff = getYearBuilt(subjectProperty) - getYearBuilt(comp);
    const yearAdj = yearDiff * rates.yearBuiltPerYear;

    const lotDiff = getLotSize(subjectProperty) - getLotSize(comp);
    const lotAdj = lotDiff * rates.lotSizePerSqft;

    const total = sqFtAdj + bedAdj + bathAdj + poolAdj + garageAdj + yearAdj + lotAdj;
    const salePrice = getSalePrice(comp);
    const adjustedPrice = salePrice + total;

    return { sqFt: sqFtAdj, bedroom: bedAdj, bathroom: bathAdj, pool: poolAdj, garage: garageAdj, yearBuilt: yearAdj, lotSize: lotAdj, total, adjustedPrice };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatAdjustment = (value: number) => {
    if (value === 0) return <span className="text-muted-foreground">—</span>;
    const formatted = formatCurrency(Math.abs(value));
    if (value > 0) {
      return <span className="text-green-600">+{formatted}</span>;
    }
    return <span className="text-red-600">-{formatted}</span>;
  };

  const getCompAddress = (comp: PropertyForAdjustment) => {
    const addr = comp.unparsedAddress || comp.address || '';
    return addr.split(',')[0] || 'Unknown';
  };

  const displayComps = comparables.slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Property Value Adjustments</CardTitle>
        <CardDescription>Configure adjustment rates to compare property values between subject and comparables</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">Adjustment Rates</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetToDefaults}
              className="text-muted-foreground hover:text-foreground gap-1"
              data-testid="button-reset-rates"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Defaults
            </Button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Sq Ft ($/sqft)</Label>
              <Input
                type="number"
                value={rates.sqftPerUnit}
                onChange={(e) => handleRateChange('sqftPerUnit', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-sqft"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bedroom ($)</Label>
              <Input
                type="number"
                value={rates.bedroomValue}
                onChange={(e) => handleRateChange('bedroomValue', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-bedroom"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Bathroom ($)</Label>
              <Input
                type="number"
                value={rates.bathroomValue}
                onChange={(e) => handleRateChange('bathroomValue', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-bathroom"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pool ($)</Label>
              <Input
                type="number"
                value={rates.poolValue}
                onChange={(e) => handleRateChange('poolValue', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-pool"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Garage ($)</Label>
              <Input
                type="number"
                value={rates.garagePerSpace}
                onChange={(e) => handleRateChange('garagePerSpace', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-garage"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Year Built ($/yr)</Label>
              <Input
                type="number"
                value={rates.yearBuiltPerYear}
                onChange={(e) => handleRateChange('yearBuiltPerYear', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-year"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Lot Size ($/sqft)</Label>
              <Input
                type="number"
                value={rates.lotSizePerSqft}
                onChange={(e) => handleRateChange('lotSizePerSqft', Number(e.target.value))}
                className="mt-1"
                data-testid="input-rate-lot"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-4">Adjustments Comparison</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-2 px-2 font-medium text-muted-foreground">
                    Subject
                    <div className="text-xs font-normal">Value</div>
                  </th>
                  {displayComps.map((comp, idx) => (
                    <th key={comp.mlsNumber || idx} className="text-center py-2 px-2 font-medium text-muted-foreground" colSpan={2}>
                      {getCompAddress(comp)}
                      <div className="flex text-xs font-normal">
                        <span className="flex-1">Value</span>
                        <span className="flex-1">Adj</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Sale Price</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                  {displayComps.map((comp, idx) => (
                    <Fragment key={comp.mlsNumber || idx}>
                      <td className="py-2 px-2 text-center">{formatCurrency(getSalePrice(comp))}</td>
                      <td className="py-2 px-2 text-center"></td>
                    </Fragment>
                  ))}
                </tr>
                
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Square Feet</td>
                  <td className="py-2 px-2 text-center">{getSqft(subjectProperty || {}).toLocaleString() || '—'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{getSqft(comp).toLocaleString() || '—'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.sqFt)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
                
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Bedrooms</td>
                  <td className="py-2 px-2 text-center">{getBedrooms(subjectProperty || {}) || '—'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{getBedrooms(comp) || '—'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.bedroom)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
                
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Bathrooms</td>
                  <td className="py-2 px-2 text-center">{getBathrooms(subjectProperty || {}) || '—'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{getBathrooms(comp) || '—'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.bathroom)}</td>
                      </Fragment>
                    );
                  })}
                </tr>

                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Pool</td>
                  <td className="py-2 px-2 text-center">{hasPool(subjectProperty || {}) ? 'Yes' : 'No'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{hasPool(comp) ? 'Yes' : 'No'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.pool)}</td>
                      </Fragment>
                    );
                  })}
                </tr>

                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Garage</td>
                  <td className="py-2 px-2 text-center">{getGarageSpaces(subjectProperty || {}) || '—'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{getGarageSpaces(comp) || '—'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.garage)}</td>
                      </Fragment>
                    );
                  })}
                </tr>

                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4">Year Built</td>
                  <td className="py-2 px-2 text-center">{getYearBuilt(subjectProperty || {}) || '—'}</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center">{getYearBuilt(comp) || '—'}</td>
                        <td className="py-2 px-2 text-center">{formatAdjustment(adj.yearBuilt)}</td>
                      </Fragment>
                    );
                  })}
                </tr>
                
                <tr className="border-b bg-muted/50">
                  <td className="py-2 pr-4 font-medium">Total Adjustment</td>
                  <td className="py-2 px-2 text-center text-muted-foreground">—</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-2 px-2 text-center" colSpan={2}>
                          {formatAdjustment(adj.total)}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
                
                <tr className="bg-muted">
                  <td className="py-3 pr-4 font-semibold">ADJUSTED PRICE</td>
                  <td className="py-3 px-2 text-center text-muted-foreground">—</td>
                  {displayComps.map((comp, idx) => {
                    const adj = calculateAdjustments(comp);
                    return (
                      <Fragment key={comp.mlsNumber || idx}>
                        <td className="py-3 px-2 text-center font-semibold" colSpan={2}>
                          {formatCurrency(adj.adjustedPrice)}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-muted-foreground">
            <span className="text-green-600">Positive adjustments</span> indicate the comparable is inferior to the subject.{' '}
            <span className="text-red-600">Negative adjustments</span> indicate the comparable is superior.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
