/**
 * Format phone number to (XXX) XXX-XXXX format
 * Handles various input formats and strips non-numeric characters
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Handle numbers with country code (1)
  const digits = cleaned.startsWith('1') && cleaned.length === 11 
    ? cleaned.slice(1) 
    : cleaned;
  
  // Must have exactly 10 digits for US format
  if (digits.length !== 10) {
    return phone; // Return original if can't format
  }
  
  // Format as (XXX) XXX-XXXX
  const areaCode = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const lineNumber = digits.slice(6, 10);
  
  return `(${areaCode}) ${prefix}-${lineNumber}`;
}

/**
 * Format phone as user types (for input onChange)
 */
export function formatPhoneAsYouType(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  if (cleaned.length <= 3) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
}
