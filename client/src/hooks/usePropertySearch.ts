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

export interface PlacePrediction {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export function usePropertySearch() {
  const [addressResults, setAddressResults] = useState<PropertySearchResult[]>([]);
  const [placePredictions, setPlacePredictions] = useState<PlacePrediction[]>([]);
  const [mlsResults, setMlsResults] = useState<PropertySearchResult[]>([]);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [isSearchingMls, setIsSearchingMls] = useState(false);
  
  const addressAbortRef = useRef<AbortController | null>(null);
  const mlsAbortRef = useRef<AbortController | null>(null);

  const searchByAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setPlacePredictions([]);
      return;
    }

    if (addressAbortRef.current) {
      addressAbortRef.current.abort();
    }
    addressAbortRef.current = new AbortController();

    setIsSearchingAddress(true);
    
    try {
      const response = await fetch(
        `/api/places/autocomplete?query=${encodeURIComponent(query)}`,
        { signal: addressAbortRef.current.signal }
      );
      
      if (response.ok) {
        const data = await response.json();
        setPlacePredictions(data.predictions || []);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Address search error:', error);
        setPlacePredictions([]);
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
    setPlacePredictions([]);
    setMlsResults([]);
  }, []);

  return {
    addressResults,
    placePredictions,
    mlsResults,
    isSearchingAddress,
    isSearchingMls,
    searchByAddress,
    searchByMlsNumber,
    clearResults,
  };
}
