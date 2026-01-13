# Mission Control - Real Estate Transaction Management

## Overview

Mission Control is a real estate transaction management application designed to help agents and coordinators track property deals from contract to close. The app provides a centralized dashboard for managing active transactions, coordinating team members, and integrating with external services like Slack, Gmail, and MLS systems.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Build Tool**: Vite with hot module replacement

The frontend follows a page-based structure with reusable components. Key pages include Dashboard, Archive, Integrations, and Settings. Transaction data flows through React Query which handles caching and synchronization.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints under `/api/*` prefix
- **Build**: esbuild for production bundling with selective dependency bundling

The server handles CRUD operations for transactions, coordinators, integration settings, and activity logs. Routes are registered in a single file for maintainability.

### Data Storage
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with migrations output to `/migrations`
- **Current Implementation**: In-memory storage class (`MemStorage`) with interface (`IStorage`) for easy database swap

Core entities include:
- **Transactions**: Property deals with status, dates, pricing, and integration IDs
- **Coordinators**: Team members assigned to transactions
- **Integration Settings**: API keys and configuration for external services
- **Activities**: Audit log of actions per transaction

### Design System
The app follows a Modern Productivity Dashboard approach inspired by Linear, Notion, and Asana:
- Clean information hierarchy with property data surfaced immediately
- Inter font for UI, IBM Plex Mono for addresses and codes
- Dense but scannable layouts with consistent spacing (Tailwind units 2, 4, 6, 8)
- Professional polish suitable for high-stakes real estate transactions

## External Dependencies

### Third-Party Integrations (Planned/Configurable)
- **Slack**: Create channels for transactions, invite coordinators automatically
- **Gmail**: Create filters to route property emails to appropriate channels
- **MLS Systems (Repliers API)**: Fetch property data including photos, pricing, and details
- **Follow Up Boss (FUB)**: CRM integration for client data

### Templates Feature (ReChat-like)
The Templates tab in transaction details provides marketing template generation:
- Search by address or MLS number to fetch listing data from Repliers API
- Template categories: Posts (1:1), Stories (9:16), Flyers, Postcards, Brochures
- Live previews with property photos, pricing, and description overlays
- Uses `/api/listings/search` endpoint with `searchByAddress` fallback to MLS lookup

### Create Property Flyer Dialog (January 2026)
Enhanced flyer creation dialog with UX improvements for mobile and desktop:
- **Dual Format Support**: Social Media (1:1 aspect ratio, 200 char limit) and Print Flyer (8.5x11, 115 char limit)
- **Preview Enlarge Lightbox**: Click preview thumbnail to open full-size modal with enlarged view
- **Photo Thumbnail Expand**: Hover shows ZoomIn icon, click opens photo in full-size lightbox
- **Replace Mode for Uploads**: When 3/3 photos selected, new uploads clear previous selections and replace
- **Collapsible Upload Section**: Accordion-style toggle with ChevronUp/Down, shows "Replace with custom photos" when limit reached
- **Full Description Loading**: Textarea loads complete MLS description, truncation only at generation time
- **Dynamic Character Limits**: Shows "{current}/{limit}" counter, amber warning when over limit
- **Mobile Optimized**: Touch-friendly controls, responsive layouts, proper scrolling on iOS/Android

