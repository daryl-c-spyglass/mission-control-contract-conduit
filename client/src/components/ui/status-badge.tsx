import { cn } from '@/lib/utils';
import { getStatusConfig } from '@/lib/utils/status-colors';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = getStatusConfig(status);
  
  return (
    <span 
      className={cn(
        "inline-flex items-center font-medium rounded-full whitespace-nowrap",
        size === 'sm' ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        config.badge,
        className
      )}
      data-testid={`badge-status-${status.toLowerCase().replace(/\s+/g, '-')}`}
    >
      {config.label}
    </span>
  );
}
