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
- **MLS Systems**: Fetch property data including photos, pricing, and details
- **Follow Up Boss (FUB)**: CRM integration for client data

### Key NPM Packages
- **UI**: Radix UI primitives, shadcn/ui components, Lucide icons, react-icons
- **Forms**: react-hook-form with zod validation via @hookform/resolvers
- **Data**: @tanstack/react-query, drizzle-orm, drizzle-zod
- **Utilities**: date-fns, clsx, class-variance-authority, tailwind-merge

### Database
- PostgreSQL (configured via `DATABASE_URL` environment variable)
- Session storage via connect-pg-simple (available but sessions not currently implemented)