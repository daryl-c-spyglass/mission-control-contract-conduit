# CMA Feature - Complete Export Bundle

This single file contains everything you need to integrate the CMA feature into another Replit app.

---

## QUICK START

### Step 1: Install Dependencies
```bash
npm install recharts react-leaflet leaflet @types/leaflet leaflet-draw @types/leaflet-draw
```

### Step 2: Add Leaflet CSS
Add to your main CSS or index.html:
```css
@import "leaflet/dist/leaflet.css";
@import "leaflet-draw/dist/leaflet.draw.css";
```

### Step 3: Add Routes to App.tsx
```tsx
import CMAs from "@/pages/CMAs";
import CMANew from "@/pages/CMANew";
import CMADetailPage from "@/pages/CMADetailPage";
import SharedCMAView from "@/pages/SharedCMAView";

<Route path="/cmas" component={CMAs} />
<Route path="/cmas/new" component={CMANew} />
<Route path="/cmas/:id" component={CMADetailPage} />
<Route path="/share/cma/:token" component={SharedCMAView} />
```

### Step 4: Add Navigation
```tsx
import { FileText } from "lucide-react";
<Link href="/cmas">
  <FileText className="w-4 h-4" />
  CMAs
</Link>
```

---

## DATABASE SCHEMA (shared/schema.ts)

Add this code:

```typescript
// CMA Schema
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
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCmaSchema = createInsertSchema(cmas).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertCma = z.infer<typeof insertCmaSchema>;
export type Cma = typeof cmas.$inferSelect;

// CMA Statistics Types
export interface PropertyStatistics {
  price: { range: { min: number; max: number }; average: number; median: number };
  pricePerSqFt: { range: { min: number; max: number }; average: number; median: number };
  daysOnMarket: { range: { min: number; max: number }; average: number; median: number };
  livingArea: { range: { min: number; max: number }; average: number; median: number };
  lotSize: { range: { min: number; max: number }; average: number; median: number };
  acres: { range: { min: number; max: number }; average: number; median: number };
  bedrooms: { range: { min: number; max: number }; average: number; median: number };
  bathrooms: { range: { min: number; max: number }; average: number; median: number };
  yearBuilt: { range: { min: number; max: number }; average: number; median: number };
}

export interface TimelineDataPoint {
  date: string;
  price: number;
  status: string;
  propertyId: string;
  address: string;
  daysOnMarket: number | null;
  cumulativeDaysOnMarket: number | null;
}
```

---

## STORAGE INTERFACE (server/storage.ts)

Add to IStorage interface:

```typescript
// CMA operations
getCma(id: string): Promise<Cma | undefined>;
getCmaByShareToken(token: string): Promise<Cma | undefined>;
getCmasByUser(userId: string): Promise<Cma[]>;
getAllCmas(): Promise<Cma[]>;
createCma(cma: InsertCma): Promise<Cma>;
updateCma(id: string, cma: Partial<Cma>): Promise<Cma | undefined>;
deleteCma(id: string): Promise<boolean>;
```

Add implementations:

```typescript
async getCma(id: string): Promise<Cma | undefined> {
  const result = await this.db.select().from(cmas).where(eq(cmas.id, id)).limit(1);
  return result[0];
}

async getCmaByShareToken(token: string): Promise<Cma | undefined> {
  const result = await this.db.select().from(cmas).where(eq(cmas.publicLink, token)).limit(1);
  return result[0];
}

async getCmasByUser(userId: string): Promise<Cma[]> {
  return await this.db.select().from(cmas).where(eq(cmas.userId, userId));
}

async getAllCmas(): Promise<Cma[]> {
  return await this.db.select().from(cmas);
}

async createCma(cma: InsertCma): Promise<Cma> {
  const result = await this.db.insert(cmas).values(cma as any).returning();
  return result[0];
}

async updateCma(id: string, updates: Partial<Cma>): Promise<Cma | undefined> {
  const result = await this.db.update(cmas)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(cmas.id, id))
    .returning();
  return result[0];
}

async deleteCma(id: string): Promise<boolean> {
  const result = await this.db.delete(cmas).where(eq(cmas.id, id));
  return result.rowCount! > 0;
}
```

---

## API ROUTES (server/routes.ts)

Add these routes:

