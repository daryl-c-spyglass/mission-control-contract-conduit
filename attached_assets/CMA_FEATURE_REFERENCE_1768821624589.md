# CMA Feature Reference Documentation
Generated from Client Data Portal for replication

## 1. Database Schema

### Table: `cmas`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | varchar | `gen_random_uuid()` | Primary key |
| userId | varchar | null | References users.id (nullable for unauthenticated) |
| name | text | NOT NULL | CMA name/title |
| subjectPropertyId | text | null | ID of the subject property |
| comparablePropertyIds | json | NOT NULL | Array of comparable property IDs |
| propertiesData | json | null | Full property data from Repliers/MLS |
| searchCriteria | json | null | Search criteria used to find comparables |
| notes | text | null | Agent notes |
| publicLink | text | null | Unique share token |
| brochure | json | null | Listing brochure (CmaBrochure type) |
| adjustments | json | null | Property value adjustments (CmaAdjustmentsData type) |
| expiresAt | timestamp | null | Expiration date (no longer used - links are permanent) |
| createdAt | timestamp | defaultNow() | Creation timestamp |
| updatedAt | timestamp | defaultNow() | Last update timestamp |

### Table: `cma_report_configs`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | varchar | `gen_random_uuid()` | Primary key |
| cmaId | varchar | NOT NULL | References cmas.id (unique, cascade delete) |
| includedSections | json | null | Array of enabled section IDs |
| sectionOrder | json | null | Custom section ordering |
| coverLetterOverride | text | null | Custom cover letter text |
| layout | text | "two_photos" | Layout: 'two_photos', 'single_photo', 'no_photos' |
| template | text | "default" | Template name |
| theme | text | "spyglass" | Theme name |
| photoLayout | text | "first_dozen" | Photo selection: 'first_dozen', 'all', 'ai_suggested', 'custom' |
| mapStyle | text | "streets" | Map style: 'streets', 'satellite', 'dark' |
| showMapPolygon | boolean | true | Show polygon on map |
| includeAgentFooter | boolean | true | Show agent footer |
| coverPageConfig | json | null | Cover page customization |
| customPhotoSelections | json | null | Per-property custom photo selections |
| createdAt | timestamp | defaultNow() | Creation timestamp |
| updatedAt | timestamp | defaultNow() | Last update timestamp |

### Table: `cma_report_templates`

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | varchar | `gen_random_uuid()` | Primary key |
| userId | varchar | NOT NULL | References users.id (cascade delete) |
| name | text | NOT NULL | Template name |
| isDefault | boolean | false | Default template flag |
| includedSections | json | null | Array of section IDs |
| sectionOrder | json | null | Custom ordering |
| coverLetterOverride | text | null | Default cover letter |
| layout | text | "two_photos" | Layout setting |
| theme | text | "spyglass" | Theme |
| photoLayout | text | "first_dozen" | Photo selection mode |
| mapStyle | text | "streets" | Map style |
| showMapPolygon | boolean | true | Polygon visibility |
| includeAgentFooter | boolean | true | Footer visibility |
| coverPageConfig | json | null | Cover page settings |
| createdAt | timestamp | defaultNow() | Creation timestamp |
| updatedAt | timestamp | defaultNow() | Last update timestamp |

### JSONB Structures

#### CmaBrochure
```typescript
interface CmaBrochure {
  type: "pdf" | "image";
  url: string;
  thumbnail?: string;
  filename: string;
  generated: boolean;
  uploadedAt: string;
}
```

#### CmaAdjustmentRates
```typescript
interface CmaAdjustmentRates {
  sqftPerUnit: number;        // $/sqft difference (default: 50)
  bedroomValue: number;       // $/bedroom (default: 10000)
  bathroomValue: number;      // $/bathroom (default: 7500)
  poolValue: number;          // Pool yes/no (default: 25000)
  garagePerSpace: number;     // $/garage space (default: 5000)
  yearBuiltPerYear: number;   // $/year newer/older (default: 1000)
  lotSizePerSqft: number;     // $/lot sqft (default: 2)
}
```

#### CmaCompAdjustmentOverrides
```typescript
interface CmaCompAdjustmentOverrides {
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  pool: number | null;
  garage: number | null;
  yearBuilt: number | null;
  lotSize: number | null;
  custom: { name: string; value: number }[];
}
```

#### CmaAdjustmentsData
```typescript
interface CmaAdjustmentsData {
  rates: CmaAdjustmentRates;
  compAdjustments: Record<string, CmaCompAdjustmentOverrides>;
  enabled: boolean;
}
```

#### CoverPageConfig
```typescript
interface CoverPageConfig {
  title: string;
  subtitle: string;
  showDate: boolean;
  showAgentPhoto: boolean;
  background: "none" | "gradient" | "property";
}
```

