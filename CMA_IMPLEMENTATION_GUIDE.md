# CMA (Comparative Market Analysis) Implementation Guide

This document describes how the CMA feature was built in Mission Control using the Repliers API for MLS data. It can be used to recreate this feature in other projects with consistency.

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Repliers API Integration](#repliers-api-integration)
5. [Frontend Components](#frontend-components)
6. [Map Implementation](#map-implementation)
7. [Data Flow](#data-flow)
8. [Sharing Feature](#sharing-feature)
9. [Key Utilities](#key-utilities)
10. [Implementation Checklist](#implementation-checklist)

---

## Overview

The CMA feature allows real estate agents to:
- Search for a subject property using MLS number or address
- Find comparable properties based on customizable filters
- Visualize properties on an interactive Mapbox map with clustering
- View statistics (avg price, price/sqft, DOM, etc.)
- Generate shareable public links with expiration
- Export/print CMA reports

---

## Database Schema

### CMA Table Structure

```typescript
// shared/schema.ts
import { pgTable, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cmas = pgTable("cmas", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id),
  userId: text("user_id"),
  title: text("title").notNull(),
  
  // Subject property snapshot (full MLS data at time of creation)
  subjectSnapshot: jsonb("subject_snapshot"),
  
  // Search polygon as GeoJSON
  polygonGeoJson: jsonb("polygon_geojson"),
  
  // Array of comparable properties with MLS data
  comparables: jsonb("comparables").$type<ComparableProperty[]>(),
  
  // Calculated statistics
  stats: jsonb("stats").$type<CMAStatistics>(),
  
  // Search filters used
  filters: jsonb("filters").$type<CMAFilters>(),
  
  // Map viewport state for restoration
  mapViewport: jsonb("map_viewport"),
  
  // Public sharing
  shareToken: text("share_token"),
  shareExpiresAt: timestamp("share_expires_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertCmaSchema = createInsertSchema(cmas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCma = z.infer<typeof insertCmaSchema>;
export type Cma = typeof cmas.$inferSelect;
```

### TypeScript Interfaces

```typescript
// Types for CMA data structures
interface ComparableProperty {
  mlsNumber: string;
  address: string;
  city?: string;
  state?: string;
  zipCode?: string;
  listPrice: number;
  soldPrice?: number;
  status: string;           // Raw MLS status
  normalizedStatus: string; // ACTIVE | PENDING | SOLD | UNKNOWN
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: string;
  daysOnMarket?: number;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  propertyType?: string;
  lotSize?: string;
  // ... other MLS fields
}

interface CMAStatistics {
  avgPrice: number;
  medianPrice: number;
  avgPricePerSqft: number;
  avgDaysOnMarket: number;
  avgSqft: number;
  avgBedrooms: number;
  avgBathrooms: number;
  priceRange: { min: number; max: number };
  totalComps: number;
}

interface CMAFilters {
  statusCodes: string[];      // ['A', 'U', 'S'] for Active, Under Contract, Sold
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bedsMax?: number;
  bathsMin?: number;
  bathsMax?: number;
  sqftMin?: number;
  sqftMax?: number;
  yearBuiltMin?: number;
  yearBuiltMax?: number;
  propertyTypes?: string[];
  radiusMiles?: number;
}
```

---

## API Endpoints

### CMA CRUD Endpoints

```typescript
// server/routes.ts

// List all CMAs (optionally filtered by user)
app.get("/api/cmas", isAuthenticated, async (req, res) => {
  const userId = req.user?.claims?.sub;
  const cmas = await storage.getCmas(userId);
  res.json(cmas);
});

// Get single CMA by ID
app.get("/api/cmas/:id", isAuthenticated, async (req, res) => {
  const cma = await storage.getCma(req.params.id);
  if (!cma) return res.status(404).json({ message: "CMA not found" });
  res.json(cma);
});

// Create new CMA
app.post("/api/cmas", isAuthenticated, async (req, res) => {
  const validatedData = insertCmaSchema.parse(req.body);
  const cma = await storage.createCma({
    ...validatedData,
    userId: req.user?.claims?.sub,
  });
  
  // Log activity if linked to transaction
  if (cma.transactionId) {
    await storage.createActivity({
      transactionId: cma.transactionId,
      type: "cma_created",
      description: `CMA created: ${cma.title}`,
      category: "cma",
    });
  }
  
  res.status(201).json(cma);
});

// Update CMA
app.patch("/api/cmas/:id", isAuthenticated, async (req, res) => {
  const cma = await storage.updateCma(req.params.id, req.body);
  res.json(cma);
});

// Delete CMA
app.delete("/api/cmas/:id", isAuthenticated, async (req, res) => {
  await storage.deleteCma(req.params.id);
  res.status(204).send();
});

// Generate share link
app.post("/api/cmas/:id/share", isAuthenticated, async (req, res) => {
  const { expirationDays = 30 } = req.body;
  
  const shareToken = crypto.randomUUID();
  const shareExpiresAt = new Date();
  shareExpiresAt.setDate(shareExpiresAt.getDate() + expirationDays);
  
  await storage.updateCma(req.params.id, {
    shareToken,
    shareExpiresAt,
  });
  
  res.json({
    shareUrl: `/shared/cma/${shareToken}`,
    expiresAt: shareExpiresAt,
  });
});

// Public CMA view (no auth required)
app.get("/api/shared/cma/:token", async (req, res) => {
  const cma = await storage.getCmaByShareToken(req.params.token);
  
  if (!cma) {
    return res.status(404).json({ message: "CMA not found" });
  }
  
  if (cma.shareExpiresAt && new Date(cma.shareExpiresAt) < new Date()) {
    return res.status(410).json({ message: "Share link has expired" });
  }
  
  res.json(cma);
});
```

### Storage Interface

```typescript
// server/storage.ts
interface IStorage {
  // CMA operations
  getCmas(userId?: string): Promise<Cma[]>;
  getCma(id: string): Promise<Cma | null>;
  getCmaByShareToken(token: string): Promise<Cma | null>;
  createCma(data: InsertCma): Promise<Cma>;
  updateCma(id: string, data: Partial<Cma>): Promise<Cma>;
  deleteCma(id: string): Promise<void>;
}
```

---

## Repliers API Integration

### API Configuration

```typescript
// server/repliers.ts
const REPLIERS_API_BASE = "https://api.repliers.io";
const REPLIERS_API_KEY = process.env.REPLIERS_API_KEY;

async function repliersRequest(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${REPLIERS_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      "REPLIERS-API-KEY": REPLIERS_API_KEY!,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Repliers API error: ${response.status}`);
  }

  return response.json();
}
```

### Fetch Single Listing

```typescript
export async function fetchMLSListing(mlsNumber: string): Promise<Property | null> {
  try {
    const data = await repliersRequest(`/listings/${mlsNumber}`);
    
    // Check if it's a rental and reject
    if (isRentalOrLease(data)) {
      return null;
    }
    
    return normalizeProperty(data);
  } catch (error) {
    console.error(`Failed to fetch MLS listing ${mlsNumber}:`, error);
    return null;
  }
}
```

### Search Similar Listings (for Comparables)

```typescript
export async function fetchSimilarListings(
  subject: Property,
  filters: CMAFilters
): Promise<Property[]> {
  const params: Record<string, any> = {
    type: "Sale",  // Always exclude rentals at API level
    status: filters.statusCodes?.join(",") || "A,U,S",
    
    // Price range (typically ±20% of subject)
    minPrice: filters.priceMin,
    maxPrice: filters.priceMax,
    
    // Property specs
    minBeds: filters.bedsMin,
    maxBeds: filters.bedsMax,
    minBaths: filters.bathsMin,
    maxBaths: filters.bathsMax,
    minSqft: filters.sqftMin,
    maxSqft: filters.sqftMax,
    
    // Location - radius search from subject
    lat: subject.latitude,
    lng: subject.longitude,
    radius: filters.radiusMiles || 1,
    
    // Results
    pageSize: 50,
    sortBy: "listPrice",
  };

  try {
    const data = await repliersRequest("/listings", params);
    
    // Secondary filter: exclude rentals that slip through
    const properties = (data.listings || [])
      .filter((listing: any) => !isRentalOrLease(listing))
      .map(normalizeProperty);
    
    return properties;
  } catch (error) {
    console.error("Failed to fetch similar listings:", error);
    return [];
  }
}
```

### Property Normalization

```typescript
function normalizeProperty(listing: any): Property {
  return {
    mlsNumber: listing.mlsNumber || listing.listingId,
    address: listing.address?.streetAddress || listing.address,
    city: listing.address?.city,
    state: listing.address?.state,
    zipCode: listing.address?.postalCode,
    
    listPrice: listing.listPrice,
    soldPrice: listing.soldPrice || listing.closePrice,
    status: listing.status,
    
    bedrooms: listing.details?.bedrooms || listing.bedrooms,
    bathrooms: listing.details?.bathrooms || listing.bathrooms,
    sqft: listing.details?.sqft || listing.sqft,
    yearBuilt: listing.details?.yearBuilt,
    
    // Days on Market - prefer simpleDaysOnMarket
    daysOnMarket: listing.simpleDaysOnMarket ?? listing.daysOnMarket,
    
    // Coordinates for mapping
    latitude: listing.map?.latitude || listing.latitude,
    longitude: listing.map?.longitude || listing.longitude,
    
    // Photos
    photos: listing.images?.map((img: any) => img.url) || [],
    
    propertyType: listing.details?.propertyType,
    lotSize: listing.details?.lotSize,
    
    // Keep raw data for reference
    _raw: listing,
  };
}
```

### Rental Exclusion Utility

```typescript
// shared/lib/listings.ts
export function isRentalOrLease(listing: any): boolean {
  if (!listing) return false;

  const rentalIndicators = [
    listing.type?.toLowerCase() === 'lease',
    listing.type?.toLowerCase() === 'rental',
    listing.propertyType?.toLowerCase()?.includes('rental'),
    listing.transactionType?.toLowerCase() === 'lease',
    listing.transactionType?.toLowerCase() === 'rent',
    listing.listingCategory?.toLowerCase()?.includes('rental'),
    listing.listingCategory?.toLowerCase()?.includes('lease'),
    listing.leaseType != null,
    listing.details?.propertySubType?.toLowerCase()?.includes('rental'),
    listing.class?.toLowerCase()?.includes('rental'),
  ];

  return rentalIndicators.some(Boolean);
}

export function excludeRentals<T>(listings: T[]): T[] {
  return listings.filter(listing => !isRentalOrLease(listing));
}

export function getDisplayDOM(listing: any): number | null {
  return listing.simpleDaysOnMarket ?? listing.daysOnMarket ?? null;
}
```

---

## Frontend Components

### Component Hierarchy

```
CMATab (or CMADetailPage)
├── CMABuilder
│   ├── PropertySearch (MLS number or address lookup)
│   ├── FilterPanel (price, beds, baths, status filters)
│   ├── CMAMap (Mapbox visualization)
│   └── ComparablesTable (selectable list of comps)
├── CMAAnalytics (statistics cards)
├── CMAReport (printable view)
└── ShareModal (generate/copy share link)
```

### CMA Tab Component

```tsx
// client/src/components/cma-tab.tsx
import { useQuery, useMutation } from "@tanstack/react-query";
import { CMAMap } from "./cma-map";
import { CMAAnalytics } from "./cma-analytics";

interface CMATabProps {
  transactionId: string;
  subjectProperty?: Property;
}

export function CMATab({ transactionId, subjectProperty }: CMATabProps) {
  // Fetch CMA data for this transaction
  const { data: cma, isLoading } = useQuery({
    queryKey: ["/api/cmas", { transactionId }],
  });

  // Fetch comparables from Repliers
  const searchComparables = useMutation({
    mutationFn: async (filters: CMAFilters) => {
      const response = await apiRequest("POST", "/api/cma/search", {
        subjectMlsNumber: subjectProperty?.mlsNumber,
        filters,
      });
      return response.json();
    },
  });

  // Save CMA
  const saveCMA = useMutation({
    mutationFn: async (data: InsertCma) => {
      const response = await apiRequest("POST", "/api/cmas", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cmas"] });
    },
  });

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {cma?.stats && <CMAAnalytics stats={cma.stats} />}

      {/* Interactive Map */}
      <CMAMap
        subject={cma?.subjectSnapshot || subjectProperty}
        comparables={cma?.comparables || []}
        polygon={cma?.polygonGeoJson}
        onSelectComparable={(comp) => console.log("Selected:", comp)}
      />

      {/* Comparables Table */}
      <ComparablesTable
        comparables={cma?.comparables || []}
        onRemove={(mlsNumber) => handleRemoveComp(mlsNumber)}
      />

      {/* Share Button */}
      <ShareModal cmaId={cma?.id} />
    </div>
  );
}
```

### Statistics Calculation

```typescript
// Calculate CMA statistics from comparables
function calculateStatistics(comparables: ComparableProperty[]): CMAStatistics {
  if (comparables.length === 0) {
    return {
      avgPrice: 0,
      medianPrice: 0,
      avgPricePerSqft: 0,
      avgDaysOnMarket: 0,
      avgSqft: 0,
      avgBedrooms: 0,
      avgBathrooms: 0,
      priceRange: { min: 0, max: 0 },
      totalComps: 0,
    };
  }

  const prices = comparables
    .map(c => c.soldPrice || c.listPrice)
    .filter(Boolean) as number[];
  
  const sqftValues = comparables
    .map(c => c.sqft)
    .filter(Boolean) as number[];
  
  const domValues = comparables
    .map(c => c.daysOnMarket)
    .filter(v => v != null) as number[];

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  
  const median = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const pricePerSqft = comparables
    .filter(c => c.listPrice && c.sqft)
    .map(c => c.listPrice! / c.sqft!);

  return {
    avgPrice: Math.round(avg(prices)),
    medianPrice: Math.round(median(prices)),
    avgPricePerSqft: Math.round(avg(pricePerSqft)),
    avgDaysOnMarket: Math.round(avg(domValues)),
    avgSqft: Math.round(avg(sqftValues)),
    avgBedrooms: parseFloat(avg(comparables.map(c => c.bedrooms || 0)).toFixed(1)),
    avgBathrooms: parseFloat(avg(comparables.map(c => c.bathrooms || 0)).toFixed(1)),
    priceRange: {
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
    totalComps: comparables.length,
  };
}
```

---

## Map Implementation

### CMA Map Data Builder

```typescript
// client/src/lib/cma-map-data.ts
import * as turf from "@turf/turf";

// Status normalization for consistent colors
export type NormalizedStatus = "ACTIVE" | "PENDING" | "SOLD" | "UNKNOWN";

export function normalizeStatus(rawStatus: string | null | undefined): NormalizedStatus {
  if (!rawStatus) return "UNKNOWN";
  
  const status = rawStatus.toLowerCase().trim();
  
  // Active statuses
  if (["a", "active", "coming", "new", "available"].includes(status)) {
    return "ACTIVE";
  }
  
  // Pending/Under Contract statuses
  if ([
    "u", "p", "pending", "contract", "contingent", 
    "backup", "option", "sc", "k", "b", "h", "t"
  ].includes(status)) {
    return "PENDING";
  }
  
  // Sold statuses
  if (["s", "sold", "closed"].includes(status)) {
    return "SOLD";
  }
  
  console.warn(`Unknown MLS status code: ${rawStatus}`);
  return "UNKNOWN";
}

// Status colors for map markers
export const STATUS_COLORS: Record<NormalizedStatus, string> = {
  ACTIVE: "#2E7D32",   // Green
  PENDING: "#F9A825",  // Amber
  SOLD: "#C62828",     // Red
  UNKNOWN: "#757575",  // Grey
};

export const SUBJECT_COLOR = "#1565C0"; // Blue - always for subject

// Build map model from subject + comparables
export interface CmaMapModel {
  subjectFeature: GeoJSON.Feature | null;
  compFeatures: GeoJSON.Feature[];
  allPointsCollection: GeoJSON.FeatureCollection;
  compsOnlyCollection: GeoJSON.FeatureCollection;
  polygonFeature: GeoJSON.Feature | null;
  polygonCollection: GeoJSON.FeatureCollection;
  bounds: [[number, number], [number, number]] | null;
  subjectLngLat: [number, number] | null;
}

export function buildCmaMapModel(
  subject: Property | null,
  comparables: ComparableProperty[],
  existingPolygon?: GeoJSON.Geometry | null
): CmaMapModel {
  const features: GeoJSON.Feature[] = [];
  const compFeatures: GeoJSON.Feature[] = [];
  
  // Subject feature
  let subjectFeature: GeoJSON.Feature | null = null;
  let subjectLngLat: [number, number] | null = null;
  
  if (subject?.longitude && subject?.latitude) {
    subjectLngLat = [subject.longitude, subject.latitude];
    subjectFeature = {
      type: "Feature",
      properties: {
        id: `subject-${subject.mlsNumber}`,
        type: "subject",
        mlsNumber: subject.mlsNumber,
        address: subject.address,
        price: subject.listPrice,
        status: "SUBJECT",
      },
      geometry: {
        type: "Point",
        coordinates: subjectLngLat,
      },
    };
    features.push(subjectFeature);
  }
  
  // Comparable features
  comparables.forEach((comp, index) => {
    if (!comp.longitude || !comp.latitude) return;
    
    const normalizedStatus = normalizeStatus(comp.status);
    const feature: GeoJSON.Feature = {
      type: "Feature",
      properties: {
        id: `comp-${comp.mlsNumber}`,
        type: "comparable",
        mlsNumber: comp.mlsNumber,
        address: comp.address,
        price: comp.soldPrice || comp.listPrice,
        status: normalizedStatus,
        color: STATUS_COLORS[normalizedStatus],
        bedrooms: comp.bedrooms,
        bathrooms: comp.bathrooms,
        sqft: comp.sqft,
        daysOnMarket: comp.daysOnMarket,
      },
      geometry: {
        type: "Point",
        coordinates: [comp.longitude, comp.latitude],
      },
    };
    features.push(feature);
    compFeatures.push(feature);
  });
  
  // Generate polygon (search area visualization)
  let polygonFeature: GeoJSON.Feature | null = null;
  
  if (existingPolygon) {
    polygonFeature = {
      type: "Feature",
      properties: { type: "searchArea" },
      geometry: existingPolygon,
    };
  } else if (features.length >= 3) {
    // Auto-generate convex hull + buffer
    const points = turf.featureCollection(features);
    const hull = turf.convex(points);
    if (hull) {
      const buffered = turf.buffer(hull, 0.3, { units: "kilometers" });
      polygonFeature = buffered;
    }
  } else if (features.length === 2) {
    // Line between two points + buffer
    const coords = features.map(f => (f.geometry as GeoJSON.Point).coordinates);
    const line = turf.lineString(coords as [number, number][]);
    const buffered = turf.buffer(line, 0.3, { units: "kilometers" });
    polygonFeature = buffered;
  } else if (features.length === 1) {
    // Single point buffer
    const point = features[0];
    const buffered = turf.buffer(point, 0.5, { units: "kilometers" });
    polygonFeature = buffered;
  }
  
  // Calculate bounds
  let bounds: [[number, number], [number, number]] | null = null;
  if (features.length > 0) {
    const allCoords = features.map(f => (f.geometry as GeoJSON.Point).coordinates);
    const lngs = allCoords.map(c => c[0]);
    const lats = allCoords.map(c => c[1]);
    bounds = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
  }
  
  return {
    subjectFeature,
    compFeatures,
    allPointsCollection: { type: "FeatureCollection", features },
    compsOnlyCollection: { type: "FeatureCollection", features: compFeatures },
    polygonFeature,
    polygonCollection: {
      type: "FeatureCollection",
      features: polygonFeature ? [polygonFeature] : [],
    },
    bounds,
    subjectLngLat,
  };
}
```

### CMA Map Component

```tsx
// client/src/components/cma-map.tsx
import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { buildCmaMapModel, STATUS_COLORS, SUBJECT_COLOR } from "@/lib/cma-map-data";

interface CMAMapProps {
  subject: Property | null;
  comparables: ComparableProperty[];
  polygon?: GeoJSON.Geometry | null;
  onSelectComparable?: (comp: ComparableProperty) => void;
  showPolygon?: boolean;
}

export function CMAMap({
  subject,
  comparables,
  polygon,
  onSelectComparable,
  showPolygon = true,
}: CMAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite" | "dark">("streets");
  
  // Build map model
  const model = buildCmaMapModel(subject, comparables, polygon);

  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: getMapStyle(mapStyle),
      center: model.subjectLngLat || [-97.7431, 30.2672], // Default: Austin, TX
      zoom: 12,
    });

    map.current.on("load", () => {
      initCmaLayers(map.current!, model, showPolygon);
    });

    return () => map.current?.remove();
  }, []);

  // Update layers when data changes
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    updateCmaLayers(map.current, model, showPolygon);
  }, [model, showPolygon]);

  return (
    <div className="relative h-[500px] rounded-lg overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Map controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (model.subjectLngLat && map.current) {
              map.current.flyTo({ center: model.subjectLngLat, zoom: 14 });
            }
          }}
        >
          Center on Subject
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (model.bounds && map.current) {
              map.current.fitBounds(model.bounds, { padding: 60 });
            }
          }}
        >
          Fit All
        </Button>
      </div>
      
      {/* Style switcher */}
      <div className="absolute bottom-4 left-4">
        <StyleSwitcher value={mapStyle} onChange={setMapStyle} />
      </div>
    </div>
  );
}

