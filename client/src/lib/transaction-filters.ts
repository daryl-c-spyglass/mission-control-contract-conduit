import { useState, useMemo, useCallback, useEffect } from "react";
import type { Transaction, Coordinator } from "@shared/schema";

export type ViewMode = "grid" | "list" | "table";

export type SortField = 
  | "address" 
  | "createdAt" 
  | "closingDate" 
  | "status" 
  | "daysRemaining";

export type SortDirection = "asc" | "desc";

export interface SortOption {
  label: string;
  field: SortField;
  direction: SortDirection;
}

export interface FilterState {
  status: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  coordinator: string | null;
  search: string;
}

export const SORT_OPTIONS: SortOption[] = [
  { label: "Newest First", field: "createdAt", direction: "desc" },
  { label: "Oldest First", field: "createdAt", direction: "asc" },
  { label: "Address A-Z", field: "address", direction: "asc" },
  { label: "Address Z-A", field: "address", direction: "desc" },
  { label: "Closing Soon", field: "closingDate", direction: "asc" },
  { label: "Closing Later", field: "closingDate", direction: "desc" },
  { label: "Status", field: "status", direction: "asc" },
  { label: "Days Remaining", field: "daysRemaining", direction: "asc" },
];

export const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "coming_soon", label: "Coming Soon" },
  { value: "active", label: "Active Listing" },
  { value: "in_contract", label: "In Contract" },
  { value: "pending", label: "Pending" },
  { value: "clear_to_close", label: "Clear to Close" },
  { value: "closed", label: "Closed" },
];

const STORAGE_KEY = "transaction-preferences";

interface TransactionPreferences {
  viewMode: ViewMode;
  sort: SortOption;
  filters: FilterState;
}

const defaultFilters: FilterState = {
  status: [],
  dateRange: { start: null, end: null },
  coordinator: null,
  search: "",
};

const defaultPreferences: TransactionPreferences = {
  viewMode: "grid",
  sort: SORT_OPTIONS[0],
  filters: defaultFilters,
};

function calculateDaysRemaining(transaction: Transaction): number {
  if (transaction.status === "closed") return Infinity;
  
  const targetDate = transaction.isOffMarket && transaction.goLiveDate
    ? transaction.goLiveDate
    : transaction.closingDate;
    
  if (!targetDate) return Infinity;
  
  const target = new Date(targetDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

const STATUS_ORDER = ["coming_soon", "active", "in_contract", "pending", "clear_to_close", "closed"];

export function useTransactionFilters(transactions: Transaction[]) {
  const [preferences, setPreferences] = useState<TransactionPreferences>(() => {
    if (typeof window === "undefined") return defaultPreferences;
    
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { 
          ...defaultPreferences, 
          ...parsed,
          filters: { ...defaultFilters, ...parsed.filters }
        };
      }
    } catch (e) {
      console.error("Failed to load preferences:", e);
    }
    return defaultPreferences;
  });

  const { viewMode, sort, filters } = preferences;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.error("Failed to save preferences:", e);
    }
  }, [preferences]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setPreferences(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const setSort = useCallback((sortOption: SortOption) => {
    setPreferences(prev => ({ ...prev, sort: sortOption }));
  }, []);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setPreferences(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setPreferences(prev => ({ ...prev, filters: defaultFilters }));
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      if (transaction.isArchived) return false;
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          transaction.propertyAddress?.toLowerCase().includes(searchLower) ||
          transaction.mlsNumber?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.status.length > 0 && !filters.status.includes(transaction.status)) {
        return false;
      }

      if (filters.coordinator) {
        const hasCoordinator = transaction.coordinatorIds?.includes(filters.coordinator);
        if (!hasCoordinator) return false;
      }

      if (filters.dateRange.start || filters.dateRange.end) {
        const closingDate = transaction.closingDate 
          ? new Date(transaction.closingDate) 
          : null;
        
        if (!closingDate) return false;
        
        if (filters.dateRange.start && closingDate < new Date(filters.dateRange.start)) {
          return false;
        }
        if (filters.dateRange.end && closingDate > new Date(filters.dateRange.end)) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sort.field) {
        case "address":
          comparison = (a.propertyAddress || "").localeCompare(b.propertyAddress || "");
          break;
          
        case "createdAt":
          const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = createdA - createdB;
          break;
          
        case "closingDate":
          const dateA = a.closingDate ? new Date(a.closingDate).getTime() : Infinity;
          const dateB = b.closingDate ? new Date(b.closingDate).getTime() : Infinity;
          comparison = dateA - dateB;
          break;
          
        case "status":
          comparison = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
          
        case "daysRemaining":
          const daysA = calculateDaysRemaining(a);
          const daysB = calculateDaysRemaining(b);
          comparison = daysA - daysB;
          break;
      }
      
      return sort.direction === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredTransactions, sort]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status.length > 0) count++;
    if (filters.coordinator) count++;
    if (filters.dateRange.start || filters.dateRange.end) count++;
    return count;
  }, [filters]);

  return {
    transactions: sortedTransactions,
    totalCount: transactions.filter(t => !t.isArchived).length,
    filteredCount: sortedTransactions.length,
    
    viewMode,
    setViewMode,
    
    sort,
    setSort,
    
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
  };
}
