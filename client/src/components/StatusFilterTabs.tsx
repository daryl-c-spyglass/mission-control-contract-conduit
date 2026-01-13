import { cn } from "@/lib/utils";

interface StatusFilterTabsProps {
  counts: {
    all: number;
    active: number;
    underContract: number;
    closed: number;
  };
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function StatusFilterTabs({ counts, activeFilter, onFilterChange }: StatusFilterTabsProps) {
  const filters = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'active', label: 'Active', count: counts.active },
    { key: 'underContract', label: 'Under Contract', count: counts.underContract },
    { key: 'closed', label: 'Closed', count: counts.closed },
  ];

  return (
    <div 
      className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto"
      data-testid="status-filter-tabs"
    >
      {filters.map(filter => (
        <button
          key={filter.key}
          onClick={() => onFilterChange(filter.key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1.5",
            activeFilter === filter.key 
              ? "bg-background shadow-sm text-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          data-testid={`button-filter-${filter.key}`}
        >
          <span>{filter.label}</span>
          <span 
            className={cn(
              "px-1.5 py-0.5 rounded-full text-xs tabular-nums",
              activeFilter === filter.key 
                ? filter.key === 'active' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : filter.key === 'underContract' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                : filter.key === 'closed' ? "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-400"
                : "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {filter.count}
          </span>
        </button>
      ))}
    </div>
  );
}
