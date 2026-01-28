import * as turf from '@turf/turf';
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson';
import type { Property } from '@shared/schema';

export type NormalizedStatus = 'ACTIVE' | 'UNDER_CONTRACT' | 'PENDING' | 'SOLD' | 'LEASING' | 'UNKNOWN';

export const STATUS_COLORS: Record<NormalizedStatus, string> = {
  ACTIVE: '#22c55e',        // Green - For Sale listings
  UNDER_CONTRACT: '#f97316', // Orange - Has accepted offer
  PENDING: '#6b7280',        // Gray - Sale pending
  SOLD: '#ef4444',          // Red - Sale completed
  LEASING: '#a855f7',       // Purple - Rental/For Rent property
  UNKNOWN: '#9ca3af',       // Light Gray
};

export const SUBJECT_COLOR = '#3b82f6'; // Blue

export const STATUS_LABELS: Record<NormalizedStatus, string> = {
  ACTIVE: 'Active',
  UNDER_CONTRACT: 'Under Contract',
  PENDING: 'Pending',
  SOLD: 'Closed',
  LEASING: 'Leasing',
  UNKNOWN: 'Unknown',
};

export interface CmaPointProperties {
  id: string;
  type: 'subject' | 'comp';
  status: NormalizedStatus;
  price: number;
  priceFormatted: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  address: string;
  dom: number | null;
  mlsNumber: string | null;
  photos: string[];
  propertyType: string | null;
  yearBuilt: number | null;
}

export type CmaPointFeature = Feature<Point, CmaPointProperties>;
export type CmaPolygonFeature = Feature<Polygon, { type: 'search-area' }>;

export interface CmaMapModel {
  subjectFeature: CmaPointFeature | null;
  compFeatures: CmaPointFeature[];
  allPointsCollection: FeatureCollection<Point, CmaPointProperties>;
  compsOnlyCollection: FeatureCollection<Point, CmaPointProperties>;
  polygonFeature: CmaPolygonFeature | null;
  polygonCollection: FeatureCollection<Polygon>;
  bounds: [[number, number], [number, number]] | null;
  subjectLngLat: [number, number] | null;
  propertyByFeatureId: Map<string, any>;
}

export function normalizeStatus(rawStatus: string | null | undefined): NormalizedStatus {
  if (!rawStatus || typeof rawStatus !== 'string' || rawStatus.trim() === '') {
    return 'UNKNOWN';
  }

  const status = rawStatus.toLowerCase().trim();

  // Leasing/Rental statuses FIRST (Repliers codes: 'lsd' = leased, 'l' = lease)
  // These are rental properties, distinct from sale transactions
  if (status === 'lsd' || status === 'leased' || status === 'l' || status === 'lease' ||
      status.includes('leasing') || status.includes('for rent') || status.includes('rental')) {
    return 'LEASING';
  }

  // Sold/Closed statuses (Repliers codes: 's', 'sld', 'sold', 'closed')
  // These are completed SALE transactions (not leases)
  if (status === 's' || status === 'sld' || status === 'sold' || status === 'closed' ||
      status.includes('sold') || status.includes('closed')) {
    return 'SOLD';
  }

  // Under Contract statuses (Repliers codes: 'u', 'sc', 'k', 'b')
  // 'u' = under contract, 'sc' = show for contingent, 'k' = kick-out clause, 'b' = backup offer
  if (status === 'u' || status === 'sc' || status === 'k' || status === 'b' ||
      status.includes('under contract') || status.includes('contract') ||
      status.includes('contingent') || status.includes('backup') ||
      status.includes('option') || status.includes('kickout') ||
      status.includes('kick-out') || status.includes('accepted')) {
    return 'UNDER_CONTRACT';
  }

  // Pending statuses (Repliers codes: 'p', 'pending')
  if (status === 'p' || status === 'pending' ||
      status.includes('pending')) {
    return 'PENDING';
  }

  // Active/Coming Soon statuses (Repliers codes: 'a', 'active', 'coming')
  if (status === 'a' || status === 'active' ||
      status.includes('active') || status.includes('coming') ||
      status.includes('new') || status.includes('available')) {
    return 'ACTIVE';
  }

  // Hold/Temp Off Market (Repliers codes: 'h', 'hold', 'temp')
  // Treat as PENDING since they're temporarily not available but not sold
  if (status === 'h' || status === 't' || status === 'hold' || status === 'temp' ||
      status.includes('hold') || status.includes('temp') || status.includes('off market')) {
    return 'PENDING';
  }

  // Withdrawn/Cancelled/Expired - these are truly unknown (no longer on market, not sold)
  if (status === 'w' || status === 'x' || status === 'e' ||
      status.includes('withdrawn') || status.includes('cancelled') ||
      status.includes('canceled') || status.includes('expired') ||
      status.includes('terminate')) {
    return 'UNKNOWN';
  }

  // For any other non-empty status, log a warning but return UNKNOWN to surface data issues
  console.warn(`[CMA] Unrecognized status "${rawStatus}" - treating as UNKNOWN`);
  return 'UNKNOWN';
}

