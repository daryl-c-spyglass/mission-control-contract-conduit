# CMA Presentation Builder — Complete Architecture Reference

## Overview

The CMA Presentation Builder is accessed at `/cmas/:id/presentation` and provides a comprehensive interface for creating professional Comparative Market Analysis presentations. It features a 3-tab configuration system, real-time live preview, PDF export with Spyglass Realty branding, AI-powered content generation, and Mapbox integration.

---

## File Structure

```
client/src/
├── pages/
│   └── CMAPresentationBuilder.tsx           # Main page component (2334 lines)
├── components/
│   ├── presentation/
│   │   ├── CoverPageEditor.tsx              # Cover page customization
│   │   ├── CoverLetterEditor.tsx            # AI-powered cover letter
│   │   ├── MapboxCMAMap.tsx                 # Mapbox GL JS integration
│   │   └── PhotoSelectionModal.tsx          # Custom photo selection
│   ├── ListingBrochureContent.tsx           # Brochure upload/generation
│   ├── AdjustmentsSection.tsx               # Property value adjustments
│   ├── CMAPdfDocument.tsx                   # PDF generation (@react-pdf/renderer)
│   └── ExpandedPreviewModal.tsx             # Full-screen preview modal
├── lib/
│   ├── adjustmentCalculations.ts            # Adjustment calculation logic
│   ├── pdfStyles.ts                         # PDF styling constants
│   └── statusColors.ts                      # Centralized status color system
└── contexts/
    └── ThemeContext.tsx                     # Global dark/light theme state

server/
├── routes.ts                                # API endpoints (cmas/:id/*)
└── services/
    └── (inline in routes.ts)                # PDF generation, AI endpoints
```

---

## Section Configuration

### All 17 Sections (CMA_REPORT_SECTIONS)

Source: `shared/schema.ts` lines 949-971

```typescript
// CMA Report Sections - Available sections for the presentation builder
export const CMA_REPORT_SECTIONS = [
  // INTRODUCTION CATEGORY (7 sections)
  { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true },
  { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false },
  { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, editable: true },
  { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, editable: true },
  { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false },
  { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false },
  { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true },
  
  // LISTINGS CATEGORY (6 sections)
  { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true },
  { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true },
  { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false },
  { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true },
  { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true },
  { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false },
  
  // ANALYSIS CATEGORY (4 sections)
  { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false },
  { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false },
  { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true },
  { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true },
] as const;

export type CmaSectionId = typeof CMA_REPORT_SECTIONS[number]['id'];
```

### Section Categories

| Category | Sections | Purpose |
|----------|----------|---------|
| `introduction` | 7 | Cover page, agent info, company branding |
| `listings` | 6 | Property data, maps, photos, adjustments |
| `analysis` | 4 | Market statistics, charts, valuations |

### Default Enabled Sections (9 total)

| Section ID | Name |
|------------|------|
| `cover_page` | Cover Page |
| `cover_letter` | Cover Letter |
| `contact_me` | Contact Me |
| `map_all_listings` | Map of All Listings |
| `summary_comparables` | Summary of Comparable Properties |
| `property_details` | Property Details |
| `property_photos` | Property Photos |
| `price_per_sqft` | Average Price Per Sq. Ft. |
| `comparable_stats` | Comparable Property Statistics |

---

## Type Definitions

### CoverPageConfig

```typescript
// client/src/components/presentation/CoverPageEditor.tsx
export interface CoverPageConfig {
  title: string;                              // Default: "Comparative Market Analysis"
  subtitle: string;                           // Default: "Prepared exclusively for you"
  showDate: boolean;                          // Default: true
  showAgentPhoto: boolean;                    // Default: true
  background: "none" | "gradient" | "property"; // Default: "none"
}

export function getDefaultCoverPageConfig(): CoverPageConfig {
  return {
    title: "Comparative Market Analysis",
    subtitle: "Prepared exclusively for you",
    showDate: true,
    showAgentPhoto: true,
    background: "none",
  };
}
```

### CmaBrochure (Database Schema)

Source: `shared/schema.ts` lines 303-311

```typescript
// Brochure structure for CMA listing brochure
export interface CmaBrochure {
  type: "pdf" | "image";          // File type
  url: string;                    // Object storage path or external URL
  thumbnail?: string;             // Optional thumbnail URL
  filename: string;               // Original filename
  generated: boolean;             // True if auto-generated, false if uploaded
  uploadedAt: string;             // ISO timestamp of upload
}
```

### CmaAdjustmentRates

