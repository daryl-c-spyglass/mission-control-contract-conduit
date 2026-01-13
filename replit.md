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
- **Print Flyer Architecture**: Utilizes HTML/CSS and Puppeteer for server-side rendering to ensure pixel-identical output for previews and downloads.
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