#### PropertyStatistics
```typescript
interface PropertyStatistics {
  price: { range: { min: number; max: number }; average: number; median: number; };
  pricePerSqFt: { range: { min: number; max: number }; average: number; median: number; };
  daysOnMarket: { range: { min: number; max: number }; average: number; median: number; };
  livingArea: { range: { min: number; max: number }; average: number; median: number; };
  lotSize: { range: { min: number; max: number }; average: number; median: number; };
  acres: { range: { min: number; max: number }; average: number; median: number; };
  bedrooms: { range: { min: number; max: number }; average: number; median: number; };
  bathrooms: { range: { min: number; max: number }; average: number; median: number; };
  yearBuilt: { range: { min: number; max: number }; average: number; median: number; };
}
```

#### TimelineDataPoint
```typescript
interface TimelineDataPoint {
  date: Date;
  price: number;
  status: 'Active' | 'Active Under Contract' | 'Closed';
  propertyId: string;
  address: string;
  daysOnMarket?: number | null;
  daysActive?: number | null;
  daysUnderContract?: number | null;
  cumulativeDaysOnMarket?: number | null;
}
```

## 2. API Endpoints

### GET /api/cmas
- **Description**: List all CMAs
- **Auth**: Optional (shows all CMAs)
- **Response**: `Cma[]`

### GET /api/cmas/:id
- **Description**: Get single CMA by ID
- **Auth**: Not required
- **Response**: `Cma` (filters out rental properties from propertiesData)

### POST /api/cmas
- **Description**: Create new CMA
- **Auth**: Optional (userId set if authenticated)
- **Request Body**:
```json
{
  "name": "string (required)",
  "subjectPropertyId": "string (optional)",
  "comparablePropertyIds": ["string array (required)"],
  "propertiesData": [{}],
  "searchCriteria": {}
}
```
- **Response**: `Cma`

### PUT /api/cmas/:id
- **Description**: Full update of CMA
- **Auth**: Not required
- **Request Body**: Partial `Cma`
- **Response**: `Cma`

### PATCH /api/cmas/:id
- **Description**: Partial update (e.g., notes)
- **Auth**: Not required
- **Request Body**: Partial `Cma`
- **Response**: `Cma`

### DELETE /api/cmas/:id
- **Description**: Delete CMA
- **Auth**: Not required
- **Response**: 204 No Content

### POST /api/cmas/:id/share
- **Description**: Generate share link
- **Auth**: Ownership check if CMA has userId
- **Response**: `{ shareToken: string, shareUrl: string }`

### DELETE /api/cmas/:id/share
- **Description**: Remove share link
- **Auth**: Ownership check if CMA has userId
- **Response**: `{ message: string }`

### POST /api/cmas/:id/email-share
- **Description**: Email CMA to recipient
- **Auth**: Not required
- **Request Body**:
```json
{
  "senderName": "string",
  "senderEmail": "string",
  "recipientName": "string",
  "recipientEmail": "string",
  "message": "string (optional)"
}
```
- **Response**: `{ success: boolean, shareUrl?: string }`

### GET /api/cmas/:id/statistics
- **Description**: Calculate statistics from CMA properties
- **Auth**: Not required
- **Response**: `PropertyStatistics` (filters out rental properties)

### GET /api/cmas/:id/timeline
- **Description**: Get timeline data for charts
- **Auth**: Not required
- **Response**: `TimelineDataPoint[]`

### GET /api/cmas/:id/report-config
- **Description**: Get presentation configuration
- **Auth**: Required
- **Response**: `CmaReportConfig` or default values

### PUT /api/cmas/:id/report-config
- **Description**: Save presentation configuration
- **Auth**: Required
- **Request Body**: `UpdateCmaReportConfig`
- **Response**: `CmaReportConfig`

### GET /api/cmas/:id/adjustments
- **Description**: Get property adjustments
- **Auth**: Not required
- **Response**: `CmaAdjustmentsData`

### PUT /api/cmas/:id/adjustments
- **Description**: Save property adjustments
- **Auth**: Required
- **Request Body**: `CmaAdjustmentsData`
- **Response**: `CmaAdjustmentsData`

### POST /api/cmas/:id/brochure
- **Description**: Upload listing brochure
- **Auth**: Required
- **Request Body**: Form data with file

### DELETE /api/cmas/:id/brochure
- **Description**: Remove listing brochure
- **Auth**: Required

### GET /api/cmas/:id/brochure
- **Description**: Get brochure metadata
- **Auth**: Not required

