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
- **Advanced Flyer Generator**: Full-page view within Marketing tab for professional flyer creation with auto-filled MLS data, AI-generated headlines, image upload with crop controls, live preview, optional grid overlay, auto-selection of MLS photos, and integration of agent marketing profiles. Exports to PNG or CMYK PDF.
- **CMA Presentation Player**: Fullscreen interactive slideshow with 33 widgets for client presentations, featuring responsive layout, Mapbox header, agent profile popover, sidebar navigation, keyboard controls, and mobile optimization. Uses Spyglass branding.
- **CMA Print Preview System**: Pre-download slide preview with data validation, single/grid view modes, zoom controls, and keyboard navigation. Ensures preview matches PDF output.
- **CMA PDF Export System**: Client-side PDF generation using `@react-pdf/renderer` in landscape letter format, covering all 33 widgets with specialized pages for dynamic content. Incorporates Spyglass brand colors and professional design elements.

### Technical Implementations
- **AI Integration**: GPT-4o-mini for social media tagline generation, MLS description summarization, and CMA cover letter generation with tone selection.
- **Agent Profile System**: Database-backed agent profiles with bio, default cover letter (with AI generation/enhancement), and social media links for CMA reports.
- **Agent Marketing Profile System**: Separate database profile for flyers and marketing materials, including agent photo, title, QR code, company logos, with API endpoints for management and server-side validation.
- **Automatic MLS Synchronization**: Background service for regular MLS data sync.
- **CMA (Comparative Market Analysis) System**: Database-backed storage, public share links, property data visualization, and configurable filters. Includes robust data flow for subject property and comparables, extensive field aliasing, and status normalization for consistency across various MLS formats.
- **Photo Upload System**: Photos uploaded via GCS client to private storage, served through a secure route. Server validates file type and size. Distinct handling for MLS photos and user uploads.
- **CMA Data Extraction Utilities**: Comprehensive client-side utilities (`client/src/lib/cma-data-utils.ts`) for safe data extraction and normalization from various MLS/Repliers API field structures, including price, square footage, DOM, lot acres, beds/baths, address, coordinates, and status. Includes calculation of CMA statistics and robust formatting functions.
- **CMA Resources System**: Agent-managed resources (documents, links) for CMA presentations, stored in a database with API endpoints for CRUD, reordering, and file uploads. Supports public access for shared CMAs.
- **User Notification Preferences System**: Per-user Slack notification settings stored in a database, with API endpoints and a reusable component for managing preferences.

## External Dependencies
- **Slack**: Team coordination.
- **Gmail**: Email routing.
- **MLS Systems (Repliers API)**: Property data, photos, pricing, and image insights.
- **Follow Up Boss (FUB)**: CRM integration.
- **Mapbox**: Interactive property maps.
- **PostgreSQL**: Primary database.
- **GPT-4o-mini**: AI services.
- **Turf.js**: Geospatial operations for CMA maps.