```typescript
// shared/schema.ts
export interface CmaAdjustmentRates {
  sqftPerUnit: number;            // Default: 50 ($/sqft)
  bedroomValue: number;           // Default: 10000 ($10K per bedroom)
  bathroomValue: number;          // Default: 7500 ($7.5K per bathroom)
  poolValue: number;              // Default: 25000 ($25K for pool)
  garagePerSpace: number;         // Default: 5000 ($5K per garage space)
  yearBuiltPerYear: number;       // Default: 1000 ($1K per year difference)
  lotSizePerSqft: number;         // Default: 2 ($/sqft of lot)
}
```

### CmaAdjustmentsData

```typescript
// shared/schema.ts
export interface CmaAdjustmentsData {
  rates: CmaAdjustmentRates;
  compAdjustments: Record<string, CmaCompAdjustmentOverrides>;
  enabled: boolean;
}

export interface CmaCompAdjustmentOverrides {
  sqft?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  pool?: number | null;
  garage?: number | null;
  yearBuilt?: number | null;
  lotSize?: number | null;
  custom?: { name: string; value: number }[];
}
```

### PropertyLocation (for Mapbox)

```typescript
// client/src/components/presentation/MapboxCMAMap.tsx
interface PropertyLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  status: string;
  isSubject?: boolean;
}
```

---

## Layout Options

### Layout (Photos per Property)

```typescript
const LAYOUT_OPTIONS = [
  { value: "two_photos", label: "Two Photos" },
  { value: "single_photo", label: "Single Photo" },
  { value: "no_photos", label: "No Photos" },
];
```

### Photo Layout (Selection Method)

```typescript
const PHOTO_LAYOUT_OPTIONS = [
  { value: "first_dozen", label: "First 12 Photos" },
  { value: "all", label: "All Photos" },
  { value: "ai_suggested", label: "AI Suggested" },       // Uses Repliers imageInsights API
  { value: "custom", label: "Custom Selection" },         // Opens PhotoSelectionModal
];
```

---

## Component Details

### 1. CMAPresentationBuilder.tsx (Main Page)

**Route:** `/cmas/:id/presentation`

**State Management:**
```typescript
// Core presentation state
const [includedSections, setIncludedSections] = useState<string[]>(DEFAULT_ENABLED_SECTIONS);
const [sectionOrder, setSectionOrder] = useState<string[]>(ALL_SECTION_IDS);
const [layout, setLayout] = useState<string>("two_photos");
const [photoLayout, setPhotoLayout] = useState<string>("first_dozen");
const [hasChanges, setHasChanges] = useState(false);

// Content state
const [coverPageConfig, setCoverPageConfig] = useState<CoverPageConfig>(getDefaultCoverPageConfig());
const [coverLetterOverride, setCoverLetterOverride] = useState<string>("");
const [brochure, setBrochure] = useState<CmaBrochure | null>(null);
const [adjustments, setAdjustments] = useState<CmaAdjustmentsData | null>(null);
const [includeAgentFooter, setIncludeAgentFooter] = useState(true);

// Map state
const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("streets");
const [showMapPolygon, setShowMapPolygon] = useState(true);

// Custom photo selections
const [customPhotoSelections, setCustomPhotoSelections] = useState<Record<string, string[]>>({});
```

**Tab Structure:**
```tsx
<Tabs defaultValue="sections">
  <TabsList>
    <TabsTrigger value="sections">Sections</TabsTrigger>
    <TabsTrigger value="content">Content</TabsTrigger>
    <TabsTrigger value="layout">Layout</TabsTrigger>
  </TabsList>
  
  <TabsContent value="sections">
    {/* Section toggles grouped by category */}
    {/* Drag-and-drop reordering with DndKit */}
  </TabsContent>
  
  <TabsContent value="content">
    <CoverPageEditor />
    <CoverLetterEditor />
    <ListingBrochureContent />
    <AdjustmentsSection />
  </TabsContent>
  
  <TabsContent value="layout">
    {/* Layout options */}
    {/* Photo selection method */}
  </TabsContent>
</Tabs>
```

### 2. CoverPageEditor.tsx

**Purpose:** Customize cover page appearance

**Fields:**
- `title`: Main heading (default: "Comparative Market Analysis")
- `subtitle`: Subheading (default: "Prepared exclusively for you")
- `showDate`: Toggle to display report date
- `showAgentPhoto`: Toggle to include agent headshot
- `background`: Visual style selection

**Background Options:**
| Value | Label | Styling |
|-------|-------|---------|
| `none` | Plain White | `bg-white` |
| `gradient` | Gradient | `bg-gradient-to-br from-orange-50 to-orange-100` |
| `property` | Property Photo | `bg-gray-200` (placeholder for subject photo) |

### 3. CoverLetterEditor.tsx

**Purpose:** Generate AI-powered personalized cover letters

