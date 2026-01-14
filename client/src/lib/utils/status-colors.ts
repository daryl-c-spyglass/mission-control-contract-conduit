export const getStatusBadgeStyle = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  // IMPORTANT: Check compound/contract statuses BEFORE simple "active"
  // "Active Under Contract" should get orange contract color, not green active color
  if (statusLower.includes('contract')) {
    return 'bg-[hsl(var(--chart-2))] text-white';
  }
  if (statusLower.includes('pending inspection') || statusLower.includes('pending_inspection')) {
    return 'bg-[hsl(var(--chart-4))] text-foreground';
  }
  if (statusLower.includes('clear to close') || statusLower.includes('clear_to_close')) {
    return 'bg-[hsl(var(--chart-1))] text-white';
  }
  if (statusLower.includes('pending')) {
    return 'bg-[hsl(var(--chart-3))] text-white';
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
  // Check "active" LAST since "Active Under Contract" should match contract above
  if (statusLower.includes('active') || statusLower === 'for sale') {
    return 'bg-[hsl(var(--chart-1))] text-white';
  }
  
  return 'bg-secondary text-secondary-foreground';
};

export const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  // IMPORTANT: Check compound/contract statuses BEFORE simple "active"
  // "Active Under Contract" should get orange contract color, not green active color
  if (statusLower.includes('contract')) return 'hsl(var(--chart-2))';
  if (statusLower.includes('pending inspection') || statusLower.includes('pending_inspection')) return 'hsl(var(--chart-4))';
  if (statusLower.includes('clear to close') || statusLower.includes('clear_to_close')) return 'hsl(var(--chart-1))';
  if (statusLower.includes('pending')) return 'hsl(var(--chart-3))';
  if (statusLower.includes('closed') || statusLower.includes('sold')) return 'hsl(var(--destructive))';
  if (statusLower.includes('withdrawn') || statusLower.includes('cancel') || statusLower.includes('expired')) return 'hsl(var(--muted-foreground))';
  if (statusLower.includes('coming soon')) return 'hsl(var(--chart-5))';
  // Check "active" LAST since "Active Under Contract" should match contract above
  if (statusLower.includes('active') || statusLower === 'for sale') return 'hsl(var(--chart-1))';
  
  return 'hsl(var(--secondary))';
};

export const getDaysRemainingStyle = (days: number): string => {
  if (days <= 0) return 'text-destructive font-medium';
  if (days <= 7) return 'text-destructive font-medium';
  if (days <= 14) return 'text-[hsl(var(--chart-2))] font-medium';
  return 'text-muted-foreground';
};

export const getStatusLabel = (status: string): string => {
  // If the status contains spaces and capital letters, it's likely an MLS status - preserve it exactly
  if (status.includes(' ') && /[A-Z]/.test(status)) {
    return status;
  }
  
  const statusLower = status.toLowerCase();
  
  // Only normalize internal status codes (snake_case or lowercase)
  if (statusLower === 'in_contract' || statusLower === 'in contract') return 'In Contract';
  if (statusLower === 'pending_inspection' || statusLower === 'pending inspection') return 'Pending Inspection';
  if (statusLower === 'clear_to_close' || statusLower === 'clear to close') return 'Clear to Close';
  if (statusLower === 'coming_soon' || statusLower === 'coming soon') return 'Coming Soon';
  if (statusLower === 'pending') return 'Pending';
  if (statusLower === 'closed' || statusLower === 'sold') return 'Closed';
  if (statusLower === 'withdrawn') return 'Withdrawn';
  if (statusLower === 'cancelled' || statusLower === 'canceled') return 'Cancelled';
  if (statusLower === 'expired') return 'Expired';
  if (statusLower === 'active' || statusLower === 'for sale') return 'Active Listing';
  
  // Default: capitalize first letter and replace underscores
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
};
