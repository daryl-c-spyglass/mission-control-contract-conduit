# Contract Conduit - Real Estate Transaction Management

## Overview
Contract Conduit is a real estate transaction management application designed to provide agents and coordinators with a centralized platform for tracking property deals from contract to close. It aims to streamline the real estate workflow, enhance collaboration, and offer a comprehensive solution for managing complex property transactions, ultimately increasing efficiency and closing rates for real estate professionals. Key capabilities include managing active transactions, coordinating team members, and integrating with essential external services.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **UI**: shadcn/ui (Radix UI, Lucide icons), Tailwind CSS for styling and theming.
- **Design**: Modern Productivity Dashboard aesthetic, using Inter and IBM Plex Mono fonts.

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API**: RESTful endpoints
- **Features**: CRUD operations for transactions, coordinators, integration settings, and activity logs.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: Shared schema definition
- **Entities**: Transactions, Coordinators, Integration Settings, Activities.

### UI/UX Decisions
- **Marketing Tab**: Centralized hub for marketing asset creation (social media graphics, flyers).
- **Templates Feature**: Preview gallery of marketing templates within transaction details.
- **MLS Data Tab**: Comprehensive property information visualization with photo gallery and Mapbox integration.
- **Print Flyer Architecture**: HTML/CSS and Puppeteer for server-side rendering to generate pixel-identical PDF previews and downloads.
- **Social Media Graphics**: Client-side canvas rendering for various social media formats with agent branding and status badges.
- **Agent Marketing Profile**: Dedicated settings for agent branding on marketing materials.
- **Mobile/WebView Optimizations**: Full-screen viewport, PWA meta tags, safe area utilities, touch optimizations, and scroll behavior controls.

### Technical Implementations
- **AI Integration**: GPT-4o-mini for social media tagline generation, MLS description summarization, and CMA cover letter generation.
- **Agent Profile System**: Database-backed agent profiles with bio, default cover letter (with AI generation/enhancement), and social media links for CMA reports. Includes tone selection (professional, friendly, confident) for AI-generated cover letters.
- **Automatic MLS Synchronization**: Background service for regular MLS data sync.
- **CMA (Comparative Market Analysis) System**: Database-backed storage, public share links, property data visualization (grid, stats, map), and configurable filters for search radius, price, size, and age. Includes API endpoints for CMA management and sharing.
- **CMA Data Flow**: 
  - Subject property: `linkedTransaction.mlsData` with coordinates in `coordinates.latitude/longitude`, normalized in CMAPresentationBuilder to include field aliases
  - Comparables: Primary source is `cma.propertiesData`, fallback to `linkedTransaction.cmaData` if empty
  - Comparable coordinates: Located in `map.latitude/longitude` field (also supports lat/lng short form)
  - Statistics/Timeline endpoints use same fallback logic for data consistency
  - Property field mapping: CMA format (`price`, `sqft`, `status`) ↔ Normalized format (`listPrice`, `livingArea`, `standardStatus`)
  - **Field Aliasing**: CMAPresentationBuilder normalizes both subject and comparables with multiple field aliases for preview components:
    - Address: `address`, `unparsedAddress`, `streetAddress`
    - Bedrooms: `bedroomsTotal`, `beds`
    - Bathrooms: `bathroomsTotal`, `bathroomsTotalInteger`, `baths`
    - Square footage: `livingArea`, `sqft` (parsed from string)
    - Coordinates: `latitude/longitude`, `lat/lng`, `map.latitude/longitude`, `coordinates.latitude/longitude`
  - **Status Normalization**: MLS status codes normalized to human-readable values (U/Sc → Pending, A → Active, C/S → Closed)
  - **CMAMapPreview**: Wrapper component for CMA Presentation Builder Live Preview that uses the working `CMAMap` component with coordinate normalization from various formats
- **Status Badges & Utilities**: Consistent styling and display logic for transaction statuses and days remaining.
- **Shared Listing Utilities**: Predicates and helpers for rental exclusion, accurate Days on Market display, and filtering.
- **MLS/IDX/VOW Compliance**: Multi-layer rental exclusion, prevention of external media redirects, and consistent DOM normalization.
- **Photo Upload System**: Photos uploaded via GCS client to `.private/uploads/property-{transactionId}-{timestamp}-{uuid}-{filename}`, served through `/objects/*` route (avoiding sidecar signed URL 500 errors). Server validates file type (jpeg/png/gif/webp) and size (max 10MB). MLS photos stored separately in `mlsData.images`, user uploads in `propertyImages` field.

## External Dependencies
- **Slack**: Team coordination.
- **Gmail**: Email routing.
- **MLS Systems (Repliers API)**: Property data, photos, pricing, and image insights.
- **Follow Up Boss (FUB)**: CRM integration.
- **Mapbox**: Interactive property maps.
- **PostgreSQL**: Primary database.
- **GPT-4o-mini**: AI services.
- **Turf.js**: Geospatial operations for CMA maps.