### GET /api/cma/report-sections
- **Description**: Get available report sections
- **Auth**: Not required
- **Response**: `CMA_REPORT_SECTIONS` constant

### GET /api/share/cma/:token
- **Description**: Get shared CMA by token (public view)
- **Auth**: Not required
- **Response**: `{ cma, properties, statistics, timelineData }`

### POST /api/cma/draft
- **Description**: Save draft CMA from AI assistant
- **Auth**: Not required

## 3. CMA Report Sections

```typescript
const CMA_REPORT_SECTIONS = [
  // Introduction
  { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true },
  { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, editable: true },
  { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false },
  { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, editable: true },
  { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false },
  { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false },
  { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true },
  // Listings
  { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true },
  { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true },
  { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false },
  { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true },
  { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true },
  { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false },
  // Analysis
  { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false },
  { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false },
  { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true },
  { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true },
] as const;
```

## 4. Frontend Routes & Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/cmas` | CMAs.tsx | List all CMAs with sorting |
| `/cmas/new` | CMANew.tsx | Create new CMA (uses CMABuilder) |
| `/cmas/:id` | CMADetailPage.tsx | View CMA with CMAReport |
| `/cmas/:id/builder` | CMAPresentationBuilder.tsx | Presentation builder UI |
| `/share/cma/:token` | SharedCMAView.tsx | Public shared CMA view |

## 5. Frontend Component Tree

```
CMAs.tsx
├── CMA list cards with sorting
└── Create New CMA button

CMANew.tsx
├── CMABuilder
│   ├── AutocompleteInput (city, subdivision, school)
│   ├── StatusFilterTabs
│   ├── Property search results
│   ├── PolygonMapSearch (map-based search)
│   ├── VisualMatchPanel (AI image similarity)
│   └── Subject/Comparable selection

CMADetailPage.tsx
├── Action buttons (Share, Email, Print, Presentation)
├── CMAReport
│   ├── Tabs: Compare | Map | Stats | List
│   ├── CompareView (property comparison table)
│   ├── MapView (MapboxMap)
│   ├── StatsView (charts, statistics)
│   └── ListView (horizontal property cards)
└── Share dialogs

CMAPresentationBuilder.tsx
├── Section toggles (drag-to-reorder)
├── CoverLetterEditor (AI-powered)
├── CoverPageEditor
├── PhotoSelectionModal
├── AdjustmentsSection
├── MapboxCMAMap
├── SaveAsTemplateModal
├── LoadTemplateDropdown
├── ExpandableList/Grid/Table
└── PDF export (CMAPdfDocument)

SharedCMAView.tsx
├── Spyglass branded header
├── CMAReport (read-only)
└── Branded footer
```

## 6. Key Utility Functions

### Statistics Calculation (server/routes.ts)
```typescript
const calculateStats = (values: number[]) => {
  if (values.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    range: { min: sorted[0], max: sorted[sorted.length - 1] },
    average: values.reduce((a, b) => a + b, 0) / values.length,
    median: calculateMedian(sorted),
  };
};
```

### Adjustment Calculations (client/src/lib/adjustmentCalculations.ts)
```typescript
const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,
  bedroomValue: 10000,
  bathroomValue: 7500,
  poolValue: 25000,
  garagePerSpace: 5000,
  yearBuiltPerYear: 1000,
  lotSizePerSqft: 2,
};

function calculateAdjustments(
  subject: PropertyForAdjustment,
  comp: PropertyForAdjustment,
  rates: CmaAdjustmentRates,
  overrides?: Partial<CmaCompAdjustmentOverrides>
): CompAdjustmentResult {
  // Returns adjustments for sqft, beds, baths, pool, garage, year, lot size
}
```

### Rental Detection (shared/schema.ts)
```typescript
const MIN_SALE_PRICE_THRESHOLD = 20000;
const MIN_PRICE_PER_SQFT_THRESHOLD = 10;

function isLikelyRentalProperty(property): boolean {
  // Returns true if property appears to be rental (not sale)
}

function filterOutRentalProperties(properties): T[] {
  return properties.filter(p => !isLikelyRentalProperty(p));
}
```

## 7. Storage Interface (IStorage)

```typescript
interface IStorage {
  // CMA operations
  getCma(id: string): Promise<Cma | undefined>;
  getCmaByShareToken(token: string): Promise<Cma | undefined>;
  getCmasByUser(userId: string): Promise<Cma[]>;
  getAllCmas(): Promise<Cma[]>;
  createCma(cma: InsertCma): Promise<Cma>;
  updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
  deleteCma(id: string): Promise<boolean>;
  
  // Report config operations
  getCmaReportConfig(cmaId: string): Promise<CmaReportConfig | undefined>;
  createCmaReportConfig(config: InsertCmaReportConfig): Promise<CmaReportConfig>;
  updateCmaReportConfig(cmaId: string, config: UpdateCmaReportConfig): Promise<CmaReportConfig | undefined>;
}
```

