export const PDF_COLORS = {
  primary: '#3b82f6',
  text: '#1f2937',
  textLight: '#4b5563',
  textMuted: '#9ca3af',
  background: '#ffffff',
  backgroundAlt: '#f9fafb',
  border: '#e5e7eb',
  
  statusSubject: '#3b82f6',
  statusActive: '#22c55e',
  statusUnderContract: '#f97316',
  statusClosed: '#ef4444',
};

export const PDF_FONTS = {
  family: 'Inter',
  sizes: {
    xs: 8,
    sm: 10,
    base: 11,
    lg: 14,
    xl: 18,
    xxl: 24,
  },
};

export const PDF_SPACING = {
  page: 40,
  coverPage: 60,
  section: 20,
  element: 10,
};

export const STATUS_COLORS = {
  subject: { hex: '#3b82f6', tailwind: 'bg-blue-500', label: 'Subject Property' },
  active: { hex: '#22c55e', tailwind: 'bg-green-500', label: 'Active' },
  underContract: { hex: '#f97316', tailwind: 'bg-orange-500', label: 'Under Contract' },
  closed: { hex: '#ef4444', tailwind: 'bg-red-500', label: 'Closed' },
  pending: { hex: '#6b7280', tailwind: 'bg-gray-500', label: 'Pending' },
};

export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

export function getStatusColorForPdf(status: string): typeof STATUS_COLORS[keyof typeof STATUS_COLORS] {
  const normalizedStatus = status?.toLowerCase().replace(/\s+/g, '');
  
  if (normalizedStatus?.includes('active') && !normalizedStatus.includes('contract')) {
    return STATUS_COLORS.active;
  }
  if (normalizedStatus?.includes('contract') || normalizedStatus?.includes('pending')) {
    return STATUS_COLORS.underContract;
  }
  if (normalizedStatus?.includes('closed') || normalizedStatus?.includes('sold')) {
    return STATUS_COLORS.closed;
  }
  
  return STATUS_COLORS.pending;
}

export function getStatusHex(status: string, isSubject = false): string {
  if (isSubject) return STATUS_COLORS.subject.hex;
  return getStatusColorForPdf(status).hex;
}
