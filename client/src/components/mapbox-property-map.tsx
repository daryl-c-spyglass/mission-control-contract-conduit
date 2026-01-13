import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  address?: string;
  price?: number | null;
  beds?: number;
  baths?: number;
  sqft?: number;
  status?: string;
  zoom?: number;
  enableGeolocate?: boolean;
}

function formatPrice(price: number | null | undefined): string {
  if (price == null) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function MapboxPropertyMap({ 
  latitude, 
  longitude, 
  address,
  price,
  beds,
  baths,
  sqft,
  status,
  zoom = 15,
  enableGeolocate = false
}: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const popup = useRef<mapboxgl.Popup | null>(null);
  const controlsAdded = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
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

  const buildPopupHTML = useCallback(() => {
    const details: string[] = [];
    if (beds != null) details.push(`${beds} bed`);
    if (baths != null) details.push(`${baths} bath`);
    if (sqft != null) details.push(`${sqft.toLocaleString()} sqft`);
    
    const priceStr = formatPrice(price);
    const statusBadge = status ? `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${isDark ? '#374151' : '#e5e7eb'}; color: ${isDark ? '#d1d5db' : '#374151'}; text-transform: uppercase;">${status}</span>` : '';
    
    return `
      <div style="color: ${isDark ? '#f3f4f6' : '#111827'}; padding: 8px; min-width: 180px; font-family: system-ui, sans-serif;">
        ${priceStr ? `<div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">${priceStr}</div>` : ''}
        <div style="font-weight: 500; margin-bottom: 6px;">${address || 'Property Location'}</div>
        ${details.length > 0 ? `<div style="font-size: 13px; color: ${isDark ? '#9ca3af' : '#6b7280'}; margin-bottom: 6px;">${details.join(' • ')}</div>` : ''}
        ${statusBadge}
      </div>
    `;
  }, [address, price, beds, baths, sqft, status, isDark]);

  const addMarkerAndPopup = useCallback(() => {
    if (!map.current) return;
    
    if (marker.current) {
      marker.current.remove();
    }
    if (popup.current) {
      popup.current.remove();
    }
    
    popup.current = new mapboxgl.Popup({ 
      offset: 25,
      closeButton: true,
      closeOnClick: false,
      className: isDark ? 'mapboxgl-popup-dark' : ''
    }).setHTML(buildPopupHTML());
    
    marker.current = new mapboxgl.Marker({ 
      color: '#f97316',
      scale: 1.1
    })
      .setLngLat([longitude, latitude])
      .setPopup(popup.current)
      .addTo(map.current);
    
    const markerEl = marker.current.getElement();
    markerEl.style.cursor = 'pointer';
    markerEl.setAttribute('tabindex', '0');
    markerEl.setAttribute('role', 'button');
    markerEl.setAttribute('aria-label', `Property marker at ${address || 'location'}`);
    
    markerEl.addEventListener('click', () => {
      if (map.current) {
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: 16,
          speed: 0.8,
          curve: 1.2
        });
      }
    });
    
    markerEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        marker.current?.togglePopup();
      }
    });
  }, [longitude, latitude, address, isDark, buildPopupHTML]);

  useEffect(() => {
    if (!mapContainer.current || !token) return;
    if (!latitude || !longitude) return;

    mapboxgl.accessToken = token;
    
    if (!map.current) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: mapStyle,
        center: [longitude, latitude],
        zoom: zoom - 2,
        pitch: 0,
        attributionControl: true
      });

      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl(), 'top-right');
      map.current.addControl(new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'imperial' }), 'bottom-left');
      
      if (enableGeolocate) {
        map.current.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserHeading: false
          }),
          'top-right'
        );
      }
      
      controlsAdded.current = true;

      map.current.on('load', () => {
        setIsLoaded(true);
        addMarkerAndPopup();
        
        map.current?.flyTo({
          center: [longitude, latitude],
          zoom: zoom,
          pitch: 30,
          speed: 0.6,
          curve: 1.4,
          essential: true
        });
      });

      map.current.on('style.load', () => {
        addMarkerAndPopup();
      });
    }

    return () => {
    };
  }, [token, enableGeolocate]);

  const prevCoordsRef = useRef({ latitude, longitude });
  useEffect(() => {
    if (map.current && isLoaded) {
      const coordsChanged = prevCoordsRef.current.latitude !== latitude || 
                           prevCoordsRef.current.longitude !== longitude;
      
      if (coordsChanged) {
        prevCoordsRef.current = { latitude, longitude };
        
        addMarkerAndPopup();
        
        map.current.flyTo({
          center: [longitude, latitude],
          zoom: zoom,
          pitch: 30,
          speed: 0.8,
          curve: 1.2,
          essential: true
        });
      }
    }
  }, [latitude, longitude, zoom, isLoaded, addMarkerAndPopup]);

  useEffect(() => {
    if (map.current && isLoaded) {
      const currentStyle = map.current.getStyle();
      const currentStyleName = currentStyle?.name || '';
      const newStyleIsDark = mapStyle.includes('dark');
      const currentStyleIsDark = currentStyleName.toLowerCase().includes('dark');
      
      if (newStyleIsDark !== currentStyleIsDark) {
        map.current.setStyle(mapStyle);
      }
    }
  }, [mapStyle, isLoaded]);

  useEffect(() => {
    return () => {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (popup.current) {
        popup.current.remove();
        popup.current = null;
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      controlsAdded.current = false;
    };
  }, []);

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
    <>
      <style>{`
        .mapboxgl-popup-dark .mapboxgl-popup-content {
          background: #1f2937;
          color: #f3f4f6;
        }
        .mapboxgl-popup-dark .mapboxgl-popup-tip {
          border-top-color: #1f2937;
        }
        .mapboxgl-popup-close-button {
          font-size: 18px;
          padding: 4px 8px;
          color: inherit;
        }
        .mapboxgl-ctrl-fullscreen {
          margin-top: 4px !important;
        }
      `}</style>
      <div 
        ref={mapContainer} 
        className="w-full h-[300px] rounded-b-lg overflow-hidden"
        data-testid="map-container"
      />
    </>
  );
}