**Features:**
- Client name input (optional, for personalized greeting)
- AI tone selection: Professional, Friendly, Confident
- Generate button with loading state
- Copy to clipboard functionality
- Manual text editing

**AI Generation Flow:**
```typescript
const generateMutation = useMutation({
  mutationFn: async () => {
    const context = buildContext(
      subjectProperty,
      properties,
      statistics,
      agentName,
      companyName,
      localClientName
    );

    const response = await apiRequest("/api/ai/generate-cover-letter", "POST", {
      context,
      tone,  // "professional" | "friendly" | "confident"
    });

    return data.coverLetter;
  },
});
```

**Context Object Structure:**
```typescript
{
  subjectProperty: {
    address: string;
    price: number;
    beds: number;
    baths: number;
    sqft: number;
    description?: string;
  },
  comparables: {
    count: number;
    avgPrice: number;
    medianPrice: number;
    avgPricePerSqft: number;
    priceRange: { min: number; max: number };
  },
  marketStats: {
    avgDOM: number;
    activeCount: number;
    closedCount: number;
  },
  agentInfo: {
    name: string;
    brokerage: string;
  },
  clientName?: string;
}
```

### 4. ListingBrochureContent.tsx

**Purpose:** Upload or auto-generate property brochures

**Features:**
- File upload (PDF or images: JPG, PNG)
- Max file size: 10MB
- Auto-generate brochure using AI (Repliers integration)
- Preview uploaded/generated brochure
- Delete functionality

**Upload Flow:**
```typescript
// 1. Request presigned URL
const urlResponse = await fetch("/api/uploads/request-url", {
  method: "POST",
  body: JSON.stringify({
    name: file.name,
    size: file.size,
    contentType: file.type,
  }),
});
const { uploadURL, objectPath } = await urlResponse.json();

// 2. Upload directly to presigned URL (GCS/S3)
await fetch(uploadURL, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": file.type },
});

// 3. Save brochure metadata to CMA
await apiRequest(`/api/cmas/${cmaId}/brochure`, "POST", {
  url: objectPath,
  filename: file.name,
  type: isPdf ? "pdf" : "image",
  generated: false,
});
```

### 5. AdjustmentsSection.tsx

**Purpose:** Configure property value adjustment calculations

**Default Adjustment Rates:**
```typescript
export const DEFAULT_ADJUSTMENT_RATES: CmaAdjustmentRates = {
  sqftPerUnit: 50,          // $50 per square foot difference
  bedroomValue: 10000,      // $10,000 per bedroom difference
  bathroomValue: 7500,      // $7,500 per bathroom difference
  poolValue: 25000,         // $25,000 for pool presence
  garagePerSpace: 5000,     // $5,000 per garage space
  yearBuiltPerYear: 1000,   // $1,000 per year difference
  lotSizePerSqft: 2,        // $2 per lot sqft difference
};
```

**Calculation Logic:**
```typescript
// client/src/lib/adjustmentCalculations.ts
export function calculateAdjustments(
  subject: PropertyForAdjustment,
  comp: PropertyForAdjustment,
  rates: CmaAdjustmentRates,
  overrides?: Partial<CmaCompAdjustmentOverrides>
): CompAdjustmentResult {
  const adjustments: AdjustmentItem[] = [];
  
  // Square footage adjustment
  const sqftDiff = (subject.livingArea || 0) - (comp.livingArea || 0);
  const sqftAdj = overrides?.sqft ?? sqftDiff * rates.sqftPerUnit;
  adjustments.push({ name: "Living Area", value: sqftAdj });
  
  // Bedroom adjustment
  const bedDiff = (subject.bedroomsTotal || 0) - (comp.bedroomsTotal || 0);
  const bedAdj = overrides?.bedrooms ?? bedDiff * rates.bedroomValue;
  adjustments.push({ name: "Bedrooms", value: bedAdj });
  
  // ... similar for other adjustments
  
  const totalAdjustment = adjustments.reduce((sum, a) => sum + a.value, 0);
  const salePrice = comp.closePrice || comp.listPrice || 0;
  const adjustedPrice = salePrice + totalAdjustment;
  
  return {
    compId: getPropertyId(comp),
    compAddress: comp.streetAddress || comp.address || "",
    salePrice,
    adjustments,
    totalAdjustment,
    adjustedPrice,
  };
}
```

### 6. MapboxCMAMap.tsx

**Purpose:** Interactive property location map with status-colored markers

**Props:**
```typescript
interface MapboxCMAMapProps {
  properties: PropertyLocation[];
  subjectProperty?: PropertyLocation | null;
  style?: 'streets' | 'satellite';
  showPolygon?: boolean;
  onStyleChange?: (style: 'streets' | 'satellite') => void;
  onPolygonChange?: (show: boolean) => void;
  height?: string;
  interactive?: boolean;
}
```

