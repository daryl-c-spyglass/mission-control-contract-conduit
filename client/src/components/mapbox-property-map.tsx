import { useRef, useEffect, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Map, Satellite, Moon, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const MAP_STYLES = {
  STREETS: 'mapbox://styles/mapbox/streets-v11',
  SATELLITE: 'mapbox://styles/mapbox/satellite-streets-v11',
  DARK: 'mapbox://styles/mapbox/dark-v10',
} as const;

type MapStylePreference = 'streets' | 'satellite' | 'dark';
const STORAGE_KEY = 'mlsDataMapStylePreference';
const STYLE_CYCLE: MapStylePreference[] = ['streets', 'satellite', 'dark'];

function getStoredStylePreference(): MapStylePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'satellite' || stored === 'dark' || stored === 'streets') {
      return stored;
    }
  } catch {}
  return 'streets';
}

function setStoredStylePreference(pref: MapStylePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {}
}

function resolveMapStyle(preference: MapStylePreference, isDark: boolean): string {
  // If user explicitly chose satellite, always use it
  if (preference === 'satellite') return MAP_STYLES.SATELLITE;
  // If user explicitly chose dark, use it
  if (preference === 'dark') return MAP_STYLES.DARK;
  // For 'streets' or default: auto-sync with theme
  return isDark ? MAP_STYLES.DARK : MAP_STYLES.STREETS;
}

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
  const [stylePreference, setStylePreference] = useState<MapStylePreference>(getStoredStylePreference);
  const { isDark } = useTheme();

  const mapStyle = resolveMapStyle(stylePreference, isDark);

  const selectStyle = useCallback((pref: MapStylePreference) => {
    setStylePreference(pref);
    setStoredStylePreference(pref);
  }, []);

  const getStyleIcon = (style: MapStylePreference) => {
    switch (style) {
      case 'satellite': return <Satellite className="h-4 w-4" />;
      case 'dark': return <Moon className="h-4 w-4" />;
      case 'streets':
      default: return <Map className="h-4 w-4" />;
    }
  };

  const getStyleLabel = (style: MapStylePreference) => {
    switch (style) {
      case 'satellite': return 'Satellite';
      case 'dark': return 'Dark';
      case 'streets':
      default: return 'Streets';
    }
  };

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
      const currentStyleUrl = (map.current as any)._styleUrl || '';
      if (currentStyleUrl !== mapStyle) {
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
      <div className="relative w-full h-[300px]">
        <div 
          ref={mapContainer} 
          className="w-full h-full rounded-b-lg overflow-hidden"
          data-testid="map-container"
        />
        {isLoaded && (
          <div className="absolute top-2 left-2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 shadow-md gap-1 px-2"
                  data-testid="button-toggle-map-style"
                >
                  {getStyleIcon(stylePreference)}
                  <span className="text-xs">{getStyleLabel(stylePreference)}</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[120px]">
                {STYLE_CYCLE.map((style) => (
                  <DropdownMenuItem
                    key={style}
                    onClick={() => selectStyle(style)}
                    className="gap-2"
                    data-testid={`menu-item-style-${style}`}
                  >
                    {getStyleIcon(style)}
                    <span>{getStyleLabel(style)}</span>
                    {style === stylePreference && (
                      <span className="ml-auto text-xs text-muted-foreground">Active</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
}
