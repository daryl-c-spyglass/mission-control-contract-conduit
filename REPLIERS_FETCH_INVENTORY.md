# Repliers Fetch Entry Points Inventory

**Generated:** 2026-01-13  
**Total Files Touching Repliers:** 5 (primary modules) + 3 (consumers/UI)

---

## Primary Entry Points (Root Modules)

### 1. `server/repliers.ts` - Core API Client

| Function | Endpoint(s) | Purpose | Notes |
|----------|-------------|---------|-------|
| `repliersRequest()` | `GET {any}` | Base fetch wrapper | Adds `REPLIERS-API-KEY` header |
| `testRepliersAccess()` | `POST /listings` | Dev testing/debugging | Returns sample listings for verification |
| `searchByMLSNumber()` | `POST /listings` | Fallback MLS lookup | boardId=53 (Unlock MLS Austin) |
| `fetchMLSListing()` | `GET /listings/{mlsNumber}`, `POST /listings` | Get single listing detail | Primary entry for transaction MLS data; extracts comparables if available |
| `fetchSimilarListings()` | `GET /listings/similar` | CMA comparables | **Has `type=Sale` filter + `isRentalOrLease` failsafe** |
| `searchByAddress()` | `GET /listings` | Address-based search | **Has `type=Sale` filter + `isRentalOrLease` failsafe** |
| `getBestPhotosForFlyer()` | `GET /listings/{mlsNumber}` | Image Insights photo selection | Uses `fetchMLSListing()` internally; selects best photos for marketing |

**Called by:**
- `server/routes.ts` (multiple routes)
- `server/repliers-sync.ts`
- `scripts/repliers_schema_audit.ts` (standalone script)

---

### 2. `server/repliers-sync.ts` - Automatic MLS Sync Service

| Function | Endpoint(s) | Purpose | Notes |
|----------|-------------|---------|-------|
| `syncTransactionMLS()` | N/A (calls `fetchMLSListing`, `fetchSimilarListings`) | Sync single transaction | Updates transaction with MLS data + CMA |
| `runSync()` | N/A (orchestrator) | Batch sync all active transactions | Runs every 15 minutes; filters `status=active\|in_contract` |
| `startRepliersSync()` | N/A | Starts scheduler | Called from `server/index.ts` on startup |
| `triggerManualSync()` | N/A | Manual sync trigger | Exposed via `POST /api/mls-sync/trigger` |

**Called by:**
- `server/index.ts` (startup)
- `server/routes.ts` (`POST /api/mls-sync/trigger`)

---

### 3. `scripts/repliers_schema_audit.ts` - Standalone Audit Script

| Function | Endpoint(s) | Purpose | Notes |
|----------|-------------|---------|-------|
| `fetchListings()` | `GET /listings` | Fetch sample listings for audit | Read-only; uses `resultsPerPage` param |
| `runAudit()` | N/A | Analyze Repliers schema alignment | Outputs to `artifacts/repliers-audit-report.json` |

**Called by:**
- Manual invocation: `npx tsx scripts/repliers_schema_audit.ts`

---

## API Routes (HTTP Entry Points)

### `server/routes.ts`

| Route | HTTP | Calls | Purpose | Rental Filter Applied? |
|-------|------|-------|---------|------------------------|
| `POST /api/transactions` | POST | `fetchMLSListing`, `fetchSimilarListings` | Create transaction with MLS data | Indirect (via `fetchSimilarListings`) |
| `POST /api/transactions/:id/refresh-mls` | POST | `fetchMLSListing`, `fetchSimilarListings` | Refresh transaction MLS data | Indirect (via `fetchSimilarListings`) |
| `GET /api/listings/search` | GET | `fetchMLSListing`, `searchByAddress` | Search for listing by address/MLS# | **Yes** (via `searchByAddress`) |
| `GET /api/listings/:mlsNumber/best-photos` | GET | `getBestPhotosForFlyer` | Get AI-selected photos for flyer | No (single listing, not search) |
| `GET /api/test-repliers` | GET | `testRepliersAccess` | Debug endpoint | No |
| `GET /api/mls-sync/status` | GET | `getSyncStatus` | Get sync scheduler status | N/A |
| `POST /api/mls-sync/trigger` | POST | `triggerManualSync` | Trigger manual sync | Indirect (via sync service) |

---

## Client-Side Consumers

### `client/src/components/transaction-details.tsx`