**Theme Integration:**
```typescript
// Effective map style respects dark/light theme
const effectiveMapStyle = useMemo(() => {
  if (style === 'satellite') {
    return 'satellite';  // Satellite stays satellite
  }
  return theme === 'dark' ? 'dark' : 'streets';  // Streets respects theme
}, [style, theme]);
```

**Map Styles (from statusColors.ts):**
```typescript
export const MAP_STYLES = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};
```

**Status Colors:**
```typescript
export const STATUS_COLORS = {
  subject: { hex: '#3b82f6', tailwind: 'bg-blue-500' },      // Blue
  active: { hex: '#22c55e', tailwind: 'bg-green-500' },      // Green
  underContract: { hex: '#f97316', tailwind: 'bg-orange-500' }, // Orange
  closed: { hex: '#ef4444', tailwind: 'bg-red-500' },        // Red
  pending: { hex: '#6b7280', tailwind: 'bg-gray-500' },      // Gray
};
```

**Features:**
- Colored markers based on property status
- Subject property highlighted in blue
- Optional polygon connecting all properties
- Streets/Satellite toggle
- Navigation controls (zoom, rotate)
- Popups with property info

### 7. CMAPdfDocument.tsx

**Purpose:** Generate professional PDF exports using @react-pdf/renderer

**Library:** `@react-pdf/renderer`

**Font Registration:**
```typescript
Font.register({
  family: "Inter",
  fonts: [
    { src: "https://fonts.gstatic.com/s/inter/v13/...woff", fontWeight: 400 },
    { src: "https://fonts.gstatic.com/s/inter/v13/...woff", fontWeight: 600 },
    { src: "https://fonts.gstatic.com/s/inter/v13/...woff", fontWeight: 700 },
  ],
});
```

**PDF Color Constants:**
```typescript
// client/src/lib/pdfStyles.ts
export const PDF_COLORS = {
  primary: '#F37216',           // Spyglass Orange
  text: '#1f2937',              // Gray-800
  textLight: '#4b5563',         // Gray-600
  textMuted: '#9ca3af',         // Gray-400
  background: '#ffffff',        // White
  backgroundAlt: '#f9fafb',     // Gray-50
  border: '#e5e7eb',            // Gray-200
  
  // Status colors
  statusSubject: '#3b82f6',     // Blue
  statusActive: '#22c55e',      // Green
  statusUnderContract: '#f97316', // Orange
  statusClosed: '#ef4444',      // Red
};
```

**Page Layout:**
```typescript
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    color: PDF_COLORS.text,
    backgroundColor: PDF_COLORS.background,
  },
  coverPage: {
    padding: 60,
    fontFamily: "Inter",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
});
```

---

## PDF Export Workflow

### Overview

PDF generation is **client-side** using `@react-pdf/renderer`. The export happens entirely in the browser without server-side processing.

### Export Flow

```typescript
// CMAPresentationBuilder.tsx - handleExportPDF function
const handleExportPDF = async () => {
  setIsExporting(true);
  
  try {
    // 1. Import PDF utilities dynamically
    const { pdf } = await import("@react-pdf/renderer");
    
    // 2. Build the document with current state
    const pdfDoc = (
      <CMAPdfDocument
        cma={cma}
        properties={properties}
        subjectProperty={subjectProperty}
        comparables={comparables}
        includedSections={includedSections}
        coverPageConfig={coverPageConfig}
        coverLetter={coverLetterOverride || agentProfile?.defaultCoverLetter}
        agentProfile={agentProfile}
        companySettings={companySettings}
        adjustments={adjustments}
        statistics={statistics}
        brochure={brochure}
        layout={layout}
        includeAgentFooter={includeAgentFooter}
      />
    );
    
    // 3. Generate PDF blob
    const blob = await pdf(pdfDoc).toBlob();
    
    // 4. Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `CMA-${cma.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
    link.click();
    
    // 5. Cleanup
    URL.revokeObjectURL(url);
    
    toast({
      title: "PDF exported",
      description: "Your CMA presentation has been downloaded.",
    });
  } catch (error) {
    console.error("PDF export error:", error);
    toast({
      title: "Export failed",
      description: "Failed to generate PDF. Please try again.",
      variant: "destructive",
    });
  } finally {
    setIsExporting(false);
  }
};
```

### CMAPdfDocument Structure

```tsx
// CMAPdfDocument.tsx
<Document>
  {/* Cover Page */}
  {includedSections.includes("cover_page") && (
    <Page size="LETTER" style={styles.coverPage}>
      <CoverPageSection config={coverPageConfig} />
    </Page>
  )}
  
  {/* Listing Brochure (if included and available) */}
  {includedSections.includes("listing_brochure") && brochure && (
    <Page size="LETTER" style={styles.page}>
      <BrochureSection brochure={brochure} />
    </Page>
  )}
  
  {/* Cover Letter */}
  {includedSections.includes("cover_letter") && coverLetter && (
    <Page size="LETTER" style={styles.page}>
      <CoverLetterSection text={coverLetter} />
    </Page>
  )}
  
  {/* Property Details */}
  {includedSections.includes("property_details") && (
    <Page size="LETTER" style={styles.page}>
      <PropertyDetailsSection properties={properties} />
    </Page>
  )}
  
  {/* ... additional sections */}
