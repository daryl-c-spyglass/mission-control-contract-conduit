export const getStatusBadgeStyle = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') {
    return 'bg-green-500 text-white hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700';
  }
  if (statusLower.includes('contract')) {
    return 'bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 dark:hover:bg-orange-700';
  }
  if (statusLower.includes('pending')) {
    return 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700';
  }
  if (statusLower.includes('closed') || statusLower.includes('sold')) {
    return 'bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700';
  }
  if (statusLower.includes('withdrawn') || statusLower.includes('cancel') || statusLower.includes('expired')) {
    return 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700';
  }
  if (statusLower.includes('coming soon')) {
    return 'bg-purple-500 text-white hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700';
  }
  
  return 'bg-gray-500 text-white dark:bg-gray-600';
};

export const getStatusColor = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') return '#22c55e';
  if (statusLower.includes('contract')) return '#f97316';
  if (statusLower.includes('pending')) return '#3b82f6';
  if (statusLower.includes('closed') || statusLower.includes('sold')) return '#ef4444';
  if (statusLower.includes('withdrawn') || statusLower.includes('cancel') || statusLower.includes('expired')) return '#6b7280';
  if (statusLower.includes('coming soon')) return '#8b5cf6';
  
  return '#6b7280';
};

export const getDaysRemainingStyle = (days: number): string => {
  if (days <= 0) return 'text-red-600 dark:text-red-400 font-medium';
  if (days <= 7) return 'text-red-600 dark:text-red-400 font-medium';
  if (days <= 14) return 'text-orange-600 dark:text-orange-400 font-medium';
  return 'text-muted-foreground';
};

export const getStatusLabel = (status: string): string => {
  const statusLower = status.toLowerCase();
  
  if (statusLower.includes('active') || statusLower === 'for sale') return 'Active Listing';
  if (statusLower.includes('in_contract') || statusLower.includes('in contract')) return 'In Contract';
  if (statusLower.includes('under_contract') || statusLower.includes('under contract')) return 'Under Contract';
  if (statusLower.includes('pending')) return 'Pending';
  if (statusLower.includes('closed') || statusLower.includes('sold')) return 'Closed';
  if (statusLower.includes('withdrawn')) return 'Withdrawn';
  if (statusLower.includes('cancel')) return 'Cancelled';
  if (statusLower.includes('expired')) return 'Expired';
  if (statusLower.includes('coming soon')) return 'Coming Soon';
  if (statusLower.includes('clear_to_close') || statusLower.includes('clear to close')) return 'Clear to Close';
  if (statusLower.includes('pending_inspection') || statusLower.includes('pending inspection')) return 'Pending Inspection';
  
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
};
