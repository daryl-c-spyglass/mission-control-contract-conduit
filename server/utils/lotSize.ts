/**
 * Lot Size Utilities for Repliers API Data
 * 
 * Normalizes lot size data from various Repliers API field formats.
 * Conversion: 1 acre = 43,560 square feet
 * Source: Repliers Help Center - Lot Size Filtering
 */

/**
 * Normalizes lot size to acres from Repliers listing data
 * @param listing - Repliers listing object (raw or mapped)
 * @returns number (acres) or null if no lot data available
 */
export function normalizedAcres(listing: any): number | null {
  if (!listing) return null;
  
  // Priority 1: Direct acres value from lot object
  if (listing.lot?.acres && listing.lot.acres > 0) {
    return listing.lot.acres;
  }
  
  // Priority 2: Convert lot.squareFeet to acres
  if (listing.lot?.squareFeet && listing.lot.squareFeet > 0) {
    return listing.lot.squareFeet / 43560;
  }
  
  // Priority 3: lotSizeAcres at root level (already calculated)
  if (listing.lotSizeAcres && listing.lotSizeAcres > 0) {
    return listing.lotSizeAcres;
  }
  
  // Priority 4: lotSizeSquareFeet at root level
  if (listing.lotSizeSquareFeet && listing.lotSizeSquareFeet > 0) {
    return listing.lotSizeSquareFeet / 43560;
  }
  
  // Priority 5: Try lotSizeArea (Repliers raw field)
  if (listing.lotSizeArea && listing.lotSizeArea > 0) {
    const units = listing.lotSizeUnits || listing.lotSizeUnit || 'sqft';
    if (units === 'acres') {
      return listing.lotSizeArea;
    }
    // If > 100, assume sqft; otherwise assume acres
    return listing.lotSizeArea > 100 ? listing.lotSizeArea / 43560 : listing.lotSizeArea;
  }
  
  // Priority 6: Try lotSize at root level (may be string or number)
  if (listing.lotSize) {
    const rawValue = typeof listing.lotSize === 'string' 
      ? parseFloat(listing.lotSize.replace(/[^0-9.]/g, '')) 
      : listing.lotSize;
    
    if (!isNaN(rawValue) && rawValue > 0) {
      const units = listing.lotSizeUnits || listing.lotSizeUnit || 'sqft';
      if (units === 'acres') {
        return rawValue;
      }
      // If > 100, assume sqft; otherwise assume acres
      return rawValue > 100 ? rawValue / 43560 : rawValue;
    }
  }
  
  // Priority 7: Check details.lotSize (nested Repliers field)
  if (listing.details?.lotSize) {
    const rawValue = typeof listing.details.lotSize === 'string'
      ? parseFloat(listing.details.lotSize.replace(/[^0-9.]/g, ''))
      : listing.details.lotSize;
    
    if (!isNaN(rawValue) && rawValue > 0) {
      return rawValue > 100 ? rawValue / 43560 : rawValue;
    }
  }
  
  return null;
}

/**
 * Extracts lot size in square feet from Repliers listing data
 * @param listing - Repliers listing object
 * @returns number (sqft) or null if no lot data available
 */
export function normalizedLotSquareFeet(listing: any): number | null {
  if (!listing) return null;
  
  // Priority 1: Direct squareFeet from lot object
  if (listing.lot?.squareFeet && listing.lot.squareFeet > 0) {
    return listing.lot.squareFeet;
  }
  
  // Priority 2: lotSizeSquareFeet at root level
  if (listing.lotSizeSquareFeet && listing.lotSizeSquareFeet > 0) {
    return listing.lotSizeSquareFeet;
  }
  
  // Priority 3: Convert acres to sqft
  if (listing.lot?.acres && listing.lot.acres > 0) {
    return listing.lot.acres * 43560;
  }
  
  if (listing.lotSizeAcres && listing.lotSizeAcres > 0) {
    return listing.lotSizeAcres * 43560;
  }
  
  // Priority 4: Try lotSizeArea (Repliers raw field)
  if (listing.lotSizeArea && listing.lotSizeArea > 0) {
    const units = listing.lotSizeUnits || listing.lotSizeUnit || 'sqft';
    if (units === 'acres') {
      return listing.lotSizeArea * 43560;
    }
    return listing.lotSizeArea;
  }
  
  return null;
}

/**
 * Calculate price per acre
 * @param price - Property price (soldPrice or listPrice)
 * @param acres - Lot size in acres
 * @returns Price per acre or null if invalid input
 */
export function calculatePricePerAcre(price: number | null | undefined, acres: number | null | undefined): number | null {
  if (!acres || acres <= 0 || !price || price <= 0) return null;
  return Math.round(price / acres);
}

/**
 * Builds lot size object with all normalized values
 * @param listing - Repliers listing object
 * @returns Object with acres, squareFeet, and formatted size string
 */
export function buildLotSizeData(listing: any): {
  acres: number | null;
  squareFeet: number | null;
  size: string | null;
} {
  const acres = normalizedAcres(listing);
  const squareFeet = normalizedLotSquareFeet(listing);
  
  let size: string | null = null;
  if (acres !== null && acres > 0) {
    if (acres >= 1) {
      size = `${acres.toFixed(2)} acres`;
    } else {
      size = squareFeet ? `${squareFeet.toLocaleString()} sqft` : `${(acres * 43560).toLocaleString()} sqft`;
    }
  } else if (squareFeet) {
    size = `${squareFeet.toLocaleString()} sqft`;
  }
  
  return { acres, squareFeet, size };
}