</Document>
```

### Page Configuration

| Setting | Value |
|---------|-------|
| Page Size | Letter (8.5" x 11") |
| Margins | 40pt (standard pages), 60pt (cover page) |
| Font | Inter (Google Fonts, loaded via URL) |
| Base Font Size | 10pt |

### Image Handling

- **Property Photos**: Loaded via URLs directly into PDF
- **Map Images**: Generated using Mapbox Static Images API for PDF
- **Logo**: Company logo URL from settings
- **Agent Photo**: Agent headshot URL from profile

### Static Map URL Generation

```typescript
// Generate static map URL for PDF export
function getStaticMapUrl(properties: PropertyLocation[], center: [number, number]): string {
  const markers = properties.map(p => {
    const color = getStatusHexFromMLS(p.status).replace('#', '');
    return `pin-s+${color}(${p.lng},${p.lat})`;
  }).join(',');
  
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${markers}/${center[0]},${center[1]},12/600x400?access_token=${MAPBOX_TOKEN}`;
}
```

---

## API Endpoints

### CMA Data & Presentation Settings

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/cmas/:id` | Fetch CMA with all data | Required |
| `PATCH` | `/api/cmas/:id` | Update CMA properties | Required |
| `GET` | `/api/cmas/:id/report-config` | Get presentation config | Required |
| `PUT` | `/api/cmas/:id/report-config` | Save presentation config | Required |
| `PUT` | `/api/cmas/:id/adjustments` | Save adjustment settings | Required |

### Brochure Management

Source: `server/routes.ts` lines 7693-7767

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/cmas/:id/brochure` | Save brochure metadata | Required |
| `DELETE` | `/api/cmas/:id/brochure` | Remove brochure | Required |
| `GET` | `/api/cmas/:id/brochure` | Get brochure details | Optional |
| `POST` | `/api/uploads/request-url` | Get presigned upload URL | Required |

**Brochure Save Request:**
```typescript
POST /api/cmas/:id/brochure
{
  url: string;        // Object storage path
  filename: string;   // Original filename
  type: "pdf" | "image";
  generated?: boolean; // True if auto-generated
}
```

### AI Generation

Source: `server/routes.ts` line 6871

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `POST` | `/api/ai/generate-cover-letter` | Generate AI cover letter | Required |

**Cover Letter Request:**
```typescript
POST /api/ai/generate-cover-letter
{
  context: {
    subjectProperty: { address, price, beds, baths, sqft, description? },
    comparables: { count, avgPrice, medianPrice, avgPricePerSqft, priceRange },
    marketStats: { avgDOM, activeCount, closedCount },
    agentInfo: { name, brokerage },
    clientName?: string
  },
  tone: "professional" | "friendly" | "confident"
}

// Response
{
  coverLetter: string  // Generated cover letter text
}
```

### Templates

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/report-templates` | List user's templates | Required |
| `POST` | `/api/report-templates` | Save new template | Required |
| `DELETE` | `/api/report-templates/:id` | Delete template | Required |
| `GET` | `/api/report-templates/default` | Get user's default template | Required |

### Report Sections Reference

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| `GET` | `/api/cma/report-sections` | Get all available sections | None |

### Report Config Request/Response

**Save Report Config:**
```typescript
PUT /api/cmas/:id/report-config
{
  includedSections?: string[];      // Array of enabled section IDs
  sectionOrder?: string[];          // Ordered section IDs
  coverLetterOverride?: string;     // Custom cover letter
  layout?: "two_photos" | "single_photo" | "no_photos";
  photoLayout?: "first_dozen" | "all" | "ai_suggested" | "custom";
  mapStyle?: "streets" | "satellite" | "dark";
  showMapPolygon?: boolean;
  includeAgentFooter?: boolean;
  coverPageConfig?: {
    title: string;
    subtitle: string;
    showDate: boolean;
    showAgentPhoto: boolean;
    background: "none" | "gradient" | "property";
  };
  customPhotoSelections?: Record<string, string[]>;  // MLS number -> photo URLs
}
```

---

## Live Preview Architecture

### Layout Structure

The Presentation Builder uses a **two-column layout**:

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Back button, CMA name, Save/Export actions             │
├───────────────────────────────────┬─────────────────────────────┤
│ LEFT PANE (Configuration)         │ RIGHT PANE (Live Preview)   │
│                                   │                             │
│ ┌─────────────────────────────┐   │ ┌─────────────────────────┐ │
│ │ Tabs: Sections | Content |  │   │ │ Live Preview            │ │
│ │       Layout                │   │ │ [X sections] [⛶ Expand] │ │
│ └─────────────────────────────┘   │ ├─────────────────────────┤ │
│                                   │ │ ScrollArea (500-900px)  │ │
│ Tab content varies by selection:  │ │                         │ │
│ - Sections: Toggle switches       │ │ ┌─────────────────────┐ │ │
│ - Content: Editors (Cover Page,   │ │ │ PreviewSection      │ │ │
│   Cover Letter, Brochure, etc.)   │ │ │ - Cover Page        │ │ │
│ - Layout: Photo options, styles   │ │ │ - Cover Letter      │ │ │
│                                   │ │ │ - Properties...     │ │ │
│                                   │ │ └─────────────────────┘ │ │
│                                   │ │                         │ │
│                                   │ └─────────────────────────┘ │
└───────────────────────────────────┴─────────────────────────────┘
```

### State Synchronization

Preview updates **in real-time** as user makes changes. All state is managed in CMAPresentationBuilder.tsx:

```typescript
// State changes trigger immediate preview re-render
const [includedSections, setIncludedSections] = useState<string[]>([]);
const [coverPageConfig, setCoverPageConfig] = useState<CoverPageConfig>(getDefaultCoverPageConfig());
const [coverLetterOverride, setCoverLetterOverride] = useState<string>("");
// ... other state

// Preview opacity indicator during updates
const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);

// Debounced visual feedback for updates
useEffect(() => {
  setIsPreviewUpdating(true);
  const timeout = setTimeout(() => setIsPreviewUpdating(false), 300);
  return () => clearTimeout(timeout);
}, [includedSections, coverPageConfig, coverLetterOverride, layout, photoLayout]);
```

### Preview Panel Component

```tsx
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <CardTitle className="text-lg">Live Preview</CardTitle>
        <CardDescription>Preview how your CMA presentation will appear</CardDescription>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="outline">{includedSections.length} sections</Badge>
        <Button variant="ghost" size="icon" onClick={() => setIsPreviewModalOpen(true)}>
          <Expand className="h-4 w-4" />
        </Button>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    <ScrollArea className="h-[500px] md:h-[600px] lg:h-[calc(100vh-200px)] lg:min-h-[600px] lg:max-h-[900px]">
      <div className={`p-4 space-y-4 transition-opacity duration-300 ${isPreviewUpdating ? "opacity-50" : "opacity-100"}`}>
        {/* Conditionally render each section based on includedSections */}
      </div>
    </ScrollArea>
  </CardContent>
</Card>
```

### PreviewSection Component

Each section in the preview is wrapped in a clickable `PreviewSection` component:

```tsx
interface PreviewSectionProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  sectionId: string;
  onClick?: (sectionId: string) => void;
  children: React.ReactNode;
}

function PreviewSection({ title, icon: Icon, sectionId, onClick, children }: PreviewSectionProps) {
  return (
    <div
      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onClick?.(sectionId)}
      data-testid={`preview-section-${sectionId}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}