```typescript
import { randomBytes } from "crypto";

// Helper function for statistics calculation
function calculateStatistics(properties: any[]) {
  const computeStats = (values: number[]) => {
    const filtered = values.filter(v => v > 0);
    if (filtered.length === 0) {
      return { average: 0, median: 0, range: { min: 0, max: 0 } };
    }
    const sorted = [...filtered].sort((a, b) => a - b);
    const average = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    return {
      average,
      median,
      range: { min: sorted[0], max: sorted[sorted.length - 1] }
    };
  };

  const prices = properties.map(p => {
    const isClosed = p.standardStatus === 'Closed';
    return isClosed 
      ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
      : Number(p.listPrice || 0);
  });
  
  const pricesPerSqFt = properties
    .filter(p => p.livingArea && Number(p.livingArea) > 0)
    .map(p => {
      const isClosed = p.standardStatus === 'Closed';
      const price = isClosed 
        ? (p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0))
        : Number(p.listPrice || 0);
      return price / Number(p.livingArea);
    });

  return {
    price: computeStats(prices),
    pricePerSqFt: computeStats(pricesPerSqFt),
    daysOnMarket: computeStats(properties.map(p => p.daysOnMarket || 0)),
    livingArea: computeStats(properties.map(p => Number(p.livingArea || 0))),
    lotSize: computeStats(properties.map(p => Number(p.lotSizeSquareFeet || 0))),
    acres: computeStats(properties.map(p => Number(p.lotSizeAcres || 0))),
    bedrooms: computeStats(properties.map(p => p.bedroomsTotal || 0)),
    bathrooms: computeStats(properties.map(p => p.bathroomsTotalInteger || 0)),
    yearBuilt: computeStats(properties.map(p => p.yearBuilt || 0)),
  };
}

// CMA CRUD routes
app.get("/api/cmas", async (req, res) => {
  try {
    const cmas = await storage.getAllCmas();
    res.json(cmas);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CMAs" });
  }
});

app.get("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch CMA" });
  }
});

app.post("/api/cmas", async (req, res) => {
  try {
    const user = req.user as any;
    const userId = user?.id || null;
    
    const cmaData = insertCmaSchema.parse({
      ...req.body,
      userId,
    });
    const cma = await storage.createCma(cmaData);
    res.status(201).json(cma);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid CMA data", details: error.errors });
    } else {
      res.status(500).json({ error: "Failed to create CMA" });
    }
  }
});

app.put("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.updateCma(req.params.id, req.body);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to update CMA" });
  }
});

app.patch("/api/cmas/:id", async (req, res) => {
  try {
    const cma = await storage.updateCma(req.params.id, req.body);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json(cma);
  } catch (error) {
    res.status(500).json({ error: "Failed to update CMA" });
  }
});

app.delete("/api/cmas/:id", async (req, res) => {
  try {
    const deleted = await storage.deleteCma(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete CMA" });
  }
});

// CMA Share routes
app.post("/api/cmas/:id/share", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const shareToken = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await storage.updateCma(req.params.id, {
      publicLink: shareToken,
      expiresAt,
    });

    res.json({
      shareToken,
      shareUrl: `${req.protocol}://${req.get('host')}/share/cma/${shareToken}`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

app.delete("/api/cmas/:id/share", async (req, res) => {
  try {
    const updated = await storage.updateCma(req.params.id, {
      publicLink: null,
      expiresAt: null,
    });
    if (!updated) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    res.json({ message: "Share link removed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove share link" });
  }
});

