import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Locate, Maximize2 } from 'lucide-react';
import type { Property } from '@shared/schema';

// Debug flag - set to true to enable console logging
const DEBUG_CMA_MAP = true;

// Normalized status type for CMA comparables
type NormalizedStatus = 'active' | 'pending' | 'sold' | 'unknown';

// Status display labels for the UI
const STATUS_LABELS: Record<NormalizedStatus, string> = {
  active: 'Active Listing',
  pending: 'Pending',
  sold: 'Sold',
  unknown: 'Unknown Status',
};

interface CMAMapProps {
  properties: Property[];
  subjectProperty: Property | null;
  onPropertyClick?: (property: Property) => void;
  showPolygon?: boolean;
}

// Point model for CMA map - single source of truth
interface CmaMapPoint {
  type: 'subject' | 'comp';
  status: NormalizedStatus;
  lng: number;
  lat: number;
  id: string;
  property: Property;
  price: number;
  // Additional details for tooltips
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  address: string;
}

// Complete map model returned by buildCmaMapModel
interface CmaMapModel {
  points: CmaMapPoint[];
  bounds: mapboxgl.LngLatBounds | null;
  polygonGeoJson: GeoJSON.Feature<GeoJSON.Polygon> | null;
  subjectCoords: [number, number] | null;
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

// Cross product for convex hull algorithm
function cross(o: [number, number], a: [number, number], b: [number, number]): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

// Calculate convex hull of points using Andrew's monotone chain algorithm
// Points are [lng, lat] (Mapbox format)
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

// Parse WKT POINT string to extract coordinates
// Format: "POINT (-97.71673184 30.28215462)"
function parseWktPoint(wkt: string | null | undefined): [number, number] | null {
  if (!wkt || typeof wkt !== 'string') return null;
  const match = wkt.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
  if (match) {
    const lng = parseFloat(match[1]);
    const lat = parseFloat(match[2]);
    if (!isNaN(lng) && !isNaN(lat)) {
      return [lng, lat];
    }
  }
  return null;
}

// Extract coordinates from a property, handling multiple possible field locations
// Returns [lng, lat] (Mapbox format) or null if not found
// Handles all known Repliers API coordinate formats:
// - map.latitude/longitude (standard)
// - coordinates.latitude/longitude (normalized)
// - geo.lat/lon (Repliers comparable format)
// - rawData.map.latitude/longitude (raw data)
// - rawData.map.point (WKT format like "POINT (-97.71 30.28)")
// - rawData.geo.lat/lon (raw geo data)
function getPropertyCoordinates(property: any): [number, number] | null {
  // Check multiple possible locations for coordinates (prioritized by reliability)
  
  // 1. Standard map object
  const mapLat = property?.map?.latitude;
  const mapLng = property?.map?.longitude;
  if (mapLat != null && mapLng != null && !isNaN(Number(mapLat)) && !isNaN(Number(mapLng))) {
    return [Number(mapLng), Number(mapLat)];
  }
  
  // 2. Normalized coordinates object
  const coordLat = property?.coordinates?.latitude;
  const coordLng = property?.coordinates?.longitude;
  if (coordLat != null && coordLng != null && !isNaN(Number(coordLat)) && !isNaN(Number(coordLng))) {
    return [Number(coordLng), Number(coordLat)];
  }
  
  // 3. Repliers geo object (used in comparables)
  const geoLat = property?.geo?.lat;
  const geoLon = property?.geo?.lon || property?.geo?.lng;
  if (geoLat != null && geoLon != null && !isNaN(Number(geoLat)) && !isNaN(Number(geoLon))) {
    return [Number(geoLon), Number(geoLat)];
  }
  
  // 4. Direct latitude/longitude on property
  const directLat = property?.latitude;
  const directLng = property?.longitude;
  if (directLat != null && directLng != null && !isNaN(Number(directLat)) && !isNaN(Number(directLng))) {
    return [Number(directLng), Number(directLat)];
  }
  
  // 5. rawData.map object
  const rawMapLat = property?.rawData?.map?.latitude;
  const rawMapLng = property?.rawData?.map?.longitude;
  if (rawMapLat != null && rawMapLng != null && !isNaN(Number(rawMapLat)) && !isNaN(Number(rawMapLng))) {
    return [Number(rawMapLng), Number(rawMapLat)];
  }
  
  // 6. rawData.map.point (WKT format)
  const rawMapPoint = property?.rawData?.map?.point;
  const wktCoords = parseWktPoint(rawMapPoint);
  if (wktCoords) {
    return wktCoords;
  }
  
  // 7. rawData.geo object
  const rawGeoLat = property?.rawData?.geo?.lat;
  const rawGeoLon = property?.rawData?.geo?.lon || property?.rawData?.geo?.lng;
  if (rawGeoLat != null && rawGeoLon != null && !isNaN(Number(rawGeoLat)) && !isNaN(Number(rawGeoLon))) {
    return [Number(rawGeoLon), Number(rawGeoLat)];
  }
  
  // 8. For comparables: check address object for lat/lng
  const addrLat = property?.address?.latitude;
  const addrLng = property?.address?.longitude;
  if (addrLat != null && addrLng != null && !isNaN(Number(addrLat)) && !isNaN(Number(addrLng))) {
    return [Number(addrLng), Number(addrLat)];
  }
  
  return null;
}

/**
 * Normalize Repliers API status values to our standard enum
 * This is the single source of truth for status normalization across the CMA map
 * 
 * Repliers API status values observed:
 * - standardStatus: "Active", "Pending", "Sold", "Closed", "Coming Soon", "Withdrawn", etc.
 * - lastStatus: "A" (Active), "U" (Under Contract), "S" (Sold), "W" (Withdrawn), "Sc" (Status Change), etc.
 * - status: Various text values
 * 
 * @param rawStatus - The raw status string from Repliers API
 * @returns Normalized status enum value
 */
function normalizeComparableStatus(rawStatus: string | null | undefined): NormalizedStatus {
  if (!rawStatus) return 'unknown';
  
  const status = rawStatus.toString().toLowerCase().trim();
  
  // Sold/Closed statuses
  if (status === 's' || status === 'sold' || status === 'closed' || 
      status.includes('sold') || status.includes('closed')) {
    return 'sold';
  }
  
  // Pending/Under Contract statuses
  if (status === 'u' || status === 'p' || status === 'pending' || 
      status.includes('pending') || status.includes('contract') || 
      status.includes('contingent') || status.includes('under contract') ||
      status.includes('backup') || status.includes('option')) {
    return 'pending';
  }
  
  // Active/Coming Soon statuses
  if (status === 'a' || status === 'active' || 
      status.includes('active') || status.includes('coming') ||
      status.includes('new') || status.includes('available')) {
    return 'active';
  }
  
  // Withdrawn/Cancelled/Expired - treat as unknown
  if (status === 'w' || status === 'x' || status === 'e' ||
      status.includes('withdrawn') || status.includes('cancelled') || 
      status.includes('canceled') || status.includes('expired') ||
      status.includes('terminate')) {
    return 'unknown';
  }
  
  // Status change indicator - try to determine from other context
  if (status === 'sc') {
    return 'pending'; // Status change often means going to pending
  }
  
  // If we have a status but can't categorize it, default to active
  // (better to show something than grey "unknown")
  if (status.length > 0) {
    if (DEBUG_CMA_MAP) {
      console.log('[CMA Map] Unrecognized status, defaulting to active:', rawStatus);
    }
    return 'active';
  }
  
  return 'unknown';
}

/**
 * Extract and normalize property status from various possible fields
 * Checks multiple fields in priority order to find the best status indicator
 */
function getPropertyStatus(property: any): NormalizedStatus {
  // Priority 1: standardStatus (RESO standard)
  if (property?.standardStatus) {
    return normalizeComparableStatus(property.standardStatus);
  }
  
  // Priority 2: status field
  if (property?.status) {
    return normalizeComparableStatus(property.status);
  }
  
  // Priority 3: lastStatus (Repliers specific)
  if (property?.lastStatus) {
    return normalizeComparableStatus(property.lastStatus);
  }
  
  // Priority 4: Check rawData for nested status
  if (property?.rawData?.standardStatus) {
    return normalizeComparableStatus(property.rawData.standardStatus);
  }
  if (property?.rawData?.status) {
    return normalizeComparableStatus(property.rawData.status);
  }
  if (property?.rawData?.lastStatus) {
    return normalizeComparableStatus(property.rawData.lastStatus);
  }
  
  // Priority 5: Infer from sold price/date
  if (property?.soldPrice || property?.closePrice || property?.soldDate || property?.closedDate) {
    return 'sold';
  }
  
  return 'unknown';
}

// Get price from property, handling multiple possible field locations
function getPropertyPrice(property: any): number {
  return property?.soldPrice 
    || property?.closePrice 
    || property?.listPrice 
    || property?.price 
    || 0;
}

// Get bedroom count from property
function getPropertyBeds(property: any): number | null {
  const beds = property?.bedroomsTotal 
    || property?.numBedrooms 
    || property?.bedrooms
    || property?.details?.numBedrooms
    || property?.rawData?.details?.numBedrooms;
  return beds != null ? Number(beds) : null;
}

// Get bathroom count from property
function getPropertyBaths(property: any): number | null {
  const baths = property?.bathroomsTotalInteger 
    || property?.numBathrooms 
    || property?.bathrooms
    || property?.details?.numBathrooms
    || property?.rawData?.details?.numBathrooms;
  return baths != null ? Number(baths) : null;
}

// Get square footage from property
function getPropertySqft(property: any): number | null {
  const sqft = property?.livingArea 
    || property?.sqft 
    || property?.details?.sqft
    || property?.rawData?.details?.sqft;
  return sqft != null ? Number(sqft) : null;
}

// Get short address from property
function getPropertyAddress(property: any): string {
  // Check for parsed address first
  if (property?.address?.streetAddress) return property.address.streetAddress;
  if (typeof property?.address === 'string') return property.address;
  
  // Build address from parts
  if (property?.address?.streetNumber && property?.address?.streetName) {
    let addr = `${property.address.streetNumber} ${property.address.streetName}`;
    if (property.address.streetSuffix) addr += ` ${property.address.streetSuffix}`;
    return addr;
  }
  
  // Check unparsedAddress
  if (property?.unparsedAddress) return property.unparsedAddress;
  
  // Raw data fallback
  if (property?.rawData?.address?.streetAddress) return property.rawData.address.streetAddress;
  
  return 'Unknown Address';
}

// Build the complete CMA map model - SINGLE SOURCE OF TRUTH
// This function is used by:
// - Initial render
// - Rerender after data changes  
// - UI controls (fit/center)
function buildCmaMapModel(subjectProperty: Property | null, comparables: Property[]): CmaMapModel {
  const points: CmaMapPoint[] = [];
  const allCoords: [number, number][] = [];
  let subjectCoords: [number, number] | null = null;

  // Process subject property first
  if (subjectProperty) {
    const coords = getPropertyCoordinates(subjectProperty);
    if (coords) {
      subjectCoords = coords;
      allCoords.push(coords);
      points.push({
        type: 'subject',
        status: 'active',
        lng: coords[0],
        lat: coords[1],
        id: 'subject',
        property: subjectProperty,
        price: getPropertyPrice(subjectProperty),
        beds: getPropertyBeds(subjectProperty),
        baths: getPropertyBaths(subjectProperty),
        sqft: getPropertySqft(subjectProperty),
        address: getPropertyAddress(subjectProperty),
      });
    }
  }

  // Process all comparables
  comparables.forEach((property, index) => {
    const coords = getPropertyCoordinates(property);
    if (coords) {
      allCoords.push(coords);
      const propAny = property as any;
      const status = getPropertyStatus(property);
      
      if (DEBUG_CMA_MAP) {
        console.log('[CMA Map] Comparable status:', {
          id: propAny.mlsNumber || `comp-${index}`,
          standardStatus: propAny.standardStatus,
          status: propAny.status,
          lastStatus: propAny.lastStatus,
          normalized: status,
        });
      }
      
      points.push({
        type: 'comp',
        status: status,
        lng: coords[0],
        lat: coords[1],
        id: propAny.mlsNumber || `comp-${index}`,
        property: property,
        price: getPropertyPrice(property),
        beds: getPropertyBeds(property),
        baths: getPropertyBaths(property),
        sqft: getPropertySqft(property),
        address: getPropertyAddress(property),
      });
    }
  });

  // Build bounds from all coordinates
  let bounds: mapboxgl.LngLatBounds | null = null;
  if (allCoords.length > 0) {
    bounds = allCoords.reduce(
      (b, coord) => b.extend(coord as mapboxgl.LngLatLike),
      new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
    );
  }

  // Build polygon GeoJSON from convex hull or bounding box
  let polygonGeoJson: GeoJSON.Feature<GeoJSON.Polygon> | null = null;
  
  if (allCoords.length >= 3) {
    // Use convex hull for 3+ points
    const hull = calculateConvexHull(allCoords);
    if (hull.length >= 3) {
      // Close the polygon by adding first point at end
      const closedHull = [...hull, hull[0]];
      polygonGeoJson = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [closedHull],
        },
      };
    }
  } else if (allCoords.length === 2 && bounds) {
    // Use bounding box for 2 points - expand slightly for visibility
    const padding = 0.005; // ~500m padding
    const bboxCoords: [number, number][] = [
      [bounds.getWest() - padding, bounds.getSouth() - padding],
      [bounds.getEast() + padding, bounds.getSouth() - padding],
      [bounds.getEast() + padding, bounds.getNorth() + padding],
      [bounds.getWest() - padding, bounds.getNorth() + padding],
      [bounds.getWest() - padding, bounds.getSouth() - padding], // Close polygon
    ];
    polygonGeoJson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [bboxCoords],
      },
    };
  } else if (allCoords.length === 1) {
    // For single point, create a small square around it
    const [lng, lat] = allCoords[0];
    const padding = 0.003; // ~300m padding
    const bboxCoords: [number, number][] = [
      [lng - padding, lat - padding],
      [lng + padding, lat - padding],
      [lng + padding, lat + padding],
      [lng - padding, lat + padding],
      [lng - padding, lat - padding], // Close polygon
    ];
    polygonGeoJson = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [bboxCoords],
      },
    };
  }

  if (DEBUG_CMA_MAP) {
    console.log('[CMA Map] buildCmaMapModel:', {
      subjectCoords,
      comparablesReceived: comparables.length,
      comparablesWithValidCoords: points.filter(p => p.type === 'comp').length,
      totalPoints: points.length,
      bounds: bounds ? {
        sw: [bounds.getWest(), bounds.getSouth()],
        ne: [bounds.getEast(), bounds.getNorth()]
      } : null,
    });
  }

  return { points, bounds, polygonGeoJson, subjectCoords };
}

