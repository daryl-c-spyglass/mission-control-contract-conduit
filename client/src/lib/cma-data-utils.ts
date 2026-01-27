/**
 * CMA Data Utilities
 * Safe data extraction functions for CMA comparables
 * Handles various field name formats from MLS/Repliers API
 */

/**
 * Safely extract price from a comparable property
 * Repliers API may return: closePrice, soldPrice, listPrice, or price
 */
export function extractPrice(comp: any): number | null {
  if (!comp) return null;
  
  const fields = ['soldPrice', 'closePrice', 'price', 'listPrice'];
  
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' 
        ? parseFloat(value.replace(/[,$]/g, '')) 
        : Number(value);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }
  return null;
}

/**
 * Safely extract square footage
 */
export function extractSqft(comp: any): number | null {
  if (!comp) return null;
  
  const fields = ['sqft', 'livingArea', 'squareFeet', 'sqFt', 'size'];
  
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' 
        ? parseFloat(value.replace(/,/g, '')) 
        : Number(value);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }
  return null;
}

/**
 * Safely extract days on market
 */
export function extractDOM(comp: any): number | null {
  if (!comp) return null;
  
  const fields = ['daysOnMarket', 'dom', 'cumulativeDom', 'DOM'];
  
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' ? parseInt(value) : Number(value);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }
  return null;
}

/**
 * Safely extract lot size in acres
 */
export function extractLotAcres(comp: any): number | null {
  if (!comp) return null;
  
  const acresFields = ['lotSizeAcres', 'acres', 'lotAcres'];
  for (const field of acresFields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(num) && num > 0) {
        return num;
      }
    }
  }
  
  if (comp?.lot?.acres) {
    const num = typeof comp.lot.acres === 'string' ? parseFloat(comp.lot.acres) : Number(comp.lot.acres);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  
  const sqftFields = ['lotSizeSqFt', 'lotSquareFeet', 'lotSizeSquareFeet'];
  for (const field of sqftFields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : Number(value);
      if (!isNaN(num) && num > 0) {
        return num / 43560;
      }
    }
  }
  
  if (comp?.lot?.squareFeet) {
    const num = typeof comp.lot.squareFeet === 'string' ? parseFloat(comp.lot.squareFeet) : Number(comp.lot.squareFeet);
    if (!isNaN(num) && num > 0) {
      return num / 43560;
    }
  }
  
  return null;
}

/**
 * Safely extract bedrooms
 */
export function extractBeds(comp: any): number | string {
  if (!comp) return 'N/A';
  const fields = ['beds', 'bedrooms', 'bedroomsTotal'];
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' ? parseInt(value) : Number(value);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }
  return 'N/A';
}

/**
 * Safely extract bathrooms
 */
export function extractBaths(comp: any): number | string {
  if (!comp) return 'N/A';
  const fields = ['baths', 'bathrooms', 'bathroomsTotal', 'bathroomsTotalInteger'];
  for (const field of fields) {
    const value = comp?.[field];
    if (value != null) {
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }
  return 'N/A';
}

/**
 * Calculate price per square foot
 */
export function calculatePricePerSqft(comp: any): number | null {
  const price = extractPrice(comp);
  const sqft = extractSqft(comp);
  if (price && sqft && sqft > 0) {
    return Math.round(price / sqft);
  }
  return null;
}

/**
 * Calculate price per acre
 */
export function calculatePricePerAcre(comp: any): number | null {
  const price = extractPrice(comp);
  const acres = extractLotAcres(comp);
  if (price && acres && acres > 0) {
    return Math.round(price / acres);
  }
  return null;
}

/**
 * Build full address string
 */
export function extractFullAddress(comp: any): string {
  if (!comp) return 'Address unavailable';
  
  if (comp?.fullAddress && comp.fullAddress.trim()) {
    return comp.fullAddress;
  }
  
  if (comp?.address && comp.address.trim()) {
    const city = comp?.city || '';
    const state = comp?.state || comp?.stateOrProvince || '';
    const zip = comp?.zip || comp?.zipCode || comp?.postalCode || '';
    
    if (city) {
      return `${comp.address}, ${city}${state ? ', ' + state : ''} ${zip}`.trim();
    }
    return comp.address;
  }
  
  const parts = [
    comp?.streetNumber,
    comp?.streetName,
    comp?.streetSuffix,
  ].filter(Boolean).join(' ');
  
  if (parts) {
    const city = comp?.city || '';
    const state = comp?.state || '';
    return city ? `${parts}, ${city}, ${state}` : parts;
  }
  
  return 'Address unavailable';
}

/**
 * Get status display color
 */
export function getStatusColor(status: string): string {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('closed') || statusLower === 'sold' || statusLower === 's' || statusLower === 'c') {
    return '#6b7280';
  }
  if (statusLower.includes('pending') || statusLower.includes('under contract') || statusLower === 'u' || statusLower === 'sc') {
    return '#f59e0b';
  }
  if (statusLower.includes('active') || statusLower === 'a') {
    return '#22c55e';
  }
  return '#6b7280';
}

