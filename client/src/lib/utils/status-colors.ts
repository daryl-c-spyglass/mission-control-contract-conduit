// Status configuration object for comprehensive status handling
export interface StatusConfig {
  label: string;
  badge: string;
  dot: string;
  marker: string;
}

export const getStatusConfig = (status: string): StatusConfig => {
  const normalized = status?.toLowerCase().replace(/\s+/g, '') || '';
  
  // Check compound statuses first
  if (normalized.includes('under') || normalized.includes('contract') || normalized.includes('incontract')) {
    return {
      label: 'Under Contract',
      badge: 'bg-amber-500 text-white',
      dot: 'bg-amber-500',
      marker: '#f59e0b',
    };
  }
  
  if (normalized.includes('closed') || normalized.includes('sold')) {
    return {
      label: 'Closed',
      badge: 'bg-gray-500 text-white',
      dot: 'bg-gray-500',
      marker: '#6b7280',
    };
  }
  
  if (normalized.includes('pendinginspection')) {
    return {
      label: 'Pending Inspection',
      badge: 'bg-yellow-400 text-gray-900',
      dot: 'bg-yellow-400',
      marker: '#facc15',
    };
  }
  
  if (normalized.includes('pending')) {
    return {
      label: 'Pending',
      badge: 'bg-yellow-500 text-white',
      dot: 'bg-yellow-500',
      marker: '#eab308',
    };
  }
  
  if (normalized.includes('cleartoclose')) {
    return {
      label: 'Clear to Close',
      badge: 'bg-green-600 text-white',
      dot: 'bg-green-600',
      marker: '#16a34a',
    };
  }
  
  if (normalized.includes('comingsoon')) {
    return {
      label: 'Coming Soon',
      badge: 'bg-purple-500 text-white',
      dot: 'bg-purple-500',
      marker: '#a855f7',
    };
  }
  
  if (normalized.includes('withdrawn') || normalized.includes('cancel') || normalized.includes('expired')) {
    return {
      label: normalized.includes('withdrawn') ? 'Withdrawn' : 
             normalized.includes('expired') ? 'Expired' : 'Cancelled',
      badge: 'bg-gray-400 text-white',
      dot: 'bg-gray-400',
      marker: '#9ca3af',
    };
  }
  
  // Check "active" last since compound statuses like "Active Under Contract" should match above
  if (normalized.includes('active') || normalized === 'forsale') {
    return {
      label: 'Active',
      badge: 'bg-green-500 text-white',
      dot: 'bg-green-500',
      marker: '#22c55e',
    };
  }
  
  return {
    label: status || 'Unknown',
    badge: 'bg-gray-500 text-white',
    dot: 'bg-gray-500',
    marker: '#6b7280',
  };
};

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
