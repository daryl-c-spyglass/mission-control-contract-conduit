import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Locate, Maximize2 } from 'lucide-react';
import type { Property } from '@shared/schema';

interface CMAMapProps {
  properties: Property[];
  subjectProperty: Property | null;
  onPropertyClick?: (property: Property) => void;
  showPolygon?: boolean;
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

function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function calculateConvexHull(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;

  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const lower: [number, number][] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function CMAMap({ properties, subjectProperty, onPropertyClick, showPolygon = true }: CMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
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

  const polygonCoordinates = useMemo(() => {
    const coords: [number, number][] = [];
    
    if (subjectProperty) {
      const c = getPropertyCoordinates(subjectProperty);
      if (c) coords.push(c);
    }
    
    properties.forEach(p => {
      const c = getPropertyCoordinates(p);
      if (c) coords.push(c);
    });
    
    if (coords.length < 3) return null;
    
    return calculateConvexHull(coords);
  }, [properties, subjectProperty, getPropertyCoordinates]);

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

  const addPolygonBoundary = useCallback((coordinates: [number, number][]) => {
    if (!map.current) return;

    if (map.current.getLayer('cma-polygon-fill')) {
      map.current.removeLayer('cma-polygon-fill');
    }
    if (map.current.getLayer('cma-polygon-line')) {
      map.current.removeLayer('cma-polygon-line');
    }
    if (map.current.getSource('cma-polygon')) {
      map.current.removeSource('cma-polygon');
    }

    const closedCoords = [...coordinates, coordinates[0]];

    map.current.addSource('cma-polygon', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [closedCoords],
        },
      },
    });

    map.current.addLayer({
      id: 'cma-polygon-fill',
      type: 'fill',
      source: 'cma-polygon',
      paint: {
        'fill-color': isDark ? '#60a5fa' : '#3b82f6',
        'fill-opacity': 0.12,
      },
    });

    map.current.addLayer({
      id: 'cma-polygon-line',
      type: 'line',
      source: 'cma-polygon',
      paint: {
        'line-color': isDark ? '#60a5fa' : '#2563eb',
        'line-width': 2.5,
        'line-opacity': 0.7,
      },
    });
  }, [isDark]);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();

    if (showPolygon && polygonCoordinates && polygonCoordinates.length >= 3) {
      addPolygonBoundary(polygonCoordinates);
    }

    if (subjectProperty) {
      const coords = getPropertyCoordinates(subjectProperty);
      if (coords) {
        const price = getPropertyPrice(subjectProperty);
        const el = document.createElement('div');
        el.className = 'subject-marker';
        el.innerHTML = `
          <div style="position: relative; z-index: 100;">
            <div style="
              background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
              color: white;
              padding: 6px 12px;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
              font-weight: 700;
              font-size: 12px;
              white-space: nowrap;
              text-align: center;
              border: 2px solid white;
            ">
              <span style="font-size: 9px; display: block; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Subject</span>
              ${formatPrice(price)}
            </div>
            <div style="
              position: absolute;
              bottom: -8px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid #1e40af;
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
      
      let bgColor = '#16a34a';
      let shadowColor = 'rgba(22, 163, 74, 0.4)';
      if (status === 'sold') {
        bgColor = '#dc2626';
        shadowColor = 'rgba(220, 38, 38, 0.4)';
      } else if (status === 'pending') {
        bgColor = '#f59e0b';
        shadowColor = 'rgba(245, 158, 11, 0.4)';
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
            border-radius: 4px;
            box-shadow: 0 2px 8px ${shadowColor};
            font-weight: 600;
            font-size: 11px;
            white-space: nowrap;
            transition: transform 0.15s, box-shadow 0.15s;
            border: 1px solid rgba(255,255,255,0.3);
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
        if (inner) {
          inner.style.transform = 'scale(1.1)';
          inner.style.boxShadow = `0 4px 12px ${shadowColor}`;
        }
      });
      el.addEventListener('mouseleave', () => {
        const inner = el.querySelector('div > div') as HTMLElement;
        if (inner) {
          inner.style.transform = 'scale(1)';
          inner.style.boxShadow = `0 2px 8px ${shadowColor}`;
        }
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    fitMapToBounds();
  }, [properties, subjectProperty, getPropertyCoordinates, getPropertyPrice, getPropertyStatus, clearMarkers, onPropertyClick, showPolygon, polygonCoordinates, addPolygonBoundary]);

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

  const centerOnSubject = useCallback(() => {
    if (!map.current || !subjectProperty) return;
    const coords = getPropertyCoordinates(subjectProperty);
    if (coords) {
      map.current.flyTo({ center: coords, zoom: 14 });
    }
  }, [subjectProperty, getPropertyCoordinates]);

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
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      addMarkers();
    });

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (map.current && mapLoaded) {
      addMarkers();
    }
  }, [properties, subjectProperty, addMarkers, mapLoaded]);

  useEffect(() => {
    if (map.current) {
      map.current.setStyle(mapStyle);
      map.current.once('styledata', () => {
        if (mapLoaded) {
          addMarkers();
        }
      });
    }
  }, [isDark, mapStyle, addMarkers, mapLoaded]);

  if (error) {
    return (
      <div className="w-full h-[550px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="w-full h-[550px] rounded-lg border flex items-center justify-center bg-muted">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  const selectedPhotos = selectedProperty ? getPropertyPhotos(selectedProperty) : [];
  const selectedPropAny = selectedProperty as any;

  return (
    <div className="relative w-full h-[550px] rounded-lg overflow-hidden border" data-testid="cma-map-container">
      <div ref={mapContainer} className="w-full h-full" />
      
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-md"
          onClick={centerOnSubject}
          title="Center on subject"
          data-testid="button-center-subject"
        >
          <Locate className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8 shadow-md"
          onClick={fitMapToBounds}
          title="Fit all properties"
          data-testid="button-fit-bounds"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <Badge variant="secondary" className="shadow-md bg-background/90 backdrop-blur">
          {properties.length} comparable{properties.length !== 1 ? 's' : ''} + Subject
        </Badge>
      </div>
      
      <div className="absolute bottom-4 left-4 bg-background/90 dark:bg-background/95 backdrop-blur rounded-lg p-3 shadow-md border">
        <p className="text-xs font-medium mb-2">Legend</p>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-xs">Subject Property</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span className="text-xs">Active Listing</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-xs">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
            <span className="text-xs">Sold</span>
          </div>
          {showPolygon && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t">
              <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/20"></div>
              <span className="text-xs">Search Area</span>
            </div>
          )}
        </div>
      </div>

      {selectedProperty && (
        <div className="absolute top-4 right-14 bg-background rounded-lg shadow-lg p-4 max-w-xs border" data-testid="selected-property-popup">
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