/**
 * Normalize status display text
 */
export function normalizeStatus(status: string): string {
  const statusLower = (status || '').toLowerCase();
  if (statusLower === 's' || statusLower === 'c' || statusLower === 'sold') return 'Closed';
  if (statusLower === 'a' || statusLower === 'active') return 'Active';
  if (statusLower === 'u' || statusLower === 'sc' || statusLower === 'pending') return 'Pending';
  return status || 'Unknown';
}

/**
 * Calculate all stats from comparables array
 */
export function calculateCMAStats(comparables: any[]) {
  if (!comparables || comparables.length === 0) {
    return {
      count: 0,
      avgPrice: null,
      minPrice: null,
      maxPrice: null,
      avgPricePerSqft: null,
      avgDOM: null,
      avgPricePerAcre: null,
      priceRange: 'N/A',
    };
  }

  const prices = comparables.map(c => extractPrice(c)).filter((p): p is number => p !== null);
  const pricesPerSqft = comparables.map(c => calculatePricePerSqft(c)).filter((p): p is number => p !== null);
  const domValues = comparables.map(c => extractDOM(c)).filter((d): d is number => d !== null);
  const pricesPerAcre = comparables.map(c => calculatePricePerAcre(c)).filter((p): p is number => p !== null);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return {
    count: comparables.length,
    avgPrice: prices.length > 0 ? Math.round(avg(prices)!) : null,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    maxPrice: prices.length > 0 ? Math.max(...prices) : null,
    avgPricePerSqft: pricesPerSqft.length > 0 ? Math.round(avg(pricesPerSqft)!) : null,
    avgDOM: domValues.length > 0 ? Math.round(avg(domValues)!) : null,
    avgPricePerAcre: pricesPerAcre.length > 0 ? Math.round(avg(pricesPerAcre)!) : null,
    priceRange: prices.length > 0 
      ? `$${Math.min(...prices).toLocaleString()} - $${Math.max(...prices).toLocaleString()}`
      : 'N/A',
  };
}

/**
 * Format price for display
 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format number for display
 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format price per unit (e.g., $250/sqft)
 */
export function formatPricePerUnit(value: number | null | undefined, unit: string): string {
  if (value == null || isNaN(value) || value === 0) return 'N/A';
  return `$${value.toLocaleString()}/${unit}`;
}

/**
 * Format price in K/M shorthand
 */
export function formatPriceShort(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  return `$${Math.round(value / 1000)}K`;
}

/**
 * Get primary photo URL from a comparable
 */
export function getPrimaryPhoto(comp: any): string | null {
  if (!comp) return null;
  if (comp.photos && Array.isArray(comp.photos) && comp.photos.length > 0) {
    return comp.photos[0];
  }
  if (comp.images && Array.isArray(comp.images) && comp.images.length > 0) {
    const img = comp.images[0];
    if (typeof img === 'string' && img.startsWith('http')) {
      return img;
    }
    if (typeof img === 'string') {
      return `https://cdn.repliers.io/${img}`;
    }
  }
  if (comp.imageUrl) return comp.imageUrl;
  if (comp.primaryPhoto) return comp.primaryPhoto;
  if (comp.image) return comp.image;
  return null;
}

/**
 * Get all photo URLs from a comparable
 */
export function getPhotos(comp: any): string[] {
  if (!comp) return [];
  if (comp.photos && Array.isArray(comp.photos)) {
    return comp.photos;
  }
  if (comp.images && Array.isArray(comp.images)) {
    return comp.images;
  }
  return [];
}

/**
 * Get agent display name
 */
export function getAgentName(agent: any): string {
  if (!agent) return 'Your Spyglass Agent';
  if (agent.name) return agent.name;
  if (agent.firstName && agent.lastName) {
    return `${agent.firstName} ${agent.lastName}`;
  }
  if (agent.firstName) return agent.firstName;
  return 'Your Spyglass Agent';
}

/**
 * Get agent photo URL with fallback
 */
export function getAgentPhoto(agent: any): string | null {
  if (!agent) return null;
  return agent.headshotUrl || agent.photoUrl || agent.photo || null;
}

/**
 * Get agent initials for placeholder
 */
export function getAgentInitials(agent: any): string {
  const name = getAgentName(agent);
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Extract coordinates from a property
 */
export function getCoordinates(comp: any): { lat: number; lng: number } | null {
  if (!comp) return null;
  
  // Check map object first (Repliers format)
  if (comp.map?.latitude && comp.map?.longitude) {
    return { lat: comp.map.latitude, lng: comp.map.longitude };
  }
  
  // Check coordinates object
  if (comp.coordinates?.latitude && comp.coordinates?.longitude) {
    return { lat: comp.coordinates.latitude, lng: comp.coordinates.longitude };
  }
  
  // Check direct properties
  if (comp.latitude && comp.longitude) {
    return { lat: comp.latitude, lng: comp.longitude };
  }
  if (comp.lat && comp.lng) {
    return { lat: comp.lat, lng: comp.lng };
  }
  
  return null;
}
