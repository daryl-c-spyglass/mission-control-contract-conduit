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
- **CMA Presentation Player**: Fullscreen interactive slideshow with 33 widgets (10 dynamic + 23 static images) for client presentations. Features:
  - Located at `client/src/components/cma-presentation/`
  - Responsive grid layout (2-5 columns based on screen size)
  - Mapbox header background with theme-synced styles
  - Agent profile popover with photo, contact info
  - Sidebar navigation for quick section access
  - Keyboard navigation (Escape, Left/Right arrows)
  - Mobile-optimized with safe area insets and touch handling
  - Spyglass branding (#EF4923 orange, #222222 black) - Official brand colors (122 instances, 100% compliant)
  - Widget types: AgentResume, Comps (Compare/Map/Stats tabs), TimeToSell, SuggestedPrice, AveragePricePerAcre, SpyglassResources, Static images
  - Data integration: Uses `useAgentProfile` hook for agent data, transforms `CMAComparable[]` to `CmaProperty[]` for presentation
  - Static widget images stored in `public/cma-widgets/` (1.png through 24.png map to widgets 11-34)
- **CMA Print Preview System**: Pre-download slide preview with data validation:
  - Files: `components/CmaPrintPreview.tsx` (modal), `components/preview-slides.tsx` (slide generation)
  - Features: Single/grid view modes, zoom controls (50%-150%), keyboard navigation (Escape, Arrow keys)
  - Data Issue Detection: Validates agent profile, subject property (address/price/sqft/photos), and comparables (price/photos/coordinates/DOM/sqft)
  - Slide Alignment: Preview matches PDF exactly (cover + 33 WIDGETS + 3 PropertyDetail pages for top comparables)
  - Integration: Opens via Eye icon in CMA presentation header, download proceeds from modal after review
- **CMA PDF Export System**: Client-side PDF generation using @react-pdf/renderer:
  - Files: `pdf/CmaPdfDocument.tsx` (main document), `pdf/styles.ts` (Spyglass branding styles with 60+ style definitions)
  - Button: `PdfDownloadButton.tsx` in presentation header, opens Print Preview modal
  - Features: Landscape Letter format, all 33 widgets covered, specialized pages for dynamic content
  - Page Types: CoverPage, AgentResumePage, ComparablesSummaryPage, TimeToSellPage, SuggestedPricePage, AveragePricePerAcrePage, ListingActionPlanPage, ClientTestimonialsPage, ListingWithSpyglassPage, SpyglassResourcesPage, MarketingPage, ThankYouPage, StaticImagePage (fallback), PropertyDetailPage (top 3 comparables)
  - Data Flow: CmaPresentationPlayer → Header → PdfDownloadButton → CmaPdfDocument (props: agent, comparables, subjectProperty, averageDaysOnMarket, suggestedListPrice, avgPricePerAcre, preparedFor)
  - Styling: Spyglass brand colors (#EF4923, #222222), built-in Helvetica font (Inter disabled due to browser font loading issues)
  - Output: `CMA-{address}-{date}.pdf` with toast notifications for status updates
  - **Font Handling**: Uses built-in Helvetica font family; hyphenation disabled via Font.registerHyphenationCallback to prevent font lookup issues
  - **Image Handling**: Uses text fallbacks for logo, property photos, agent photos due to cross-origin restrictions; agent initials placeholder shown for agent photos
  - **Professional PDF Design (CloudCMA-style)**:
    - Cover Page: Split "SPYGLASS REALTY" logo, address box, orange agent section at bottom with photo/initials placeholder
    - Agent Resume: Two-column layout with agent photo placeholder, bio, stats grid (150+ Homes Sold, $85M Sales Volume, 4.9★ Rating)
    - Comparables Summary: Highlighted stats row (orange boxes for key metrics), table with 8 properties, color-coded status badges (green=Closed, blue=Active)
    - Property Details: Photo placeholder, status badges, beds/baths/sqft stat boxes, price per sqft and lot acres info
    - Suggested Price: Green highlighted price box, visual price range slider with low/high markers
    - Thank You: Professional logo, circular agent photo placeholder with initials, branded contact display
- **CMA Data Extraction Utilities** (`client/src/lib/cma-data-utils.ts`): Safe data extraction functions for handling MLS/Repliers API field variations:
  - `extractPrice(comp)`: Handles soldPrice, closePrice, price, listPrice fields
  - `extractSqft(comp)`: Handles sqft, livingArea, squareFeet (including string parsing)
  - `extractDOM(comp)`: Handles daysOnMarket, dom, cumulativeDom, simpleDaysOnMarket
  - `extractLotAcres(comp)`: Handles lot.acres, lotSizeAcres, lotAcres
  - `extractBeds(comp)`, `extractBaths(comp)`: Handles bedroomsTotal, beds, bathroomsTotal, baths
  - `extractFullAddress(comp)`: Handles address, unparsedAddress, streetAddress, nested streetNumber/streetName
  - `calculatePricePerSqft(comp)`, `calculatePricePerAcre(comp)`: Safe calculation with null checks
  - `calculateCMAStats(comparables)`: Calculates avgPrice, avgSqft, avgDOM, avgPricePerSqft, avgPricePerAcre, priceRange, count
  - `formatPrice(value)`, `formatNumber(value)`: Safe formatting with N/A fallback
  - `formatPriceShort(value)`: Compact price format ($500K, $1.2M)
  - `normalizeStatus(status)`, `getStatusColor(status)`: Status display utilities
  - `getAgentName(agent)`, `getAgentInitials(agent)`: Agent display helpers for PDF
  - `getPrimaryPhoto(comp)`, `getPhotos(comp)`: Photo extraction from various field structures
  - `getCoordinates(comp)`: Coordinate extraction from multiple field formats
- **CMA Resources System**: Agent-managed resources (documents, links) for CMA presentations:
  - Database: `agentResources` table with id, userId, name, type (file/link), url, fileUrl, displayOrder, isActive, timestamps
  - API Endpoints: GET/POST `/api/agent/resources`, PATCH/DELETE `/api/agent/resources/:id`, POST `/api/agent/resources/reorder`, POST `/api/agent/resources/upload`
  - Public API: GET `/api/shared/cma/:token/resources` for shared CMA access
  - File Upload: PDF/Word docs up to 50MB, stored at `.private/resources/{userId}/{timestamp}-{filename}` via @replit/object-storage
  - Settings Page: Drag-to-reorder list, visibility toggles, edit/delete, file upload with dashed border drop zones
  - SpyglassResourcesWidget: CloudCMA-style underlined text links, supports authenticated and public contexts via optional `cmaToken` prop
- **User Notification Preferences System**: Per-user Slack notification settings:
  - Database: `userNotificationPreferences` table with userId, notifyDocumentUploads, notifyClosingReminders, notifyMarketingAssets
  - API Endpoints: GET/PUT `/api/user/notification-preferences` with Zod validation
  - Component: `NotificationPreferences.tsx` with 3 toggles, auto-save, optimistic updates
  - Settings Page Integration: Replaced inline notification settings with reusable component

## External Dependencies
- **Slack**: Team coordination.
- **Gmail**: Email routing.
- **MLS Systems (Repliers API)**: Property data, photos, pricing, and image insights.
- **Follow Up Boss (FUB)**: CRM integration.
- **Mapbox**: Interactive property maps.
- **PostgreSQL**: Primary database.
- **GPT-4o-mini**: AI services.
- **Turf.js**: Geospatial operations for CMA maps.