function extractStatus(property: any): NormalizedStatus {
  const isValid = (s: any) => typeof s === 'string' && s.trim().length > 0;

  if (isValid(property?.standardStatus)) {
    return normalizeStatus(property.standardStatus);
  }
  if (isValid(property?.status)) {
    return normalizeStatus(property.status);
  }
  if (isValid(property?.lastStatus)) {
    return normalizeStatus(property.lastStatus);
  }
  if (isValid(property?.rawData?.standardStatus)) {
    return normalizeStatus(property.rawData.standardStatus);
  }
  if (isValid(property?.rawData?.status)) {
    return normalizeStatus(property.rawData.status);
  }
  if (isValid(property?.rawData?.lastStatus)) {
    return normalizeStatus(property.rawData.lastStatus);
  }
  if (property?.soldPrice || property?.closePrice || property?.soldDate || property?.closedDate) {
    return 'SOLD';
  }
  if (property?.price && !property?.soldPrice && !property?.closePrice) {
    return 'ACTIVE';
  }
  return 'UNKNOWN';
}

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

function extractCoordinates(property: any): [number, number] | null {
  const tryParse = (lat: any, lng: any): [number, number] | null => {
    if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      return [Number(lng), Number(lat)];
    }
    return null;
  };

  return (
    tryParse(property?.map?.latitude, property?.map?.longitude) ||
    tryParse(property?.coordinates?.latitude, property?.coordinates?.longitude) ||
    tryParse(property?.geo?.lat, property?.geo?.lon || property?.geo?.lng) ||
    tryParse(property?.latitude, property?.longitude) ||
    tryParse(property?.rawData?.map?.latitude, property?.rawData?.map?.longitude) ||
    parseWktPoint(property?.rawData?.map?.point) ||
    tryParse(property?.rawData?.geo?.lat, property?.rawData?.geo?.lon || property?.rawData?.geo?.lng) ||
    tryParse(property?.address?.latitude, property?.address?.longitude) ||
    null
  );
}

function extractPrice(property: any): number {
  return property?.soldPrice || property?.closePrice || property?.listPrice || property?.price || 0;
}

function formatPrice(price: number): string {
  if (price <= 0) return 'N/A';
  if (price >= 1000000) {
    return `$${(price / 1000000).toFixed(2)}M`;
  }
  return `$${Math.round(price / 1000)}K`;
}

function extractBeds(property: any): number | null {
  const beds = property?.bedroomsTotal || property?.numBedrooms || property?.bedrooms ||
    property?.details?.numBedrooms || property?.rawData?.details?.numBedrooms;
  return beds != null ? Number(beds) : null;
}

function extractBaths(property: any): number | null {
  const baths = property?.bathroomsTotalInteger || property?.numBathrooms || property?.bathrooms ||
    property?.details?.numBathrooms || property?.rawData?.details?.numBathrooms;
  return baths != null ? Number(baths) : null;
}

function extractSqft(property: any): number | null {
  const sqft = property?.livingArea || property?.sqft ||
    property?.details?.sqft || property?.rawData?.details?.sqft;
  return sqft != null ? Number(sqft) : null;
}

function extractDom(property: any): number | null {
  const dom = property?.simpleDaysOnMarket || property?.daysOnMarket ||
    property?.rawData?.simpleDaysOnMarket || property?.rawData?.daysOnMarket;
  return dom != null ? Number(dom) : null;
}

function extractAddress(property: any): string {
  if (property?.address?.streetAddress) return property.address.streetAddress;
  if (typeof property?.address === 'string') return property.address;
  if (property?.address?.streetNumber && property?.address?.streetName) {
    let addr = `${property.address.streetNumber} ${property.address.streetName}`;
    if (property.address.streetSuffix) addr += ` ${property.address.streetSuffix}`;
    return addr;
  }
  if (property?.unparsedAddress) return property.unparsedAddress;
  if (property?.rawData?.address?.streetAddress) return property.rawData.address.streetAddress;
  return 'Unknown Address';
}

