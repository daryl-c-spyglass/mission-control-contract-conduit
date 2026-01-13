import { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  zoom?: number;
}

export function MapboxPropertyMap({ 
  latitude, 
  longitude, 
  address,
  zoom = 15 
}: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!mapContainer.current || !token) return;
    if (!latitude || !longitude) return;

    mapboxgl.accessToken = token;

    const addMarker = () => {
      if (!map.current) return;
      
      if (marker.current) {
        marker.current.remove();
      }
      
      marker.current = new mapboxgl.Marker({ color: '#f97316' })
        .setLngLat([longitude, latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 })
            .setHTML(`<div style="color: #000; padding: 4px;"><strong>${address || 'Property Location'}</strong></div>`)
        )
        .addTo(map.current);
    };
    
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [longitude, latitude],
        zoom: zoom,
      });

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.on('load', addMarker);
      map.current.on('style.load', addMarker);
    } else {
      map.current.setStyle(mapStyle);
    }

    return () => {
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, [latitude, longitude, address, zoom, token, mapStyle]);

  if (error) {
    return (
      <div 
        className="w-full h-[300px] rounded-b-lg bg-muted flex items-center justify-center text-muted-foreground"
        data-testid="map-error"
      >
        {error}
      </div>
    );
  }

  if (!token) {
    return (
      <div 
        className="w-full h-[300px] rounded-b-lg bg-muted flex items-center justify-center text-muted-foreground"
        data-testid="map-loading"
      >
        Loading map...
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      className="w-full h-[300px] rounded-b-lg overflow-hidden"
      data-testid="map-container"
    />
  );
}
