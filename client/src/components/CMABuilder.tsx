import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, TrendingUp, Search, Loader2, AlertCircle, Home, MousePointerClick, RotateCcw, ChevronLeft, ChevronRight, Info, Map, ListFilter, Sparkles, LayoutGrid, List, Table2, Filter } from "lucide-react";
import { StatusFilterTabs } from "@/components/StatusFilterTabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PolygonMapSearch } from "@/components/PolygonMapSearch";
import VisualMatchPanel, { type ImageSearchItem } from "@/components/VisualMatchPanel";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Property } from "@shared/schema";

interface AutocompleteInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  endpoint: string;
  testId?: string;
  className?: string;
  name?: string;
}

function AutocompleteInput({ placeholder, value, onChange, endpoint, testId, className, name }: AutocompleteInputProps) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      // Handle both array response and { suggestions: [] } format
      if (Array.isArray(data)) {
        // API returns array of { value, count } objects
        setSuggestions(data.map((item: any) => typeof item === 'string' ? item : item.value));
      } else if (data.suggestions) {
        setSuggestions(data.suggestions);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchSuggestions(inputValue);
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [inputValue, fetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    onChange(newValue);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    onChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        data-testid={testId}
        name={name}
        autoComplete="off"
        className={cn("h-10", className)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className="px-3 py-2 cursor-pointer hover-elevate text-sm"
              onClick={() => handleSuggestionClick(suggestion)}
              data-testid={`suggestion-${testId}-${index}`}
            >
              {suggestion}
            </div>
          ))}
        </div>
      )}
      {isLoading && inputValue.length >= 2 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

interface UnifiedSearchResponse {
  properties: Property[];
  count: number;
  status: string;
  schoolFilterWarning?: string | null;
}

// Property type options for the dropdown - matches Repliers propertySubType values exactly
const PROPERTY_TYPES = [
  { value: 'Single Family Residence', label: 'Single Family Residence' },
  { value: 'Condominium', label: 'Condominium' },
  { value: 'Townhouse', label: 'Townhouse' },
  { value: 'Multi-Family', label: 'Multi-Family' },
  { value: 'Ranch', label: 'Ranch' },
  { value: 'Manufactured Home', label: 'Manufactured Home' },
  { value: 'Unimproved Land', label: 'Unimproved Land' },
  { value: 'Multiple Lots (Adjacent)', label: 'Multiple Lots' },
];

interface InitialCMAData {
  name?: string;
  searchCriteria?: {
    city?: string;
    subdivision?: string;
    zipCode?: string;
    schoolDistrict?: string;
    elementarySchool?: string;
    middleSchool?: string;
    highSchool?: string;
    minBeds?: string;
    maxBeds?: string;
    minPrice?: string;
    maxPrice?: string;
    minBaths?: string;
    maxBaths?: string;
    statuses?: string[];
    minSqft?: string;
    maxSqft?: string;
    minLotAcres?: string;
    maxLotAcres?: string;
    minYearBuilt?: string;
    maxYearBuilt?: string;
    stories?: string;
    garage?: string;
    propertyType?: string;
    soldDays?: string;
  };
  comparables?: Property[];
  subjectProperty?: Property | null;
}

interface CMABuilderProps {
  onCreateCMA: (data: {
    name: string;
    subjectPropertyId?: string;
    comparablePropertyIds: string[];
    propertiesData: any[];
    searchCriteria?: any;
  }) => void;
  initialData?: InitialCMAData;
}

export function CMABuilder({ onCreateCMA, initialData }: CMABuilderProps) {
  const { toast } = useToast();
  const sc = initialData?.searchCriteria || {};
  
  const [cmaName, setCmaName] = useState(initialData?.name || "");
  const [hasUserEditedName, setHasUserEditedName] = useState(!!initialData?.name);
  const [subjectProperty, setSubjectProperty] = useState<Property | null>(initialData?.subjectProperty || null);
  const [comparables, setComparables] = useState<Property[]>(initialData?.comparables || []);
  const searchSectionRef = useRef<HTMLDivElement>(null);
  
  const [manualSubjectAddress, setManualSubjectAddress] = useState("");
  const [manualSubjectCity, setManualSubjectCity] = useState("");
  const [manualSubjectState, setManualSubjectState] = useState("");
  const [manualSubjectZip, setManualSubjectZip] = useState("");
  const [manualSubjectListPrice, setManualSubjectListPrice] = useState("");
  const [manualSubjectBeds, setManualSubjectBeds] = useState("");
  const [manualSubjectBaths, setManualSubjectBaths] = useState("");
  const [manualSubjectSqft, setManualSubjectSqft] = useState("");
  
  const [searchCity, setSearchCity] = useState(sc.city || "");
  const [searchSubdivision, setSearchSubdivision] = useState(sc.subdivision || "");
  const [searchZipCode, setSearchZipCode] = useState(sc.zipCode || "");
  const [searchSchoolDistrict, setSearchSchoolDistrict] = useState(sc.schoolDistrict || "");
  const [searchElementarySchool, setSearchElementarySchool] = useState(sc.elementarySchool || "");
  const [searchMiddleSchool, setSearchMiddleSchool] = useState(sc.middleSchool || "");
  const [searchHighSchool, setSearchHighSchool] = useState(sc.highSchool || "");
  const [searchMinBeds, setSearchMinBeds] = useState(sc.minBeds || "");
  const [searchMaxBeds, setSearchMaxBeds] = useState(sc.maxBeds || "");
  const [searchMinPrice, setSearchMinPrice] = useState(sc.minPrice || "");
  const [searchMaxPrice, setSearchMaxPrice] = useState(sc.maxPrice || "");
  const [searchMinBaths, setSearchMinBaths] = useState(sc.minBaths || "");
  const [searchMaxBaths, setSearchMaxBaths] = useState(sc.maxBaths || "");
  const [searchStatuses, setSearchStatuses] = useState<string[]>(sc.statuses || ["active"]);
  const [searchEnabled, setSearchEnabled] = useState(!!initialData?.searchCriteria);

  // Generate default CMA name based on subdivision, status, and date/time
  const generateDefaultName = useCallback(() => {
    const parts: string[] = [];
    
    // Use subdivision if available, otherwise city
    if (searchSubdivision.trim()) {
      parts.push(searchSubdivision.trim());
    } else if (searchCity.trim()) {
      parts.push(searchCity.trim());
    }
    
    // Format status(es)
    if (searchStatuses.length > 0) {
      const statusMap: Record<string, string> = {
        'active': 'Active',
        'under_contract': 'Active Under Contract',
        'closed': 'Closed'
      };
      const formattedStatuses = searchStatuses.map(s => statusMap[s] || s).join('/');
      parts.push(formattedStatuses);
    }
    
    // Add current date/time
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    parts.push(`${dateStr} ${timeStr}`);
    
    return parts.join(' - ');
  }, [searchSubdivision, searchCity, searchStatuses]);

  // Auto-update CMA name when search criteria changes (unless user has manually edited)
  // Always generate a default name - even on initial load with just the default "active" status
  useEffect(() => {
    if (!hasUserEditedName) {
      setCmaName(generateDefaultName());
    }
  }, [searchSubdivision, searchCity, searchStatuses, hasUserEditedName, generateDefaultName]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCmaName(e.target.value);
    setHasUserEditedName(true);
  };
  const [searchMinSqft, setSearchMinSqft] = useState(sc.minSqft || "");
  const [searchMaxSqft, setSearchMaxSqft] = useState(sc.maxSqft || "");
  const [searchMinLotAcres, setSearchMinLotAcres] = useState(sc.minLotAcres || "");
  const [searchMaxLotAcres, setSearchMaxLotAcres] = useState(sc.maxLotAcres || "");
  const [searchStories, setSearchStories] = useState(sc.stories || "");
  const [searchMinYearBuilt, setSearchMinYearBuilt] = useState(sc.minYearBuilt || "");
  const [searchMaxYearBuilt, setSearchMaxYearBuilt] = useState(sc.maxYearBuilt || "");
  const [searchSoldDays, setSearchSoldDays] = useState(sc.soldDays || "365");
  const [searchPropertyType, setSearchPropertyType] = useState(sc.propertyType || "");
  
  // Search mode state
  const [searchMode, setSearchMode] = useState<'criteria' | 'map'>('criteria');
  const [mapSearchResults, setMapSearchResults] = useState<Property[]>([]);
  const [isMapSearching, setIsMapSearching] = useState(false);
  const [currentBoundary, setCurrentBoundary] = useState<number[][][] | null>(null);
  
  // Visual Match AI search state (for ranking comps by visual similarity)
  const [visualMatchEnabled, setVisualMatchEnabled] = useState(false);
  const [visualMatchItems, setVisualMatchItems] = useState<ImageSearchItem[]>([]);
  const [visualMatchResults, setVisualMatchResults] = useState<Property[]>([]);
  const [isVisualSearching, setIsVisualSearching] = useState(false);
  const [visualMatchError, setVisualMatchError] = useState<string>("");
  
  // Property detail dialog state
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  // View mode state - persisted to localStorage
  type ViewMode = 'grid' | 'list' | 'table';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('cma-view-mode') : null;
      if (saved === 'grid' || saved === 'list' || saved === 'table') {
        return saved;
      }
    } catch {
      // localStorage may not be available
    }
    return 'grid';
  });
  
  // Persist view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cma-view-mode', mode);
    } catch {
      // localStorage may not be available
    }
  };
  
  // Status filter for client-side filtering of already-fetched results
  const [statusDisplayFilter, setStatusDisplayFilter] = useState<string>('all');
  
  // Autoplay carousel effect - advance every 3 seconds when dialog is open
  useEffect(() => {
    if (!selectedProperty) return;
    const photos = ((selectedProperty as any).photos as string[] | undefined) || [];
    if (photos.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [selectedProperty]);

  const resetForm = () => {
    setCmaName("");
    setHasUserEditedName(false);
    setSubjectProperty(null);
    setComparables([]);
    setSearchCity("");
    setSearchSubdivision("");
    setSearchZipCode("");
    setSearchMinBeds("");
    setSearchMaxBeds("");
    setSearchMinPrice("");
    setSearchMaxPrice("");
    setSearchMinBaths("");
    setSearchMaxBaths("");
    setSearchStatuses(["active"]);
    setSearchEnabled(false);
    setSearchMinSqft("");
    setSearchMaxSqft("");
    setSearchMinLotAcres("");
    setSearchMaxLotAcres("");
    setSearchStories("");
    setSearchMinYearBuilt("");
    setSearchMaxYearBuilt("");
    setSearchSoldDays("");
    setSearchPropertyType("");
    setStatusDisplayFilter('all');
  };
  
  const clearFilters = () => {
    setSearchCity("");
    setSearchSubdivision("");
    setSearchZipCode("");
    setSearchSchoolDistrict("");
    setSearchElementarySchool("");
    setSearchMiddleSchool("");
    setSearchHighSchool("");
    setSearchMinBeds("");
    setSearchMaxBeds("");
    setSearchMinPrice("");
    setSearchMaxPrice("");
    setVisualMatchEnabled(false);
    setVisualMatchItems([]);
    setVisualMatchResults([]);
    setSearchMinBaths("");
    setSearchMaxBaths("");
    setSearchStatuses(["active"]);
    setSearchMinSqft("");
    setSearchMaxSqft("");
    setSearchMinLotAcres("");
    setSearchMaxLotAcres("");
    setSearchStories("");
    setSearchMinYearBuilt("");
    setSearchMaxYearBuilt("");
    setSearchSoldDays("");
    setSearchPropertyType("");
    setSearchEnabled(false);
    setStatusDisplayFilter('all');
  };

  const buildSearchQuery = () => {
    const params = new URLSearchParams();
    // Support multiple statuses as comma-separated values
    if (searchStatuses.length > 0) {
      params.set('statuses', searchStatuses.join(','));
    }
    if (searchCity) params.set('city', searchCity.trim());
    if (searchSubdivision) params.set('subdivision', searchSubdivision.trim());
    if (searchZipCode) params.set('postalCode', searchZipCode.trim());
    if (searchSchoolDistrict) params.set('schoolDistrict', searchSchoolDistrict.trim());
    if (searchElementarySchool) params.set('elementarySchools', searchElementarySchool.trim());
    if (searchMiddleSchool) params.set('middleSchools', searchMiddleSchool.trim());
    if (searchHighSchool) params.set('highSchools', searchHighSchool.trim());
    if (searchMinBeds && searchMinBeds !== 'any') params.set('bedsMin', searchMinBeds);
    if (searchMaxBeds && searchMaxBeds !== 'any') params.set('bedsMax', searchMaxBeds);
    if (searchMinPrice && searchMinPrice !== 'any') params.set('minPrice', searchMinPrice);
    if (searchMaxPrice && searchMaxPrice !== 'any') params.set('maxPrice', searchMaxPrice);
    if (searchMinBaths && searchMinBaths !== 'any') params.set('bathsMin', searchMinBaths);
    if (searchMaxBaths && searchMaxBaths !== 'any') params.set('bathsMax', searchMaxBaths);
    if (searchMinSqft) params.set('minSqft', searchMinSqft);
    if (searchMaxSqft) params.set('maxSqft', searchMaxSqft);
    if (searchMinLotAcres) params.set('minLotAcres', searchMinLotAcres);
    if (searchMaxLotAcres) params.set('maxLotAcres', searchMaxLotAcres);
    if (searchStories && searchStories !== 'any') params.set('stories', searchStories);
    if (searchMinYearBuilt) params.set('minYearBuilt', searchMinYearBuilt);
    if (searchMaxYearBuilt) params.set('maxYearBuilt', searchMaxYearBuilt);
    // Only include soldDays when searching for Closed status
    if (searchStatuses.includes('closed') && searchSoldDays && searchSoldDays !== 'any') {
      params.set('soldDays', searchSoldDays);
    }
    if (searchPropertyType && searchPropertyType !== 'any') params.set('propertySubType', searchPropertyType);
    // Sort by listing date for active/under contract
    if (searchStatuses.includes('active') || searchStatuses.includes('under_contract')) {
      params.set('sortBy', 'listingContractDate');
      params.set('sortOrder', 'desc');
    }
    // CMA always uses sale listings only (no rentals/leases)
    params.set('type', 'sale');
    params.set('limit', '20');
    return params.toString();
  };
  
  const toggleStatus = (status: string) => {
    setSearchStatuses(prev => {
      if (prev.includes(status)) {
        // Don't allow deselecting all statuses
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  const { data: searchResponse, isLoading, isError, error, refetch } = useQuery<UnifiedSearchResponse>({
    queryKey: ['/api/search', buildSearchQuery()],
    queryFn: async () => {
      const res = await fetch(`/api/search?${buildSearchQuery()}`);
      if (!res.ok) throw new Error('Failed to search properties');
      return res.json();
    },
    enabled: searchEnabled,
    retry: 1,
  });

  const searchResults = searchResponse?.properties || [];
  const totalResults = searchResponse?.count || 0;
  const schoolFilterWarning = searchResponse?.schoolFilterWarning;
  
  // Reset status filter when search results change (new search performed)
  const prevSearchResultsRef = useRef<Property[]>([]);
  useEffect(() => {
    // Only reset if the results have actually changed (new search)
    if (searchResults !== prevSearchResultsRef.current && searchResults.length > 0) {
      setStatusDisplayFilter('all');
      prevSearchResultsRef.current = searchResults;
    }
  }, [searchResults]);

  const handleSearch = () => {
    const missingFields: string[] = [];
    
    // Close Date is only required when searching for Closed/Sold properties
    if (searchStatuses.includes('closed') && (!searchSoldDays || searchSoldDays === 'any')) {
      missingFields.push('Close Date');
    }
    if (!searchPropertyType || searchPropertyType === 'any') {
      missingFields.push('Property Type');
    }
    // Sqft fields are now optional - users can leave blank for broader results
    
    if (missingFields.length > 0) {
      toast({
        title: "Required Fields Missing",
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }
    
    setSearchEnabled(true);
    refetch();
  };

  // Visual Match AI search handler for ranking comps
  const handleVisualSearch = async () => {
    if (visualMatchItems.length === 0) return;
    
    setIsVisualSearching(true);
    setVisualMatchError("");
    
    try {
      // Build criteria from current search filters
      const criteria: any = {
        resultsPerPage: 50,
        pageNum: 1,
      };
      
      // Add status filters - prefer closed for CMAs
      if (searchStatuses.includes('closed')) {
        criteria.standardStatus = 'Closed';
      } else if (searchStatuses.includes('active')) {
        criteria.standardStatus = 'Active';
      }
      
      // CMA always uses sale listings only (no rentals/leases)
      criteria.type = 'sale';
      
      // Add filters
      if (searchCity) criteria.city = searchCity;
      if (searchZipCode) criteria.postalCode = searchZipCode;
      if (searchSubdivision) criteria.subdivision = searchSubdivision;
      if (searchMinPrice && searchMinPrice !== 'any') criteria.minPrice = parseInt(searchMinPrice);
      if (searchMaxPrice && searchMaxPrice !== 'any') criteria.maxPrice = parseInt(searchMaxPrice);
      if (searchMinBeds && searchMinBeds !== 'any') criteria.minBeds = parseInt(searchMinBeds);
      if (searchMaxBeds && searchMaxBeds !== 'any') criteria.maxBeds = parseInt(searchMaxBeds);
      if (searchMinBaths && searchMinBaths !== 'any') criteria.minBaths = parseInt(searchMinBaths);
      if (searchMinSqft) criteria.minSqft = parseInt(searchMinSqft);
      if (searchMaxSqft) criteria.maxSqft = parseInt(searchMaxSqft);
      
      const response = await fetch('/api/repliers/image-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageSearchItems: visualMatchItems,
          criteria,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Visual search failed');
      }
      
      setVisualMatchResults(data.listings || []);
      
      if ((data.listings || []).length === 0) {
        setVisualMatchError("No matching properties found. Try different search criteria.");
      }
    } catch (error: any) {
      console.error('Visual search error:', error);
      setVisualMatchResults([]);
      setVisualMatchError(error.message || "Visual search failed. Please try again.");
    } finally {
      setIsVisualSearching(false);
    }
  };

  // Map polygon search handler
  const handlePolygonSearch = async (boundary: number[][][]) => {
    setCurrentBoundary(boundary);
    await executePolygonSearch(boundary);
  };
  
  // Execute polygon search with current filters
  const executePolygonSearch = async (boundary: number[][][]) => {
    setIsMapSearching(true);
    try {
      const response = await apiRequest('/api/properties/search/polygon', 'POST', {
        boundary,
        statuses: searchStatuses,
        limit: 50,
        type: 'sale',  // CMA always uses sale listings only (no rentals/leases)
        minBeds: searchMinBeds && searchMinBeds !== 'any' ? parseInt(searchMinBeds) : undefined,
        maxBeds: searchMaxBeds && searchMaxBeds !== 'any' ? parseInt(searchMaxBeds) : undefined,
        minBaths: searchMinBaths && searchMinBaths !== 'any' ? parseInt(searchMinBaths) : undefined,
        minPrice: searchMinPrice && searchMinPrice !== 'any' ? parseInt(searchMinPrice) : undefined,
        maxPrice: searchMaxPrice && searchMaxPrice !== 'any' ? parseInt(searchMaxPrice) : undefined,
        minSqft: searchMinSqft ? parseInt(searchMinSqft) : undefined,
        maxSqft: searchMaxSqft ? parseInt(searchMaxSqft) : undefined,
        propertyType: searchPropertyType && searchPropertyType !== 'any' ? searchPropertyType : undefined,
        minYearBuilt: searchMinYearBuilt ? parseInt(searchMinYearBuilt) : undefined,
        maxYearBuilt: searchMaxYearBuilt ? parseInt(searchMaxYearBuilt) : undefined,
        soldDays: searchSoldDays && searchSoldDays !== 'any' ? parseInt(searchSoldDays) : undefined,
      });
      const data = await response.json();
      setMapSearchResults(data.properties || []);
    } catch (err) {
      console.error('Polygon search error:', err);
      setMapSearchResults([]);
    } finally {
      setIsMapSearching(false);
    }
  };
  
  // Re-run polygon search with current boundary and updated filters
  const handleMapFilterSearch = () => {
    if (currentBoundary) {
      executePolygonSearch(currentBoundary);
    }
  };

  const handleClearPolygonSearch = () => {
    setMapSearchResults([]);
    setCurrentBoundary(null);
  };

  // Get the base results based on search mode and visual match
  const baseSearchResults = visualMatchEnabled && visualMatchResults.length > 0 
    ? visualMatchResults 
    : searchMode === 'map' 
      ? mapSearchResults 
      : searchResults;
  
  // Calculate status counts for the filter tabs (client-side)
  const statusCounts = useMemo(() => {
    const counts = {
      all: baseSearchResults.length,
      active: 0,
      underContract: 0,
      closed: 0,
    };
    
    baseSearchResults.forEach((listing) => {
      const status = listing.standardStatus;
      if (status === 'Active') {
        counts.active++;
      } else if (status === 'Active Under Contract' || status === 'Pending') {
        counts.underContract++;
      } else if (status === 'Closed') {
        counts.closed++;
      }
    });
    
    return counts;
  }, [baseSearchResults]);
  
  // Filter results by selected status (client-side filtering of already-fetched data)
  const activeSearchResults = useMemo(() => {
    if (statusDisplayFilter === 'all') return baseSearchResults;
    
    return baseSearchResults.filter((listing) => {
      const status = listing.standardStatus;
      
      switch (statusDisplayFilter) {
        case 'active':
          return status === 'Active';
        case 'underContract':
          return status === 'Active Under Contract' || status === 'Pending';
        case 'closed':
          return status === 'Closed';
        default:
          return true;
      }
    });
  }, [baseSearchResults, statusDisplayFilter]);
  
  const activeResultCount = visualMatchEnabled && visualMatchResults.length > 0
    ? visualMatchResults.length
    : searchMode === 'map' 
      ? mapSearchResults.length 
      : totalResults;

  const handleAddComparable = (property: Property) => {
    if (!comparables.find(p => p.id === property.id)) {
      setComparables([...comparables, property]);
    }
  };

  const handleRemoveComparable = (propertyId: string) => {
    setComparables(comparables.filter(p => p.id !== propertyId));
  };

  const handleSetSubject = (property: Property) => {
    setSubjectProperty(property);
  };

  const generateDefaultCMAName = () => {
    // Get status description
    const statusLabels = searchStatuses.map(s => {
      if (s === 'active') return 'Active';
      if (s === 'under_contract') return 'Active Under Contract';
      if (s === 'closed') return 'Closed';
      return s;
    }).join(' & ');
    
    // Get location from search criteria or first property
    const location = searchSubdivision 
      || searchCity 
      || comparables[0]?.subdivision 
      || comparables[0]?.city 
      || 'Properties';
    
    // Format current date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return `${location} - ${statusLabels} - ${dateStr} ${timeStr}`;
  };

  const handleCreate = () => {
    if (!subjectProperty) {
      // Subject property is required
      return;
    }
    if (comparables.length > 0) {
      const allProperties = subjectProperty 
        ? [subjectProperty, ...comparables] 
        : comparables;
      
      // Use user-provided name or generate a descriptive default
      const finalName = cmaName.trim() || generateDefaultCMAName();
      
      // Build search criteria to save with CMA for "Modify Search" feature
      const searchCriteria = {
        city: searchCity,
        subdivision: searchSubdivision,
        zipCode: searchZipCode,
        minBeds: searchMinBeds,
        maxBeds: searchMaxBeds,
        minPrice: searchMinPrice,
        maxPrice: searchMaxPrice,
        minBaths: searchMinBaths,
        maxBaths: searchMaxBaths,
        statuses: searchStatuses,
        minSqft: searchMinSqft,
        maxSqft: searchMaxSqft,
        minLotAcres: searchMinLotAcres,
        maxLotAcres: searchMaxLotAcres,
        minYearBuilt: searchMinYearBuilt,
        maxYearBuilt: searchMaxYearBuilt,
        stories: searchStories,
        soldDays: searchSoldDays,
        propertyType: searchPropertyType,
      };
      
      onCreateCMA({
        name: finalName,
        subjectPropertyId: subjectProperty?.id,
        comparablePropertyIds: comparables.map(p => p.id),
        propertiesData: allProperties,
        searchCriteria,
      });
      resetForm();
    }
  };

  const formatPrice = (price: string | number | null | undefined) => {
    if (!price) return 'N/A';
    return `$${Number(price).toLocaleString()}`;
  };

  const getPriceDisplay = (property: Property) => {
    if (property.standardStatus === 'Closed' && property.closePrice) {
      return formatPrice(property.closePrice);
    }
    return formatPrice(property.listPrice);
  };

  const getPriceLabel = (property: Property) => {
    if (property.standardStatus === 'Closed' && property.closePrice) {
      return 'Closed';
    }
    return 'List';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>CMA Information</CardTitle>
          <CardDescription>Name your Comparative Market Analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cma-name">CMA Name</Label>
            <Input
              id="cma-name"
              name="cma-name"
              placeholder="Auto-generated: Subdivision - Status - Date/Time"
              value={cmaName}
              onChange={handleNameChange}
              data-testid="input-cma-name"
              autoComplete="on"
            />
          </div>
        </CardContent>
      </Card>

      <Card ref={searchSectionRef}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Search Properties
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Clear Filters
            </Button>
          </div>
          <CardDescription>
            Find comparable properties from the Repliers database (30,000+ active listings)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'criteria' | 'map')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="criteria" className="gap-2" data-testid="tab-search-criteria">
                <ListFilter className="w-4 h-4" />
                Search by Criteria
              </TabsTrigger>
              <TabsTrigger value="map" className="gap-2" data-testid="tab-search-map">
                <Map className="w-4 h-4" />
                Search by Map
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="criteria" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <AutocompleteInput
                    placeholder="e.g., Austin"
                    value={searchCity}
                    onChange={setSearchCity}
                    endpoint="/api/autocomplete/cities"
                    testId="input-search-city"
                    name="city"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subdivision</Label>
                  <AutocompleteInput
                    placeholder="e.g., Barton Hills"
                    value={searchSubdivision}
                    onChange={setSearchSubdivision}
                    endpoint="/api/autocomplete/subdivisions"
                    testId="input-search-subdivision"
                    name="subdivision"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Zip Code</Label>
                  <AutocompleteInput
                    placeholder="e.g., 78704"
                    value={searchZipCode}
                    onChange={setSearchZipCode}
                    endpoint="/api/autocomplete/postalCodes"
                    testId="input-search-zipcode"
                    name="zipCode"
                  />
                </div>
                <div className="space-y-2">
                  <Label>School District</Label>
                  <AutocompleteInput
                    placeholder="e.g., Austin ISD"
                    value={searchSchoolDistrict}
                    onChange={setSearchSchoolDistrict}
                    endpoint="/api/autocomplete/schoolDistricts"
                    testId="input-search-school-district"
                    name="schoolDistrict"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Elementary School</Label>
                  <AutocompleteInput
                    placeholder="e.g., Barton Hills"
                    value={searchElementarySchool}
                    onChange={setSearchElementarySchool}
                    endpoint="/api/autocomplete/elementarySchools"
                    testId="input-search-elementary"
                    name="elementarySchool"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Middle School</Label>
                  <AutocompleteInput
                    placeholder="e.g., O Henry"
                    value={searchMiddleSchool}
                    onChange={setSearchMiddleSchool}
                    endpoint="/api/autocomplete/middleSchools"
                    testId="input-search-middle"
                    name="middleSchool"
                  />
                </div>
                <div className="space-y-2">
                  <Label>High School</Label>
                  <AutocompleteInput
                    placeholder="e.g., Austin High"
                    value={searchHighSchool}
                    onChange={setSearchHighSchool}
                    endpoint="/api/autocomplete/highSchools"
                    testId="input-search-high"
                    name="highSchool"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Beds</Label>
                  <Select value={searchMinBeds} onValueChange={setSearchMinBeds}>
                    <SelectTrigger data-testid="select-min-beds">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                      <SelectItem value="5">5+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Baths</Label>
                  <Select value={searchMinBaths} onValueChange={setSearchMinBaths}>
                    <SelectTrigger data-testid="select-min-baths">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">1+</SelectItem>
                      <SelectItem value="2">2+</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                      <SelectItem value="4">4+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Price</Label>
                  <Select value={searchMinPrice} onValueChange={setSearchMinPrice}>
                    <SelectTrigger data-testid="select-min-price">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="100000">$100K</SelectItem>
                      <SelectItem value="200000">$200K</SelectItem>
                      <SelectItem value="300000">$300K</SelectItem>
                      <SelectItem value="500000">$500K</SelectItem>
                      <SelectItem value="750000">$750K</SelectItem>
                      <SelectItem value="1000000">$1M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Price</Label>
                  <Select value={searchMaxPrice} onValueChange={setSearchMaxPrice}>
                    <SelectTrigger data-testid="select-max-price">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="300000">$300K</SelectItem>
                      <SelectItem value="500000">$500K</SelectItem>
                      <SelectItem value="750000">$750K</SelectItem>
                      <SelectItem value="1000000">$1M</SelectItem>
                      <SelectItem value="2000000">$2M</SelectItem>
                      <SelectItem value="5000000">$5M</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Property Type <span className="text-destructive">*</span></Label>
                  <Select value={searchPropertyType} onValueChange={setSearchPropertyType}>
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROPERTY_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                <Label className="text-sm font-medium">Status:</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-active"
                    checked={searchStatuses.includes("active")}
                    onCheckedChange={() => toggleStatus("active")}
                    data-testid="checkbox-status-active"
                  />
                  <label htmlFor="status-active" className="text-sm cursor-pointer">Active</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-under-contract"
                    checked={searchStatuses.includes("under_contract")}
                    onCheckedChange={() => toggleStatus("under_contract")}
                    data-testid="checkbox-status-under-contract"
                  />
                  <label htmlFor="status-under-contract" className="text-sm cursor-pointer">Active Under Contract</label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="status-closed"
                    checked={searchStatuses.includes("closed")}
                    onCheckedChange={() => toggleStatus("closed")}
                    data-testid="checkbox-status-closed"
                  />
                  <label htmlFor="status-closed" className="text-sm cursor-pointer">Closed</label>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {/* Close Date - Only show when Closed status is selected */}
                {searchStatuses.includes("closed") && (
                  <div className="space-y-2">
                    <Label>Close Date <span className="text-destructive">*</span></Label>
                    <Select value={searchSoldDays} onValueChange={setSearchSoldDays}>
                      <SelectTrigger data-testid="select-sold-days">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90">0-90 days</SelectItem>
                        <SelectItem value="150">0-150 days</SelectItem>
                        <SelectItem value="180">0-180 days</SelectItem>
                        <SelectItem value="365">0-365 days (default)</SelectItem>
                        <SelectItem value="730">0-730 days (2 years)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Min Sq Ft</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 2000"
                    value={searchMinSqft}
                    onChange={(e) => setSearchMinSqft(e.target.value)}
                    data-testid="input-min-sqft"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Sq Ft</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5000"
                    value={searchMaxSqft}
                    onChange={(e) => setSearchMaxSqft(e.target.value)}
                    data-testid="input-max-sqft"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Lot (Acres)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 0.25"
                    value={searchMinLotAcres}
                    onChange={(e) => setSearchMinLotAcres(e.target.value)}
                    data-testid="input-min-lot-acres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Lot (Acres)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 1.0"
                    value={searchMaxLotAcres}
                    onChange={(e) => setSearchMaxLotAcres(e.target.value)}
                    data-testid="input-max-lot-acres"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stories</Label>
                  <Select value={searchStories} onValueChange={setSearchStories}>
                    <SelectTrigger data-testid="select-stories">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Min Year Built</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 1990"
                    value={searchMinYearBuilt}
                    onChange={(e) => setSearchMinYearBuilt(e.target.value)}
                    data-testid="input-min-year-built"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Year Built</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 2024"
                    value={searchMaxYearBuilt}
                    onChange={(e) => setSearchMaxYearBuilt(e.target.value)}
                    data-testid="input-max-year-built"
                  />
                </div>
              </div>
              
              <Separator className="my-4" />
              
              {/* Visual Match AI Search - rank comps by visual similarity */}
              <VisualMatchPanel
                enabled={visualMatchEnabled}
                onEnabledChange={(enabled) => {
                  setVisualMatchEnabled(enabled);
                  if (!enabled) {
                    setVisualMatchResults([]);
                    setVisualMatchError("");
                  }
                }}
                items={visualMatchItems}
                onItemsChange={setVisualMatchItems}
                isSearching={isVisualSearching}
                onSearch={handleVisualSearch}
                compact={true}
                error={visualMatchError}
              />
              
              <Separator className="my-4" />
              
              <Button onClick={handleSearch} disabled={isLoading} data-testid="button-search-properties">
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Search Properties
              </Button>
            </TabsContent>
            
            <TabsContent value="map" className="space-y-4">
              <PolygonMapSearch
                onSearch={handlePolygonSearch}
                onClear={handleClearPolygonSearch}
                isLoading={isMapSearching}
                resultCount={mapSearchResults.length}
              />
              
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Filter properties within polygon:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <AutocompleteInput
                      placeholder="e.g., Austin"
                      value={searchCity}
                      onChange={setSearchCity}
                      endpoint="/api/autocomplete/cities"
                      testId="input-map-search-city"
                      name="map-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Subdivision</Label>
                    <AutocompleteInput
                      placeholder="e.g., Barton Hills"
                      value={searchSubdivision}
                      onChange={setSearchSubdivision}
                      endpoint="/api/autocomplete/subdivisions"
                      testId="input-map-search-subdivision"
                      name="map-subdivision"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zip Code</Label>
                    <AutocompleteInput
                      placeholder="e.g., 78704"
                      value={searchZipCode}
                      onChange={setSearchZipCode}
                      endpoint="/api/autocomplete/postalCodes"
                      testId="input-map-search-zipcode"
                      name="map-zipCode"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Beds</Label>
                    <Select value={searchMinBeds} onValueChange={setSearchMinBeds}>
                      <SelectTrigger data-testid="select-map-min-beds">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                        <SelectItem value="5">5+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min Baths</Label>
                    <Select value={searchMinBaths} onValueChange={setSearchMinBaths}>
                      <SelectTrigger data-testid="select-map-min-baths">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                        <SelectItem value="4">4+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min Price</Label>
                    <Select value={searchMinPrice} onValueChange={setSearchMinPrice}>
                      <SelectTrigger data-testid="select-map-min-price">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="100000">$100K</SelectItem>
                        <SelectItem value="200000">$200K</SelectItem>
                        <SelectItem value="300000">$300K</SelectItem>
                        <SelectItem value="500000">$500K</SelectItem>
                        <SelectItem value="750000">$750K</SelectItem>
                        <SelectItem value="1000000">$1M</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Price</Label>
                    <Select value={searchMaxPrice} onValueChange={setSearchMaxPrice}>
                      <SelectTrigger data-testid="select-map-max-price">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="300000">$300K</SelectItem>
                        <SelectItem value="500000">$500K</SelectItem>
                        <SelectItem value="750000">$750K</SelectItem>
                        <SelectItem value="1000000">$1M</SelectItem>
                        <SelectItem value="2000000">$2M</SelectItem>
                        <SelectItem value="5000000">$5M</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Property Type <span className="text-destructive">*</span></Label>
                    <Select value={searchPropertyType} onValueChange={setSearchPropertyType}>
                      <SelectTrigger data-testid="select-map-property-type">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 items-center">
                  <Label className="text-sm font-medium">Status:</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="map-status-active"
                      checked={searchStatuses.includes("active")}
                      onCheckedChange={() => toggleStatus("active")}
                      data-testid="checkbox-map-status-active"
                    />
                    <label htmlFor="map-status-active" className="text-sm cursor-pointer">Active</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="map-status-under-contract"
                      checked={searchStatuses.includes("under_contract")}
                      onCheckedChange={() => toggleStatus("under_contract")}
                      data-testid="checkbox-map-status-uc"
                    />
                    <label htmlFor="map-status-under-contract" className="text-sm cursor-pointer">Active Under Contract</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="map-status-closed"
                      checked={searchStatuses.includes("closed")}
                      onCheckedChange={() => toggleStatus("closed")}
                      data-testid="checkbox-map-status-closed"
                    />
                    <label htmlFor="map-status-closed" className="text-sm cursor-pointer">Closed</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                  {/* Close Date - Only show when Closed status is selected */}
                  {searchStatuses.includes("closed") && (
                    <div className="space-y-2">
                      <Label>Close Date <span className="text-destructive">*</span></Label>
                      <Select value={searchSoldDays} onValueChange={setSearchSoldDays}>
                        <SelectTrigger data-testid="select-map-sold-days">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">0-90 days</SelectItem>
                          <SelectItem value="150">0-150 days</SelectItem>
                          <SelectItem value="180">0-180 days</SelectItem>
                          <SelectItem value="365">0-365 days (default)</SelectItem>
                          <SelectItem value="730">0-730 days (2 years)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Min Sq Ft</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2000"
                      value={searchMinSqft}
                      onChange={(e) => setSearchMinSqft(e.target.value)}
                      data-testid="input-map-min-sqft"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Sq Ft</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 5000"
                      value={searchMaxSqft}
                      onChange={(e) => setSearchMaxSqft(e.target.value)}
                      data-testid="input-map-max-sqft"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min Lot (Acres)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 0.25"
                      value={searchMinLotAcres}
                      onChange={(e) => setSearchMinLotAcres(e.target.value)}
                      data-testid="input-map-min-lot-acres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Lot (Acres)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 1.0"
                      value={searchMaxLotAcres}
                      onChange={(e) => setSearchMaxLotAcres(e.target.value)}
                      data-testid="input-map-max-lot-acres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stories</Label>
                    <Select value={searchStories} onValueChange={setSearchStories}>
                      <SelectTrigger data-testid="select-map-stories">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min Year Built</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 1990"
                      value={searchMinYearBuilt}
                      onChange={(e) => setSearchMinYearBuilt(e.target.value)}
                      data-testid="input-map-min-year-built"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Year Built</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 2024"
                      value={searchMaxYearBuilt}
                      onChange={(e) => setSearchMaxYearBuilt(e.target.value)}
                      data-testid="input-map-max-year-built"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleMapFilterSearch} 
                  disabled={isMapSearching || !currentBoundary} 
                  data-testid="button-map-search-properties"
                >
                  {isMapSearching ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4 mr-2" />
                  )}
                  {currentBoundary ? 'Search Properties' : 'Draw polygon first'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Subject Property
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs z-[100]">
                  <p>The property you are creating this CMA for. This is typically your client's home that they want to sell or a property they're considering buying.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subjectProperty ? (
              <div className="space-y-4">
                <div className="p-4 border rounded-md">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{subjectProperty.unparsedAddress}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant="secondary">{getPriceLabel(subjectProperty)}</Badge>
                        <span className="font-medium">{getPriceDisplay(subjectProperty)}</span>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSubjectProperty(null)}
                      data-testid="button-remove-subject"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>{subjectProperty.bedroomsTotal} beds</span>
                    <span>•</span>
                    <span>{subjectProperty.bathroomsTotalInteger} baths</span>
                    <span>•</span>
                    <span>{subjectProperty.livingArea && `${Number(subjectProperty.livingArea).toLocaleString()} sqft`}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  This property will be the focus of your CMA analysis
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // Auto-fill search criteria based on subject property
                    const sp = subjectProperty;
                    if (sp) {
                      // Set status to Closed for sold comps
                      setSearchStatuses(['closed']);
                      
                      // Set location from subject
                      if (sp.subdivision) setSearchSubdivision(sp.subdivision);
                      else if (sp.city) setSearchCity(sp.city);
                      if (sp.postalCode) setSearchZipCode(sp.postalCode);
                      
                      // Set sqft range (±20%)
                      if (sp.livingArea) {
                        const sqft = Number(sp.livingArea);
                        const minSqft = Math.floor(sqft * 0.8);
                        const maxSqft = Math.ceil(sqft * 1.2);
                        setSearchMinSqft(String(minSqft));
                        setSearchMaxSqft(String(maxSqft));
                      }
                      
                      // Set beds (same or ±1)
                      if (sp.bedroomsTotal) {
                        const beds = Number(sp.bedroomsTotal);
                        setSearchMinBeds(String(Math.max(1, beds - 1)));
                        setSearchMaxBeds(String(beds + 1));
                      }
                      
                      // Set baths (same or ±1)
                      if (sp.bathroomsTotalInteger) {
                        const baths = Number(sp.bathroomsTotalInteger);
                        setSearchMinBaths(String(Math.max(1, baths - 1)));
                        setSearchMaxBaths(String(baths + 1));
                      }
                      
                      // Set sold days to last 6 months
                      setSearchSoldDays('180');
                      
                      // Trigger search
                      setSearchEnabled(true);
                      setTimeout(() => {
                        searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }, 100);
                    }
                  }}
                  data-testid="button-find-sold-comps"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Find Sold Comparables
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search by Address</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter property address..."
                      value={manualSubjectAddress}
                      onChange={(e) => setManualSubjectAddress(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && manualSubjectAddress.length > 5) {
                          e.preventDefault();
                          try {
                            const res = await fetch(`/api/search?address=${encodeURIComponent(manualSubjectAddress)}&limit=1`);
                            const data = await res.json();
                            if (data.properties?.[0]) {
                              setSubjectProperty(data.properties[0]);
                              setManualSubjectAddress("");
                              setManualSubjectCity("");
                              setManualSubjectState("");
                              setManualSubjectZip("");
                            }
                          } catch (err) {
                            console.error('Address search error:', err);
                          }
                        }
                      }}
                      autoComplete="off"
                      data-testid="input-subject-address"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={async () => {
                        if (manualSubjectAddress.length > 5) {
                          try {
                            const res = await fetch(`/api/search?address=${encodeURIComponent(manualSubjectAddress)}&limit=1`);
                            const data = await res.json();
                            if (data.properties?.[0]) {
                              setSubjectProperty(data.properties[0]);
                              setManualSubjectAddress("");
                              setManualSubjectCity("");
                              setManualSubjectState("");
                              setManualSubjectZip("");
                            }
                          } catch (err) {
                            console.error('Address search error:', err);
                          }
                        }
                      }}
                      data-testid="button-search-subject-address"
                    >
                      <Search className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <Input 
                      placeholder="City" 
                      className="h-8 text-xs"
                      value={manualSubjectCity}
                      onChange={(e) => setManualSubjectCity(e.target.value)}
                      data-testid="input-subject-city"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">State</Label>
                    <Input 
                      placeholder="TX" 
                      className="h-8 text-xs"
                      value={manualSubjectState}
                      onChange={(e) => setManualSubjectState(e.target.value)}
                      data-testid="input-subject-state"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Zip</Label>
                    <Input 
                      placeholder="Zip" 
                      className="h-8 text-xs"
                      value={manualSubjectZip}
                      onChange={(e) => setManualSubjectZip(e.target.value)}
                      data-testid="input-subject-zip"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">List Price <span className="text-destructive">*</span></Label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      placeholder="500000" 
                      className="h-8 text-xs"
                      value={manualSubjectListPrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setManualSubjectListPrice(val);
                      }}
                      data-testid="input-subject-listprice"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Beds</Label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      placeholder="3" 
                      className="h-8 text-xs"
                      value={manualSubjectBeds}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setManualSubjectBeds(val);
                      }}
                      data-testid="input-subject-beds"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Baths</Label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      placeholder="2" 
                      className="h-8 text-xs"
                      value={manualSubjectBaths}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setManualSubjectBaths(val);
                      }}
                      data-testid="input-subject-baths"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sq Ft <span className="text-destructive">*</span></Label>
                    <Input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="2000" 
                      className="h-8 text-xs"
                      value={manualSubjectSqft}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setManualSubjectSqft(val);
                      }}
                      data-testid="input-subject-sqft"
                    />
                  </div>
                </div>
                {manualSubjectAddress.trim() && (!manualSubjectSqft.trim() || !manualSubjectListPrice.trim()) && (
                  <p className="text-xs text-muted-foreground text-center">
                    List price and square footage are required for pricing analysis
                  </p>
                )}
                {manualSubjectAddress.trim() && manualSubjectSqft.trim() && manualSubjectListPrice.trim() && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      const manualProperty = {
                        id: `manual-${Date.now()}`,
                        listingId: `manual-${Date.now()}`,
                        unparsedAddress: manualSubjectAddress.trim(),
                        streetNumber: '',
                        streetName: manualSubjectAddress.trim(),
                        city: manualSubjectCity.trim() || 'Unknown',
                        stateOrProvince: manualSubjectState.trim() || 'TX',
                        postalCode: manualSubjectZip.trim() || '',
                        latitude: null,
                        longitude: null,
                        listPrice: manualSubjectListPrice ? Number(manualSubjectListPrice) : null,
                        closePrice: null,
                        originalListPrice: null,
                        bedroomsTotal: manualSubjectBeds ? Number(manualSubjectBeds) : null,
                        bathroomsTotalInteger: manualSubjectBaths ? Number(manualSubjectBaths) : null,
                        livingArea: manualSubjectSqft ? Number(manualSubjectSqft) : null,
                        lotSizeAcres: null,
                        lotSizeSquareFeet: null,
                        yearBuilt: null,
                        propertyType: 'Residential',
                        propertySubType: null,
                        standardStatus: 'Active',
                        listingContractDate: null,
                        closeDate: null,
                        daysOnMarket: null,
                        neighborhood: null,
                        subdivision: null,
                        subdivisionName: null,
                        poolPrivateYn: null,
                        garageSpaces: null,
                        storiesTotal: null,
                        elementarySchool: null,
                        middleSchool: null,
                        highSchool: null,
                        publicRemarks: null,
                        mlsNumber: null,
                        virtualTourUrl: null,
                      } as unknown as Property;
                      setSubjectProperty(manualProperty);
                      // Reset form fields after setting subject
                      setManualSubjectAddress("");
                      setManualSubjectCity("");
                      setManualSubjectState("");
                      setManualSubjectZip("");
                      setManualSubjectListPrice("");
                      setManualSubjectBeds("");
                      setManualSubjectBaths("");
                      setManualSubjectSqft("");
                    }}
                    data-testid="button-use-manual-subject"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Use This Address as Subject
                  </Button>
                )}
                <div className="text-center text-muted-foreground">
                  <p className="text-xs mb-2">or</p>
                  <div 
                    className="py-4 cursor-pointer hover-elevate rounded-lg border border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50"
                    onClick={() => searchSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    data-testid="button-select-subject"
                  >
                    <MousePointerClick className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">Select from search results below</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Comparable Properties
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs z-[100]">
                  <p>Similar properties in the area that help establish market value. Select properties with similar features, location, and condition to the subject property.</p>
                </TooltipContent>
              </Tooltip>
              {comparables.length > 0 && (
                <Badge variant="secondary">{comparables.length} selected</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comparables.length > 0 ? (
              <div className="space-y-3">
                {comparables.map((property, index) => (
                  <div key={property.id} className="p-4 border rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                          <p className="font-semibold text-sm line-clamp-1">{property.unparsedAddress}</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="secondary">{getPriceLabel(property)}</Badge>
                          <span className="font-medium">{getPriceDisplay(property)}</span>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRemoveComparable(property.id)}
                        data-testid={`button-remove-comparable-${index}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      <span>{property.bedroomsTotal} beds</span>
                      <span>•</span>
                      <span>{property.bathroomsTotalInteger} baths</span>
                      <span>•</span>
                      <span>{property.livingArea && `${Number(property.livingArea).toLocaleString()} sqft`}</span>
                    </div>
                  </div>
                ))}
                </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm mb-2">No comparables selected</p>
                <p className="text-xs">Search and select properties to compare</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Analysis
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs z-[100]">
                  <p>Summary statistics calculated from your selected comparable properties including average price, square footage, and price per sqft to help determine fair market value.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {comparables.length > 0 ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Price</span>
                    <span className="font-semibold">
                      {formatPrice(
                        comparables.reduce((sum, p) => {
                          const price = p.standardStatus === 'Closed' && p.closePrice 
                            ? Number(p.closePrice) 
                            : Number(p.listPrice || 0);
                          return sum + price;
                        }, 0) / comparables.length
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg Sqft</span>
                    <span className="font-semibold">
                      {Math.round(
                        comparables.reduce((sum, p) => sum + Number(p.livingArea || 0), 0) / comparables.length
                      ).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avg $/Sqft</span>
                    <span className="font-semibold">
                      ${(
                        comparables.reduce((sum, p) => {
                          const price = p.standardStatus === 'Closed' && p.closePrice 
                            ? Number(p.closePrice) 
                            : Number(p.listPrice || 0);
                          const sqft = Number(p.livingArea || 1);
                          return sum + (price / sqft);
                        }, 0) / comparables.length
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price Range</span>
                    <span className="font-semibold text-xs">
                      {formatPrice(Math.min(...comparables.map(p => {
                        return p.standardStatus === 'Closed' && p.closePrice 
                          ? Number(p.closePrice) 
                          : Number(p.listPrice || 0);
                      })))} - {formatPrice(Math.max(...comparables.map(p => {
                        return p.standardStatus === 'Closed' && p.closePrice 
                          ? Number(p.closePrice) 
                          : Number(p.listPrice || 0);
                      })))}
                    </span>
                  </div>
                </div>

                <Separator />

                <Button 
                  className="w-full" 
                  onClick={handleCreate}
                  disabled={comparables.length === 0 || !subjectProperty}
                  data-testid="button-generate-report"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
                {!subjectProperty && comparables.length > 0 && (
                  <p className="text-xs text-amber-600 text-center mt-2">
                    Subject property required
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Add properties to see analysis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                Search Results 
                {statusDisplayFilter === 'all' ? (
                  activeResultCount > 0 && ` (${activeResultCount.toLocaleString()} found)`
                ) : (
                  <>
                    {` (${activeSearchResults.length} `}
                    {statusDisplayFilter === 'active' ? 'Active' : 
                      statusDisplayFilter === 'underContract' ? 'Under Contract' : 'Closed'}
                    {`)  `}
                    <span className="text-muted-foreground font-normal text-sm">
                      of {statusCounts.all} total
                    </span>
                  </>
                )}
                {searchMode === 'map' && mapSearchResults.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    <Map className="w-3 h-3 mr-1" />
                    Map Search
                  </Badge>
                )}
              </CardTitle>
              
              {/* View Toggle */}
              {baseSearchResults.length > 0 && (
                <div className="flex items-center gap-1" data-testid="view-toggle">
                  <Button
                    size="icon"
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    className="toggle-elevate"
                    onClick={() => handleViewModeChange('grid')}
                    data-testid="button-view-grid"
                    title="Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    className="toggle-elevate"
                    onClick={() => handleViewModeChange('list')}
                    data-testid="button-view-list"
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    className="toggle-elevate"
                    onClick={() => handleViewModeChange('table')}
                    data-testid="button-view-table"
                    title="Table View"
                  >
                    <Table2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
            
            {/* Status Filter Tabs - only show when there are results */}
            {baseSearchResults.length > 0 && (
              <StatusFilterTabs
                counts={statusCounts}
                activeFilter={statusDisplayFilter}
                onFilterChange={setStatusDisplayFilter}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* School filter warning */}
          {schoolFilterWarning && searchEnabled && !isLoading && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">{schoolFilterWarning}</p>
              </div>
            </div>
          )}
          
          {/* Warning 1: No subdivision filter when ZIP is filled */}
          {!searchSubdivision && searchZipCode && searchEnabled && !isLoading && baseSearchResults.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md" data-testid="warning-no-subdivision">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <span className="font-medium">Tip:</span> No subdivision filter applied. Results include ALL subdivisions in ZIP {searchZipCode}.
                </p>
              </div>
            </div>
          )}
          
          {/* Warning 2: Closed status selected but 0 results */}
          {searchStatuses.includes('closed') && statusCounts.closed === 0 && searchEnabled && !isLoading && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md" data-testid="warning-no-closed">
              <div className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">No Closed Listings Found</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      No properties matching your criteria have closed in the last {searchSoldDays || 365} days.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {searchSoldDays !== '365' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                      onClick={() => {
                        setSearchSoldDays('365');
                        setSearchEnabled(true);
                        setTimeout(() => refetch(), 100);
                      }}
                      data-testid="button-try-365-days"
                    >
                      Try 365 days
                    </Button>
                  )}
                  {(searchMinSqft || searchMaxSqft) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800"
                      onClick={() => {
                        setSearchMinSqft('');
                        setSearchMaxSqft('');
                        setSearchEnabled(true);
                        setTimeout(() => refetch(), 100);
                      }}
                      data-testid="button-remove-sqft-limits"
                    >
                      Remove sqft limits
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Warning 3: Very narrow sqft range */}
          {searchMinSqft && searchMaxSqft && 
           (parseInt(searchMaxSqft) - parseInt(searchMinSqft)) < 2000 && 
           (parseInt(searchMaxSqft) - parseInt(searchMinSqft)) > 0 &&
           searchEnabled && !isLoading && (
            <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md" data-testid="warning-narrow-sqft">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-medium">Note:</span> Narrow sqft range ({parseInt(searchMaxSqft) - parseInt(searchMinSqft)} sqft) may limit results.
                </p>
              </div>
            </div>
          )}
          
          {(isLoading || isMapSearching) ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Searching properties...</p>
            </div>
          ) : isError && searchMode === 'criteria' ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" />
              <p className="text-sm text-destructive mb-2">Unable to search properties</p>
              <p className="text-xs text-muted-foreground">
                The property search service may be temporarily unavailable. Please try again later.
              </p>
            </div>
          ) : activeSearchResults.length > 0 ? (
            <>
              {/* GRID VIEW */}
              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSearchResults.map((property) => {
                    const photos = (property as any).photos as string[] | undefined;
                    const primaryPhoto = photos?.[0];
                    const pricePerSqft = property.livingArea 
                      ? (property.standardStatus === 'Closed' && property.closePrice 
                          ? Number(property.closePrice) 
                          : Number(property.listPrice || 0)) / Number(property.livingArea)
                      : null;
                    const listingDate = property.listingContractDate 
                      ? new Date(property.listingContractDate).toLocaleDateString()
                      : null;
                    const getStatusBadge = () => {
                      if (property.standardStatus === 'Closed') {
                        return <Badge variant="secondary" className="flex-shrink-0">Closed</Badge>;
                      } else if (property.standardStatus === 'Active') {
                        return <Badge variant="default" className="flex-shrink-0 bg-green-600 hover:bg-green-600">Active</Badge>;
                      } else if (property.standardStatus === 'Active Under Contract') {
                        return <Badge variant="default" className="flex-shrink-0 bg-amber-500 hover:bg-amber-500">Active Under Contract</Badge>;
                      }
                      return <Badge variant="secondary" className="flex-shrink-0">{property.standardStatus}</Badge>;
                    };
                    const matchTier = (property as any).matchTier as string | undefined;
                    
                    return (
                      <Card 
                        key={property.id} 
                        className="overflow-hidden cursor-pointer hover-elevate relative"
                        onClick={() => {
                          setSelectedProperty(property);
                          setCurrentPhotoIndex(0);
                        }}
                        data-testid={`card-property-${property.id}`}
                      >
                        {matchTier && visualMatchEnabled && (
                          <div className="absolute top-2 left-2 z-10">
                            <Badge 
                              className={cn(
                                "text-xs",
                                matchTier === 'High' && "bg-emerald-500 text-white hover:bg-emerald-500",
                                matchTier === 'Medium' && "bg-amber-500 text-white hover:bg-amber-500",
                                matchTier === 'Low' && "bg-gray-500 text-white hover:bg-gray-500"
                              )}
                            >
                              <Sparkles className="w-3 h-3 mr-1" />
                              {matchTier} Match
                            </Badge>
                          </div>
                        )}
                        <div className="flex">
                          {primaryPhoto ? (
                            <div className="w-32 h-32 flex-shrink-0">
                              <img 
                                src={primaryPhoto} 
                                alt={property.unparsedAddress || 'Property'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-32 h-32 flex-shrink-0 bg-muted flex flex-col items-center justify-center p-2">
                              <Home className="w-6 h-6 text-muted-foreground/50 mb-1" />
                              <span className="text-[10px] text-muted-foreground text-center leading-tight">No photos available</span>
                            </div>
                          )}
                          <CardContent className="flex-1 p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm line-clamp-1" data-testid={`text-address-${property.id}`}>
                                  {property.unparsedAddress}
                                </p>
                                {property.subdivision && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {property.subdivision}
                                  </p>
                                )}
                              </div>
                              {getStatusBadge()}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg text-primary">{getPriceDisplay(property)}</span>
                              {pricePerSqft && (
                                <span className="text-xs text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              <span>{property.bedroomsTotal || 0} beds</span>
                              <span>{property.bathroomsFull || property.bathroomsTotalInteger || 0}F/{property.bathroomsHalf || 0}H baths</span>
                              {property.livingArea && (
                                <span>{Number(property.livingArea).toLocaleString()} sqft</span>
                              )}
                              {property.yearBuilt && <span>Built {property.yearBuilt}</span>}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                              {property.garageParkingSpaces !== null && property.garageParkingSpaces !== undefined && property.garageParkingSpaces > 0 && (
                                <span>{property.garageParkingSpaces} garage</span>
                              )}
                              {property.lotSizeAcres && Number(property.lotSizeAcres) > 0 && (
                                <span>{Number(property.lotSizeAcres).toFixed(2)} acres</span>
                              )}
                              {property.storiesTotal && Number(property.storiesTotal) > 0 && (
                                <span>{property.storiesTotal} story</span>
                              )}
                              {property.daysOnMarket !== null && property.daysOnMarket !== undefined && (
                                <span>{property.daysOnMarket} DOM</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {listingDate && <span>Listed: {listingDate}</span>}
                              {property.standardStatus === 'Closed' && property.closeDate && (
                                <span>Closed: {new Date(property.closeDate).toLocaleDateString()}</span>
                              )}
                              {property.standardStatus === 'Closed' && property.closePrice && (
                                <span className="font-medium text-foreground">
                                  Close: ${Number(property.closePrice).toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleSetSubject(property)}
                                disabled={subjectProperty?.id === property.id}
                                data-testid={`button-set-subject-${property.id}`}
                              >
                                Set as Subject
                              </Button>
                              {comparables.some(p => p.id === property.id) ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() => handleRemoveComparable(property.id)}
                                  data-testid={`button-remove-comparable-${property.id}`}
                                >
                                  <X className="w-3 h-3 mr-1" />
                                  Remove
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleAddComparable(property)}
                                  disabled={comparables.length >= 15}
                                  data-testid={`button-add-comparable-${property.id}`}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Add
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              
              {/* LIST VIEW */}
              {viewMode === 'list' && (
                <div className="flex flex-col gap-3">
                  {activeSearchResults.map((property) => {
                    const photos = (property as any).photos as string[] | undefined;
                    const primaryPhoto = photos?.[0];
                    const pricePerSqft = property.livingArea 
                      ? (property.standardStatus === 'Closed' && property.closePrice 
                          ? Number(property.closePrice) 
                          : Number(property.listPrice || 0)) / Number(property.livingArea)
                      : null;
                    const getStatusBadge = () => {
                      if (property.standardStatus === 'Closed') {
                        return <Badge variant="secondary" className="flex-shrink-0">Closed</Badge>;
                      } else if (property.standardStatus === 'Active') {
                        return <Badge variant="default" className="flex-shrink-0 bg-green-600 hover:bg-green-600">Active</Badge>;
                      } else if (property.standardStatus === 'Active Under Contract') {
                        return <Badge variant="default" className="flex-shrink-0 bg-amber-500 hover:bg-amber-500">Active Under Contract</Badge>;
                      }
                      return <Badge variant="secondary" className="flex-shrink-0">{property.standardStatus}</Badge>;
                    };
                    
                    return (
                      <Card 
                        key={property.id}
                        className="overflow-hidden cursor-pointer hover-elevate"
                        onClick={() => {
                          setSelectedProperty(property);
                          setCurrentPhotoIndex(0);
                        }}
                        data-testid={`list-property-${property.id}`}
                      >
                        <div className="flex flex-col md:flex-row">
                          {primaryPhoto ? (
                            <div className="w-full md:w-48 h-36 flex-shrink-0">
                              <img 
                                src={primaryPhoto} 
                                alt={property.unparsedAddress || 'Property'}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="w-full md:w-48 h-36 flex-shrink-0 bg-muted flex flex-col items-center justify-center">
                              <Home className="w-8 h-8 text-muted-foreground/50 mb-1" />
                              <span className="text-xs text-muted-foreground">No photo</span>
                            </div>
                          )}
                          <div className="flex-1 p-4">
                            <div className="flex justify-between items-start gap-2 mb-2">
                              <div>
                                <h4 className="font-semibold text-base" data-testid={`text-list-address-${property.id}`}>
                                  {property.unparsedAddress}
                                </h4>
                                {property.subdivision && (
                                  <p className="text-sm text-muted-foreground">{property.subdivision}</p>
                                )}
                              </div>
                              {getStatusBadge()}
                            </div>
                            <div className="flex items-center gap-4 mb-2">
                              <span className="text-xl font-bold text-primary">{getPriceDisplay(property)}</span>
                              {pricePerSqft && (
                                <span className="text-sm text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span>{property.bedroomsTotal || 0} beds</span>
                              <span>{property.bathroomsFull || property.bathroomsTotalInteger || 0}F/{property.bathroomsHalf || 0}H baths</span>
                              {property.livingArea && (
                                <span>{Number(property.livingArea).toLocaleString()} sqft</span>
                              )}
                              {property.yearBuilt && <span>Built {property.yearBuilt}</span>}
                              {property.daysOnMarket !== null && property.daysOnMarket !== undefined && (
                                <span>{property.daysOnMarket} DOM</span>
                              )}
                              {property.lotSizeAcres && Number(property.lotSizeAcres) > 0 && (
                                <span>{Number(property.lotSizeAcres).toFixed(2)} acres</span>
                              )}
                            </div>
                            {property.standardStatus === 'Closed' && (
                              <div className="text-sm text-muted-foreground mb-2">
                                {property.closeDate && (
                                  <span>Closed: {new Date(property.closeDate).toLocaleDateString()}</span>
                                )}
                                {property.closePrice && (
                                  <span className="ml-2 font-medium text-foreground">
                                    Close: ${Number(property.closePrice).toLocaleString()}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex md:flex-col justify-center gap-2 p-4 border-t md:border-t-0 md:border-l" onClick={(e) => e.stopPropagation()}>
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => handleSetSubject(property)}
                              disabled={subjectProperty?.id === property.id}
                              data-testid={`button-list-subject-${property.id}`}
                            >
                              Set as Subject
                            </Button>
                            {comparables.some(p => p.id === property.id) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveComparable(property.id)}
                                data-testid={`button-list-remove-${property.id}`}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Remove
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleAddComparable(property)}
                                disabled={comparables.length >= 15}
                                data-testid={`button-list-add-${property.id}`}
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              
              {/* TABLE VIEW */}
              {viewMode === 'table' && (
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Address</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Price</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Beds</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Baths</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Sq Ft</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">$/Sqft</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Year</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">DOM</th>
                        <th className="px-3 py-3 text-left font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {activeSearchResults.map((property) => {
                        const photos = (property as any).photos as string[] | undefined;
                        const primaryPhoto = photos?.[0];
                        const pricePerSqft = property.livingArea 
                          ? (property.standardStatus === 'Closed' && property.closePrice 
                              ? Number(property.closePrice) 
                              : Number(property.listPrice || 0)) / Number(property.livingArea)
                          : null;
                        const getStatusBadge = () => {
                          if (property.standardStatus === 'Closed') {
                            return <Badge variant="secondary" className="text-xs">Closed</Badge>;
                          } else if (property.standardStatus === 'Active') {
                            return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">Active</Badge>;
                          } else if (property.standardStatus === 'Active Under Contract') {
                            return <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500">AUC</Badge>;
                          }
                          return <Badge variant="secondary" className="text-xs">{property.standardStatus}</Badge>;
                        };
                        
                        return (
                          <tr 
                            key={property.id} 
                            className="hover:bg-muted/30 cursor-pointer"
                            onClick={() => {
                              setSelectedProperty(property);
                              setCurrentPhotoIndex(0);
                            }}
                            data-testid={`row-property-${property.id}`}
                          >
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                {primaryPhoto ? (
                                  <img 
                                    src={primaryPhoto} 
                                    alt=""
                                    className="w-10 h-8 object-cover rounded flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-8 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                    <Home className="w-4 h-4 text-muted-foreground/50" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <span className="font-medium block truncate max-w-[180px]" data-testid={`text-table-address-${property.id}`}>
                                    {property.unparsedAddress}
                                  </span>
                                  {property.subdivision && (
                                    <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
                                      {property.subdivision}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3">{getStatusBadge()}</td>
                            <td className="px-3 py-3 font-semibold text-primary whitespace-nowrap">
                              {getPriceDisplay(property)}
                            </td>
                            <td className="px-3 py-3">{property.bedroomsTotal || '-'}</td>
                            <td className="px-3 py-3">
                              {property.bathroomsFull || property.bathroomsTotalInteger || 0}F/{property.bathroomsHalf || 0}H
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {property.livingArea ? Number(property.livingArea).toLocaleString() : '-'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {pricePerSqft ? `$${pricePerSqft.toFixed(0)}` : '-'}
                            </td>
                            <td className="px-3 py-3">{property.yearBuilt || '-'}</td>
                            <td className="px-3 py-3">
                              {property.daysOnMarket !== null && property.daysOnMarket !== undefined ? property.daysOnMarket : '-'}
                            </td>
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex gap-1">
                                <Button 
                                  size="sm"
                                  variant="outline"
                                  className="text-xs px-2 py-1 h-7"
                                  onClick={() => handleSetSubject(property)}
                                  disabled={subjectProperty?.id === property.id}
                                  data-testid={`button-table-subject-${property.id}`}
                                >
                                  Subject
                                </Button>
                                {comparables.some(p => p.id === property.id) ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="text-xs px-2 py-1 h-7"
                                    onClick={() => handleRemoveComparable(property.id)}
                                    data-testid={`button-table-remove-${property.id}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="text-xs px-2 py-1 h-7"
                                    onClick={() => handleAddComparable(property)}
                                    disabled={comparables.length >= 15}
                                    data-testid={`button-table-add-${property.id}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (searchEnabled || (searchMode === 'map' && mapSearchResults.length === 0)) ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchMode === 'map' ? (
                <>
                  <Map className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm mb-2">Draw a polygon on the map to search</p>
                  <p className="text-xs">Properties within your drawn area will appear here</p>
                </>
              ) : (
                <>
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm mb-2">No properties found matching your criteria</p>
                  <p className="text-xs">Try adjusting your search filters</p>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm mb-2">Search for properties to add to your CMA</p>
              <p className="text-xs">Use the filters above and click "Search Properties" or draw a map polygon</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Property Detail Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={(open) => !open && setSelectedProperty(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProperty && (() => {
            // Photos are returned directly from Repliers API
            const photos = ((selectedProperty as any).photos as string[] | undefined) || [];
            const pricePerSqft = selectedProperty.livingArea 
              ? (selectedProperty.standardStatus === 'Closed' && selectedProperty.closePrice 
                  ? Number(selectedProperty.closePrice) 
                  : Number(selectedProperty.listPrice || 0)) / Number(selectedProperty.livingArea)
              : null;
            const listingDate = selectedProperty.listingContractDate 
              ? new Date(selectedProperty.listingContractDate).toLocaleDateString()
              : null;
              
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">{selectedProperty.unparsedAddress}</DialogTitle>
                </DialogHeader>
                
                {/* Photo Carousel */}
                {photos.length > 0 ? (
                  <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                    <img 
                      src={photos[currentPhotoIndex]} 
                      alt={`Property photo ${currentPhotoIndex + 1}`}
                      className="w-full h-full object-cover"
                      data-testid="img-cma-carousel"
                    />
                    {/* Click zones for navigation - invisible, covering full halves */}
                    {photos.length > 1 && (
                      <>
                        {/* Left click zone - covers left half */}
                        <div 
                          className="absolute left-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                          onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => (prev - 1 + photos.length) % photos.length); }}
                          data-testid="zone-cma-carousel-prev"
                        >
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                            <ChevronLeft className="w-5 h-5" />
                          </div>
                        </div>
                        {/* Right click zone - covers right half */}
                        <div 
                          className="absolute right-0 top-0 w-1/2 h-full cursor-pointer z-10 group"
                          onClick={(e) => { e.stopPropagation(); setCurrentPhotoIndex(prev => (prev + 1) % photos.length); }}
                          data-testid="zone-cma-carousel-next"
                        >
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all opacity-70 group-hover:opacity-100">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                        {/* Photo counter */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1.5 rounded-full text-sm font-medium z-20">
                          {currentPhotoIndex + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted rounded-md flex flex-col items-center justify-center">
                    <Home className="w-12 h-12 text-muted-foreground/50 mb-2" />
                    <span className="text-sm text-muted-foreground">No photos available for this property</span>
                  </div>
                )}
                
                <ScrollArea className="max-h-[40vh]">
                  <div className="space-y-4 p-1">
                    {/* Price and Status */}
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-2xl font-bold text-primary">{getPriceDisplay(selectedProperty)}</p>
                        {pricePerSqft && (
                          <p className="text-sm text-muted-foreground">${pricePerSqft.toFixed(0)}/sqft</p>
                        )}
                      </div>
                      {selectedProperty.standardStatus === 'Closed' ? (
                        <Badge variant="secondary" className="text-base px-3 py-1">Closed</Badge>
                      ) : selectedProperty.standardStatus === 'Active' ? (
                        <Badge className="bg-green-600 hover:bg-green-600 text-base px-3 py-1">Active</Badge>
                      ) : (
                        <Badge className="bg-amber-500 hover:bg-amber-500 text-base px-3 py-1">Active Under Contract</Badge>
                      )}
                    </div>
                    
                    {/* Property Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.bedroomsTotal || 0}</p>
                        <p className="text-xs text-muted-foreground">Beds</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.bathroomsTotalInteger || 0}</p>
                        <p className="text-xs text-muted-foreground">Baths</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.livingArea ? Number(selectedProperty.livingArea).toLocaleString() : 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">Sq Ft</p>
                      </div>
                      <div className="text-center p-3 bg-muted rounded-md">
                        <p className="text-2xl font-bold">{selectedProperty.yearBuilt || 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">Year Built</p>
                      </div>
                    </div>
                    
                    {/* Dates */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {listingDate && (
                        <div>
                          <span className="text-muted-foreground">Listed: </span>
                          <span className="font-medium">{listingDate}</span>
                        </div>
                      )}
                      {selectedProperty.standardStatus === 'Closed' && selectedProperty.closeDate && (
                        <div>
                          <span className="text-muted-foreground">Closed: </span>
                          <span className="font-medium">{new Date(selectedProperty.closeDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {selectedProperty.subdivision && (
                        <div>
                          <span className="text-muted-foreground">Subdivision: </span>
                          <span className="font-medium">{selectedProperty.subdivision}</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          handleSetSubject(selectedProperty);
                          setSelectedProperty(null);
                        }}
                        disabled={subjectProperty?.id === selectedProperty.id}
                        data-testid="button-dialog-set-subject"
                      >
                        <Home className="w-4 h-4 mr-2" />
                        Set as Subject
                      </Button>
                      {comparables.some(p => p.id === selectedProperty.id) ? (
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            handleRemoveComparable(selectedProperty.id);
                            setSelectedProperty(null);
                          }}
                          data-testid="button-dialog-remove-comparable"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Remove from Comparables
                        </Button>
                      ) : (
                        <Button
                          className="flex-1"
                          onClick={() => {
                            handleAddComparable(selectedProperty);
                            setSelectedProperty(null);
                          }}
                          disabled={comparables.length >= 15}
                          data-testid="button-dialog-add-comparable"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add as Comparable
                        </Button>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}