## 8. Dependencies Required

```json
{
  "@react-pdf/renderer": "^4.3.2",
  "mapbox-gl": "^3.18.0",
  "recharts": "^2.15.4",
  "resend": "^6.6.0",
  "@tanstack/react-query": "^5.x",
  "wouter": "^3.x",
  "drizzle-orm": "^0.x",
  "@radix-ui/react-*": "various",
  "lucide-react": "^0.x"
}
```

## 9. Environment Variables

| Variable | Description |
|----------|-------------|
| VITE_MAPBOX_TOKEN | Mapbox GL JS access token |
| DATABASE_URL | PostgreSQL connection string |
| REPLIERS_API_KEY | Repliers API key for property data |
| RESEND_API_KEY | Resend API key for email |

## 10. Status Color Scheme

| Status | Name | Hex | Tailwind BG |
|--------|------|-----|-------------|
| subject | Subject Property | #3B82F6 | bg-blue-500 |
| active | Active | #22C55E | bg-green-500 |
| underContract | Under Contract | #F97316 | bg-orange-500 |
| closed | Closed | #EF4444 | bg-red-500 |
| pending | Pending | #6B7280 | bg-gray-500 |

### Status Color Utilities (client/src/lib/statusColors.ts)
```typescript
const STATUS_COLORS = {
  subject: { name: 'Subject Property', hex: '#3b82f6', bg: 'bg-blue-500', ... },
  active: { name: 'Active', hex: '#22c55e', bg: 'bg-green-500', ... },
  underContract: { name: 'Under Contract', hex: '#f97316', bg: 'bg-orange-500', ... },
  closed: { name: 'Closed', hex: '#ef4444', bg: 'bg-red-500', ... },
  pending: { name: 'Pending', hex: '#6b7280', bg: 'bg-gray-500', ... },
};

function getStatusFromMLS(mlsStatus: string, isSubject?: boolean): StatusKey;
function getStatusHex(status: StatusKey): string;
function getStatusHexFromMLS(mlsStatus: string, isSubject?: boolean): string;
function getStatusBadgeClasses(status: StatusKey): string;
function getStatusConfig(mlsStatus: string): { color, textColor, hex };
```

## 11. Map Styles

```typescript
const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};
```

## 12. Key Component Files

| File | Purpose |
|------|---------|
| `client/src/pages/CMAs.tsx` | CMA list page |
| `client/src/pages/CMANew.tsx` | Create new CMA |
| `client/src/pages/CMADetailPage.tsx` | View/manage CMA |
| `client/src/pages/CMAPresentationBuilder.tsx` | Presentation builder |
| `client/src/pages/SharedCMAView.tsx` | Public shared view |
| `client/src/components/CMAReport.tsx` | Main report display (4035 lines) |
| `client/src/components/CMABuilder.tsx` | Property search/selection (2736 lines) |
| `client/src/components/CMAPdfDocument.tsx` | PDF generation (1071 lines) |
| `client/src/components/AdjustmentsSection.tsx` | Property adjustments |
| `client/src/components/presentation/MapboxCMAMap.tsx` | Interactive map |
| `client/src/components/presentation/CoverLetterEditor.tsx` | AI cover letter |
| `client/src/components/presentation/PhotoSelectionModal.tsx` | Photo selection |
| `client/src/lib/adjustmentCalculations.ts` | Adjustment math |
| `client/src/lib/statusColors.ts` | Status color utilities |
| `shared/schema.ts` | Database schema & types |
| `server/routes.ts` | API endpoints |
| `server/storage.ts` | Database operations |

## 13. AI-Powered Features

### Cover Letter Generation
- Endpoint: POST /api/ai/generate-cover-letter
- Model: GPT-4o (temperature 0.7, max_tokens 500)
- Tone options: Professional, Friendly, Confident
- Detects existing content (>20 chars) and enhances vs generates

### AI Photo Selection
- Uses Repliers imageInsights API for classification
- Room types: Front, Living, Kitchen, Dining, Bedroom, Primary Bed, Primary Bath, Bathroom, Pool, Other
- Confidence threshold: 0.90
- Diversity algorithm prioritizes key room types for CMA

## 14. Branding

- Company: Spyglass Realty
- Primary color: #F37216 (Orange)
- Logo: `/spyglass-logo-white.png` (dark backgrounds), `/spyglass-logo.png` (light)
- Font: Inter (Google Fonts)

---

*This document serves as the complete reference for replicating the CMA feature in a separate project.*