// Initialize map layers
function initCmaLayers(
  map: mapboxgl.Map,
  model: CmaMapModel,
  showPolygon: boolean
) {
  // 1. Polygon layer (search area)
  map.addSource("cma-polygon", {
    type: "geojson",
    data: model.polygonCollection,
  });
  
  map.addLayer({
    id: "cma-polygon-fill",
    type: "fill",
    source: "cma-polygon",
    paint: {
      "fill-color": "#3b82f6",
      "fill-opacity": showPolygon ? 0.1 : 0,
    },
  });
  
  map.addLayer({
    id: "cma-polygon-outline",
    type: "line",
    source: "cma-polygon",
    paint: {
      "line-color": "#3b82f6",
      "line-width": 2,
      "line-opacity": showPolygon ? 0.5 : 0,
    },
  });

  // 2. Comparables source with clustering
  map.addSource("cma-comps", {
    type: "geojson",
    data: model.compsOnlyCollection,
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  });

  // Cluster circles
  map.addLayer({
    id: "cma-clusters",
    type: "circle",
    source: "cma-comps",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#64748b",
      "circle-radius": ["step", ["get", "point_count"], 20, 5, 30, 10, 40],
    },
  });

  // Cluster count labels
  map.addLayer({
    id: "cma-cluster-count",
    type: "symbol",
    source: "cma-comps",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-size": 12,
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  // Unclustered comparable points
  map.addLayer({
    id: "cma-comp-points",
    type: "circle",
    source: "cma-comps",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        12,
        8,
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  // 3. Subject marker (always on top)
  if (model.subjectFeature) {
    map.addSource("cma-subject", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [model.subjectFeature] },
    });

    map.addLayer({
      id: "cma-subject-point",
      type: "circle",
      source: "cma-subject",
      paint: {
        "circle-color": SUBJECT_COLOR,
        "circle-radius": 12,
        "circle-stroke-width": 3,
        "circle-stroke-color": "#ffffff",
      },
    });

    map.addLayer({
      id: "cma-subject-label",
      type: "symbol",
      source: "cma-subject",
      layout: {
        "text-field": "SUBJECT",
        "text-size": 10,
        "text-offset": [0, 2],
      },
      paint: {
        "text-color": SUBJECT_COLOR,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.5,
      },
    });
  }

  // Interactivity: hover
  let hoveredId: string | null = null;
  
  map.on("mousemove", "cma-comp-points", (e) => {
    if (e.features && e.features[0]) {
      if (hoveredId) {
        map.setFeatureState({ source: "cma-comps", id: hoveredId }, { hover: false });
      }
      hoveredId = e.features[0].properties?.id;
      map.setFeatureState({ source: "cma-comps", id: hoveredId }, { hover: true });
      map.getCanvas().style.cursor = "pointer";
    }
  });

  map.on("mouseleave", "cma-comp-points", () => {
    if (hoveredId) {
      map.setFeatureState({ source: "cma-comps", id: hoveredId }, { hover: false });
    }
    hoveredId = null;
    map.getCanvas().style.cursor = "";
  });

  // Click to show popup
  map.on("click", "cma-comp-points", (e) => {
    if (!e.features?.[0]) return;
    
    const props = e.features[0].properties;
    const coords = (e.features[0].geometry as GeoJSON.Point).coordinates;

    new mapboxgl.Popup()
      .setLngLat(coords as [number, number])
      .setHTML(`
        <div class="p-2">
          <div class="font-semibold">${props.address}</div>
          <div class="text-sm">$${props.price?.toLocaleString()}</div>
          <div class="text-xs text-gray-500">
            ${props.bedrooms} bd | ${props.bathrooms} ba | ${props.sqft?.toLocaleString()} sqft
          </div>
          <div class="text-xs">${props.daysOnMarket} days on market</div>
        </div>
      `)
      .addTo(map);
  });

  // Click cluster to zoom
  map.on("click", "cma-clusters", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["cma-clusters"] });
    const clusterId = features[0]?.properties?.cluster_id;
    
    (map.getSource("cma-comps") as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
      clusterId,
      (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number],
          zoom: zoom!,
        });
      }
    );
  });
}

