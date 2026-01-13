import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { Property } from '@shared/schema';

interface CMAMapProps {
  properties: Property[];
  subjectProperty: Property | null;
  onPropertyClick?: (property: Property) => void;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '';
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  return `$${Math.round(price / 1000)}K`;
}

function formatFullPrice(price: number | null | undefined): string {
  if (price == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function CMAMap({ properties, subjectProperty, onPropertyClick }: CMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const { isDark } = useTheme();

  const mapStyle = isDark 
    ? 'mapbox://styles/mapbox/dark-v11' 
    : 'mapbox://styles/mapbox/light-v11';

  useEffect(() => {
    fetch('/api/mapbox-token')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.token) {
          setToken(data.token);
        } else {
          setError(data.error || 'Failed to load map token');
        }
      })
      .catch((err) => setError(`Failed to load map: ${err.message}`));
  }, []);

  const getPropertyCoordinates = useCallback((property: Property): [number, number] | null => {
    const propAny = property as any;
    const lat = propAny.map?.latitude || propAny.latitude;
    const lng = propAny.map?.longitude || propAny.longitude;
    if (lat && lng) {
      return [lng, lat];
    }
    return null;
  }, []);

  const getPropertyStatus = useCallback((property: Property): 'active' | 'pending' | 'sold' => {
    const status = ((property.standardStatus || (property as any).status) || '').toLowerCase();
    if (status.includes('closed') || status.includes('sold')) {
      return 'sold';
    }
    if (status.includes('pending') || status.includes('contract') || status.includes('contingent')) {
      return 'pending';
    }
    return 'active';
  }, []);

  const getPropertyPrice = useCallback((property: Property): number => {
    const propAny = property as any;
    return propAny.soldPrice || propAny.closePrice || property.listPrice || 0;
  }, []);

  const getPropertyPhotos = useCallback((property: Property): string[] => {
    const propAny = property as any;
    if (propAny.photos && propAny.photos.length > 0) return propAny.photos;
    if (propAny.media && propAny.media.length > 0) {
      return propAny.media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
    }
    if (propAny.images && propAny.images.length > 0) return propAny.images;
    return [];
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();

    if (subjectProperty) {
      const coords = getPropertyCoordinates(subjectProperty);
      if (coords) {
        const price = getPropertyPrice(subjectProperty);
        const el = document.createElement('div');
        el.className = 'subject-marker';
        el.innerHTML = `
          <div style="position: relative; z-index: 100;">
            <div style="
              background-color: hsl(var(--primary));
              color: white;
              padding: 6px 12px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              font-weight: 600;
              font-size: 12px;
              white-space: nowrap;
              text-align: center;
            ">
              <span style="font-size: 10px; display: block; opacity: 0.8;">Subject</span>
              ${formatPrice(price)}
            </div>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid hsl(var(--primary));
            "></div>
          </div>
        `;
        
        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(coords)
          .addTo(map.current);
        markersRef.current.push(marker);
      }
    }

    properties.forEach((property) => {
      const coords = getPropertyCoordinates(property);
      if (!coords) return;

      const price = getPropertyPrice(property);
      const status = getPropertyStatus(property);
      
      let bgColor = '#22c55e';
      if (status === 'sold') {
        bgColor = '#ef4444';
      } else if (status === 'pending') {
        bgColor = '#f59e0b';
      }

      const el = document.createElement('div');
      el.className = 'comp-marker';
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div style="position: relative;">
          <div style="
            background-color: ${bgColor};
            color: white;
            padding: 4px 8px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-weight: 600;
            font-size: 11px;
            white-space: nowrap;
            transition: transform 0.15s;
          ">
            ${formatPrice(price)}
          </div>
          <div style="
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid ${bgColor};
          "></div>
        </div>
      `;

      el.addEventListener('click', () => {
        setSelectedProperty(property);
        onPropertyClick?.(property);
      });

      el.addEventListener('mouseenter', () => {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) inner.style.transform = 'scale(1.1)';
      });
      el.addEventListener('mouseleave', () => {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) inner.style.transform = 'scale(1)';
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    fitMapToBounds();
  }, [properties, subjectProperty, getPropertyCoordinates, getPropertyPrice, getPropertyStatus, clearMarkers, onPropertyClick]);

  const fitMapToBounds = useCallback(() => {
    if (!map.current) return;

    const coordinates: [number, number][] = [];

    if (subjectProperty) {
      const coords = getPropertyCoordinates(subjectProperty);
      if (coords) coordinates.push(coords);
    }

    properties.forEach(p => {
      const coords = getPropertyCoordinates(p);
      if (coords) coordinates.push(coords);
    });

    if (coordinates.length === 0) return;

    if (coordinates.length === 1) {
      map.current.flyTo({ center: coordinates[0], zoom: 14 });
      return;
    }

    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord as mapboxgl.LngLatLike),
      new mapboxgl.LngLatBounds(coordinates[0], coordinates[0])
    );

    map.current.fitBounds(bounds, {
      padding: 60,
      maxZoom: 14,
    });
  }, [properties, subjectProperty, getPropertyCoordinates]);

  useEffect(() => {
    if (!token || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;

    const centerLat = subjectProperty 
      ? getPropertyCoordinates(subjectProperty)?.[1] || 30.2672
      : properties[0] 
        ? getPropertyCoordinates(properties[0])?.[1] || 30.2672
        : 30.2672;
    const centerLng = subjectProperty 
      ? getPropertyCoordinates(subjectProperty)?.[0] || -97.7431
      : properties[0] 
        ? getPropertyCoordinates(properties[0])?.[0] || -97.7431
        : -97.7431;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [centerLng, centerLat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      addMarkers();
    });

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (map.current?.loaded()) {
      addMarkers();
    }
  }, [properties, subjectProperty, addMarkers]);

  useEffect(() => {
    if (map.current) {
      map.current.setStyle(mapStyle);
      map.current.once('styledata', () => {
        addMarkers();
      });
    }
  }, [isDark, mapStyle, addMarkers]);

  if (error) {
    return (
      <div className="w-full h-[500px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full h-[500px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  const selectedPhotos = selectedProperty ? getPropertyPhotos(selectedProperty) : [];
  const selectedPropAny = selectedProperty as any;

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden border" data-testid="cma-map-container">
      <div ref={mapContainer} className="w-full h-full" />
      
      <div className="absolute bottom-4 left-4 bg-background/90 dark:bg-background/95 backdrop-blur rounded-lg p-3 shadow-md border">
        <p className="text-xs font-medium mb-2">Legend</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }}></div>
            <span className="text-xs">Subject Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs">Active Listing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-xs">Sold</span>
          </div>
        </div>
      </div>

      {selectedProperty && (
        <div className="absolute top-4 right-4 bg-background rounded-lg shadow-lg p-4 max-w-xs border" data-testid="selected-property-popup">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => setSelectedProperty(null)}
            data-testid="button-close-property-popup"
          >
            <X className="h-4 w-4" />
          </Button>
          {selectedPhotos[0] && (
            <img 
              src={selectedPhotos[0]} 
              alt="Property" 
              className="w-full h-24 object-cover rounded mb-2"
            />
          )}
          <p className="font-semibold text-sm">
            {formatFullPrice(getPropertyPrice(selectedProperty))}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {selectedPropAny.address?.streetAddress || selectedProperty.unparsedAddress || 'Unknown Address'}
          </p>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{selectedPropAny.bedroomsTotal || selectedPropAny.numBedrooms || '-'} bd</span>
            <span>{selectedPropAny.bathroomsTotalInteger || selectedPropAny.numBathrooms || '-'} ba</span>
            <span>{(selectedPropAny.livingArea || selectedPropAny.sqft)?.toLocaleString() || '-'} sqft</span>
          </div>
        </div>
      )}
    </div>
  );
}