#### Print Flyer Architecture (January 2026)
Print flyers use HTML/CSS + Puppeteer for server-side rendering (replaced canvas approach):
- **Template**: `server/templates/flyer-template.html` with Handlebars placeholders
- **Fonts**: League Spartan (headlines) and Montserrat (body) via Google Fonts
- **Generator Service**: `server/services/flyer-generator.ts` launches headless Chromium
- **Unified API Endpoint**: `POST /api/flyer/render` with `outputType` parameter ('pngPreview' or 'pdf')
- **Pixel-Identical Output**: Both preview and download use same Puppeteer rendering for exact parity
- **Address Formatting**: Letter-spaced styling preserving state abbreviations and ZIP codes
- **Price Badge**: Tan/brown rectangle (#8b7355) with price display
- **Puppeteer Config**: Runs with --no-sandbox, --disable-setuid-sandbox for Replit compatibility
- **Social flyers** still use client-side canvas rendering for speed
- **Preview Rendering**: "Render Preview" button triggers server-side Puppeteer preview identical to download
- **Template Version**: v2.2.1 with baseline alignment and sizing updates
- **Parity Verification**: `scripts/verify-flyer-parity.ts` validates pixel-identical output

#### Print Flyer Layout Specifications (January 2026)
Bottom strip layout with PSD-matching baseline alignment:
- **Three Column Grid**: Stats (520px) | Copy (flexible) | Agent (480px)
- **Baseline Alignment**: All three columns use `justify-content: flex-end` to align bottom content:
  - Stats column: sqft row at bottom
  - Copy column: description at bottom
  - Agent column: phone number at bottom
- **Sqft/Phone Alignment**: Sqft baseline aligns horizontally with agent phone baseline
- **Agent Photo**: 220px diameter with 5px warm gray stroke (#d4c5a9)
- **Spyglass Logo**: 130px beside agent photo
- **Stat Icons**: 56px PNG icons (bedroom, bathroom, sqft) loaded as base64 data URIs
- **Y-axis Dividers Only**: Vertical dividers match content height, no horizontal rules

#### Print Flyer Agent Information (January 2026)
Professional agent branding for print flyers with validated required fields:
- **Agent Name** (required): Full name displayed on flyer
- **Agent Title**: Optional title like "REALTOR®" 
- **Agent Phone** (required): Contact number displayed prominently
- **Agent Photo**: Optional circular headshot upload with User icon placeholder if not provided
- **Listing Headline**: Optional 39-character headline (e.g., "OPEN HOUSE SATURDAY") shown above description
- **Validation**: Toast error prevents generation without required agent name and phone
- **Live Preview**: Agent section updates in real-time as fields are filled

#### Agent Marketing Profile Settings (January 2026)
Settings page includes dedicated "Agent Marketing Profile" section:
- **Headshot Upload**: Base64 image storage (5MB max frontend validation, 7MB backend validation for base64 overhead)
- **Display Name**: Agent's name for marketing materials
- **Title**: Professional title (e.g., "REALTOR®")
- **Phone Number**: Contact number for flyers
- **Email Address**: Contact email for marketing materials
- **API Endpoint**: `PATCH /api/user/graphics-settings` handles all marketing profile fields
- **Database Fields**: `marketing_headshot_url`, `marketing_display_name`, `marketing_title`, `marketing_phone`, `marketing_email` in users table
- **Server Validation**: Size limits, format validation, and field length checks

#### AI Description Summarization (January 2026)
AI-powered summarization for property descriptions in both flyer formats:
- **Dual Format Support**: Available for Social Media (200 chars) and Print Flyer (150 chars)
- **Single Source of Truth**: Character limits centralized in `DESCRIPTION_LIMITS` constant
- **Original Source**: Always summarizes from the original MLS description, not edited text
- **Re-runnable**: Click "AI Summarize" again for a different variation
- **Revert Functionality**: Dropdown with "Revert to Previous" and "Revert to Original" options
- **API Endpoint**: `POST /api/summarize-description` using gpt-4o-mini model
- **Graceful Fallback**: If AI fails, truncates to character limit with ellipsis

#### Preview Modal Zoom Controls (January 2026)
Zoom controls for the enlarged preview modal:
- **Zoom Toolbar**: [-] [100%] [+] [Fit] layout above preview
- **Zoom Range**: 50% to 300% in 25% increments
- **ScrollArea**: Scrollbars appear when zoomed beyond viewport
- **Smooth Transitions**: CSS transform scale with 200ms ease-out
- **Keyboard Shortcuts**: Ctrl/Cmd + Plus (zoom in), Minus (zoom out), 0 (reset)
- **Larger Modal**: max-w-[min(90vw,1200px)] and max-h-[90vh] for more preview space
- **Auto-Reset**: Zoom level resets to 100% when modal closes

### Enhanced MLS Data Tab (January 2026)
The MLS Data tab provides comprehensive property information visualization:
- **Photo Gallery**: Fullscreen modal with navigation arrows, thumbnail strip, and photo counter
- **Browse by Room**: Room type filter UI (Coming Soon - Repliers API doesn't provide room categorization)
- **Feature Tags**: Dynamic badges extracted from MLS data (garage, pool, fireplace, patio/deck, stories)
- **Google Maps Integration**: Embedded map showing property location (via secure `/api/maps-embed` endpoint)
- **Property Details**: Description, collapsible feature sections, price per sqft, HOA fees, tax info
- All MLS images are proxied through `/api/proxy-image` to avoid CORS issues

### Automatic MLS Synchronization (January 2026)
MLS data syncs automatically every 15 minutes without requiring manual refresh:
- **Background Service**: `server/repliers-sync.ts` runs as a cron job using node-cron
- **Transaction Filtering**: Only syncs transactions with status "active" or "in_contract"
- **Rate Limiting**: 2-second delays between API calls to prevent overwhelming the Repliers API
- **Sync Status Display**: MLS Data tab shows "Auto-synced {timestamp}" under the header
- **API Endpoints**:
  - `GET /api/mls-sync/status` - Returns last sync time and statistics
  - `POST /api/mls-sync/trigger` - Manually triggers a sync
- **Stats Tracking**: Sync results (total, successful, failed, duration) stored in integration settings

### Key NPM Packages
- **UI**: Radix UI primitives, shadcn/ui components, Lucide icons, react-icons
- **Forms**: react-hook-form with zod validation via @hookform/resolvers
- **Data**: @tanstack/react-query, drizzle-orm, drizzle-zod
- **Utilities**: date-fns, clsx, class-variance-authority, tailwind-merge

### Database
- PostgreSQL (configured via `DATABASE_URL` environment variable)
- Session storage via connect-pg-simple (available but sessions not currently implemented)