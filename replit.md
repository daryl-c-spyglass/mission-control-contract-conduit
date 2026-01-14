# Mission Control - Real Estate Transaction Management

## Overview

Mission Control is a real estate transaction management application designed to empower agents and coordinators with a centralized platform for tracking property deals from contract to close. It offers tools for managing active transactions, coordinating team members, and integrating with essential external services. The project aims to streamline the real estate workflow, enhance collaboration, and provide a comprehensive solution for managing complex property transactions, ultimately increasing efficiency and closing rates for real estate professionals.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **UI Components**: shadcn/ui built on Radix UI, Lucide icons, react-icons
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode)
- **Build Tool**: Vite
- **Design System**: Modern Productivity Dashboard aesthetic inspired by Linear, Notion, and Asana, featuring Inter font for UI, IBM Plex Mono for addresses, dense layouts, and consistent spacing.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints
- **Build**: esbuild
- **Core Features**: CRUD operations for transactions, coordinators, integration settings, and activity logs.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: Shared `shared/schema.ts`
- **Migrations**: Drizzle Kit
- **Core Entities**: Transactions, Coordinators, Integration Settings, Activities.

### UI/UX Decisions
- **Marketing Tab**: Centralized hub for all marketing asset creation, including social media graphics and flyers.
- **Templates Feature**: Provides a preview gallery of marketing templates within transaction details.
- **Enhanced MLS Data Tab**: Comprehensive property information visualization with photo gallery, feature tags, and interactive Mapbox integration.
- **Print Flyer Architecture**: Utilizes HTML/CSS and Puppeteer for server-side rendering to ensure pixel-identical output for previews and PDF downloads.
- **Social Media Graphics**: MarketingMaterialsDialog uses client-side canvas rendering for Instagram Post (1080x1080), Instagram Story (1080x1920), and Facebook Post (1200x630) formats with agent branding and status badges.
- **Graphics Templates (Server-side)**: Alternative Handlebars templates in `server/templates/graphics/` for future server-side rendering via `/api/graphics/render` endpoint.
- **Agent Marketing Profile**: Dedicated settings for agent branding on marketing materials, including headshot, name, title, and contact information.

### Technical Implementations
- **AI Social Media Tagline Generation**: GPT-4o-mini powered tagline generation for social media graphics, using full property context and image insights from Repliers API.
- **AI Description Summarization**: AI-powered summarization of MLS descriptions for flyers, with character limits and revert functionality.
- **Preview Modal Zoom Controls**: Interactive zoom functionality for enlarged previews of marketing materials.
- **Automatic MLS Synchronization**: Background service using node-cron to sync MLS data every 15 minutes for active and in-contract transactions.
- **CMA (Comparative Market Analysis) System** (`cmas` table + `CMATab` component):
  - Database-backed CMA storage with `cmas` table supporting transaction linking via `transactionId`
  - Public share links with `publicLink` token and `expiresAt` expiration
  - Property data stored as JSONB in `propertiesData` field
  - Statistics visualization: avg price, price/sqft, DOM, sqft, beds, baths
  - Multiple view modes: grid, stats, map (when coordinates available)
  - Photo galleries with fullscreen support
  - Share link generation with 30-day default expiration
  - Public sharing page at `/shared/cma/:token` (no auth required)
  - API endpoints: GET/POST/PATCH/DELETE `/api/cmas`, POST `/api/cmas/:id/share`, GET `/api/shared/cma/:token`
- **Status Badge Color Utility** (`client/src/lib/utils/status-colors.ts`):
  - `getStatusBadgeStyle(status)`: Returns Tailwind classes using CSS variable tokens for theme-aware coloring
  - `getStatusLabel(status)`: Returns formatted display labels for transaction statuses
  - `getStatusColor(status)`: Returns CSS color strings for charts/maps
  - `getDaysRemainingStyle(days)`: Returns urgency-based text color classes
  - Color scheme: Active=chart-1 (green), In Contract=chart-2 (orange), Pending=chart-3 (blue), Closed=destructive (red), Withdrawn/Cancelled=muted (gray), Coming Soon=chart-5 (purple)
- **Shared Listing Utilities** (`shared/lib/listings.ts`):
  - `isRentalOrLease(listing)`: Predicate for detecting rentals via type, propertyType, transactionType, listingCategory, leaseType, details.propertySubType, and class fields
  - `getDisplayDOM(listing)`: Returns accurate Days on Market (prefers simpleDaysOnMarket over daysOnMarket)
  - `hasAccurateDOM(listing)`: Checks if simpleDaysOnMarket is available
  - `excludeRentals(listings)`: Filter helper for arrays