// Usage:
{includedSections.includes("cover_page") && (
  <PreviewSection title="Cover Page" icon={FileText} sectionId="cover_page" onClick={handlePreviewSectionClick}>
    <CoverPagePreview config={coverPageConfig} ... />
  </PreviewSection>
)}
```

### ExpandableList Component

For sections with many items (properties, photos, comparables), use `ExpandableList`:

```tsx
interface ExpandableListProps<T> {
  items: T[];
  initialCount: number;           // Show first N items
  itemLabel: string;              // "properties", "comparables", etc.
  renderItem: (item: T, index: number) => React.ReactNode;
  header?: React.ReactNode;       // Optional table header
  renderRow?: (item: T) => React.ReactNode;  // For table rows
}

// Example usage:
<ExpandableList
  items={properties}
  initialCount={3}
  itemLabel="properties"
  renderItem={(property, index) => (
    <div className="p-2 bg-muted rounded-md">
      <p className="text-xs font-medium truncate">{property.streetAddress}</p>
      <p className="text-xs text-muted-foreground">{formatCurrency(property.listPrice)}</p>
    </div>
  )}
/>
```

### Expanded Preview Modal

Full-screen preview modal for detailed viewing:

```tsx
// ExpandedPreviewModal component
interface ExpandedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionsEnabled: number;
  children: React.ReactNode;
}

