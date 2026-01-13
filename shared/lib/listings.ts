/**
 * Shared listing utilities - Single Source of Truth
 * 
 * These pure functions are used across the entire application to ensure
 * consistent handling of rentals/leases and Days on Market.
 */

/**
 * Determines if a listing is a rental/lease that should be excluded.
 * 
 * MUST be used everywhere listings are filtered or displayed to enforce
 * the global "no rentals" policy for ACTRIS MLS.
 * 
 * @param listing - Raw listing object from Repliers API
 * @returns true if listing is a rental/lease (should be excluded)
 */
export function isRentalOrLease(listing: {
  type?: string | null;
  propertyType?: string | null;
  transactionType?: string | null;
  listingCategory?: string | null;
  leaseType?: string | null;
  details?: { propertyType?: string | null; propertySubType?: string | null } | null;
  class?: string | null;
}): boolean {
  if (!listing) return false;
  
  // Helper to check for rental keywords
  const hasRentalKeyword = (str: string) => {
    const lower = str.toLowerCase();
    return lower.includes('lease') || lower.includes('rental') || lower.includes('rent');
  };
  
  // Check type field (exact match)
  const type = (listing.type || '').toLowerCase().trim();
  if (type === 'lease' || type === 'rental' || type === 'rent') {
    return true;
  }
  
  // Check transactionType (ACTRIS commercial leases often use this)
  if (hasRentalKeyword(listing.transactionType || '')) {
    return true;
  }
  
  // Check listingCategory
  if (hasRentalKeyword(listing.listingCategory || '')) {
    return true;
  }
  
  // Check leaseType (if present, it's definitely a lease)
  if (listing.leaseType) {
    return true;
  }
  
  // Check top-level propertyType (from normalized mlsData)
  if (hasRentalKeyword(listing.propertyType || '')) {
    return true;
  }
  
  // Check details.propertyType (from raw Repliers data)
  if (hasRentalKeyword(listing.details?.propertyType || '')) {
    return true;
  }
  
  // Check details.propertySubType
  if (hasRentalKeyword(listing.details?.propertySubType || '')) {
    return true;
  }
  
  // Check class field
  const listingClass = (listing.class || '').toLowerCase();
  if (listingClass.includes('lease') || listingClass.includes('rental')) {
    return true;
  }
  
  return false;
}

/**
 * Gets the display-ready Days on Market value.
 * 
 * MUST be used everywhere DOM is displayed to ensure consistency.
 * Prefers simpleDaysOnMarket (more accurate) over daysOnMarket.
 * 
 * @param listing - Listing object with DOM fields
 * @returns Number of days on market, or null if unavailable
 */
export function getDisplayDOM(listing: {
  simpleDaysOnMarket?: number | null;
  daysOnMarket?: number | null;
}): number | null {
  if (listing.simpleDaysOnMarket != null) {
    return listing.simpleDaysOnMarket;
  }
  
  if (listing.daysOnMarket != null) {
    return listing.daysOnMarket;
  }
  
  return null;
}

/**
 * Checks if simpleDaysOnMarket is available (for showing tooltip about accuracy).
 */
export function hasAccurateDOM(listing: {
  simpleDaysOnMarket?: number | null;
}): boolean {
  return listing.simpleDaysOnMarket != null;
}

/**
 * Filter an array of listings to exclude rentals/leases.
 * Use this as a failsafe after API calls.
 */
export function excludeRentals<T extends { 
  type?: string | null; 
  propertyType?: string | null; 
  transactionType?: string | null;
  listingCategory?: string | null;
  leaseType?: string | null;
  details?: { propertyType?: string | null; propertySubType?: string | null } | null; 
  class?: string | null 
}>(
  listings: T[]
): T[] {
  return listings.filter(listing => !isRentalOrLease(listing));
}