### MLS/IDX/VOW Compliance
- **Rental Exclusion**: Multi-layer enforcement:
  - API level: `type=Sale` filter on search endpoints
  - Local failsafe: `isRentalOrLease()` predicate on array results
  - Route rejection: 422 + `RENTAL_EXCLUDED` code for single-listing endpoints
  - Sync skip: Rentals skipped with `skippedLeaseCount` logging
- **No External Media Redirects**: Virtual tour URLs are stored but not rendered; `safe-links.ts` utility blocks external redirects
- **DOM Normalization**: UI uses `getDisplayDOM()` for consistent Days on Market display across all surfaces

## External Dependencies

- **Slack**: For channel creation and team coordination.
- **Gmail**: For routing property-related emails.
- **MLS Systems (Repliers API)**: For fetching comprehensive property data, including photos, pricing, and details, and for image insights.
- **Follow Up Boss (FUB)**: CRM integration for client data.
- **Mapbox**: For interactive property maps with dynamic styling.
- **PostgreSQL**: Primary database for application data.
- **GPT-4o-mini**: Used for AI-powered tagline generation and description summarization.
- **Turf.js**: For geospatial operations like convex hull polygon generation and buffering in CMA maps.

## CMA Map Data Flow

### Architecture
The CMA map uses a single source of truth pattern with shared data structures for both UI rendering and any export/preview features.

**Key Files:**
- `client/src/lib/cma-map-data.ts` - Shared data builder module (canonical data structures)
- `client/src/components/cma-map.tsx` - Mapbox GL JS map component

### Data Model
```typescript
// Status normalization
type NormalizedStatus = 'ACTIVE' | 'PENDING' | 'SOLD' | 'UNKNOWN';

// CmaMapModel - returned by buildCmaMapModel()
interface CmaMapModel {
  subjectFeature: CmaPointFeature | null;     // Subject property GeoJSON
  compFeatures: CmaPointFeature[];            // Comparable properties GeoJSON
  allPointsCollection: FeatureCollection;     // Combined for bounds
  compsOnlyCollection: FeatureCollection;     // For clustering (excludes subject)
  polygonFeature: CmaPolygonFeature | null;   // Convex hull search area
  polygonCollection: FeatureCollection;       // For map layer
  bounds: [[number, number], [number, number]] | null;
  subjectLngLat: [number, number] | null;
}
```

### Status Normalization
`normalizeStatus(rawStatus)` maps Repliers API values:
- ACTIVE: 'a', 'active', 'coming', 'new', 'available'
- PENDING: 'u', 'p', 'pending', 'contract', 'contingent', 'backup', 'option', 'sc', 'k' (kick-out), 'b' (backup offer), 'h' (hold), 't' (temp off market)
- SOLD: 's', 'sold', 'closed'
- UNKNOWN: Only when no status data available, unrecognized codes, or withdrawn/cancelled/expired listings

Note: Unknown status codes now surface warnings in console and return UNKNOWN to ensure data quality issues are visible.

### Layer Order (bottom to top)
1. Polygon fill (search area)
2. Polygon outline
3. Cluster circles (comps only)
4. Cluster count labels
5. Comparable points (unclustered)
6. Comparable price labels
7. Subject point (always on top)
8. Subject label

### Status Colors
- ACTIVE: #2E7D32 (green)
- PENDING: #F9A825 (amber)
- SOLD: #C62828 (red)
- UNKNOWN: #757575 (grey)
- Subject: #1565C0 (blue, always)

### Polygon Generation (turf.js)
- 3+ points: `turf.convex()` → `turf.buffer(hull, 0.3km)`
- 2 points: `turf.lineString()` → `turf.buffer(line, 0.3km)`
- 1 point: `turf.buffer(point, 0.5km)`

### Controls
- **Center on Subject**: `map.flyTo({ center: subjectLngLat, zoom: 14 })`
- **Fit All**: `map.fitBounds(bounds, { padding: 60 })`
- Both use `map.resize()` first to handle responsive containers

### Interactivity
- **Hover**: Feature-state `{hover: true}` → larger radius + stronger stroke
- **Click Comp**: Feature-state `{selected: true}` + popup with details
- **Click Cluster**: `getClusterExpansionZoom()` → zoom in
- **Canonical Property Lookup**: `propertyByFeatureId` Map provides direct access to original Property objects by feature ID

### Theme Toggle Handling
- Style effect only triggers on actual mapStyle changes (not on data changes)
- Uses refs (`modelRef`, `isDarkRef`, `showPolygonRef`) to access latest values in styledata callback
- Selection state (selected/hovered features) is captured before style change and restored after

### Verification Steps
1. Map shows subject (blue) + N comparables with correct status colors
2. Polygon is visible and encloses all points (or buffer fallback)
3. Colors match status (green/amber/red), grey only if truly unknown
4. Hover highlights comparable, click opens details popup
5. Clusters appear when zoomed out, clicking zooms in
6. "Center on Subject" and "Fit All" buttons always work
7. Subject label always readable and on top