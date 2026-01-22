import { useEffect, useRef, useState, useMemo } from 'react';
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
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const { theme } = useTheme();
  const initAttempts = useRef(0);

  const subjectCoords = getCoordinates(subjectProperty);
  const validComparables = useMemo(() => 
    comparables.filter(c => getCoordinates(c) !== null),
    [comparables]
  );

  const comparablesKey = useMemo(() => 
    validComparables.map(c => {
      const coords = getCoordinates(c);
      return `${c.mlsNumber || ''}-${coords?.lat}-${coords?.lng}-${c.standardStatus || c.status}`;
    }).join('|'),
    [validComparables]
  );

  const mapHeight = compact ? 150 : 200;

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      setMapError('Mapbox token not configured');
      return;
    }
    
    mapboxgl.accessToken = token;
    
    const centerCoords = subjectCoords || (validComparables.length > 0 ? getCoordinates(validComparables[0]) : null);
    
    if (!centerCoords && validComparables.length === 0) {
      setMapError('No properties with valid coordinates');
      return;
    }

    const initMap = () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      setIsMapLoaded(false);
      setMapError(null);

      try {
        const isDark = theme === 'dark';
        const mapStyle = isDark 
          ? 'mapbox://styles/mapbox/dark-v11' 
          : 'mapbox://styles/mapbox/streets-v12';
        
        const newMap = new mapboxgl.Map({
          container: container,
          style: mapStyle,
          center: [centerCoords?.lng || -97.7431, centerCoords?.lat || 30.2672],
          zoom: 11,
          attributionControl: true,
          interactive: true,
        });

        newMap.on('load', () => {
          setIsMapLoaded(true);
          newMap.resize();
        });

        newMap.on('error', (e) => {
          console.error('Mapbox error:', e);
        });

        map.current = newMap;
      } catch (err: any) {
        console.error('Map init error:', err);
        setMapError(err.message || 'Failed to load map');
      }
    };

    const attemptInit = () => {
      const { clientWidth, clientHeight } = container;
      if (clientWidth > 50 && clientHeight > 50) {
        initMap();
      } else if (initAttempts.current < 10) {
        initAttempts.current++;
        setTimeout(attemptInit, 100);
      }
    };

    initAttempts.current = 0;
    
    requestAnimationFrame(() => {
      setTimeout(attemptInit, 50);
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [theme, subjectCoords?.lat, subjectCoords?.lng, validComparables.length]);

  useEffect(() => {
    if (!isMapLoaded || !map.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (subjectCoords && map.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px;
        height: 28px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        cursor: pointer;
      `;
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([subjectCoords.lng, subjectCoords.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
    }

    validComparables.forEach((comp) => {
      const coords = getCoordinates(comp);
      if (!coords || !map.current) return;
      
      const status = comp.standardStatus || comp.status || 'Active';
      const color = getStatusColor(status);
      
      const el = document.createElement('div');
      el.style.cssText = `
        width: 18px;
        height: 18px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([coords.lng, coords.lat])
        .addTo(map.current);
      markersRef.current.push(marker);
    });

    if (markersRef.current.length > 0 && map.current) {
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
      if (markersRef.current.length > 1) {
        map.current.fitBounds(bounds, { padding: 40, maxZoom: 13 });
      }
    }
  }, [isMapLoaded, subjectCoords?.lat, subjectCoords?.lng, comparablesKey]);

  useEffect(() => {
    if (map.current && isMapLoaded) {
      const isDark = theme === 'dark';
      const mapStyle = isDark 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/streets-v12';
      map.current.setStyle(mapStyle);
    }
  }, [theme, isMapLoaded]);

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
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={mapContainer} 
        className="rounded-lg overflow-hidden border"
        style={{ 
          height: `${mapHeight}px`,
          width: '100%',
          position: 'relative',
        }}
      />
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
    </div>
  );
}
