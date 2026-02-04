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
- **Schema**: Shared schema definition for Transactions, Coordinators, Integration Settings, and Activities.

### UI/UX Decisions
- **Marketing Tab**: Centralized hub for marketing asset creation (social media graphics, flyers).
- **Templates Feature**: Preview gallery of marketing templates within transaction details.
- **MLS Data Tab**: Comprehensive property information visualization with photo gallery and Mapbox integration.
- **Print Flyer Architecture**: HTML/CSS and Puppeteer for server-side rendering to generate pixel-identical PDF previews and downloads.
- **Social Media Graphics**: Client-side canvas rendering for various social media formats with agent branding and status badges.
- **Agent Marketing Profile**: Dedicated settings for agent branding on marketing materials.
- **Mobile/WebView Optimizations**: Full-screen viewport, PWA meta tags, safe area utilities, touch optimizations, and scroll behavior controls.
- **Advanced Flyer Generator**: Full-page view within Marketing tab for professional flyer creation with auto-filled MLS data, AI-generated headlines, image upload with crop controls, live preview, optional grid overlay, AI-powered photo selection using Repliers `coverImage` parameter, and integration of agent marketing profiles. Exports to PNG or CMYK PDF.
  - **AI Photo Selection**: Uses Repliers API `coverImage` parameter for optimal photo selection:
    - Main Photo: `coverImage=exterior front` - AI selects best exterior/front photo
    - Kitchen Photo: `coverImage=kitchen` - AI selects best kitchen photo
    - Room Photo: `coverImage=living room` - AI selects best living room photo
  - Falls back to `imageInsights` classification when coverImage API unavailable
  - Endpoint: `/api/listings/:mlsNumber/ai-photos` with 5-minute client-side cache
  - **Off-Market Photo Support**: For transactions without MLS numbers, uses photos from `transaction.propertyImages` (user uploads). User-uploaded photos appear first in the photo picker, followed by MLS photos.
  - **Modal-Based Image Cropping**: CropModal component with drag-to-pan, zoom slider (1-3x), touch support, grid overlay, and reset functionality for precise image positioning
  - **QR Code Generation**: URL input field with generate button that creates QR codes using the qrcode library. Supports prepopulation from settings/transaction data with proper state synchronization
  - **Auto-Population Data Flow**:
    - Active Listings (has MLS #): Auto-populates price, beds, baths, sqft, address, description from Repliers API
    - Off-Market Listings (no MLS #): Uses uploaded photos from transaction.propertyImages, shows empty fields for manual entry
    - Agent Details: Always loads from Settings (name, title, phone, photo, logos)
- **CMA Presentation Player**: Fullscreen interactive slideshow with 33 widgets for client presentations, featuring responsive layout, Mapbox header, agent profile popover, sidebar navigation, keyboard controls, and mobile optimization. Uses Spyglass branding.
- **CMA Print Preview System**: Pre-download slide preview with data validation, single/grid view modes, zoom controls, and keyboard navigation. Ensures preview matches PDF output.
- **CMA PDF Export System**: Client-side PDF generation using `@react-pdf/renderer` in landscape letter format, covering all 33 widgets with specialized pages for dynamic content. Incorporates Spyglass brand colors and professional design elements.

### Technical Implementations
- **AI Integration**: GPT-4o-mini for social media tagline generation, MLS description summarization, and CMA cover letter generation with tone selection.
- **Agent Profile System**: Database-backed agent profiles with bio, default cover letter (with AI generation/enhancement), and social media links for CMA reports.
- **Agent Marketing Profile System**: Separate database profile for flyers and marketing materials, including agent photo, title, QR code, company logos, with API endpoints for management and server-side validation.
- **Automatic MLS Synchronization**: Background service for regular MLS data sync.
- **CMA (Comparative Market Analysis) System**: Database-backed storage, public share links, property data visualization, and configurable filters. Includes robust data flow for subject property and comparables, extensive field aliasing, and status normalization for consistency across various MLS formats. Status normalization checks both `status` and `lastStatus` fields from Repliers API:
  - `lastStatus="Sld"` (Sold) indicates a completed SALE transaction - displays as "Closed" with red badge
  - `lastStatus="Lsd"` (Leased) indicates a completed RENTAL transaction - displays as "Leasing" with purple badge
  - Per RESO Standard: Sale statuses (Active/Pending/Closed) are distinct from Rental statuses (Leasing)
- **Status Color System**: Centralized status colors across all CMA views:
  - Active = Green (#22c55e) - Property listed for sale
  - Pending / Under Contract = Orange (#f97316) - Has accepted offer
  - Closed = Red (#ef4444) - Sale completed
  - Leasing = Purple (#a855f7) - Rental/For Rent property
  - Subject = Blue (#3b82f6) - Subject property marker
  - Unknown = Gray (#6b7280) - Status not determined
- **Photo Upload System**: Photos uploaded via GCS client to private storage, served through a secure route. Server validates file type and size. Distinct handling for MLS photos and user uploads.
- **Transaction Photos Table**: Database-backed photo tracking with source attribution:
  - **Schema**: transactionPhotos table tracks id, transactionId, url, filename, source, label, sortOrder, createdAt
  - **Source Types**: 'mls' (synced from MLS, locked), 'off_market' (uploaded during transaction creation), 'coming_soon' (uploaded during transaction creation with Slack notification), 'uploaded' (added via Marketing tab)
  - **API Endpoints**:
    - GET /api/transactions/:id/transaction-photos - Fetch photos sorted by source (MLS first)
    - DELETE /api/transactions/:id/transaction-photos/:photoId - Delete user photos (blocks MLS deletion)
    - POST /api/transactions/:id/photos - Upload new photos (saves to both propertyImages and transactionPhotos)
  - **PropertyPhotos Component** (client/src/components/marketing/PropertyPhotos.tsx): Unified photo gallery with color-coded source badges, upload functionality, and delete capability for non-MLS photos. Displays in Marketing tab.
  - **Lot Size Conversion**: Bidirectional auto-conversion between Square Feet and Acres (1 acre = 43,560 sq ft) in Create Transaction form
- **CMA Data Extraction Utilities**: Comprehensive client-side utilities (`client/src/lib/cma-data-utils.ts`) for safe data extraction and normalization from various MLS/Repliers API field structures, including price, square footage, DOM, lot acres, beds/baths, address, coordinates, and status. Includes calculation of CMA statistics and robust formatting functions.
- **CMA Resources System**: Agent-managed resources (documents, links) for CMA presentations, stored in a database with API endpoints for CRUD, reordering, and file uploads. Supports public access for shared CMAs.
- **User Notification Preferences System**: Per-user Slack notification settings stored in a database, with API endpoints and a reusable component for managing preferences.
- **Slack Diagnostics System**: Read-only diagnostic endpoint for pre-UAT testing:
  - **Endpoint**: GET /api/admin/slack-diagnostics (authenticated)
  - **Format**: JSON (default) or text (?format=text for formatted report)
  - **Checks**: Notification flags, Slack tokens, API connection, scheduler status, database pending notifications, user preferences, recent notification history
  - **UAT Mode**: Supports UAT_MODE env var to limit notifications to test users only
  - **Kill Switches**: DISABLE_SLACK_NOTIFICATIONS, SLACK_BOT_TOKEN_DISABLE, SLACK_API_TOKEN_DISABLE
- **Shareable Flyer System**: Database-backed storage for property flyers with public viewing pages accessible via QR codes.
  - **Flyer Storage**: Flyers table stores snapshot of property data, images, agent info, branding settings, and metadata
  - **Short URLs**: Uses nanoid(9) for URL-friendly 9-character IDs (e.g., /flyer/abc123xyz)
  - **API Routes**:
    - POST /api/flyers - Create flyer (authenticated, validates with Zod schema)
    - GET /api/flyers - Get user's flyers (authenticated)
    - GET /api/flyers/:id/qr - Regenerate QR code (authenticated)
    - GET /api/public/flyer/:id - Public viewing (NO AUTH, increments view count)
  - **Public Flyer Viewer** (client/src/pages/flyer-viewer.tsx):
    - Mobile-optimized responsive design
    - Photo gallery with prev/next navigation
    - Property stats display (beds, baths, sqft)
    - Agent contact buttons (call, email, schedule showing)
    - Google Maps integration
    - Social share options (Facebook, X, LinkedIn, WhatsApp, SMS, Email, Copy Link)
    - Uses TanStack Query for data fetching
    - Complies with UI guidelines (shadcn Button components, no custom hover states)

## External Dependencies
- **Slack**: Team coordination.
- **Gmail**: Email routing.
- **MLS Systems (Repliers API)**: Property data, photos, pricing, and image insights.
- **Follow Up Boss (FUB)**: CRM integration.
- **Mapbox**: Interactive property maps.
- **PostgreSQL**: Primary database.
- **GPT-4o-mini**: AI services.
- **Turf.js**: Geospatial operations for CMA maps.