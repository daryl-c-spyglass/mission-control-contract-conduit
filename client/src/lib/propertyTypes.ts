/**
 * Property Types - RESO Data Dictionary v2.0 Compliant
 * Reference: https://www.reso.org/data-dictionary/
 * 
 * Note: "value" is the RESO-standard value for data exchange
 *       "label" is the user-friendly display text
 *       "category" is used for grouping in the UI
 */
export const PROPERTY_TYPES = [
  // ============ RESIDENTIAL ============
  { 
    value: 'Residential', 
    label: 'Residential',
    category: 'Residential',
    description: 'Single family residential property'
  },
  { 
    value: 'Residential Income', 
    label: 'Residential Income',
    category: 'Residential',
    description: 'Multi-family or income-producing residential property'
  },
  { 
    value: 'Residential Lease', 
    label: 'Residential Lease',
    category: 'Residential',
    description: 'Residential property for rent/lease'
  },
  
  // ============ COMMERCIAL ============
  { 
    value: 'Commercial Sale', 
    label: 'Commercial Sale',
    category: 'Commercial',
    description: 'Commercial property for sale'
  },
  { 
    value: 'Business Opportunity', 
    label: 'Business Opportunity',
    category: 'Commercial',
    description: 'Business for sale (not the real estate)'
  },
  
  // ============ LAND & FARM ============
  { 
    value: 'Farm', 
    label: 'Farm and Ranch',
    category: 'Land & Farm',
    description: 'Farm, ranch, or agricultural property'
  },
  { 
    value: 'Land', 
    label: 'Land',
    category: 'Land & Farm',
    description: 'Vacant land or lot'
  },
  
  // ============ OTHER ============
  { 
    value: 'Manufactured In Park', 
    label: 'Manufactured Home',
    category: 'Other',
    description: 'Manufactured or mobile home in a park'
  },
] as const;

export type PropertyType = typeof PROPERTY_TYPES[number]['value'];

export const PROPERTY_TYPE_CATEGORIES = ['Residential', 'Commercial', 'Land & Farm', 'Other'] as const;

/**
 * Get display label for a RESO property type value
 */
export function getPropertyTypeLabel(value: string): string {
  const type = PROPERTY_TYPES.find(t => t.value === value);
  return type?.label || value;
}

/**
 * Get description for a property type (for tooltips)
 */
export function getPropertyTypeDescription(value: string): string {
  const type = PROPERTY_TYPES.find(t => t.value === value);
  return type?.description || '';
}

/**
 * Get property types by category
 */
export function getPropertyTypesByCategory(category: string) {
  return PROPERTY_TYPES.filter(t => t.category === category);
}

/**
 * RESO value migration map for converting old values
 */
export const RESO_VALUE_MIGRATIONS: Record<string, string> = {
  'Residential Investment': 'Residential Income',
  'residential': 'Residential',
  'residential_income': 'Residential Income',
  'residential_investment': 'Residential Income',
  'residential_lease': 'Residential Lease',
  'commercial_sale': 'Commercial Sale',
  'farm_and_ranch': 'Farm',
  'land_lot': 'Land',
  'Land/Lot': 'Land',
  'Farm and Ranch': 'Farm',
};

/**
 * Normalize property type value to RESO standard
 */
export function normalizePropertyType(value: string | null | undefined): string | null {
  if (!value) return null;
  return RESO_VALUE_MIGRATIONS[value] || value;
}
