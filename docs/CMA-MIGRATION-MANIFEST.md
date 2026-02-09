# CMA Feature System - Migration Manifest

**Generated**: February 9, 2026
**Purpose**: Complete inventory of the Comparative Market Analysis (CMA) feature for potential migration, refactoring, or extraction.
**Scope**: READ-ONLY documentation of existing system. No code changes.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [Client Routes](#5-client-routes)
6. [File Inventory](#6-file-inventory)
7. [Component Hierarchy](#7-component-hierarchy)
8. [Presentation Builder Widgets](#8-presentation-builder-widgets)
9. [PDF Export System](#9-pdf-export-system)
10. [Utility Libraries](#10-utility-libraries)
11. [External Service Dependencies](#11-external-service-dependencies)
12. [Package Dependencies](#12-package-dependencies)
13. [Static Assets](#13-static-assets)
14. [Data Flow Diagrams](#14-data-flow-diagrams)
15. [Shared Schema Types](#15-shared-schema-types)
16. [Cross-Feature Touchpoints](#16-cross-feature-touchpoints)
17. [Migration Considerations](#17-migration-considerations)

---

## 1. Executive Summary

The CMA feature is a ~29,000+ line system spanning 90+ files that provides real estate agents with Comparative Market Analysis tools. It operates in two UI modes:

1. **CMA Tab** - Embedded analytics/stats view within transaction details (data analysis, maps, statistics, comparable property management)
2. **Presentation Builder** - Standalone client-facing slideshow with 33 widgets for listing presentations, Mapbox maps, PDF export, and public sharing via short links

### Scale Metrics

| Metric | Count |
|--------|-------|
| Total lines (core 22 files) | 17,109 |
| Total lines (all CMA files) | ~29,000+ |
| Total files | 90+ |
| Database tables | 5 (3 CMA-specific + 2 agent tables) |
| API routes | 35 (26 CMA-specific + 9 agent profile/resource shared) |
| Client routes | 6 |
| React components | 75+ |
| Presentation widgets | 33 (10 dynamic, 23 static) |
| PDF section components | 13 |
| Shared config files | 2 |
| Utility libraries | 6 |
| External packages (CMA-only) | 3 (@turf/turf, @dnd-kit/*, @react-pdf/renderer) |
| External packages (shared) | 4 (mapbox-gl, react-map-gl, recharts, qrcode) |
| Static image assets | 5 (1 CMA widget + 4 logos) |

---

## 2. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React)                          │
│                                                                 │
│  ┌──────────────────────┐   ┌────────────────────────────────┐  │
│  │    CMA Tab Mode      │   │   Presentation Builder Mode    │  │
│  │                      │   │                                │  │
│  │  cma-tab.tsx         │   │  CMAPresentationBuilder.tsx    │  │
│  │  CMAReport.tsx       │   │  CmaPresentationPlayer.tsx     │  │
│  │  CMABuilder.tsx      │   │  33 Widgets                    │  │
│  │  cma-map.tsx         │   │  PDF Export System             │  │
│  │  cma-stats-view.tsx  │   │  DrawingCanvas                │  │
│  │  cma-analytics.tsx   │   │  Print Preview                │  │
│  └────────┬─────────────┘   └──────────────┬─────────────────┘  │
│           │                                │                    │
│  ┌────────┴────────────────────────────────┴─────────────────┐  │
│  │                  Shared Utilities                         │  │
│  │  cma-data-utils.ts │ cma-map-data.ts │ cma-transformer.ts│  │
│  │  adjustmentCalculations.ts │ statusColors.ts              │  │
│  └────────────────────────────┬──────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────┴──────────────────────────────┐  │
│  │              Shared Config (shared/)                       │  │
│  │  cma-sections.ts (17 report sections)                     │  │
│  │  cma-defaults.ts (default configs)                        │  │
│  │  schema.ts (types + interfaces)                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ REST API
┌────────────────────────────────┴────────────────────────────────┐
│                        SERVER (Express)                         │
│                                                                 │
│  routes.ts ─► storage.ts ─► PostgreSQL (Drizzle ORM)           │
│       │                                                         │
│       └──► repliers.ts ─► Repliers API (MLS data)              │
│       └──► timeline.ts (CMA event logging)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 `cmas` Table (Primary CMA Record)

**File**: `shared/schema.ts` (line 234)

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | UUID, auto-generated |
| `transactionId` | varchar | FK to transactions table |
| `userId` | varchar | Owner of CMA |
| `name` | text | Required |
| `subjectPropertyId` | text | MLS number of subject property |
| `comparablePropertyIds` | jsonb (string[]) | MLS numbers of comparables |
| `propertiesData` | jsonb (any[]) | Full comparable property data (denormalized) |
| `searchCriteria` | jsonb | Saved search filters |
| `notes` | text | User notes |
| `publicLink` | text (unique) | Share token for public access |
| `brochure` | jsonb (CmaBrochure) | Listing brochure content |
| `adjustments` | jsonb (CmaAdjustmentsData) | Property value adjustment overrides |
| `expiresAt` | timestamp | Expiration for public share link |
| `createdAt` | timestamp | Auto-set |
| `updatedAt` | timestamp | Auto-set |

### 3.2 `cmaReportConfigs` Table (Presentation Settings)

**File**: `shared/schema.ts` (line 253)
**Relationship**: 1:1 with `cmas` via `cmaId` (unique constraint)

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | UUID, auto-generated |
| `cmaId` | varchar (unique) | FK to cmas.id |
| `includedSections` | jsonb (string[]) | Which sections are enabled |
| `sectionOrder` | jsonb (string[]) | Display order of sections |
| `coverLetterOverride` | text | Custom cover letter text |
| `layout` | text | `two_photos` / `single_photo` / `no_photos` |
| `template` | text | Default: `default` |
| `theme` | text | Default: `spyglass` |
| `photoLayout` | text | `first_dozen` / `all` / `ai_suggested` / `custom` |
| `mapStyle` | text | `streets` / `satellite` / `dark` |
| `showMapPolygon` | boolean | Default: true |
| `includeAgentFooter` | boolean | Default: true |
| `coverPageConfig` | jsonb (CoverPageConfig) | Cover page customization |
| `createdAt` | timestamp | Auto-set |
| `updatedAt` | timestamp | Auto-set |

### 3.3 `cmaReportTemplates` Table (Reusable Templates)

**File**: `shared/schema.ts` (line 273)

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | UUID |
| `userId` | varchar | Template owner |
| `name` | text | Required |
| `isDefault` | boolean | Default: false |
| `includedSections` | jsonb (string[]) | Mirror of reportConfigs columns |
| `sectionOrder` | jsonb (string[]) | Mirror of reportConfigs columns |
| `coverLetterOverride` | text | |
| `layout` | text | |
| `theme` | text | |
| `photoLayout` | text | |
| `mapStyle` | text | |
| `showMapPolygon` | boolean | |
| `includeAgentFooter` | boolean | |
| `coverPageConfig` | jsonb (CoverPageConfig) | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 3.4 `agentProfiles` Table (Agent Info for CMA/Marketing)

**File**: `shared/schema.ts` (line 378)

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | UUID |
| `userId` | text (unique) | |
| `title` | text | |
| `headshotUrl` | text | |
| `bio` | text | |
| `defaultCoverLetter` | text | |
| `facebookUrl` | text | |
| `instagramUrl` | text | |
| `linkedinUrl` | text | |
| `twitterUrl` | text | |
| `websiteUrl` | text | |
| `marketingCompany` | text | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 3.5 `agentResources` Table (Presentation Resources)

**File**: `shared/schema.ts` (line 397)

| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar (PK) | UUID |
| `userId` | text | Owner |
| `name` | text | Required |
| `type` | text | `link` or `file` |
| `url` | text | For external links |
| `fileUrl` | text | Deprecated, use fileData |
| `fileName` | text | Original file name |
| `fileData` | text | Base64 encoded content |
| `fileMimeType` | text | MIME type |
| `isActive` | boolean | Default: true |
| `displayOrder` | integer | Default: 0 |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### 3.6 Transaction Table CMA Fields (Inline CMA Data)

The `transactions` table also stores CMA data inline:

| Column | Type | Notes |
|--------|------|-------|
| `cmaData` | jsonb | Array of comparable properties |
| `cmaSource` | varchar(50) | Source indicator (e.g., `coordinate_fallback`) |
| `cmaGeneratedAt` | timestamp | When CMA data was generated |

---

## 4. API Routes

All routes defined in `server/routes.ts`. Routes marked (public) require no authentication.

### 4.1 CMA CRUD Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cmas` | Yes | List all CMAs |
| GET | `/api/cmas/:id` | Yes | Get CMA by ID |
| POST | `/api/cmas` | Yes | Create standalone CMA |
| PATCH | `/api/cmas/:id` | Yes | Update CMA |
| DELETE | `/api/cmas/:id` | Yes | Delete CMA (cascades to reportConfig) |

### 4.2 Transaction-CMA Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/transactions/:transactionId/cma` | Yes | Get CMA for transaction |
| POST | `/api/transactions/:transactionId/cma` | Yes | Create CMA linked to transaction |
| POST | `/api/transactions/:transactionId/cma/refresh` | Yes | Refresh CMA data from MLS |
| POST | `/api/transactions/:id/generate-cma-fallback` | Yes | Generate CMA via coordinate search for closed listings |
| DELETE | `/api/transactions/:id/cma` | Yes | Clear CMA data from transaction |

### 4.3 CMA Sharing Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/cmas/:id/share` | Yes | Generate public share link |
| DELETE | `/api/cmas/:id/share` | Yes | Revoke share link |
| GET | `/api/shared/cma/:token` | **No** | Public CMA access |
| GET | `/api/shared/cma/:token/resources` | **No** | Public agent resources |

### 4.4 CMA Configuration Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cmas/:id/report-config` | Yes | Get report configuration |
| PUT | `/api/cmas/:id/report-config` | Yes | Upsert report configuration |
| GET | `/api/cmas/:id/adjustments` | No | Get property adjustments |
| PUT | `/api/cmas/:id/adjustments` | Yes | Save property adjustments |

### 4.5 CMA Content Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cmas/:id/brochure` | No | Get listing brochure |
| POST | `/api/cmas/:id/brochure` | Yes | Save listing brochure |
| DELETE | `/api/cmas/:id/brochure` | Yes | Delete listing brochure |

### 4.6 CMA Analytics/Export Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cmas/:id/statistics` | No | Get computed statistics |
| GET | `/api/cmas/:id/timeline` | No | Get CMA timeline events |
| POST | `/api/cmas/:id/export-pdf` | Yes | Export CMA to PDF |
| GET | `/api/cma/report-sections` | No | Get available report section definitions |

### 4.7 Agent Profile Routes (Shared - Used by CMA and Settings)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agent/profile` | Yes | Get current agent profile |
| PUT | `/api/agent/profile` | Yes | Create/update agent profile |

### 4.8 Agent Resources Routes (Shared - Used by Presentation Builder and Settings)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/agent/resources` | Yes | List agent resources |
| POST | `/api/agent/resources` | Yes | Create resource |
| PATCH | `/api/agent/resources/:id` | Yes | Update resource |
| DELETE | `/api/agent/resources/:id` | Yes | Delete resource |
| PATCH | `/api/agent/resources/reorder` | Yes | Reorder resources |
| GET | `/api/agent/resources/:id/file` | **No** | Download resource file |
| POST | `/api/agent/resources/upload` | Yes | Upload resource file |

### 4.9 Debug Route

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/debug/cma-pdf-audit/:transactionId` | Yes | PDF data audit diagnostics |

### 4.10 MLS Sync CMA Integration (in transaction routes)

The MLS refresh route (`POST /api/transactions/:id/refresh-mls`, line ~1331) also syncs CMA data:
- Fetches comparables via `fetchSimilarListings()` or `searchNearbyComparables()`
- Updates `transaction.cmaData`
- Syncs CMA record's `propertiesData` if a linked CMA exists

The transaction GET route (`GET /api/transactions/:id`, line ~112) enriches CMA coordinates on-the-fly via `enrichCMAWithCoordinates()`.

---

## 5. Client Routes

**File**: `client/src/App.tsx`

| Path | Component | Auth | Description |
|------|-----------|------|-------------|
| `/cmas` | CMAs | Yes | CMA listing page |
| `/cmas/new` | CMANew | Yes | Create new CMA |
| `/cmas/:id` | CMADetailPage | Yes | CMA detail/edit view |
| `/cmas/:id/presentation` | CMAPresentationBuilder | Yes | Presentation builder |
| `/transactions/:transactionId/cma-presentation` | CMAPresentation | Yes | Presentation from transaction context |
| `/shared/cma/:token` | SharedCMAPage | **No** | Public shared CMA view |

---

## 6. File Inventory

### 6.1 Pages (client/src/pages/)

| File | Lines | Description |
|------|-------|-------------|
| CMAs.tsx | 150 | CMA listing page with grid/table views |
| CMANew.tsx | 287 | Create new CMA form |
| CMADetailPage.tsx | 925 | CMA detail page with tabs (Stats, Map, Report, Presentation) |
| CMAPresentationBuilder.tsx | 1,105 | Full presentation builder with section management |
| CMAPresentation.tsx | 420 | Transaction-context presentation entry point |
| shared-cma.tsx | 260 | Public shared CMA viewer |
| **Subtotal** | **3,147** | |

### 6.2 Core Components (client/src/components/)

| File | Lines | Description |
|------|-------|-------------|
| cma-tab.tsx | 1,609 | Main CMA tab embedded in transaction details |
| CMAReport.tsx | 4,030 | CMA report generator/viewer with all sections |
| CMABuilder.tsx | 2,740 | CMA comparable selection and configuration |
| cma-map.tsx | 1,151 | Mapbox map with property markers and polygon |
| cma-analytics.tsx | 248 | Analytics preview cards for dashboard |
| cma-stats-view.tsx | 1,034 | Statistics dashboard with charts |
| cma-source-indicator.tsx | 147 | Source badge indicator component |
| SharedCMAView.tsx | 133 | Shared CMA viewer wrapper |
| **Subtotal** | **11,092** | |

### 6.3 CMA Sub-Components (client/src/components/cma/)

| File | Lines | Description |
|------|-------|-------------|
| cma-action-bar.tsx | 174 | Action toolbar (share, export, etc.) |
| CMAActionButtons.tsx | 268 | Action button group |
| CMAEmailShareDialog.tsx | 208 | Email sharing dialog |
| CMAFiltersPanel.tsx | 467 | Comparable search filters |
| CMANotesDialog.tsx | 120 | Notes editing dialog |
| CMAPreviewBanner.tsx | 234 | Preview mode banner |
| CMAShareDialog.tsx | 235 | Share link dialog |
| ExpandedPreviewModal.tsx | 60 | Expanded preview overlay |
| LivePreviewPanel.tsx | 424 | Live preview sidebar panel |
| PreviewSection.tsx | 110 | Section preview wrapper |
| CoverPhotoGrid.tsx | 358 | Cover photo selection grid |
| **Subtotal** | **2,658** | |

### 6.4 Preview Sections (client/src/components/cma/preview-sections/)

| File | Lines | Description |
|------|-------|-------------|
| SummaryComparablesPreview.tsx | 44 | Summary table preview |
| AdjustmentsPreview.tsx | 75 | Adjustments preview |
| MapAllListingsPreview.tsx | 334 | Map preview component |
| PricePerSqftChartPreview.tsx | 59 | Price/sqft chart preview |
| **Subtotal** | **512** | |

### 6.5 Presentation Components (client/src/components/presentation/)

| File | Lines | Description |
|------|-------|-------------|
| CMAMapPreview.tsx | 52 | Map preview thumbnail |
| CMAPreviewContent.tsx | 308 | Report preview content renderer |
| MapboxCMAMap.tsx | 228 | Mapbox map for presentations |
| AdjustmentsSection.tsx | 420 | Property adjustments section |
| CoverLetterEditor.tsx | 295 | Cover letter editor |
| CoverPageEditor.tsx | 161 | Cover page customization |
| ListingBrochureContent.tsx | 188 | Listing brochure layout |
| ReportSections.tsx | 287 | Report sections manager |
| ExpandedPreviewModal.tsx | 42 | Expanded view modal |
| PhotoSelectionModal.tsx | 130 | Photo picker modal |
| **Subtotal** | **2,111** | |

### 6.6 Presentation Builder System (client/src/components/cma-presentation/)

| File | Lines | Description |
|------|-------|-------------|
| **Player** | | |
| CmaPresentationPlayer.tsx | 206 | Main slideshow player orchestrator |
| index.ts | 8 | Barrel exports |
| types/index.ts | 74 | TypeScript interfaces |
| **Components** | | |
| Header.tsx | 213 | Presentation header with agent profile popover |
| BottomNavigation.tsx | 165 | Slide navigation bar |
| SlideViewer.tsx | 276 | Slide rendering engine |
| SectionGrid.tsx | 73 | Section overview grid |
| SectionCard.tsx | 113 | Individual section card |
| Sidebar.tsx | 149 | Sidebar navigation |
| DrawingCanvas.tsx | 121 | Annotation drawing canvas |
| CmaPrintPreview.tsx | 385 | Pre-download print preview |
| PdfDownloadButton.tsx | 224 | PDF generation trigger |
| preview-slides.tsx | 681 | Slide preview rendering |
| **Constants** | | |
| constants/widgets.ts | 344 | 33 widget definitions |
| **Hooks** | | |
| hooks/useTheme.ts | 28 | Theme toggle hook |
| **PDF Export** | | |
| pdf/CmaPdfDocument.tsx | 980 | Presentation PDF renderer (@react-pdf) |
| pdf/styles.ts | 592 | PDF stylesheet definitions |
| **Subtotal** | **4,632** | |

### 6.7 Presentation Widgets (client/src/components/cma-presentation/widgets/)

| File | Lines | Description |
|------|-------|-------------|
| AgentResumeWidget.tsx | 78 | Agent bio/credentials slide |
| ListingWithSpyglassWidget.tsx | 43 | YouTube embed slide |
| ClientTestimonialsWidget.tsx | 86 | Google reviews display |
| MarketingWidget.tsx | 30 | Marketing overview slide |
| CompsWidget.tsx | 694 | Comparable properties comparison |
| TimeToSellWidget.tsx | 927 | Days on market analysis chart |
| SuggestedPriceWidget.tsx | 612 | Price recommendation with map |
| AveragePriceAcreWidget.tsx | 635 | Price per acre analysis |
| SpyglassResourcesWidget.tsx | 211 | Agent resources/links |
| ListingActionPlanWidget.tsx | 49 | Listing action plan text |
| StaticImageWidget.tsx | 49 | Static image slide renderer |
| PropertyDetailModal.tsx | 355 | Property detail popup |
| **Subtotal** | **3,769** | |

### 6.8 PDF Section Components (client/src/components/pdf/)

Uses `@react-pdf/renderer` for server-quality PDF generation.

| File | Lines | Description |
|------|-------|-------------|
| CMAPdfDocument.tsx | 138 | Root PDF document wrapper |
| CoverPageSection.tsx | 111 | Cover page |
| CoverLetterSection.tsx | 87 | Cover letter page |
| AgentResumeSection.tsx | 108 | Agent resume page |
| OurCompanySection.tsx | 89 | Company info page |
| WhatIsCMASection.tsx | 101 | CMA explanation page |
| ContactMeSection.tsx | 90 | Contact information page |
| ListingBrochureSection.tsx | 111 | Property brochure page |
| SummaryComparablesSection.tsx | 125 | Comparable summary table |
| ComparableStatsSection.tsx | 161 | Statistics page |
| PropertyDetailsSection.tsx | 160 | Individual property pages |
| ChapterHeaderSection.tsx | 70 | Chapter divider page |
| styles.ts | 254 | Shared PDF styles |
| **Subtotal** | **1,605** | |

### 6.9 Utility Libraries (client/src/lib/)

| File | Lines | Description |
|------|-------|-------------|
| cma-data-utils.ts | 653 | Data extraction, normalization, formatting |
| cma-map-data.ts | 531 | Turf.js polygon generation, GeoJSON conversion |
| cma-section-sources.ts | 121 | Section data source mapping |
| cma-transformer.ts | 179 | Transform raw data to report format |
| adjustmentCalculations.ts | 174 | Property value adjustment math |
| image-to-base64.ts | 84 | Image URL to base64 converter (for PDF) |
| statusColors.ts | 56 | Status color mapping |
| **Subtotal** | **1,798** | |

### 6.10 Shared Config (shared/)

| File | Lines | Description |
|------|-------|-------------|
| cma-sections.ts | 158 | 17 report section definitions |
| cma-defaults.ts | 42 | Default configs (cover page, adjustments, layouts) |
| **Subtotal** | **200** | |

### 6.11 Server Files (CMA-relevant portions)

| File | Total Lines | CMA Lines (est.) | Description |
|------|-------------|-------------------|-------------|
| routes.ts | 6,141 | ~800 | CMA API routes |
| storage.ts | 834 | ~130 | CMA storage interface + implementation |
| repliers.ts | 1,761 | ~250 | CMA data fetching functions |
| repliers-sync.ts | 256 | ~20 | MLS sync with CMA data updates |
| services/timeline.ts | - | ~10 | CMA event logging |
| **CMA subtotal** | | **~1,210** | |

### 6.12 Additional Supporting Files

| File | Lines | CMA-Specific? | Description |
|------|-------|---------------|-------------|
| hooks/useAgentProfile.ts | 89 | Shared | Agent profile data hook |
| components/StatusFilterTabs.tsx | 57 | Shared | Status filter tabs |
| components/VisualMatchPanel.tsx | 376 | Shared | Visual match panel |

---

## 7. Component Hierarchy

### 7.1 CMA Tab Mode (Embedded in Transaction Details)

```
transaction-details.tsx
├── TabsTrigger value="cma"
├── CMAAnalytics (cma-analytics.tsx) — Dashboard preview cards
└── CMATab (cma-tab.tsx)
    ├── CMASourceIndicator (cma-source-indicator.tsx)
    ├── CMAStatsView (cma-stats-view.tsx)
    │   └── recharts (BarChart, LineChart, ScatterChart)
    ├── CMAMap (cma-map.tsx)
    │   └── mapbox-gl / react-map-gl
    ├── CMAReport (CMAReport.tsx)
    │   ├── CoverPageEditor
    │   ├── CoverLetterEditor
    │   ├── ListingBrochureContent
    │   ├── AdjustmentsSection
    │   ├── CMAPreviewContent
    │   ├── ReportSections
    │   └── CMAPdfDocument (PDF export)
    ├── CMABuilder (CMABuilder.tsx)
    │   ├── CMAFiltersPanel
    │   ├── CMAActionButtons
    │   ├── CMAShareDialog
    │   ├── CMAEmailShareDialog
    │   ├── CMANotesDialog
    │   └── LivePreviewPanel
    │       └── PreviewSection
    │           ├── SummaryComparablesPreview
    │           ├── AdjustmentsPreview
    │           ├── MapAllListingsPreview
    │           └── PricePerSqftChartPreview
    └── CMAActionBar (cma-action-bar.tsx)
```

### 7.2 Presentation Builder Mode (Standalone)

```
CMAPresentationBuilder.tsx (page)
├── @dnd-kit (drag-and-drop section ordering)
├── CmaPresentationPlayer.tsx
│   ├── Header.tsx (agent profile popover)
│   ├── SlideViewer.tsx
│   │   ├── AgentResumeWidget
│   │   ├── ListingWithSpyglassWidget (YouTube embed)
│   │   ├── ClientTestimonialsWidget
│   │   ├── MarketingWidget
│   │   ├── CompsWidget
│   │   │   └── PropertyDetailModal
│   │   ├── TimeToSellWidget (recharts)
│   │   ├── SuggestedPriceWidget (mapbox-gl)
│   │   ├── AveragePriceAcreWidget (recharts)
│   │   ├── SpyglassResourcesWidget
│   │   ├── ListingActionPlanWidget
│   │   └── StaticImageWidget (23 static slides)
│   ├── BottomNavigation.tsx
│   ├── Sidebar.tsx
│   ├── SectionGrid.tsx / SectionCard.tsx
│   └── DrawingCanvas.tsx
├── CmaPrintPreview.tsx
└── PdfDownloadButton.tsx
    └── CmaPdfDocument.tsx (@react-pdf/renderer)
        └── pdf/styles.ts
```

### 7.3 Public Shared View

```
shared-cma.tsx (page)
└── SharedCMAView.tsx
    └── CmaPresentationPlayer.tsx (same as above, read-only mode)
```

---

## 8. Presentation Builder Widgets

### 8.1 Widget Definitions

**File**: `client/src/components/cma-presentation/constants/widgets.ts` (344 lines)

33 total widgets defined in `WIDGETS` array. Each has: `id`, `number`, `title`, `icon`, `type`, `component?`, `imagePath?`, `videoUrl?`.

### 8.2 Dynamic Widgets (Data-Driven)

| # | ID | Component | Data Source | Lines |
|---|-----|-----------|-------------|-------|
| 1 | `agent_resume` | AgentResumeWidget | Agent profile | 78 |
| 2 | `listing_with_spyglass` | ListingWithSpyglassWidget | YouTube URL | 43 |
| 3 | `client_testimonials` | ClientTestimonialsWidget | Google Reviews / samples | 86 |
| 4 | `marketing` | MarketingWidget | Static marketing text | 30 |
| 5 | `comps` | CompsWidget | CMA comparables data | 694 |
| 6 | `time_to_sell` | TimeToSellWidget | Days on market stats | 927 |
| 7 | `suggested_list_price` | SuggestedPriceWidget | Price analysis + Mapbox | 612 |
| 8 | `listing_action_plan` | ListingActionPlanWidget | Static text | 49 |
| 9 | `spyglass_resources` | SpyglassResourcesWidget | Agent resources DB | 211 |
| 10 | `average_price_acre` | AveragePriceAcreWidget | Lot size analysis | 635 |

### 8.3 Static Image Widgets (11-33)

Widgets 11-33 are static image slides. Only widget 11 (`home_selling_system`) has a mapped image path (`/cma-widgets/marketing-infographic.png`). The remainder (12-33) reference image paths `/cma-widgets/2.png` through `/cma-widgets/24.png` which are defined in widget constants but may rely on uploaded assets.

### 8.4 Widget Type Taxonomy

| Type | Count | Rendering |
|------|-------|-----------|
| `dynamic` | 7 | Custom React components with data |
| `static` | 23 | Static image display (`StaticImageWidget`) |
| `youtube` | 1 | YouTube iframe embed |
| `text` | 2 | Text content display |

---

## 9. PDF Export System

Two parallel PDF export systems exist:

### 9.1 CMA Report PDF (CMA Tab)

**Orchestrator**: `client/src/components/pdf/CMAPdfDocument.tsx` (138 lines)
**13 section components** in `client/src/components/pdf/`:
- CoverPageSection, CoverLetterSection, AgentResumeSection
- OurCompanySection, WhatIsCMASection, ContactMeSection
- ListingBrochureSection, SummaryComparablesSection
- PropertyDetailsSection, ComparableStatsSection
- ChapterHeaderSection
- Shared styles.ts (254 lines)

**Technology**: `@react-pdf/renderer` with `Document`, `Page`, `View`, `Text`, `Image` components
**Triggered from**: CMAReport.tsx via export actions

### 9.2 Presentation PDF (Presentation Builder)

**Orchestrator**: `client/src/components/cma-presentation/pdf/CmaPdfDocument.tsx` (980 lines)
**Styles**: `client/src/components/cma-presentation/pdf/styles.ts` (592 lines)
**Button**: `client/src/components/cma-presentation/components/PdfDownloadButton.tsx` (224 lines)
**Preview**: `client/src/components/cma-presentation/components/CmaPrintPreview.tsx` (385 lines)

**Technology**: Same `@react-pdf/renderer` but landscape letter format, covering all 33 widgets with specialized pages. Uses Spyglass brand colors.

---

## 10. Utility Libraries

### 10.1 cma-data-utils.ts (653 lines)

**Path**: `client/src/lib/cma-data-utils.ts`

Safe data extraction and normalization from various MLS/Repliers API field structures:
- `extractPrice()` - Parse price from multiple field names
- `extractSqft()` - Square footage with fallbacks
- `extractDOM()` - Days on market
- `extractLotAcres()` - Lot size with unit conversion
- `extractBedsBaths()` - Bedroom/bathroom counts
- `extractAddress()` - Full address assembly
- `extractCoordinates()` - Lat/lng from nested objects
- `extractStatus()` - Status normalization (Active/Pending/Closed/Leasing)
- `calculateCMAStatistics()` - Aggregate statistics computation
- Formatting functions for currency, numbers, dates

### 10.2 cma-map-data.ts (531 lines)

**Path**: `client/src/lib/cma-map-data.ts`

Geospatial operations using Turf.js:
- `generatePropertyPolygon()` - Convex hull polygon around properties
- `generateMapBounds()` - Calculate map viewport bounds
- `propertiesToGeoJSON()` - Convert properties to GeoJSON FeatureCollection
- `calculatePolygonArea()` - Area calculations
- `generateCircularSearchArea()` - Circular search radius visualization

### 10.3 cma-transformer.ts (179 lines)

**Path**: `client/src/lib/cma-transformer.ts`

Transform raw CMA/MLS data to the `CMAReportData` format expected by report components:
- `transformToCMAReportData()` - Main transformation function
- Maps raw property fields to standardized `CMASubjectProperty` and `CMAComparable` interfaces

### 10.4 adjustmentCalculations.ts (174 lines)

**Path**: `client/src/lib/adjustmentCalculations.ts`

Property value adjustment calculations:
- `calculateAdjustments()` - Compute adjusted values based on configurable rates
- Default rates: sqft ($50/unit), bedroom ($10K), bathroom ($7.5K), pool ($25K), garage ($5K/space), year built ($1K/yr), lot size ($2/sqft)

### 10.5 cma-section-sources.ts (121 lines)

**Path**: `client/src/lib/cma-section-sources.ts`

Maps report section IDs to their data dependencies, indicating which data fields each section requires.

### 10.6 statusColors.ts (56 lines)

**Path**: `client/src/lib/statusColors.ts`

Centralized status-to-color mapping for CMA views:
- Active = Green (#22c55e)
- Pending = Orange (#f97316)
- Closed = Red (#ef4444)
- Leasing = Purple (#a855f7)
- Subject = Blue (#3b82f6)
- Unknown = Gray (#6b7280)

---

## 11. External Service Dependencies

### 11.1 Repliers API (MLS Data Provider)

**File**: `server/repliers.ts`

Three CMA-specific functions:

| Function | Line | Purpose | API Endpoint |
|----------|------|---------|--------------|
| `fetchSimilarListings()` | 631 | Get comparables by MLS number | `/listings/similar` |
| `enrichCMAWithCoordinates()` | 770 | Backfill lat/lng for existing comparables | `/listings` (per property) |
| `searchNearbyComparables()` | 1491 | Geo-search comparables by coordinates | `/listings` (POST with polygon) |

**Supporting type**: `CMASearchFilters` (line 1445) - radius, price range, sqft range, year built, beds, baths, statuses, sold within months, max results.

**Data normalization**: Each function normalizes Repliers API response to `CMAComparable` interface including address assembly, photo URL normalization, lot size calculation, coordinate extraction, and status mapping.

### 11.2 Mapbox

**Client-side only** via `mapbox-gl` and `react-map-gl`.

Used in:
- `cma-map.tsx` - Main CMA map with property markers and polygon
- `MapboxCMAMap.tsx` - Presentation map component
- `MapAllListingsPreview.tsx` - Map preview in report builder
- `SuggestedPriceWidget.tsx` - Mini map in price suggestion slide

**Environment variable**: `VITE_MAPBOX_TOKEN`

### 11.3 OpenAI (GPT-4o-mini)

Used in CMA context for:
- Cover letter generation/enhancement (via CMA report configuration)
- MLS description summarization

Not directly imported in CMA files but called through API routes.

---

## 12. Package Dependencies

### 12.1 CMA-Only Packages (No Other Feature Uses These)

| Package | Version | Used By | Purpose |
|---------|---------|---------|---------|
| `@turf/turf` | ^7.3.2 | cma-map-data.ts only | Geospatial polygon generation, area calculations |
| `@dnd-kit/core` | ^6.3.1 | CMAPresentationBuilder.tsx only | Drag-and-drop section ordering |
| `@dnd-kit/sortable` | ^10.0.0 | CMAPresentationBuilder.tsx only | Sortable section list |

### 12.2 CMA-Primary Packages (CMA is dominant consumer)

| Package | Version | CMA Files | Non-CMA Files | Purpose |
|---------|---------|-----------|---------------|---------|
| `@react-pdf/renderer` | ^4.3.2 | 15 files | main.tsx (font registration) | PDF document generation |
| `recharts` | ^2.15.4 | cma-stats-view.tsx, TimeToSellWidget, AveragePriceAcreWidget | chart.tsx (base component) | Charts and graphs |

### 12.3 Shared Packages (Used by CMA and other features)

| Package | Version | CMA Usage | Other Usage |
|---------|---------|-----------|-------------|
| `mapbox-gl` | ^3.18.0 | cma-map.tsx, SuggestedPriceWidget, MapboxCMAMap | mapbox-property-map.tsx (MLS tab) |
| `react-map-gl` | ^8.1.0 | cma-map.tsx, MapAllListingsPreview | mapbox-property-map.tsx |
| `qrcode` | ^1.5.4 | CMA share links | Flyer QR codes |

---

## 13. Static Assets

### 13.1 CMA Widget Images

**Directory**: `client/public/cma-widgets/`
- `marketing-infographic.png` - Used by widget #11 (Home Selling System)

### 13.2 Brand Logos

**Directory**: `client/public/logos/`
- `spyglass-logo-white.png` - Presentation header/footer (dark backgrounds)
- `spyglass-logo-square.png` - Presentation square logo
- `SpyglassRealty_Logo_Black.png` - PDF/print on light backgrounds
- `SpyglassRealty_Logo_White.png` - PDF/print on dark backgrounds

### 13.3 Logo Constants

Defined in `constants/widgets.ts`:
```
SPYGLASS_LOGO_WHITE = '/logos/spyglass-logo-white.png'
SPYGLASS_LOGO_BLACK = '/logos/spyglass-logo-black.png'
SPYGLASS_LOGO_SQUARE = '/logos/spyglass-logo-square.png'
LRE_SGR_WHITE = '/logos/lre-sgr-white.png'
LRE_SGR_BLACK = '/logos/lre-sgr-black.png'
```

---

## 14. Data Flow Diagrams

### 14.1 CMA Data Acquisition

```
Repliers API
    │
    ├──► fetchSimilarListings(mlsNumber)     ── GET /listings/similar
    │        └─► CMAComparable[]
    │
    ├──► searchNearbyComparables(lat, lng)    ── POST /listings (polygon search)
    │        └─► CMAComparable[]
    │
    └──► enrichCMAWithCoordinates(comps)      ── GET /listings/:mls per comp
             └─► CMAComparable[] (with lat/lng filled)
                    │
                    ▼
            ┌───────────────┐
            │  PostgreSQL   │
            │               │
            │  transactions │ ◄── cmaData (jsonb), cmaSource, cmaGeneratedAt
            │  cmas         │ ◄── propertiesData (jsonb), comparablePropertyIds
            │  cmaConfigs   │ ◄── Report settings
            │  cmaTemplates │ ◄── Reusable report configs
            └───────┬───────┘
                    │
                    ▼
            REST API (/api/cmas/*, /api/transactions/*/cma)
                    │
                    ▼
            React Client (TanStack Query)
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
 CMA Tab    Presentation     Shared View
 (Analysis)  Builder         (Public Link)
             (Slideshow)
```

### 14.2 CMA Report Generation Flow

```
CMAReport.tsx
    │
    ├── Loads: CMA data, Agent Profile, Report Config
    │
    ├── cma-transformer.ts
    │       └── transformToCMAReportData() → CMAReportData
    │
    ├── cma-data-utils.ts
    │       └── extractPrice(), extractSqft(), calculateCMAStatistics()
    │
    ├── Renders: Section-based report view
    │       ├── CoverPageEditor / CoverLetterEditor
    │       ├── AdjustmentsSection
    │       ├── CMAPreviewContent
    │       └── ReportSections
    │
    └── PDF Export: CMAPdfDocument.tsx
            └── 13 @react-pdf sections → downloadable PDF
```

### 14.3 Presentation Builder Flow

```
CMAPresentationBuilder.tsx
    │
    ├── Loads: CMA, Transaction, Agent Profile, Report Config
    │
    ├── Widget System:
    │   └── WIDGETS[] (33 definitions)
    │       ├── Dynamic widgets → dedicated components
    │       └── Static widgets → StaticImageWidget
    │
    ├── Section Management (@dnd-kit):
    │   └── Drag-to-reorder, toggle enable/disable
    │
    ├── Slideshow Player:
    │   └── CmaPresentationPlayer → SlideViewer → Widget Components
    │
    ├── Print Preview:
    │   └── CmaPrintPreview (validation + grid/single view)
    │
    └── PDF Export:
        └── PdfDownloadButton → CmaPdfDocument (@react-pdf, landscape)
```

---

## 15. Shared Schema Types

### 15.1 Core CMA Types (from shared/schema.ts)

```typescript
// CMA record type
type Cma = typeof cmas.$inferSelect;
type InsertCma = z.infer<typeof insertCmaSchema>;

// Report configuration
type CmaReportConfig = typeof cmaReportConfigs.$inferSelect;
type InsertCmaReportConfig = z.infer<typeof insertCmaReportConfigSchema>;

// Report templates
type CmaReportTemplate = typeof cmaReportTemplates.$inferSelect;
type InsertCmaReportTemplate = z.infer<typeof insertCmaReportTemplateSchema>;
```

### 15.2 CMAComparable Interface (shared/schema.ts line 631)

```typescript
interface CMAComparable {
  address: string;
  price: number;
  listPrice?: number;
  closePrice?: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | string;
  daysOnMarket: number;
  distance: number;
  imageUrl?: string;
  photos?: string[];
  mlsNumber?: string;
  status?: string;
  listDate?: string;
  closeDate?: string;
  yearBuilt?: number;
  map?: { latitude: number; longitude: number; };
}
```

### 15.3 CMA Brochure Type (shared/schema.ts line 173)

```typescript
interface CmaBrochure {
  // Listing brochure data stored as JSON
}
```

### 15.4 CMA Adjustment Types (shared/schema.ts lines 183-230)

```typescript
interface CmaAdjustmentRates {
  sqftPerUnit: number;       // Default: 50
  bedroomValue: number;      // Default: 10000
  bathroomValue: number;     // Default: 7500
  poolValue: number;         // Default: 25000
  garagePerSpace: number;    // Default: 5000
  yearBuiltPerYear: number;  // Default: 1000
  lotSizePerSqft: number;    // Default: 2
}

interface CmaComparableAdjustmentOverrides {
  // Per-comparable manual overrides
}

interface CmaAdjustmentsData {
  rates: CmaAdjustmentRates;
  overrides: Record<string, CmaComparableAdjustmentOverrides>;
}
```

### 15.5 Cover Page Config (shared/schema.ts)

```typescript
interface CoverPageConfig {
  title: string;              // Default: "Comparative Market Analysis"
  subtitle: string;           // Default: "Prepared exclusively for you"
  showDate: boolean;
  showAgentPhoto: boolean;
  background: string;         // "none" | other options
}
```

### 15.6 Presentation Types (cma-presentation/types/index.ts)

```typescript
interface WidgetDefinition { id, number, title, subtitle?, icon, type, imagePath?, component?, badge?, videoUrl? }
interface AgentProfile { name, company, photo?, phone?, email?, bio? }
interface CmaProperty { id, mlsNumber?, address, city, state, zipCode, price, sqft, beds, baths, ... }
interface CmaPresentationData { propertyAddress, mlsNumber, preparedFor?, agent, subjectProperty?, comparables[], ... }
```

### 15.7 Report Section Types (shared/cma-sections.ts)

```typescript
interface CmaSectionConfig { id, name, category, defaultEnabled, icon, editable? }

// 17 sections in 3 categories:
// Introduction: cover_page, listing_brochure, cover_letter, agent_resume, our_company, what_is_cma, contact_me
// Listings: map_all_listings, listings_header, summary_comparables, property_details, property_photos, adjustments
// Analysis: analysis_header, online_valuation, price_per_sqft, comparable_stats
```

---

## 16. Cross-Feature Touchpoints

These are points where the CMA feature connects to non-CMA parts of the application:

### 16.1 Transaction Details Integration

- **File**: `client/src/components/transaction-details.tsx`
- CMA tab is one of the main tabs in transaction details
- CMA analytics preview cards shown on Overview tab
- `cmaData`, `cmaSource`, `cmaGeneratedAt` fields on Transaction model

### 16.2 Create Transaction Dialog

- **File**: `client/src/components/create-transaction-dialog.tsx`
- References CMA data during transaction creation flow

### 16.3 MLS Sync System

- **File**: `server/repliers-sync.ts`
- MLS data refresh syncs comparables to both `transaction.cmaData` and `cma.propertiesData`

### 16.4 Timeline Service

- **File**: `server/services/timeline.ts`
- Logs CMA events: `cma_created`, `cma_updated`, `cma_shared`, `cma_share_revoked`

### 16.5 Activity Categories

- **File**: `shared/schema.ts` (line 93-94)
- Activity types include: `cma_created`, `cma_shared`
- Activity categories include: `cma`

### 16.6 Settings Page

- **File**: `client/src/pages/settings.tsx`
- Agent profile management (used by CMA reports)
- Agent resources management (used by Presentation Builder)

### 16.7 Admin Page

- **File**: `client/src/pages/admin.tsx`
- May reference CMA data for admin views

### 16.8 Agent Profile Hook

- **File**: `client/src/hooks/useAgentProfile.ts` (89 lines)
- Shared hook used by CMA reports and other features

### 16.9 Storage Interface

- **File**: `server/storage.ts`
- CMA storage methods (lines 98-118): getCma, getCmaByTransaction, getCmaByShareToken, getCmasByUser, getAllCmas, createCma, updateCma, deleteCma, getCmaReportConfig, upsertCmaReportConfig, deleteCmaReportConfig, getCmaReportTemplates, getCmaReportTemplate, createCmaReportTemplate, updateCmaReportTemplate, deleteCmaReportTemplate

### 16.10 Status Utilities

- **File**: `shared/lib/listings.ts`
- `isRentalOrLease()` and `excludeRentals()` used in CMA data filtering

### 16.11 Status Colors

- **File**: `client/src/lib/utils/status-colors.ts`
- `getStatusBadgeStyle()`, `getStatusLabel()`, `getStatusColor()` used in CMA views

---

## 17. Migration Considerations

### 17.1 Extraction Complexity: HIGH

The CMA feature is deeply integrated with the transaction system. Key challenges:

1. **Dual storage model**: CMA data exists both inline on transactions (`cmaData` field) and in dedicated `cmas` table. Both must be synchronized.
2. **Shared agent profile system**: Agent profiles and resources are used by both CMA and marketing features (flyers).
3. **MLS sync coupling**: The MLS refresh route updates both transaction CMA data and CMA records.
4. **Shared packages**: Mapbox, recharts, and qrcode are used by non-CMA features.

### 17.2 Clean Extraction Candidates (CMA-Only)

These can be extracted without impacting other features:

- `@turf/turf` package and `cma-map-data.ts`
- `@dnd-kit/*` packages (only used in CMAPresentationBuilder)
- All files in `client/src/components/cma-presentation/` (entire Presentation Builder)
- All files in `client/src/components/cma/` (CMA sub-components)
- All files in `client/src/components/pdf/` (CMA PDF sections)
- `cma-data-utils.ts`, `cma-transformer.ts`, `cma-section-sources.ts`, `adjustmentCalculations.ts`
- `shared/cma-sections.ts`, `shared/cma-defaults.ts`
- All CMA pages except shared-cma.tsx (which has public URL implications)

### 17.3 Shared Dependencies Requiring Careful Handling

| Dependency | CMA Usage | Other Usage |
|------------|-----------|-------------|
| Agent Profiles table | CMA reports, presentations | Settings page, marketing |
| Agent Resources table | Presentation builder | Settings page |
| Mapbox | CMA maps | MLS property map |
| recharts | CMA stats/charts | Potentially chart.tsx base |
| Transaction model | cmaData, cmaSource, cmaGeneratedAt | Core transaction fields |
| Activity/Timeline | CMA event types | All other event types |
| StatusFilterTabs | CMA filtering | Potentially elsewhere |
| useAgentProfile hook | CMA report/presentation | Settings |

### 17.4 Database Migration Notes

If extracting CMA:
1. The `cmas`, `cmaReportConfigs`, `cmaReportTemplates` tables can be dropped
2. The `cmaData`, `cmaSource`, `cmaGeneratedAt` columns on `transactions` table should be removed
3. `agentProfiles` and `agentResources` tables are shared - cannot remove without impacting Settings/Marketing
4. Activity log entries with `category: "cma"` can be cleaned up

### 17.5 API Route Removal Checklist

All routes in Section 4 can be removed. Additionally:
- Remove CMA enrichment logic from `GET /api/transactions/:id` (line ~112-133)
- Remove CMA sync logic from `POST /api/transactions/:id/refresh-mls` (line ~1331-1418)
- Remove `POST /api/transactions/:id/generate-cma-fallback`
- Remove `DELETE /api/transactions/:id/cma`
- Remove `GET /api/debug/cma-pdf-audit/:transactionId`

### 17.6 Environment Variables

| Variable | CMA-Specific? | Notes |
|----------|---------------|-------|
| `VITE_MAPBOX_TOKEN` | Shared | Also used by MLS property map |
| `REPLIERS_API_KEY` | Shared | Used by all MLS operations |

### 17.7 Estimated Removal Impact

| Category | Lines to Remove |
|----------|----------------|
| Client pages | ~3,147 |
| Client components (CMA-specific) | ~20,600 |
| Client utilities | ~1,798 |
| Shared configs | ~200 |
| Server routes/storage/repliers | ~1,210 |
| Schema definitions | ~300 |
| **Total** | **~27,255** |

Packages that can be uninstalled if CMA is fully removed:
- `@turf/turf`
- `@dnd-kit/core`
- `@dnd-kit/sortable`
- `@react-pdf/renderer` (verify no other consumers first)

---

*End of CMA Migration Manifest*