function getMapStyle(style: "streets" | "satellite" | "dark"): string {
  const styles = {
    streets: "mapbox://styles/mapbox/streets-v11",
    satellite: "mapbox://styles/mapbox/satellite-streets-v11",
    dark: "mapbox://styles/mapbox/dark-v10",
  };
  return styles[style];
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Search Subject Property                                      │
│     - Enter MLS number or address                                │
│     - Frontend calls: GET /api/repliers/listing/:mlsNumber       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Backend: Fetch from Repliers API                             │
│     - Call: fetchMLSListing(mlsNumber)                           │
│     - Normalize property data                                    │
│     - Filter out rentals                                         │
│     - Return to frontend                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. User Sets Filters & Searches Comparables                     │
│     - Price range, beds, baths, status, radius                   │
│     - Frontend calls: POST /api/cma/search                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. Backend: Fetch Comparables from Repliers                     │
│     - Call: fetchSimilarListings(subject, filters)               │
│     - Filter rentals, normalize data                             │
│     - Return array of comparables                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. Frontend: Build Map Model & Display                          │
│     - buildCmaMapModel(subject, comparables, polygon)            │
│     - Initialize Mapbox layers                                   │
│     - Calculate statistics                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. User Saves CMA                                               │
│     - Frontend calls: POST /api/cmas                             │
│     - Backend persists to database                               │
│     - Creates activity log                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. Share CMA (Optional)                                         │
│     - Frontend calls: POST /api/cmas/:id/share                   │
│     - Backend generates token, sets expiration                   │
│     - Returns shareable URL                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Sharing Feature

### Generate Share Link

```typescript
// Backend route
app.post("/api/cmas/:id/share", isAuthenticated, async (req, res) => {
  const { expirationDays = 30 } = req.body;
  
  const shareToken = crypto.randomUUID();
  const shareExpiresAt = new Date();
  shareExpiresAt.setDate(shareExpiresAt.getDate() + expirationDays);
  
  const cma = await storage.updateCma(req.params.id, {
    shareToken,
    shareExpiresAt,
  });
  
  // Log activity
  if (cma.transactionId) {
    await storage.createActivity({
      transactionId: cma.transactionId,
      type: "cma_shared",
      description: `CMA shared (expires ${shareExpiresAt.toLocaleDateString()})`,
      category: "cma",
    });
  }
  
  res.json({
    shareUrl: `${req.protocol}://${req.get("host")}/shared/cma/${shareToken}`,
    expiresAt: shareExpiresAt,
  });
});
```

### Public View Page

```tsx
// client/src/pages/shared-cma-view.tsx
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function SharedCMAView() {
  const { token } = useParams<{ token: string }>();
  
  const { data: cma, isLoading, error } = useQuery({
    queryKey: ["/api/shared/cma", token],
    queryFn: async () => {
      const res = await fetch(`/api/shared/cma/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
  });

  if (isLoading) return <LoadingSpinner />;
  
  if (error) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold mb-2">CMA Not Available</h1>
        <p className="text-muted-foreground">
          {error.message === "Share link has expired"
            ? "This share link has expired."
            : "This CMA could not be found."}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <CMAReport
        title={cma.title}
        subject={cma.subjectSnapshot}
        comparables={cma.comparables}
        stats={cma.stats}
        polygon={cma.polygonGeoJson}
        isPublicView
      />
    </div>
  );
}
```

---

## Key Utilities

### Status Color Utility

```typescript
// client/src/lib/utils/status-colors.ts

// For Tailwind badge classes
export function getStatusBadgeStyle(status: string): string {
  const normalizedStatus = normalizeStatus(status);
  
  const styles: Record<NormalizedStatus, string> = {
    ACTIVE: "bg-chart-1/10 text-chart-1 border-chart-1/20",
    PENDING: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    SOLD: "bg-destructive/10 text-destructive border-destructive/20",
    UNKNOWN: "bg-muted text-muted-foreground border-muted",
  };
  
  return styles[normalizedStatus];
}

// For charts and maps (CSS color values)
export function getStatusColor(status: string): string {
  const normalizedStatus = normalizeStatus(status);
  return STATUS_COLORS[normalizedStatus];
}

// Display labels
export function getStatusLabel(status: string): string {
  const normalizedStatus = normalizeStatus(status);
  
  const labels: Record<NormalizedStatus, string> = {
    ACTIVE: "Active",
    PENDING: "Pending",
    SOLD: "Sold",
    UNKNOWN: "Unknown",
  };
  
  return labels[normalizedStatus];
}
```

### Days Remaining Urgency

```typescript
export function getDaysRemainingStyle(days: number): string {
  if (days <= 0) return "text-destructive font-bold";
  if (days <= 3) return "text-orange-500 font-semibold";
  if (days <= 7) return "text-yellow-500";
  return "text-muted-foreground";
}
```

---

## Implementation Checklist

Use this checklist when implementing CMA in a new project:

### Database Setup
- [ ] Add `cmas` table to schema (see Database Schema section)
- [ ] Add CMA-related TypeScript interfaces
- [ ] Create Zod insert/select schemas
- [ ] Run database migration

### Backend API
- [ ] Implement storage interface methods (getCmas, getCma, createCma, updateCma, deleteCma, getCmaByShareToken)
- [ ] Add CMA CRUD routes
- [ ] Add share link generation route
- [ ] Add public CMA view route (no auth)
- [ ] Add Repliers integration routes (/api/repliers/listing/:mls, /api/cma/search)

### Repliers Integration
- [ ] Set up REPLIERS_API_KEY environment variable
- [ ] Implement fetchMLSListing function
- [ ] Implement fetchSimilarListings function
- [ ] Add property normalization
- [ ] Add rental exclusion filter

### Frontend Components
- [ ] Install dependencies: mapbox-gl, @turf/turf
- [ ] Set up MAPBOX_TOKEN (or VITE_MAPBOX_TOKEN for client)
- [ ] Create cma-map-data.ts utility
- [ ] Create CMAMap component
- [ ] Create CMATab or CMABuilder component
- [ ] Create CMAAnalytics component
- [ ] Create ComparablesTable component
- [ ] Create ShareModal component
- [ ] Add SharedCMAView page for public links

### Styling
- [ ] Add status color CSS variables if using theme tokens
- [ ] Import mapbox-gl CSS
- [ ] Configure Tailwind for map container styles

### Routes
- [ ] Add authenticated CMA routes (list, detail, create)
- [ ] Add public /shared/cma/:token route

---

## Dependencies

```json
{
  "dependencies": {
    "@turf/turf": "^6.5.0",
    "mapbox-gl": "^2.15.0"
  },
  "devDependencies": {
    "@types/mapbox-gl": "^2.7.0"
  }
}
```

## Environment Variables

```
REPLIERS_API_KEY=your_repliers_api_key
MAPBOX_TOKEN=your_mapbox_access_token
```

---

## Notes

- **Rental Exclusion**: Always filter at API level (`type=Sale`) AND locally using `isRentalOrLease()` for defense in depth
- **Status Normalization**: Use `normalizeStatus()` consistently across all surfaces for uniform colors
- **DOM Display**: Prefer `simpleDaysOnMarket` over `daysOnMarket` when available
- **Map Performance**: Use clustering for large datasets (>20 comparables)
- **Polygon Generation**: Turf.js handles edge cases (1-2 points) with buffer fallbacks
- **Share Expiration**: Default 30 days, check expiration server-side before returning data
