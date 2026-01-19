import type { CmaAdjustmentRates, CmaCompAdjustmentOverrides } from '@shared/schema';
import { DEFAULT_ADJUSTMENT_RATES } from '@shared/cma-defaults';

export interface PropertyForAdjustment {
  listingId?: string;
  mlsNumber?: string;
  streetAddress?: string;
  address?: string;
  livingArea?: number;
  bedroomsTotal?: number;
  bathroomsTotal?: number;
  poolFeatures?: string | string[];
  garageSpaces?: number;
  yearBuilt?: number;
  lotSizeArea?: number;
  lotSizeSquareFeet?: number;
  listPrice?: number;
  closePrice?: number;
  soldPrice?: number;
}

export interface AdjustmentItem {
  name: string;
  value: number;
  description?: string;
}

export interface CompAdjustmentResult {
  compId: string;
  compAddress: string;
  salePrice: number;
  adjustments: AdjustmentItem[];
  totalAdjustment: number;
  adjustedPrice: number;
}

export function getPropertyId(property: PropertyForAdjustment): string {
  return property.listingId || property.mlsNumber || '';
}

export function hasPool(property: PropertyForAdjustment): boolean {
  if (!property.poolFeatures) return false;
  if (Array.isArray(property.poolFeatures)) {
    return property.poolFeatures.length > 0 && 
           !property.poolFeatures.every(f => f.toLowerCase() === 'none');
  }
  return property.poolFeatures.toLowerCase() !== 'none' && 
         property.poolFeatures.toLowerCase() !== '';
}

export function calculateAdjustments(
  subject: PropertyForAdjustment,
  comp: PropertyForAdjustment,
  rates: CmaAdjustmentRates = DEFAULT_ADJUSTMENT_RATES,
  overrides?: Partial<CmaCompAdjustmentOverrides>
): CompAdjustmentResult {
  const adjustments: AdjustmentItem[] = [];
  
  const subjectSqft = subject.livingArea || 0;
  const compSqft = comp.livingArea || 0;
  const sqftDiff = subjectSqft - compSqft;
  const sqftAdj = overrides?.sqft ?? sqftDiff * rates.sqftPerUnit;
  if (sqftAdj !== 0) {
    adjustments.push({ 
      name: "Sq Ft", 
      value: sqftAdj,
      description: `${sqftDiff > 0 ? '+' : ''}${sqftDiff} sqft @ $${rates.sqftPerUnit}/sqft`
    });
  }
  
  const subjectBeds = subject.bedroomsTotal || 0;
  const compBeds = comp.bedroomsTotal || 0;
  const bedDiff = subjectBeds - compBeds;
  const bedAdj = overrides?.bedrooms ?? bedDiff * rates.bedroomValue;
  if (bedAdj !== 0) {
    adjustments.push({ 
      name: "Beds", 
      value: bedAdj,
      description: `${bedDiff > 0 ? '+' : ''}${bedDiff} beds @ $${rates.bedroomValue.toLocaleString()}/bed`
    });
  }
  
  const subjectBaths = subject.bathroomsTotal || 0;
  const compBaths = comp.bathroomsTotal || 0;
  const bathDiff = subjectBaths - compBaths;
  const bathAdj = overrides?.bathrooms ?? bathDiff * rates.bathroomValue;
  if (bathAdj !== 0) {
    adjustments.push({ 
      name: "Baths", 
      value: bathAdj,
      description: `${bathDiff > 0 ? '+' : ''}${bathDiff} baths @ $${rates.bathroomValue.toLocaleString()}/bath`
    });
  }
  
  const subjectHasPool = hasPool(subject);
  const compHasPool = hasPool(comp);
  if (subjectHasPool !== compHasPool) {
    const poolAdj = overrides?.pool ?? (subjectHasPool ? rates.poolValue : -rates.poolValue);
    adjustments.push({ 
      name: "Pool", 
      value: poolAdj,
      description: subjectHasPool ? 'Subject has pool' : 'Comp has pool'
    });
  }
  
  const subjectGarage = subject.garageSpaces || 0;
  const compGarage = comp.garageSpaces || 0;
  const garageDiff = subjectGarage - compGarage;
  const garageAdj = overrides?.garage ?? garageDiff * rates.garagePerSpace;
  if (garageAdj !== 0) {
    adjustments.push({ 
      name: "Garage", 
      value: garageAdj,
      description: `${garageDiff > 0 ? '+' : ''}${garageDiff} spaces @ $${rates.garagePerSpace.toLocaleString()}/space`
    });
  }
  
  const subjectYear = subject.yearBuilt || 0;
  const compYear = comp.yearBuilt || 0;
  if (subjectYear > 0 && compYear > 0) {
    const yearDiff = subjectYear - compYear;
    const yearAdj = overrides?.yearBuilt ?? yearDiff * rates.yearBuiltPerYear;
    if (yearAdj !== 0) {
      adjustments.push({ 
        name: "Year Built", 
        value: yearAdj,
        description: `${yearDiff > 0 ? '+' : ''}${yearDiff} years @ $${rates.yearBuiltPerYear.toLocaleString()}/year`
      });
    }
  }
  
  const subjectLot = subject.lotSizeSquareFeet || subject.lotSizeArea || 0;
  const compLot = comp.lotSizeSquareFeet || comp.lotSizeArea || 0;
  const lotDiff = subjectLot - compLot;
  const lotAdj = overrides?.lotSize ?? lotDiff * rates.lotSizePerSqft;
  if (Math.abs(lotAdj) > 100) {
    adjustments.push({ 
      name: "Lot Size", 
      value: lotAdj,
      description: `${lotDiff > 0 ? '+' : ''}${lotDiff.toLocaleString()} sqft @ $${rates.lotSizePerSqft}/sqft`
    });
  }
  
  if (overrides?.custom) {
    for (const custom of overrides.custom) {
      adjustments.push({ name: custom.name, value: custom.value });
    }
  }
  
  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.value, 0);
  const salePrice = comp.closePrice || comp.soldPrice || comp.listPrice || 0;
  const adjustedPrice = salePrice + totalAdjustment;
  
  return {
    compId: getPropertyId(comp),
    compAddress: comp.streetAddress || comp.address || 'Unknown',
    salePrice,
    adjustments,
    totalAdjustment,
    adjustedPrice,
  };
}

export function calculateAllAdjustments(
  subject: PropertyForAdjustment,
  comparables: PropertyForAdjustment[],
  rates: CmaAdjustmentRates = DEFAULT_ADJUSTMENT_RATES,
  overridesMap: Record<string, CmaCompAdjustmentOverrides> = {}
): CompAdjustmentResult[] {
  return comparables.map(comp => {
    const compId = getPropertyId(comp);
    return calculateAdjustments(subject, comp, rates, overridesMap[compId]);
  });
}
