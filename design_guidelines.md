# Design Guidelines: Real Estate Transaction Management App

## Design Approach

**Selected Approach:** Design System - Modern Productivity Dashboard
**Primary References:** Linear (clean hierarchy), Notion (flexible layouts), Asana (workflow clarity)
**Rationale:** This is a data-dense productivity tool requiring clarity, efficiency, and professional polish over visual flair.

## Core Design Principles

1. **Information Hierarchy:** Surface critical transaction data immediately - property address, status, timeline
2. **Workflow Clarity:** Clear visual distinction between active transactions, completed deals, and action items
3. **Dense but Scannable:** Maximize data visibility while maintaining breathing room
4. **Professional Authority:** Convey trust and competence for high-stakes real estate transactions

## Typography System

**Primary Font:** Inter (via Google Fonts CDN)
**Secondary Font:** IBM Plex Mono (for addresses, codes, MLS numbers)

- Page Titles: 2xl, semibold
- Section Headers: xl, semibold  
- Card Titles/Property Addresses: lg, medium
- Body Text: base, regular
- Metadata/Timestamps: sm, regular
- Labels/Tags: xs, medium, uppercase tracking-wide

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, and 8
- Component padding: p-4, p-6
- Section gaps: gap-6, gap-8
- Margins: m-4, m-6, m-8
- Card spacing: space-y-4

**Grid Structure:**
- Sidebar navigation: Fixed 240px width
- Main content: Full remaining width with max-w-7xl container
- Transaction cards: Grid 2-3 columns on desktop, single column mobile

## Component Library

### Navigation
**Left Sidebar:**
- Company logo at top (h-12)
- Main navigation links (Active Transactions, Archive, Settings, Integrations)
- User profile at bottom with avatar and name
- Active transaction counter badge

### Dashboard Views

**Transaction Card (Primary Component):**
- Property address as bold header with MLS# in mono font
- Status badge (In Contract, Pending, Closed)
- Transaction coordinator avatars (overlapping circles, max 3 visible + count)
- Key dates: Contract date, closing date, days remaining
- Quick actions: View Slack, View Emails, MLS Sheet
- CTA: "Open Transaction Details" button

**Transaction Detail Panel (Slide-over or Full Page):**
- Property address header with large text
- Tabbed sections: Overview, Documents, Communications, Timeline
- MLS data card with key metrics (price, bed/bath, sqft)
- CMA summary with comparable properties in compact table
- Email thread preview with "View in Slack" link
- FUB client card with contact info and profile link
- Activity timeline showing all events chronologically

### Forms & Inputs

**Create Transaction Form:**
- Property address autocomplete input
- MLS number field (mono font)
- Transaction coordinator multi-select dropdown
- Contract date picker
- Expected closing date picker
- Submit creates Slack channel automatically

**Input Fields:**
- Consistent height (h-10)
- Border treatment with focus states
- Label above input (text-sm, medium)
- Helper text below (text-xs)

### Data Display

**MLS Sheet Viewer:**
- Two-column layout: Property image gallery on left, data grid on right
- Data presented in labeled rows with clear hierarchy
- Download/Share buttons in header

**CMA Display:**
- Comparable properties in card grid (3 columns)
- Each card shows: address, price, bed/bath, sqft, DOM, thumbnail image
- Visual indicators for distance from subject property

**Email Integration Panel:**
- Gmail filter status indicator
- Recent emails list with subject, sender, preview
- "Open in Slack" button per email
- Filter management controls

### Status & Feedback

**Status Badges:**
- Rounded-full pills with px-3, py-1
- Text-xs, medium weight
- States: In Contract, Pending Inspection, Clear to Close, Closed

**Loading States:**
- Skeleton screens for data loading
- Inline spinners for actions
- Progress indicators for multi-step processes

**Notifications:**
- Toast messages (top-right) for actions
- Inline alerts for errors/warnings
- Success confirmations with checkmark icons

## Page Layouts

### Dashboard (Home)
- Filter bar at top: All, Active, Closing Soon, Archived
- Search bar for addresses
- Transaction cards in responsive grid
- Empty state with "Create Transaction" CTA

### Transaction Details
- Sticky header with property address and primary action
- Sidebar with quick stats and coordinator info
- Main content area with tabbed sections
- Fixed action bar at bottom (mobile)

### Settings/Integrations
- Card-based layout for each integration (Slack, Gmail, MLS, FUB)
- Connection status indicators
- API key management fields
- Test connection buttons

## Icons
**Library:** Heroicons (via CDN)
**Usage:**
- Navigation: Home, Archive, Settings, Integration icons
- Actions: External link, download, share, mail
- Status: Check circle, clock, alert triangle
- UI: Chevron, search, filter, close

## Animations
**Minimal, Purposeful Only:**
- Slide-over panel transitions (300ms ease)
- Loading skeleton shimmer
- Status badge color transitions
- NO scroll effects, parallax, or decorative animations

## Images
**Property Thumbnails:**
- Aspect ratio 4:3 or 16:9
- Rounded corners (rounded-lg)
- Used in transaction cards, CMA comparables, MLS sheets
- Placeholder: Gray background with house icon for missing images

**No Hero Images:** This is a utility app, not marketing - skip hero sections entirely.