// Public CMA view
app.get("/api/share/cma/:token", async (req, res) => {
  try {
    const cma = await storage.getCmaByShareToken(req.params.token);
    if (!cma) {
      res.status(404).json({ error: "CMA not found or link expired" });
      return;
    }

    if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
      res.status(410).json({ error: "This CMA link has expired" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    const statistics = calculateStatistics(properties);
    
    const timelineData = properties
      .filter((p: any) => p.closeDate || p.listingContractDate)
      .map((p: any) => ({
        date: p.closeDate || p.listingContractDate,
        price: Number(p.closePrice || p.listPrice),
        status: p.standardStatus || 'Unknown',
        propertyId: p.id || p.listingId,
        address: p.unparsedAddress || 'Unknown',
        daysOnMarket: p.daysOnMarket ?? null,
        cumulativeDaysOnMarket: p.cumulativeDaysOnMarket ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({
      cma: {
        id: cma.id,
        name: cma.name,
        notes: cma.notes,
        createdAt: cma.createdAt,
        expiresAt: cma.expiresAt,
        subjectPropertyId: cma.subjectPropertyId,
      },
      properties,
      statistics,
      timelineData,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load shared CMA" });
  }
});

// CMA Statistics
app.get("/api/cmas/:id/statistics", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }
    const properties = (cma as any).propertiesData || [];
    res.json(calculateStatistics(properties));
  } catch (error) {
    res.status(500).json({ error: "Failed to calculate statistics" });
  }
});

// CMA Timeline
app.get("/api/cmas/:id/timeline", async (req, res) => {
  try {
    const cma = await storage.getCma(req.params.id);
    if (!cma) {
      res.status(404).json({ error: "CMA not found" });
      return;
    }

    const properties = (cma as any).propertiesData || [];
    const timelineData = properties
      .filter((p: any) => p.closeDate || p.listingContractDate)
      .map((p: any) => ({
        date: p.closeDate || p.listingContractDate,
        price: Number(p.closePrice || p.listPrice),
        status: p.standardStatus || 'Unknown',
        propertyId: p.id || p.listingId,
        address: p.unparsedAddress || 'Unknown',
        daysOnMarket: p.daysOnMarket ?? null,
        cumulativeDaysOnMarket: p.cumulativeDaysOnMarket ?? null,
      }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json(timelineData);
  } catch (error) {
    res.status(500).json({ error: "Failed to get timeline data" });
  }
});
```

---

## SQL MIGRATION

Run this to create the table:

```sql
CREATE TABLE cmas (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  name TEXT NOT NULL,
  subject_property_id TEXT,
  comparable_property_ids JSON NOT NULL,
  properties_data JSON,
  search_criteria JSON,
  notes TEXT,
  public_link TEXT UNIQUE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_cmas_user_id ON cmas(user_id);
CREATE INDEX idx_cmas_public_link ON cmas(public_link);
```

---

## SOURCE FILES TO COPY

Copy these files from this project to your other project:

### Pages (copy to client/src/pages/)
| File | Lines | Purpose |
|------|-------|---------|
| CMAs.tsx | 148 | CMA list/dashboard |
| CMANew.tsx | 222 | Create/modify CMA |
| CMADetailPage.tsx | 923 | View CMA with actions |
| SharedCMAView.tsx | 131 | Public shareable view |

### Components (copy to client/src/components/)
| File | Lines | Purpose |
|------|-------|---------|
| CMABuilder.tsx | 2,738 | Search form & property selection |
| CMAReport.tsx | 4,241 | Report with stats, charts, map |
| PolygonMapSearch.tsx | 204 | Map polygon drawing |
| VisualMatchPanel.tsx | 376 | AI visual match search |
| StatusFilterTabs.tsx | 57 | Status filter tabs |

**Total: ~9,040 lines of code**

---

## WHERE TO FIND THE SOURCE FILES

In this project, the source files are at:
- `docs/exports/source_files/` - Individual component files
- `docs/exports/CMA_ALL_SOURCE_FILES.txt` - All source files combined

To copy a file:
1. Click on it in the file explorer
2. Select all (Ctrl+A or Cmd+A)
3. Copy (Ctrl+C or Cmd+C)
4. Create new file in your other project
5. Paste (Ctrl+V or Cmd+V)

---

## REQUIRED PROPERTY FIELDS

Your Repliers API must return these fields:
- id, listingId
- standardStatus (Active, Active Under Contract, Closed)
- listPrice, closePrice
- livingArea, lotSizeSquareFeet, lotSizeAcres
- bedroomsTotal, bathroomsTotalInteger
- daysOnMarket, yearBuilt
- city, subdivisionName, unparsedAddress
- closeDate, listingContractDate
- photos (array of image URLs)
- latitude, longitude (for map)

---

## AUTOCOMPLETE ENDPOINTS NEEDED

CMABuilder uses these autocomplete endpoints:
- `/api/autocomplete/cities?q=...`
- `/api/autocomplete/subdivisions?q=...`
- `/api/autocomplete/schools?q=...`

Each should return: `[{ value: "Name", count: 123 }, ...]`

---

## OPTIONAL FEATURES

### Polygon Map Search
- Uses PolygonMapSearch component
- Requires `/api/properties/search/polygon` endpoint
- Can be disabled by removing the Map tab from CMABuilder

### Visual Match AI
- Uses VisualMatchPanel component
- Requires `/api/repliers/image-search` endpoint
- Can be disabled by removing the Visual Match section

---

## INTEGRATION PROMPTS

If you prefer to use AI Agent assistance, copy these prompts one at a time:

### Prompt 1: Database
```
Add CMA database schema with table for id, userId, name, subjectPropertyId, comparablePropertyIds (json array), propertiesData (json), searchCriteria (json), notes, publicLink (unique), expiresAt, createdAt, updatedAt. Add PropertyStatistics and TimelineDataPoint interfaces.
```

### Prompt 2: Storage
```
Add CMA storage methods: getCma, getCmaByShareToken, getCmasByUser, getAllCmas, createCma, updateCma, deleteCma. Implement using Drizzle ORM.
```

### Prompt 3: Routes
```
Add CMA API routes: GET/POST /api/cmas, GET/PUT/PATCH/DELETE /api/cmas/:id, POST/DELETE /api/cmas/:id/share, GET /api/share/cma/:token, GET /api/cmas/:id/statistics, GET /api/cmas/:id/timeline. Include calculateStatistics helper.
```

### Prompt 4: Pages
```
Create CMA pages: CMAs.tsx (list with sort), CMANew.tsx (create/modify), CMADetailPage.tsx (view with share/print), SharedCMAView.tsx (public view). Add routes to App.tsx.
```

### Prompt 5: Components
```
Create CMABuilder component with search form, autocomplete inputs, status filters, property type select, polygon map search, visual match AI, property results grid/list/table views, property selection, subject property picker, and CMA name input.
```

### Prompt 6: Report
```
Create CMAReport component with statistics cards, Compare tab (property cards), List tab (table), Map tab (Leaflet with price markers), Charts tab (Recharts timeline), pricing strategy section. Support include/exclude toggles and print styles.
```
