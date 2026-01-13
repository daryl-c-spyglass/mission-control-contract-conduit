export const getStatusBadgeStyle = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') {
    return 'bg-[hsl(var(--chart-1))] text-white';
  }
  if (statusLower.includes('contract')) {
    return 'bg-[hsl(var(--chart-2))] text-white';
  }
  if (statusLower.includes('pending') && !statusLower.includes('inspection')) {
    return 'bg-[hsl(var(--chart-3))] text-white';
  }
  if (statusLower.includes('pending_inspection') || statusLower.includes('pending inspection')) {
    return 'bg-[hsl(var(--chart-4))] text-foreground';
  }
  if (statusLower.includes('clear_to_close') || statusLower.includes('clear to close')) {
    return 'bg-[hsl(var(--chart-1))] text-white';
  }
  if (statusLower.includes('closed') || statusLower.includes('sold')) {
    return 'bg-destructive text-destructive-foreground';
  }
  if (statusLower.includes('withdrawn') || statusLower.includes('cancel') || statusLower.includes('expired')) {
    return 'bg-muted text-muted-foreground';
  }
  if (statusLower.includes('coming soon')) {
    return 'bg-[hsl(var(--chart-5))] text-white';
  }
  
  return 'bg-secondary text-secondary-foreground';
};

export const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') return 'hsl(var(--chart-1))';
  if (statusLower.includes('contract')) return 'hsl(var(--chart-2))';
  if (statusLower.includes('pending') && !statusLower.includes('inspection')) return 'hsl(var(--chart-3))';
  if (statusLower.includes('pending_inspection') || statusLower.includes('pending inspection')) return 'hsl(var(--chart-4))';
  if (statusLower.includes('clear_to_close') || statusLower.includes('clear to close')) return 'hsl(var(--chart-1))';
  if (statusLower.includes('closed') || statusLower.includes('sold')) return 'hsl(var(--destructive))';
  if (statusLower.includes('withdrawn') || statusLower.includes('cancel') || statusLower.includes('expired')) return 'hsl(var(--muted-foreground))';
  if (statusLower.includes('coming soon')) return 'hsl(var(--chart-5))';
  
  return 'hsl(var(--secondary))';
};

export const getDaysRemainingStyle = (days: number): string => {
  if (days <= 0) return 'text-destructive font-medium';
  if (days <= 7) return 'text-destructive font-medium';
  if (days <= 14) return 'text-[hsl(var(--chart-2))] font-medium';
  return 'text-muted-foreground';
};

export const getStatusLabel = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') return 'Active Listing';
  if (statusLower.includes('in_contract') || statusLower.includes('in contract')) return 'In Contract';
  if (statusLower.includes('under_contract') || statusLower.includes('under contract')) return 'Under Contract';
  if (statusLower.includes('pending_inspection') || statusLower.includes('pending inspection')) return 'Pending Inspection';
  if (statusLower.includes('clear_to_close') || statusLower.includes('clear to close')) return 'Clear to Close';
  if (statusLower.includes('pending')) return 'Pending';
  if (statusLower.includes('closed') || statusLower.includes('sold')) return 'Closed';
  if (statusLower.includes('withdrawn')) return 'Withdrawn';
  if (statusLower.includes('cancel')) return 'Cancelled';
  if (statusLower.includes('expired')) return 'Expired';
  if (statusLower.includes('coming soon')) return 'Coming Soon';
  
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
};