// Usage in CMAPresentationBuilder:
<ExpandedPreviewModal
  isOpen={isPreviewModalOpen}
  onClose={() => setIsPreviewModalOpen(false)}
  sectionsEnabled={includedSections.length}
>
  <div className="p-4 space-y-4">
    {/* Same preview content but larger/scrollable */}
    {includedSections.includes("cover_page") && <CoverPagePreview ... />}
    {includedSections.includes("cover_letter") && <CoverLetterPreview ... />}
    {/* ... all sections */}
  </div>
</ExpandedPreviewModal>
```

### Section Click Navigation

Clicking a preview section scrolls to corresponding editor:

```typescript
const handlePreviewSectionClick = (sectionId: string) => {
  // Find the corresponding tab and scroll to editor
  const editableSection = EDITABLE_SECTIONS.find(s => s.id === sectionId);
  if (editableSection) {
    // Switch to Content tab if needed
    setActiveTab("content");
    // Scroll to editor element
    document.getElementById(`editor-${sectionId}`)?.scrollIntoView({ behavior: "smooth" });
  }
};
```

### Data Hydration

Preview data is derived from multiple sources:

```typescript
// Subject property from CMA
const subjectProperty = cma?.propertiesData?.find(p => p.listingId === cma.subjectPropertyId);

// Comparables (all except subject)
const comparables = cma?.propertiesData?.filter(p => p.listingId !== cma.subjectPropertyId) || [];

// All properties combined
const properties = cma?.propertiesData || [];

// Statistics calculated from properties
const statistics = useMemo(() => calculateStatistics(comparables), [comparables]);

