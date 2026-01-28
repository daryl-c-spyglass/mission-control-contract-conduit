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
      // Clean JSON-encoded strings (strip leading/trailing quotes) and commas
      const cleaned = typeof value === 'string' 
        ? value.replace(/^["']|["']$/g, '').replace(/,/g, '') 
        : value;
      const num = typeof cleaned === 'string' ? parseFloat(cleaned) : Number(cleaned);
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
 * Handles all Repliers API field formats with proper unit detection
 */
export function extractLotAcres(comp: any): number | null {
  if (!comp) return null;
  
  const SQFT_PER_ACRE = 43560;
  
  // Helper to parse numeric values from various formats
  const parseNum = (value: any): number => {
    if (value == null) return NaN;
    const str = String(value).replace(/[,$]/g, '');
    return parseFloat(str);
  };
  
  // Priority 1: Direct acres fields (already in correct units)
  const acresFields = ['lotSizeAcres', 'acres', 'lotAcres', 'lot_size_acres'];
  for (const field of acresFields) {
    const num = parseNum(comp?.[field]);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  
  // Priority 2: Nested lot.acres (Repliers API format)
  if (comp?.lot?.acres != null) {
    const num = parseNum(comp.lot.acres);
    if (!isNaN(num) && num > 0) {
      return num;
    }
  }
  
  // Priority 3: lotSizeSquareFeet and similar (convert to acres)
  const sqftFields = ['lotSizeSqFt', 'lotSquareFeet', 'lotSizeSquareFeet', 'lotSizeSF'];
  for (const field of sqftFields) {
    const num = parseNum(comp?.[field]);
    if (!isNaN(num) && num > 0) {
      return num / SQFT_PER_ACRE;
    }
  }
  
  // Priority 4: Nested lot.squareFeet (Repliers API format)
  if (comp?.lot?.squareFeet != null) {
    const num = parseNum(comp.lot.squareFeet);
    if (!isNaN(num) && num > 0) {
      return num / SQFT_PER_ACRE;
    }
  }
  
  // Priority 5: lotSizeArea (determine unit by magnitude)
  // Values > 100 are likely sqft, values < 100 are likely acres
  if (comp?.lotSizeArea != null) {
    const num = parseNum(comp.lotSizeArea);
    if (!isNaN(num) && num > 0) {
      if (num > 100) {
        return num / SQFT_PER_ACRE;
      }
      return num;
    }
  }
  
  // Priority 6: lotSize - could be string with unit or number
  // Repliers returns "8,328.67 sqft" or similar
  if (comp?.lot?.size != null) {
    const sizeVal = comp.lot.size;
    if (typeof sizeVal === 'string') {
      const lowerSize = sizeVal.toLowerCase();
      const numMatch = sizeVal.match(/[\d,.]+/);
      if (numMatch) {
        const num = parseNum(numMatch[0]);
        if (!isNaN(num) && num > 0) {
          if (lowerSize.includes('acre')) {
            return num;
          }
          // Default to sqft for lot.size
          return num / SQFT_PER_ACRE;
        }
      }
    } else {
      const num = parseNum(sizeVal);
      if (!isNaN(num) && num > 0) {
        // lot.size without unit - determine by magnitude
        return num > 100 ? num / SQFT_PER_ACRE : num;
      }
    }
  }
  
  // Priority 7: Generic lotSize field
  if (comp?.lotSize != null) {
    const lotSize = comp.lotSize;
    if (typeof lotSize === 'string') {
      const lowerSize = lotSize.toLowerCase();
      const numMatch = lotSize.match(/[\d,.]+/);
      if (numMatch) {
        const num = parseNum(numMatch[0]);
        if (!isNaN(num) && num > 0) {
          if (lowerSize.includes('acre')) {
            return num;
          } else if (lowerSize.includes('sq') || lowerSize.includes('ft')) {
            return num / SQFT_PER_ACRE;
          }
          // No unit - determine by magnitude
          return num > 100 ? num / SQFT_PER_ACRE : num;
        }
      }
    } else {
      const num = parseNum(lotSize);
      if (!isNaN(num) && num > 0) {
        // Determine unit by magnitude
        return num > 100 ? num / SQFT_PER_ACRE : num;
      }
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
      // Clean JSON-encoded strings (strip leading/trailing quotes)
      const cleaned = typeof value === 'string' ? value.replace(/^["']|["']$/g, '') : value;
      const num = typeof cleaned === 'string' ? parseInt(cleaned) : Number(cleaned);
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
      // Clean JSON-encoded strings (strip leading/trailing quotes)
      const cleaned = typeof value === 'string' ? value.replace(/^["']|["']$/g, '') : value;
      const num = typeof cleaned === 'string' ? parseFloat(cleaned) : Number(cleaned);
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
 * Safely extract city from a property
 * Handles various field name formats from MLS/Repliers API
 */
export function extractCity(comp: any): string {
  if (!comp) return '';
  
  // Try direct field names
  const city = comp?.city || 
    comp?.cityName || 
    comp?.city_name ||
    comp?.address?.city ||
    comp?.location?.city ||
    comp?.municipality ||
    '';
    
  return String(city).trim();
}

/**
 * Safely extract state from a property
 * Handles various field name formats from MLS/Repliers API
 */
export function extractState(comp: any): string {
  if (!comp) return '';
  
  const state = comp?.state || 
    comp?.stateCode || 
    comp?.state_code ||
    comp?.stateOrProvince ||
    comp?.address?.state ||
    comp?.location?.state ||
    comp?.province ||
    '';
    
  return String(state).trim();
}

/**
 * Get formatted city, state string
 * Returns empty string if both are missing to avoid showing just a comma
 */
export function getCityState(comp: any): string {
  if (!comp) return '';
  
  const city = extractCity(comp);
  const state = extractState(comp);
  
  if (city && state) {
    return `${city}, ${state}`;
  }
  if (city) {
    return city;
  }
  if (state) {
    return state;
  }
  
  // Fallback: try to extract from full/formatted address
  const fullAddress = comp?.fullAddress || comp?.full_address || comp?.formattedAddress || comp?.unparsedAddress;
  if (fullAddress && typeof fullAddress === 'string') {
    // Try to extract city, state from "123 Main St, Austin, TX 78701"
    const parts = fullAddress.split(',');
    if (parts.length >= 2) {
      // Get everything after the street address
      return parts.slice(1).join(',').trim();
    }
  }
  
  return '';
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
 * Contract Conduit Standard: Closed=RED, Active=GREEN, Under Contract=ORANGE, Pending=GRAY, Leasing=PURPLE
 */
export function getStatusColor(status: string): string {
  const statusLower = (status || '').toLowerCase();
  // Check leasing/rental first (before other checks) - Purple
  if (statusLower.includes('leasing') || statusLower === 'lsd' || statusLower === 'leased' || 
      statusLower.includes('for rent') || statusLower.includes('rental') || statusLower === 'lease') {
    return '#a855f7';  // Purple for Leasing
  }
  if (statusLower.includes('closed') || statusLower === 'sold' || statusLower === 'sld' || statusLower === 's' || statusLower === 'c') {
    return '#ef4444';  // Red for Closed/Sold
  }
  if (statusLower.includes('pending') || statusLower.includes('under contract') || statusLower === 'u' || statusLower === 'sc') {
    return '#f59e0b';  // Orange for Pending/Under Contract
  }
  if (statusLower.includes('active') || statusLower === 'a') {
    return '#22c55e';  // Green for Active
  }
  return '#6b7280';    // Gray for Unknown
}

/**
 * Safely extract status from a comparable property
 * Checks multiple fields including lastStatus for sold/closed listings
 */
export function extractStatus(comp: any): string {
  if (!comp) return '';
  
  // Check multiple status fields in priority order
  const fields = ['status', 'standardStatus', 'lastStatus', 'mlsStatus', 'listingStatus'];
  
  for (const field of fields) {
    const value = comp?.[field];
    if (value && typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return '';
}

/**
 * Normalize status display text
 * Handles Repliers-specific status codes: Sld (Sold), Lsd (Leased), Sc (Sold Conditionally/Under Contract), etc.
 * Per RESO Standard: Sale statuses (Active/Pending/Closed) vs Rental statuses (Leasing)
 */
export function normalizeStatus(status: string): string {
  const statusLower = (status || '').toLowerCase().trim();
  
  // Handle empty/unknown
  if (!statusLower) return 'Unknown';
  
  // Repliers-specific codes and common variations
  // Check leasing/rental FIRST (before other checks) - distinct from sales
  if (statusLower === 'lsd' || statusLower === 'leased' || statusLower === 'lease' ||
      statusLower.includes('leasing') || statusLower.includes('for rent') || statusLower.includes('rental')) {
    return 'Leasing';
  }
  
  // Closed/Sold statuses (sale transactions)
  if (statusLower === 'sld' || statusLower === 'sold' || statusLower === 's' || 
      statusLower === 'c' || statusLower === 'closed' || statusLower.includes('closed')) {
    return 'Closed';
  }
  
  // Pending/Under Contract statuses
  if (statusLower === 'sc' || statusLower === 'u' || statusLower === 'pending' || 
      statusLower.includes('pending') || statusLower.includes('under contract') ||
      statusLower === 'pc') {
    return 'Pending';
  }
  
  // Active statuses
  if (statusLower === 'a' || statusLower === 'active' || statusLower.includes('active')) {
    return 'Active';
  }
  
  // Back on market
  if (statusLower === 'bom' || statusLower.includes('back on market')) {
    return 'Active';
  }
  
  // Withdrawn
  if (statusLower === 'wdn' || statusLower === 'withdrawn') {
    return 'Withdrawn';
  }
  
  // Expired
  if (statusLower === 'exp' || statusLower === 'expired') {
    return 'Expired';
  }
  
  return status || 'Unknown';
}

/**
 * Calculate all stats from comparables array
 * Applies sanity checks for price per acre to exclude impossible values
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

  // Sanity check constants for price per acre
  const MIN_LOT_SIZE_ACRES = 0.05;
  const MAX_PRICE_PER_ACRE = 20_000_000; // $20M/acre max
  const MIN_PRICE_PER_ACRE = 10_000; // $10K/acre minimum

  const prices = comparables.map(c => extractPrice(c)).filter((p): p is number => p !== null);
  const pricesPerSqft = comparables.map(c => calculatePricePerSqft(c)).filter((p): p is number => p !== null);
  const domValues = comparables.map(c => extractDOM(c)).filter((d): d is number => d !== null);
  
  // Filter out impossible price per acre values
  const pricesPerAcre = comparables
    .map(c => {
      const acres = extractLotAcres(c);
      const pricePerAcre = calculatePricePerAcre(c);
      // Apply sanity checks
      if (acres !== null && acres < MIN_LOT_SIZE_ACRES) return null;
      if (pricePerAcre !== null) {
        if (pricePerAcre > MAX_PRICE_PER_ACRE || pricePerAcre < MIN_PRICE_PER_ACRE) return null;
      }
      return pricePerAcre;
    })
    .filter((p): p is number => p !== null);

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
