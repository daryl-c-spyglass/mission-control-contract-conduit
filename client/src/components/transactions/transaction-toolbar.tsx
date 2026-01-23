import { useState } from "react";
import { 
  LayoutGrid, 
  List, 
  Table2, 
  SortAsc, 
  SortDesc, 
  Filter, 
  X, 
  ChevronDown,
  Search,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Coordinator } from "@shared/schema";
import type { ViewMode, SortOption, FilterState } from "@/lib/transaction-filters";
import { SORT_OPTIONS, STATUS_OPTIONS } from "@/lib/transaction-filters";

interface TransactionToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  filters: FilterState;
  onFiltersChange: (filters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  activeFilterCount: number;
  totalCount: number;
  filteredCount: number;
  coordinators: Coordinator[];
}

export function TransactionToolbar({
  viewMode,
  onViewModeChange,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
  onResetFilters,
  activeFilterCount,
  totalCount,
  filteredCount,
  coordinators,
}: TransactionToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by address or MLS#..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ search: e.target.value })}
            className="pl-10 pr-10"
            data-testid="input-search-transactions"
          />
          {filters.search && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onFiltersChange({ search: "" })}
              className="absolute right-1 top-1/2 -translate-y-1/2"
              data-testid="button-clear-search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="default" data-testid="button-sort">
                {sort.direction === "asc" ? (
                  <SortAsc className="h-4 w-4 mr-2" />
                ) : (
                  <SortDesc className="h-4 w-4 mr-2" />
                )}
                <span className="hidden sm:inline">{sort.label}</span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {SORT_OPTIONS.map((option) => {
                const isSelected = sort.field === option.field && sort.direction === option.direction;
                return (
                  <DropdownMenuItem
                    key={`${option.field}-${option.direction}`}
                    onClick={() => onSortChange(option)}
                    data-testid={`sort-${option.field}-${option.direction}`}
                  >
                    {isSelected && <Check className="mr-2 h-4 w-4" />}
                    {option.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={activeFilterCount > 0 ? "default" : "outline"}
            size="default"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewModeChange("grid")}
              title="Grid View"
              data-testid="button-view-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewModeChange("list")}
              title="List View"
              data-testid="button-view-list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "outline"}
              size="icon"
              onClick={() => onViewModeChange("table")}
              title="Table View"
              data-testid="button-view-table"
            >
              <Table2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-muted/50 rounded-lg p-4 border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-foreground">Filters</h3>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                data-testid="button-clear-filters"
              >
                Clear All
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Status
              </label>
              <Select
                value={filters.status[0] || "all"}
                onValueChange={(value) => {
                  onFiltersChange({ 
                    status: value === "all" ? [] : [value] 
                  });
                }}
              >
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Closing After
              </label>
              <Input
                type="date"
                value={filters.dateRange.start || ""}
                onChange={(e) => {
                  onFiltersChange({
                    dateRange: {
                      ...filters.dateRange,
                      start: e.target.value || null,
                    },
                  });
                }}
                data-testid="input-closing-after"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Closing Before
              </label>
              <Input
                type="date"
                value={filters.dateRange.end || ""}
                onChange={(e) => {
                  onFiltersChange({
                    dateRange: {
                      ...filters.dateRange,
                      end: e.target.value || null,
                    },
                  });
                }}
                data-testid="input-closing-before"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Coordinator
              </label>
              <Select
                value={filters.coordinator || "all"}
                onValueChange={(value) => {
                  onFiltersChange({ 
                    coordinator: value === "all" ? null : value 
                  });
                }}
              >
                <SelectTrigger data-testid="select-coordinator-filter">
                  <SelectValue placeholder="All Coordinators" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Coordinators</SelectItem>
                  {coordinators.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {filteredCount === totalCount ? (
          <span data-testid="text-results-count">Showing {totalCount} transactions</span>
        ) : (
          <span data-testid="text-results-count">
            Showing {filteredCount} of {totalCount} transactions
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResetFilters}
                className="ml-2"
                data-testid="button-clear-filters-inline"
              >
                Clear filters
              </Button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