| Usage | API Route | Purpose |
|-------|-----------|---------|
| `fetch(/api/listings/search?query=...)` | `GET /api/listings/search` | CMA property search in transaction details |

### `client/src/components/create-flyer-dialog.tsx`

| Usage | API Route | Purpose |
|-------|-----------|---------|
| `apiRequest("GET", /api/listings/{mlsNumber}/best-photos)` | `GET /api/listings/:mlsNumber/best-photos` | Get best photos for flyer generation |

### `client/src/components/create-transaction-dialog.tsx`

| Usage | API Route | Purpose |
|-------|-----------|---------|
| `apiRequest("POST", /api/transactions)` | `POST /api/transactions` | Create transaction with `fetchMlsData: true` |

---

## Rental Exclusion Coverage

| Entry Point | API-Level Filter | Local Failsafe |
|-------------|------------------|----------------|
| `fetchMLSListing()` | None (single listing) | None |
| `fetchSimilarListings()` | **`type=Sale`** | **`isRentalOrLease()` filter** |
| `searchByAddress()` | **`type=Sale`** | **`isRentalOrLease()` filter** |
| `searchListings()` | **`type=Sale`** | **`isRentalOrLease()` filter** |
| `scripts/repliers_schema_audit.ts` | None (audit only) | `detectRental()` for reporting |

### Gap Analysis

| Surface | Status | Notes |
|---------|--------|-------|
| Transaction MLS fetch | **Covered** | Single listing by MLS#, no search results |
| Similar listings/CMA | **Covered** | `type=Sale` + `isRentalOrLease` failsafe |
| Address search | **Covered** | `type=Sale` + `isRentalOrLease` failsafe |
| Sync service | **Covered** | Uses `fetchMLSListing` + `fetchSimilarListings` |
| Audit script | N/A | Read-only analysis, reports rentals but doesn't filter |

---

## Call Graph Summary

```
server/index.ts
  └── startRepliersSync()
        └── server/repliers-sync.ts
              ├── fetchMLSListing()  ──────┐
              └── fetchSimilarListings() ──┤
                                           │
server/routes.ts                           │
  ├── POST /api/transactions ──────────────┤
  │     ├── fetchMLSListing()              │
  │     └── fetchSimilarListings()         │
  ├── POST /api/transactions/:id/refresh-mls
  │     ├── fetchMLSListing()              │
  │     └── fetchSimilarListings()         │
  ├── GET /api/listings/search ────────────┤
  │     ├── fetchMLSListing()              │
  │     └── searchByAddress()              │
  ├── GET /api/listings/:mlsNumber/best-photos
  │     └── getBestPhotosForFlyer() ───────┤
  ├── GET /api/test-repliers               │
  │     └── testRepliersAccess()           │
  └── POST /api/mls-sync/trigger           │
        └── triggerManualSync() ───────────┘
                                           │
                                           v
                              server/repliers.ts
                                ├── repliersRequest()
                                │     └── fetch("https://api.repliers.io/...")
                                ├── fetchMLSListing()
                                ├── fetchSimilarListings()
                                ├── searchByAddress()
                                ├── getBestPhotosForFlyer()
                                └── testRepliersAccess()
```

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `REPLIERS_API_KEY` | Yes | API authentication header |
| `REPLIERS_BASE_URL` | No | Override base URL (default: `https://api.repliers.io`) |

---

## File Summary

| File | Type | Repliers Functions |
|------|------|-------------------|
| `server/repliers.ts` | Core client | `repliersRequest`, `fetchMLSListing`, `fetchSimilarListings`, `searchByAddress`, `getBestPhotosForFlyer`, `testRepliersAccess` |
| `server/repliers-sync.ts` | Sync service | `startRepliersSync`, `triggerManualSync`, `runSync` |
| `server/routes.ts` | HTTP routes | 7 routes consuming Repliers functions |
| `scripts/repliers_schema_audit.ts` | Audit script | `fetchListings`, `runAudit` |
| `shared/lib/listings.ts` | Shared predicates | `isRentalOrLease`, `getDisplayDOM`, `hasAccurateDOM`, `excludeRentals` |

---

## Summary

- **Total primary Repliers modules:** 3 (`server/repliers.ts`, `server/repliers-sync.ts`, `scripts/repliers_schema_audit.ts`)
- **Total HTTP routes consuming Repliers:** 7
- **Total client-side consumers:** 3 components
- **Rental exclusion coverage:** All search/list endpoints protected with `type=Sale` API filter + local `isRentalOrLease` failsafe