// Get marker color based on type and status
function getMarkerColor(point: CmaMapPoint): { bg: string; shadow: string } {
  if (point.type === 'subject') {
    return { bg: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)', shadow: 'rgba(37, 99, 235, 0.4)' };
  }
  
  switch (point.status) {
    case 'sold':
      return { bg: '#dc2626', shadow: 'rgba(220, 38, 38, 0.4)' };
    case 'pending':
      return { bg: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.4)' };
    case 'active':
      return { bg: '#16a34a', shadow: 'rgba(22, 163, 74, 0.4)' };
    case 'unknown':
    default:
      return { bg: '#6b7280', shadow: 'rgba(107, 114, 128, 0.4)' };
  }
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

  // Build the map model - this is the single source of truth
  const model = useMemo(() => {
    return buildCmaMapModel(subjectProperty, properties);
  }, [subjectProperty, properties]);

  useEffect(() => {
    fetch('/api/mapbox-token')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.token) setToken(data.token);
        else setError(data.error || 'Failed to load map token');
      })
      .catch((err) => setError(`Failed to load map: ${err.message}`));
  }, []);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  }, []);

  const updatePolygonLayer = useCallback(() => {
    if (!map.current || !showPolygon) return;

    const sourceId = 'cma-polygon';
    const fillLayerId = 'cma-polygon-fill';
    const lineLayerId = 'cma-polygon-line';

    // Remove existing layers/source if present
    if (map.current.getLayer(fillLayerId)) map.current.removeLayer(fillLayerId);
    if (map.current.getLayer(lineLayerId)) map.current.removeLayer(lineLayerId);
    if (map.current.getSource(sourceId)) map.current.removeSource(sourceId);

    if (model.polygonGeoJson) {
      map.current.addSource(sourceId, {
        type: 'geojson',
        data: model.polygonGeoJson,
      });

      map.current.addLayer({
        id: fillLayerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': isDark ? '#60a5fa' : '#3b82f6',
          'fill-opacity': 0.12,
        },
      });

      map.current.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': isDark ? '#60a5fa' : '#2563eb',
          'line-width': 2.5,
          'line-opacity': 0.7,
        },
      });
    }
  }, [model.polygonGeoJson, showPolygon, isDark]);

  const addMarkers = useCallback(() => {
    if (!map.current) return;
    clearMarkers();

    // Update polygon layer
    updatePolygonLayer();

    // Add markers for all points
    model.points.forEach((point) => {
      const colors = getMarkerColor(point);
      const el = document.createElement('div');
      el.className = point.type === 'subject' ? 'subject-marker' : 'comp-marker';
      el.style.cursor = 'pointer';

      if (point.type === 'subject') {
        el.innerHTML = `
          <div style="position: relative; z-index: 100;">
            <div style="
              background: ${colors.bg};
              color: white;
              padding: 6px 12px;
              border-radius: 8px;
              box-shadow: 0 4px 12px ${colors.shadow};
              font-weight: 700;
              font-size: 12px;
              white-space: nowrap;
              text-align: center;
              border: 2px solid white;
            ">
              <span style="font-size: 9px; display: block; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">Subject</span>
              ${formatPrice(point.price)}
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
      } else {
        // Build details string for tooltip
        const details: string[] = [];
        if (point.beds != null) details.push(`${point.beds} bd`);
        if (point.baths != null) details.push(`${point.baths} ba`);
        if (point.sqft != null) details.push(`${point.sqft.toLocaleString()} sqft`);
        const detailsStr = details.length > 0 ? details.join(' · ') : '';
        const statusLabel = STATUS_LABELS[point.status];
        
        el.innerHTML = `
          <div style="position: relative;" class="marker-container">
            <!-- Main price marker -->
            <div class="marker-main" style="
              background-color: ${colors.bg};
              color: white;
              padding: 4px 8px;
              border-radius: 4px;
              box-shadow: 0 2px 8px ${colors.shadow};
              font-weight: 600;
              font-size: 11px;
              white-space: nowrap;
              transition: transform 0.15s, box-shadow 0.15s;
              border: 1px solid rgba(255,255,255,0.3);
            ">
              ${formatPrice(point.price)}
            </div>
            <!-- Pointer arrow -->
            <div style="
              position: absolute;
              bottom: -4px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-top: 4px solid ${colors.bg};
            "></div>
            <!-- Hover tooltip -->
            <div class="marker-tooltip" style="
              position: absolute;
              bottom: calc(100% + 8px);
              left: 50%;
              transform: translateX(-50%);
              background: ${isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.97)'};
              color: ${isDark ? '#f5f5f5' : '#1f1f1f'};
              padding: 8px 12px;
              border-radius: 6px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.25);
              font-size: 11px;
              white-space: nowrap;
              display: none;
              z-index: 200;
              border: 1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            ">
              <div style="font-weight: 600; margin-bottom: 4px;">${formatFullPrice(point.price)}</div>
              <div style="
                display: inline-block;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 10px;
                font-weight: 500;
                background-color: ${colors.bg};
                color: white;
                margin-bottom: 4px;
              ">${statusLabel}</div>
              ${detailsStr ? `<div style="color: ${isDark ? '#aaa' : '#666'}; margin-bottom: 2px;">${detailsStr}</div>` : ''}
              <div style="color: ${isDark ? '#888' : '#999'}; font-size: 10px; max-width: 180px; overflow: hidden; text-overflow: ellipsis;">${point.address}</div>
            </div>
          </div>
        `;

        // Add hover effects for comparables
        el.addEventListener('mouseenter', () => {
          const main = el.querySelector('.marker-main') as HTMLElement;
          const tooltip = el.querySelector('.marker-tooltip') as HTMLElement;
          if (main) {
            main.style.transform = 'scale(1.1)';
            main.style.boxShadow = `0 4px 12px ${colors.shadow}`;
          }
          if (tooltip) {
            tooltip.style.display = 'block';
          }
        });
        el.addEventListener('mouseleave', () => {
          const main = el.querySelector('.marker-main') as HTMLElement;
          const tooltip = el.querySelector('.marker-tooltip') as HTMLElement;
          if (main) {
            main.style.transform = 'scale(1)';
            main.style.boxShadow = `0 2px 8px ${colors.shadow}`;
          }
          if (tooltip) {
            tooltip.style.display = 'none';
          }
        });
      }

      el.addEventListener('click', () => {
        setSelectedProperty(point.property);
        onPropertyClick?.(point.property);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([point.lng, point.lat])
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    if (DEBUG_CMA_MAP) {
      console.log('[CMA Map] Markers added:', markersRef.current.length);
    }
  }, [model, clearMarkers, updatePolygonLayer, onPropertyClick]);

  // Fit map to bounds - uses the model's bounds (single source of truth)
  const fitMapToBounds = useCallback(() => {
    if (!map.current) return;

    if (!model.bounds) {
      if (DEBUG_CMA_MAP) console.log('[CMA Map] fitMapToBounds: No bounds available');
      return;
    }

    // Call resize() before fitting to handle responsive container changes
    map.current.resize();

    if (model.points.length === 1 && model.subjectCoords) {
      map.current.flyTo({ center: model.subjectCoords, zoom: 14, duration: 600 });
      return;
    }

    if (DEBUG_CMA_MAP) {
      console.log('[CMA Map] fitMapToBounds:', {
        sw: [model.bounds.getWest(), model.bounds.getSouth()],
        ne: [model.bounds.getEast(), model.bounds.getNorth()],
      });
    }

    map.current.fitBounds(model.bounds, {
      padding: 60,
      maxZoom: 14,
      duration: 600,
    });
  }, [model]);

  // Center on subject - uses the model's subjectCoords (single source of truth)
  const centerOnSubject = useCallback(() => {
    if (!map.current) return;
    
    if (!model.subjectCoords) {
      if (DEBUG_CMA_MAP) console.log('[CMA Map] centerOnSubject: No subject coordinates');
      return;
    }

    // Call resize() before flying to handle responsive container changes
    map.current.resize();

    if (DEBUG_CMA_MAP) {
      console.log('[CMA Map] centerOnSubject:', model.subjectCoords);
    }

    map.current.flyTo({ 
      center: model.subjectCoords, 
      zoom: 14,
      duration: 600 
    });
  }, [model.subjectCoords]);

  // Initialize map
  useEffect(() => {
    if (!token || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = token;

    // Use subject coordinates or first property or default to Austin
    const centerCoords = model.subjectCoords 
      || (model.points[0] ? [model.points[0].lng, model.points[0].lat] as [number, number] : null)
      || [-97.7431, 30.2672] as [number, number];

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: centerCoords,
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapLoaded(true);
      // Add markers only after map is fully loaded
      addMarkers();
      // Fit to bounds after markers are added
      if (model.bounds) {
        setTimeout(() => fitMapToBounds(), 100);
      }
    });

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [token]);

  // Update markers when properties or model changes
  useEffect(() => {
    if (map.current && mapLoaded) {
      addMarkers();
    }
  }, [model, addMarkers, mapLoaded]);

  // Handle theme changes
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

  // Get photos from property
  const getPropertyPhotos = useCallback((property: Property): string[] => {
    const propAny = property as any;
    if (propAny.photos && propAny.photos.length > 0) return propAny.photos;
    if (propAny.media && propAny.media.length > 0) {
      return propAny.media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
    }
    if (propAny.images && propAny.images.length > 0) return propAny.images;
    return [];
  }, []);

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

  // Count of comparables with valid coordinates
  const compsWithCoords = model.points.filter(p => p.type === 'comp').length;
  const totalComps = properties.length;

  return (
    <div className="relative w-full h-[550px] rounded-lg overflow-hidden border" data-testid="cma-map-container">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Map controls - attached after map load, using model for latest state */}
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

      {/* Property count badge */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2">
        <Badge variant="secondary" className="shadow-md bg-background/90 backdrop-blur">
          {compsWithCoords === totalComps 
            ? `${totalComps} comparable${totalComps !== 1 ? 's' : ''} + Subject`
            : `${compsWithCoords}/${totalComps} comparables + Subject`
          }
        </Badge>
      </div>
      
      {/* Legend */}
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
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className="text-xs">Unknown Status</span>
          </div>
          {showPolygon && (
            <div className="flex items-center gap-2 mt-1 pt-1 border-t">
              <div className="w-3 h-3 rounded border-2 border-blue-500 bg-blue-500/20"></div>
              <span className="text-xs">Search Area</span>
            </div>
          )}
        </div>
      </div>

      {/* Selected property popup */}
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
            {selectedPropAny.address?.streetAddress || selectedPropAny.address || selectedProperty.unparsedAddress || 'Unknown Address'}
          </p>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <span>{selectedPropAny.bedroomsTotal || selectedPropAny.numBedrooms || selectedPropAny.bedrooms || '-'} bd</span>
            <span>{selectedPropAny.bathroomsTotalInteger || selectedPropAny.numBathrooms || selectedPropAny.bathrooms || '-'} ba</span>
            <span>{(selectedPropAny.livingArea || selectedPropAny.sqft)?.toLocaleString() || '-'} sqft</span>
          </div>
        </div>
      )}
    </div>
  );
}