// Property locations for map
const propertyLocations = useMemo(() => 
  properties.filter(p => p.latitude && p.longitude).map(p => ({
    id: p.listingId,
    address: p.streetAddress || p.address,
    lat: p.latitude,
    lng: p.longitude,
    price: p.listPrice || p.closePrice,
    status: p.standardStatus,
    isSubject: p.listingId === cma?.subjectPropertyId,
  })), [properties, cma?.subjectPropertyId]
);
```

---

## Environment Variables

### Required for Full Functionality

| Variable | Purpose | Used By |
|----------|---------|---------|
| `VITE_MAPBOX_TOKEN` | Mapbox GL JS access token for interactive maps | MapboxCMAMap, PDF static maps |
| `OPENAI_API_KEY` | OpenAI API for AI-powered cover letter generation | `/api/ai/generate-cover-letter` |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket ID for file uploads | Brochure upload flow |
| `PRIVATE_OBJECT_DIR` | Directory path for private objects in storage | Object storage paths |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public object storage search paths | File serving |

### Optional / External Services

| Variable | Purpose | Used By |
|----------|---------|---------|
| `REPLIERS_API_KEY` | Repliers API for AI photo suggestions | AI suggested photos |
| `REPLIERS_API_URL` | Repliers API base URL | Photo classification |

### Access in Code

**Frontend (Vite):**
```typescript
// Use import.meta.env for client-side access
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
```

**Backend (Node.js):**
```typescript
// Use process.env for server-side access
const openaiKey = process.env.OPENAI_API_KEY;
```

---

## Dependencies

### Frontend

```json
{
  "@react-pdf/renderer": "^3.x",
  "mapbox-gl": "^2.x",
  "@tanstack/react-query": "^5.x",
  "recharts": "^2.x",
  "wouter": "^3.x",
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^8.x"
}
```

### Backend

```json
{
  "openai": "^4.x",
  "drizzle-orm": "^0.29.x",
  "@neondatabase/serverless": "^0.9.x"
}
```

---

## Database Schema

### cmas Table (Core CMA Data)

Source: `shared/schema.ts` lines 343-358

```typescript
export const cmas = pgTable("cmas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  name: text("name").notNull(),
  subjectPropertyId: text("subject_property_id"),
  comparablePropertyIds: json("comparable_property_ids").$type<string[]>().notNull(),
  propertiesData: json("properties_data").$type<any[]>(),
  searchCriteria: json("search_criteria"),
  notes: text("notes"),
  publicLink: text("public_link").unique(),
  brochure: json("brochure").$type<CmaBrochure>(),           // Listing brochure
  adjustments: json("adjustments").$type<CmaAdjustmentsData>(), // Property value adjustments
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### cma_report_configs Table (Presentation Settings)

Source: `shared/schema.ts` lines 984-1002

```typescript
export const cmaReportConfigs = pgTable("cma_report_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cmaId: varchar("cma_id").notNull().references(() => cmas.id, { onDelete: 'cascade' }).unique(),
  includedSections: json("included_sections").$type<string[]>(),      // Array of enabled section IDs
  sectionOrder: json("section_order").$type<string[]>(),              // Ordered array for custom ordering
  coverLetterOverride: text("cover_letter_override"),                 // Custom cover letter text
  layout: text("layout").default("two_photos"),                       // 'two_photos', 'single_photo', 'no_photos'
  template: text("template").default("default"),                      // Template name
  theme: text("theme").default("spyglass"),                           // Theme name
  photoLayout: text("photo_layout").default("first_dozen"),           // 'first_dozen', 'all', 'ai_suggested', 'custom'
  mapStyle: text("map_style").default("streets"),                     // 'streets', 'satellite', 'dark'
  showMapPolygon: boolean("show_map_polygon").default(true),          // Show polygon on map
  includeAgentFooter: boolean("include_agent_footer").default(true),  // Show agent footer
  coverPageConfig: json("cover_page_config").$type<CoverPageConfig>(), // Cover page customization
  customPhotoSelections: json("custom_photo_selections").$type<Record<string, string[]>>(), // MLS -> photo URLs
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### cma_report_templates Table (Reusable Templates)

Source: `shared/schema.ts` lines 1004-1022

```typescript
export const cmaReportTemplates = pgTable("cma_report_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  includedSections: json("included_sections").$type<string[]>(),
  sectionOrder: json("section_order").$type<string[]>(),
  coverLetterOverride: text("cover_letter_override"),
  layout: text("layout").default("two_photos"),
  theme: text("theme").default("spyglass"),
  photoLayout: text("photo_layout").default("first_dozen"),
  mapStyle: text("map_style").default("streets"),
  showMapPolygon: boolean("show_map_polygon").default(true),
  includeAgentFooter: boolean("include_agent_footer").default(true),
  coverPageConfig: json("cover_page_config").$type<CoverPageConfig>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### Zod Validation Schemas

```typescript
// Update schema for report configs
export const updateCmaReportConfigSchema = z.object({
  includedSections: z.array(z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  coverLetterOverride: z.string().optional(),
  layout: z.enum(['two_photos', 'single_photo', 'no_photos']).optional(),
  template: z.string().optional(),
  theme: z.string().optional(),
  photoLayout: z.enum(['first_dozen', 'all', 'ai_suggested', 'custom']).optional(),
  mapStyle: z.enum(['streets', 'satellite', 'dark']).optional(),
  showMapPolygon: z.boolean().optional(),
  includeAgentFooter: z.boolean().optional(),
  coverPageConfig: coverPageConfigSchema.optional(),
  customPhotoSelections: z.record(z.string(), z.array(z.string())).optional(),
});

// Cover page config validation
const coverPageConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  showDate: z.boolean(),
  showAgentPhoto: z.boolean(),
  background: z.enum(['none', 'gradient', 'property']),
});
```

---

## Usage Flow

### 1. Opening Presentation Builder

```
User navigates to /cmas/:id/presentation
  → CMAPresentationBuilder loads
  → Fetches CMA data with presentation settings
  → Fetches agent profile, company settings
  → Initializes state from saved settings or defaults
```

### 2. Configuring Sections

```
User toggles sections on/off in Sections tab
  → Updates includedSections state
  → Live preview immediately reflects changes
  → setHasChanges(true) enables save button
```

### 3. Editing Content

```
User edits cover page, cover letter, or adjustments
  → Component state updates
  → Preview reflects changes in real-time
  → Save button becomes active
```

### 4. Saving Presentation

```
User clicks "Save Presentation"
  → PATCH /api/cmas/:id with presentation config
  → Toast notification confirms save
  → hasChanges resets to false
```

### 5. Exporting PDF

```
User clicks "Export PDF"
  → CMAPdfDocument generates PDF blob
  → Browser downloads file
  → Uses @react-pdf/renderer (client-side)
```

---

## Key Implementation Notes

1. **Section Order Persistence:** Section order is stored as an array of section IDs, allowing drag-and-drop reordering.

2. **Photo Selection:** The `ai_suggested` option queries the Repliers `imageInsights` API to rank photos by quality/relevance.

3. **Map Static Export:** For PDF export, static map images are generated using Mapbox Static Images API.

4. **Theme Synchronization:** Maps automatically switch between light/dark styles based on ThemeContext.

5. **Brochure Storage:** Uses Replit Object Storage (GCS-backed) with presigned URL upload flow.

6. **Adjustment Calculations:** All calculations run client-side in real-time using the adjustmentCalculations library.

7. **Template System:** Templates store section configuration, layout, and content settings for reuse across CMAs.
