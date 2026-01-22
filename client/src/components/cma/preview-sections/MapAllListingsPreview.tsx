import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';

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
  const [mapReady, setMapReady] = useState(false);
  const { theme } = useTheme();

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

  useEffect(() => {
    if (!mapContainer.current) return;
    
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

    setMapError(null);
    
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    setMapReady(false);

    try {
      const isDark = theme === 'dark';
      const mapStyle = isDark ? 'mapbox://styles/mapbox/dark-v10' : 'mapbox://styles/mapbox/streets-v11';
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [centerCoords?.lng || -97.7431, centerCoords?.lat || 30.2672],
        zoom: 12,
        attributionControl: false,
      });

      map.current.on('load', () => {
        setMapReady(true);
      });
    } catch (err: any) {
      setMapError(err.message || 'Failed to load map');
    }

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [theme]);

  useEffect(() => {
    if (!mapReady || !map.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (subjectCoords) {
      const el = document.createElement('div');
      el.className = 'subject-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
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
      el.className = 'comp-marker';
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
        map.current.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      }
    }
  }, [mapReady, subjectCoords?.lat, subjectCoords?.lng, comparablesKey]);

  if (mapError) {
    return (
      <div className="space-y-2">
        <div className={`bg-muted rounded-lg ${compact ? 'h-24' : 'h-32'} flex items-center justify-center text-muted-foreground text-sm`}>
          {mapError}
        </div>
        <div className="flex gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Subject
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500"></span> Sold
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div 
        ref={mapContainer} 
        className={`rounded-lg overflow-hidden ${compact ? 'h-24' : 'h-32'}`}
        style={{ minHeight: compact ? '96px' : '128px' }}
      />
      <div className="flex gap-3 text-xs flex-wrap">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span> Subject
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span> Active
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500"></span> Sold
        </span>
      </div>
    </div>
  );
}
