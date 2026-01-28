/**
 * Format phone number to (XXX) XXX-XXXX format
 * Handles various input formats and strips non-numeric characters
 * Always returns a properly formatted string or empty string
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle numbers with country code (1)
  if (cleaned.startsWith('1') && cleaned.length >= 11) {
    cleaned = cleaned.slice(1);
  }
  
  // Take only the first 10 digits
  const digits = cleaned.slice(0, 10);
  
  // Need exactly 10 digits for US format
  if (digits.length !== 10) {
    // If we have some digits but not 10, return empty to prompt user to fix
    return digits.length > 0 ? formatPhoneAsYouType(digits) : '';
  }
  
  // Format as (XXX) XXX-XXXX
  const areaCode = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const lineNumber = digits.slice(6, 10);
  
  return `(${areaCode}) ${prefix}-${lineNumber}`;
}

/**
 * Format phone as user types (for input onChange)
 * Clamps to 10 digits maximum
 */
export function formatPhoneAsYouType(value: string): string {
  // Remove all non-numeric characters and clamp to 10 digits
  const cleaned = value.replace(/\D/g, '').slice(0, 10);
  
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}
