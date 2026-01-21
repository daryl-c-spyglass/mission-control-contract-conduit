import { useState, useCallback, useRef } from 'react';

export interface PropertySearchResult {
  mlsNumber: string;
  address: string;
  fullAddress: string;
  listPrice?: number;
  status?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  yearBuilt?: number;
  daysOnMarket?: number;
  photos?: string[];
}

export function usePropertySearch() {
  const [addressResults, setAddressResults] = useState<PropertySearchResult[]>([]);
  const [mlsResults, setMlsResults] = useState<PropertySearchResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isSearchingMls, setIsSearchingMls] = useState(false);
  
  // Separate abort controllers to prevent one search from canceling the other
  const addressAbortRef = useRef<AbortController | null>(null);
  const mlsAbortRef = useRef<AbortController | null>(null);

  const searchByAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressResults([]);
      return;
    }

    // Only abort previous address searches, not MLS searches
    if (addressAbortRef.current) {
      addressAbortRef.current.abort();
    }
    addressAbortRef.current = new AbortController();

    setIsSearchingAddress(true);
    
    try {
      const response = await fetch(
        `/api/mls/search/address?query=${encodeURIComponent(query)}`,
        { signal: addressAbortRef.current.signal }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddressResults(data.results || []);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Address search error:', error);
        setAddressResults([]);
      }
    } finally {
      setIsSearchingAddress(false);
    }
  }, []);

  const searchByMlsNumber = useCallback(async (query: string) => {
    if (query.length < 3) {
      setMlsResults([]);
      return;
    }

    // Only abort previous MLS searches, not address searches
    if (mlsAbortRef.current) {
      mlsAbortRef.current.abort();
    }
    mlsAbortRef.current = new AbortController();

    setIsSearchingMls(true);
    
    try {
      const response = await fetch(
        `/api/mls/search/mlsNumber?query=${encodeURIComponent(query)}`,
        { signal: mlsAbortRef.current.signal }
      );
      
      if (response.ok) {
        const data = await response.json();
        setMlsResults(data.results || []);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('MLS search error:', error);
        setMlsResults([]);
      }
    } finally {
      setIsSearchingMls(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setAddressResults([]);
    setMlsResults([]);
  }, []);

  return {
    addressResults,
    mlsResults,
    isSearchingAddress,
    isSearchingMls,
    searchByAddress,
    searchByMlsNumber,
    clearResults,
  };
}
