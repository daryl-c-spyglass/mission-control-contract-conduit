/**
 * Safe Links Utility
 * 
 * Centralized guardrail to prevent external link rendering from MLS listing data.
 * Per MLS/IDX/VOW compliance requirements, we do NOT render external tour/video URLs.
 * 
 * Allowlist:
 * - Internal routes (same-origin)
 * - Repliers CDN images (for photo rendering)
 * 
 * Blocklist:
 * - Any virtualTourUrl-like fields
 * - Any absolute URL not on allowlist
 */

// Allowed external domains for images only
const ALLOWED_IMAGE_DOMAINS = [
  'cdn.repliers.io',
  'photos.repliers.io',
  'images.repliers.io',
];

// Blocked field patterns (external tour/video URLs)
const BLOCKED_FIELD_PATTERNS = [
  /virtualTour/i,
  /videoUrl/i,
  /matterport/i,
  /propertypanorama/i,
  /tourUrl/i,
  /3dTour/i,
  /unbrandedTour/i,
  /brandedTour/i,
];

/**
 * Check if a URL is safe to render as a link
 * @param url - The URL to check
 * @param fieldName - The field name this URL came from (for blocklist checking)
 * @returns true if safe to render, false if blocked
 */
export function isSafeLinkUrl(url: string | null | undefined, fieldName?: string): boolean {
  if (!url) return false;
  
  // Check if fieldName matches blocked patterns
  if (fieldName) {
    for (const pattern of BLOCKED_FIELD_PATTERNS) {
      if (pattern.test(fieldName)) {
        if (import.meta.env.DEV) {
          console.warn(`[SafeLinks] Blocked field: ${fieldName}`);
        }
        return false;
      }
    }
  }
  
  try {
    const parsedUrl = new URL(url, window.location.origin);
    
    // Allow same-origin links
    if (parsedUrl.origin === window.location.origin) {
      return true;
    }
    
    // Block all other external links from listing data
    if (import.meta.env.DEV) {
      console.warn(`[SafeLinks] Blocked external URL from field "${fieldName}": ${url}`);
    }
    return false;
  } catch {
    // Invalid URL - block it
    return false;
  }
}

/**
 * Check if a URL is a safe image URL (allows Repliers CDN)
 * @param url - The image URL to check
 * @returns true if safe to render as image src
 */
export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url, window.location.origin);
    
    // Allow same-origin
    if (parsedUrl.origin === window.location.origin) {
      return true;
    }
    
    // Allow Repliers CDN domains for images
    if (ALLOWED_IMAGE_DOMAINS.some(domain => parsedUrl.hostname.endsWith(domain))) {
      return true;
    }
    
    // Our proxy endpoint is safe
    if (parsedUrl.pathname.startsWith('/api/proxy-image')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Get a safe link href or return undefined if blocked
 * Use this in components: href={getSafeLinkHref(url, 'fieldName')}
 */
export function getSafeLinkHref(url: string | null | undefined, fieldName?: string): string | undefined {
  return isSafeLinkUrl(url, fieldName) ? url! : undefined;
}
