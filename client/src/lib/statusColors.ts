// Centralized status color system for CMA

export const STATUS_COLORS = {
  subject: { hex: '#3b82f6', tailwind: 'bg-blue-500', text: 'text-blue-500', label: 'Subject Property' },
  active: { hex: '#22c55e', tailwind: 'bg-green-500', text: 'text-green-500', label: 'Active' },
  underContract: { hex: '#f97316', tailwind: 'bg-orange-500', text: 'text-orange-500', label: 'Under Contract' },
  closed: { hex: '#ef4444', tailwind: 'bg-red-500', text: 'text-red-500', label: 'Closed' },
  pending: { hex: '#6b7280', tailwind: 'bg-gray-500', text: 'text-gray-500', label: 'Pending' },
};

export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

export function getStatusColor(status: string): typeof STATUS_COLORS[keyof typeof STATUS_COLORS] {
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
  return getStatusColor(status).hex;
}

export function getAdjustmentColor(value: number): string {
  if (value > 0) return "#ef4444";
  if (value < 0) return "#22c55e";
  return "inherit";
}

export function formatAdjustmentValue(value: number): string {
  if (value === 0) return "$0";
  const formatted = Math.abs(value).toLocaleString();
  return value > 0 ? `+$${formatted}` : `-$${formatted}`;
}
