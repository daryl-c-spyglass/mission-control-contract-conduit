export const PROPERTY_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'residential_income', label: 'Residential Income' },
  { value: 'residential_investment', label: 'Residential Investment' },
  { value: 'residential_lease', label: 'Residential Lease' },
  { value: 'commercial_sale', label: 'Commercial Sale' },
  { value: 'farm_and_ranch', label: 'Farm and Ranch' },
  { value: 'land_lot', label: 'Land/Lot' },
] as const;

export type PropertyType = typeof PROPERTY_TYPES[number]['value'];
