import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { MapPin } from 'lucide-react';

interface Property {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  coordinates?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
  };
  map?: {
    latitude?: number;
    longitude?: number;
  };
  status?: string;
  standardStatus?: string;
  address?: string;
  streetAddress?: string;
  unparsedAddress?: string;
  mlsNumber?: string;
}

interface MapAllListingsPreviewProps {
  subjectProperty?: Property | null;
  comparables: Property[];
  compact?: boolean;
}

function getStatusColor(status: string): string {
  const lower = (status || '').toLowerCase();
  if (lower.includes('sold') || lower.includes('closed')) return '#ef4444';
  if (lower.includes('pending') || lower.includes('under contract')) return '#f59e0b';
  if (lower.includes('active')) return '#22c55e';
  return '#6b7280';
}

function getCoordinates(property: Property | null | undefined): { lat: number; lng: number } | null {
  if (!property) return null;
  
  const lat = property.latitude || property.lat || 
    property.coordinates?.lat || property.coordinates?.latitude ||
    property.map?.latitude;
  const lng = property.longitude || property.lng || 
    property.coordinates?.lng || property.coordinates?.longitude ||
    property.map?.longitude;
  
  if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
    return { lat, lng };
  }
  return null;
}

export function MapAllListingsPreview({ subjectProperty, comparables, compact }: MapAllListingsPreviewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const { theme } = useTheme();

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const subjectCoords = getCoordinates(subjectProperty);
  const validComparables = useMemo(() => 
    comparables.filter(c => getCoordinates(c) !== null),
    [comparables]
  );

  const centerCoords = subjectCoords || (validComparables.length > 0 ? getCoordinates(validComparables[0]) : null);
  const mapHeight = compact ? 150 : 200;

  // Debug logging
  useEffect(() => {
    console.log('[MapAllListingsPreview] Data:', {
      hasSubject: !!subjectProperty,
      subjectCoords,
      comparablesCount: comparables.length,
      validComparablesCount: validComparables.length,
      centerCoords,
      hasToken: !!mapboxToken,
    });
  }, [subjectProperty, subjectCoords, comparables.length, validComparables.length, centerCoords, mapboxToken]);

  // Initialize map when center coordinates become available
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || !centerCoords) {
      console.log('[MapAllListingsPreview] Cannot init map:', { 
        hasContainer: !!mapContainer.current, 
        hasToken: !!mapboxToken, 
        hasCenter: !!centerCoords 
      });
      return;
    }
    
    // If already have a map, don't reinitialize
    if (mapRef.current) {
      console.log('[MapAllListingsPreview] Map already initialized');
      return;
    }
    
    console.log('[MapAllListingsPreview] Initializing map at:', centerCoords);
    mapboxgl.accessToken = mapboxToken;

    const cleanup = () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };

    try {
      const isDark = theme === 'dark';
      const style = isDark 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12';

      const map = new mapboxgl.Map({
        container: mapContainer.current,
        style,
        center: [centerCoords.lng, centerCoords.lat],
        zoom: 11,
        attributionControl: true,
      });

      map.on('load', () => {
        setMapLoaded(true);
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load map');
      });

      mapRef.current = map;

      return cleanup;
    } catch (err: any) {
      console.error('Map init error:', err);
      setMapError(err.message || 'Failed to load map');
      return cleanup;
    }
  }, [mapboxToken, centerCoords?.lat, centerCoords?.lng]);

  // Update map style on theme change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const isDark = theme === 'dark';
    const style = isDark 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/streets-v12';
    
    mapRef.current.setStyle(style);
  }, [theme, mapLoaded]);

  // Add markers
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Add subject marker
    if (subjectCoords) {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          width: 28px;
          height: 28px;
          background-color: #3b82f6;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
      `;
      
      const marker = new mapboxgl.Marker({ element: el.firstElementChild as HTMLElement })
        .setLngLat([subjectCoords.lng, subjectCoords.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }

    // Add comparable markers
    validComparables.forEach((comp, index) => {
      const coords = getCoordinates(comp);
      if (!coords || !mapRef.current) return;
      
      const status = comp.standardStatus || comp.status || 'Active';
      const color = getStatusColor(status);
      
      const el = document.createElement('div');
      el.style.cssText = `
        width: 16px;
        height: 16px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });

    // Fit bounds if multiple markers
    if (markersRef.current.length > 1 && mapRef.current) {
      const bounds = new mapboxgl.LngLatBounds();
      if (subjectCoords) {
        bounds.extend([subjectCoords.lng, subjectCoords.lat]);
      }
      validComparables.forEach(comp => {
        const coords = getCoordinates(comp);
        if (coords) {
          bounds.extend([coords.lng, coords.lat]);
        }
      });
      mapRef.current.fitBounds(bounds, { padding: 40, maxZoom: 13 });
    }
  }, [mapLoaded, subjectCoords?.lat, subjectCoords?.lng, validComparables]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (!mapboxToken) {
    return (
      <div className="space-y-2">
        <div 
          className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: mapHeight }}
        >
          <div className="text-center">
            <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>Mapbox token not configured</p>
          </div>
        </div>
        <Legend />
      </div>
    );
  }

  if (!centerCoords && validComparables.length === 0) {
    return (
      <div className="space-y-2">
        <div 
          className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: mapHeight }}
        >
          <div className="text-center">
            <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>No properties with valid coordinates</p>
          </div>
        </div>
        <Legend />
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="space-y-2">
        <div 
          className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm"
          style={{ height: mapHeight }}
        >
          <div className="text-center">
            <MapPin className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <p>{mapError}</p>
          </div>
        </div>
        <Legend />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={mapContainer}
        className="rounded-lg overflow-hidden border"
        style={{ height: `${mapHeight}px`, width: '100%' }}
      />
      <Legend />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 text-xs flex-wrap justify-center">
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Subject
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Active
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> Pending
      </span>
      <span className="flex items-center gap-1">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Sold
      </span>
    </div>
  );
}