/**
 * Sanitize a photo URL by stripping any wrapping quotes that may have been 
 * incorrectly added during JSON serialization/parsing.
 * e.g., '"https://..." ' -> 'https://...'
 */
export function sanitizePhotoUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  // Strip leading and trailing quotes (single or double) and whitespace
  return url.replace(/^["'\s]+|["'\s]+$/g, '');
}

function extractPhotos(property: any): string[] {
  let photos: string[] = [];
  
  if (property?.photos && Array.isArray(property.photos)) {
    photos = property.photos;
  } else if (property?.images && Array.isArray(property.images)) {
    photos = property.images;
  } else if (property?.media && Array.isArray(property.media)) {
    photos = property.media.map((m: any) => m.mediaURL || m.mediaUrl).filter(Boolean);
  }
  
  // Sanitize all photo URLs to strip any wrapping quotes
  return photos.map(sanitizePhotoUrl).filter(url => url.length > 0);
}

function extractMlsNumber(property: any): string | null {
  return property?.mlsNumber || property?.listingId || null;
}

function extractPropertyType(property: any): string | null {
  return property?.propertyType || 
         property?.propertySubType || 
         property?.type ||
         property?.rawData?.propertyType ||
         property?.rawData?.propertySubType ||
         property?.details?.propertyType ||
         null;
}

function extractYearBuilt(property: any): number | null {
  const year = property?.yearBuilt || 
               property?.yearConstructed ||
               property?.builtYear ||
               property?.rawData?.yearBuilt ||
               property?.rawData?.yearConstructed ||
               property?.details?.yearBuilt;
  return year != null ? Number(year) : null;
}

export function buildSubjectFeature(subject: Property | null): CmaPointFeature | null {
  if (!subject) return null;
  const coords = extractCoordinates(subject);
  if (!coords) return null;

  const price = extractPrice(subject);
  return {
    type: 'Feature',
    properties: {
      id: 'subject',
      type: 'subject',
      status: 'ACTIVE',
      price,
      priceFormatted: formatPrice(price),
      beds: extractBeds(subject),
      baths: extractBaths(subject),
      sqft: extractSqft(subject),
      address: extractAddress(subject),
      dom: extractDom(subject),
      mlsNumber: extractMlsNumber(subject),
      photos: extractPhotos(subject),
      propertyType: extractPropertyType(subject),
      yearBuilt: extractYearBuilt(subject),
    },
    geometry: {
      type: 'Point',
      coordinates: coords,
    },
  };
}

export function buildComparableFeatures(comparables: Property[]): CmaPointFeature[] {
  const features: CmaPointFeature[] = [];

  comparables.forEach((property, index) => {
    const coords = extractCoordinates(property);
    if (!coords) return;

    const status = extractStatus(property);
    const price = extractPrice(property);
    const propAny = property as any;

    if (status === 'UNKNOWN') {
      console.warn(`[CMA] Comparable ${propAny.mlsNumber || index} has UNKNOWN status after normalization`);
    }

    features.push({
      type: 'Feature',
      properties: {
        id: propAny.mlsNumber || `comp-${index}`,
        type: 'comp',
        status,
        price,
        priceFormatted: formatPrice(price),
        beds: extractBeds(property),
        baths: extractBaths(property),
        sqft: extractSqft(property),
        address: extractAddress(property),
        dom: extractDom(property),
        mlsNumber: extractMlsNumber(property),
        photos: extractPhotos(property),
        propertyType: extractPropertyType(property),
        yearBuilt: extractYearBuilt(property),
      },
      geometry: {
        type: 'Point',
        coordinates: coords,
      },
    });
  });

  return features;
}

export function buildBounds(
  subjectFeature: CmaPointFeature | null,
  compFeatures: CmaPointFeature[]
): [[number, number], [number, number]] | null {
  const allFeatures = [
    ...(subjectFeature ? [subjectFeature] : []),
    ...compFeatures,
  ];

  if (allFeatures.length === 0) return null;

  const collection = turf.featureCollection(allFeatures);
  const bbox = turf.bbox(collection);

  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}

export function buildPolygon(
  subjectFeature: CmaPointFeature | null,
  compFeatures: CmaPointFeature[],
  bufferKm: number = 0.3
): CmaPolygonFeature | null {
  const allFeatures = [
    ...(subjectFeature ? [subjectFeature] : []),
    ...compFeatures,
  ];

  if (allFeatures.length === 0) return null;

  if (allFeatures.length === 1) {
    const point = allFeatures[0];
    const buffered = turf.buffer(point, 0.5, { units: 'kilometers' });
    if (buffered && buffered.geometry.type === 'Polygon') {
      return {
        type: 'Feature',
        properties: { type: 'search-area' },
        geometry: buffered.geometry,
      };
    }
    return null;
  }

  const collection = turf.featureCollection(allFeatures);

  let hull = turf.convex(collection);

  if (!hull && allFeatures.length === 2) {
    const [p1, p2] = allFeatures;
    const line = turf.lineString([
      p1.geometry.coordinates,
      p2.geometry.coordinates,
    ]);
    const bufferedLine = turf.buffer(line, 0.3, { units: 'kilometers' });
    if (bufferedLine && bufferedLine.geometry.type === 'Polygon') {
      return {
        type: 'Feature',
        properties: { type: 'search-area' },
        geometry: bufferedLine.geometry,
      };
    }
    return null;
  }

  if (!hull) return null;

  const bufferedHull = turf.buffer(hull, bufferKm, { units: 'kilometers' });

  if (bufferedHull && bufferedHull.geometry.type === 'Polygon') {
    return {
      type: 'Feature',
      properties: { type: 'search-area' },
      geometry: bufferedHull.geometry,
    };
  }

  if (hull.geometry.type === 'Polygon') {
    return {
      type: 'Feature',
      properties: { type: 'search-area' },
      geometry: hull.geometry,
    };
  }

  return null;
}

export function buildCmaMapModel(
  subjectProperty: Property | null,
  comparables: Property[]
): CmaMapModel {
  const subjectFeature = buildSubjectFeature(subjectProperty);
  const compFeatures = buildComparableFeatures(comparables);
  const bounds = buildBounds(subjectFeature, compFeatures);
  const polygonFeature = buildPolygon(subjectFeature, compFeatures);

  const allFeatures = [
    ...(subjectFeature ? [subjectFeature] : []),
    ...compFeatures,
  ];

  const allPointsCollection: FeatureCollection<Point, CmaPointProperties> = {
    type: 'FeatureCollection',
    features: allFeatures,
  };

  const compsOnlyCollection: FeatureCollection<Point, CmaPointProperties> = {
    type: 'FeatureCollection',
    features: compFeatures,
  };

  const polygonCollection: FeatureCollection<Polygon> = {
    type: 'FeatureCollection',
    features: polygonFeature ? [polygonFeature] : [],
  };

  const subjectLngLat = subjectFeature
    ? (subjectFeature.geometry.coordinates as [number, number])
    : null;

  const propertyByFeatureId = new Map<string, any>();
  if (subjectProperty && subjectFeature) {
    propertyByFeatureId.set('subject', subjectProperty);
  }
  comparables.forEach((property, index) => {
    const propAny = property as any;
    const featureId = propAny.mlsNumber || `comp-${index}`;
    propertyByFeatureId.set(featureId, property);
  });

  console.log('[CMA Data] Model built:', {
    subject: !!subjectFeature,
    comps: compFeatures.length,
    polygon: !!polygonFeature,
    bounds,
    propertyMapSize: propertyByFeatureId.size,
    statusBreakdown: {
      active: compFeatures.filter(f => f.properties.status === 'ACTIVE').length,
      underContract: compFeatures.filter(f => f.properties.status === 'UNDER_CONTRACT').length,
      pending: compFeatures.filter(f => f.properties.status === 'PENDING').length,
      sold: compFeatures.filter(f => f.properties.status === 'SOLD').length,
      unknown: compFeatures.filter(f => f.properties.status === 'UNKNOWN').length,
    },
  });

  return {
    subjectFeature,
    compFeatures,
    allPointsCollection,
    compsOnlyCollection,
    polygonFeature,
    polygonCollection,
    bounds,
    subjectLngLat,
    propertyByFeatureId,
  };
}

export function formatFullPrice(price: number | null | undefined): string {
  if (price == null || price <= 0) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function getStatusColor(status: NormalizedStatus): string {
  return STATUS_COLORS[status] || STATUS_COLORS.UNKNOWN;
}
