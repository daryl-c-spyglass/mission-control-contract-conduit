import { useEffect, useRef, useState, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Map, Layers } from "lucide-react";
import { MAP_STYLES, getStatusHex } from "@/lib/pdfStyles";

interface PropertyLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  status: string;
  isSubject?: boolean;
}

interface MapboxCMAMapProps {
  properties: PropertyLocation[];
  subjectProperty?: PropertyLocation | null;
  style?: 'streets' | 'satellite' | 'dark';
  showPolygon?: boolean;
  onStyleChange?: (style: 'streets' | 'satellite' | 'dark') => void;
  onPolygonChange?: (show: boolean) => void;
  height?: string;
  interactive?: boolean;
}

export function MapboxCMAMap({
  properties,
  subjectProperty,
  style = 'streets',
  showPolygon = true,
  onStyleChange,
  onPolygonChange,
  height = '400px',
  interactive = true,
}: MapboxCMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Fetch token from backend API (same as cma-map.tsx)
  useEffect(() => {
    fetch('/api/mapbox-token')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.token) setMapboxToken(data.token);
        else setTokenError(data.error || 'Failed to load map token');
      })
      .catch((err) => setTokenError(`Failed to load map: ${err.message}`));
  }, []);

  const allProperties = useMemo(() => {
    const props = [...properties];
    if (subjectProperty && !props.find(p => p.id === subjectProperty.id)) {
      props.push({ ...subjectProperty, isSubject: true });
    }
    return props;
  }, [properties, subjectProperty]);

  const center = useMemo(() => {
    if (subjectProperty) {
      return [subjectProperty.lng, subjectProperty.lat] as [number, number];
    }
    if (allProperties.length > 0) {
      const avgLng = allProperties.reduce((sum, p) => sum + p.lng, 0) / allProperties.length;
      const avgLat = allProperties.reduce((sum, p) => sum + p.lat, 0) / allProperties.length;
      return [avgLng, avgLat] as [number, number];
    }
    return [-97.7431, 30.2672] as [number, number];
  }, [allProperties, subjectProperty]);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[style],
      center: center,
      zoom: 12,
      interactive: interactive,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    if (interactive) {
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken, interactive]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.setStyle(MAP_STYLES[style]);
  }, [style, mapLoaded]);

  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const existingMarkers = document.querySelectorAll('.cma-map-marker');
    existingMarkers.forEach(marker => marker.remove());

    allProperties.forEach(property => {
      const color = getStatusHex(property.status, property.isSubject);
      
      const el = document.createElement('div');
      el.className = 'cma-map-marker';
      el.style.cssText = `
        width: 24px;
        height: 24px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `;

      new mapboxgl.Marker(el)
        .setLngLat([property.lng, property.lat])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`
              <div style="font-family: system-ui; padding: 4px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${property.address}</div>
                <div style="color: #666;">$${property.price.toLocaleString()}</div>
                <div style="color: #888; font-size: 12px;">${property.status}</div>
              </div>
            `)
        )
        .addTo(map.current!);
    });

    if (allProperties.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      allProperties.forEach(p => bounds.extend([p.lng, p.lat]));
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [allProperties, mapLoaded]);

  if (tokenError) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg" 
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <Map className="w-8 h-8 mx-auto mb-2" />
          <p>{tokenError}</p>
        </div>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div 
        className="flex items-center justify-center bg-muted rounded-lg" 
        style={{ height }}
      >
        <div className="text-center text-muted-foreground">
          <Map className="w-8 h-8 mx-auto mb-2 animate-pulse" />
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(onStyleChange || onPolygonChange) && (
        <div className="flex items-center justify-between gap-4 px-2">
          {onStyleChange && (
            <div className="flex items-center gap-2">
              <Button
                variant={style === 'streets' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStyleChange('streets')}
                data-testid="button-map-streets"
              >
                Streets
              </Button>
              <Button
                variant={style === 'satellite' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onStyleChange('satellite')}
                data-testid="button-map-satellite"
              >
                Satellite
              </Button>
            </div>
          )}
          {onPolygonChange && (
            <div className="flex items-center gap-2">
              <Switch
                id="showPolygon"
                checked={showPolygon}
                onCheckedChange={onPolygonChange}
                data-testid="switch-show-polygon"
              />
              <Label htmlFor="showPolygon" className="text-sm">Show Area</Label>
            </div>
          )}
        </div>
      )}
      <div 
        ref={mapContainer} 
        className="rounded-lg overflow-hidden"
        style={{ height }}
        data-testid="mapbox-cma-map"
      />
    </div>
  );
}
