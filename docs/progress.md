# Group Car Buying Platform — Implementation Progress

## Extracted Visual Style Summary (DesignLab & Uiverse Reference)
1. **Layout Rhythm**: Generous vertical section rhythm (80–120px desktop, 48–64px mobile), 12-column responsive grid with a 1240px max container and balanced margins.
2. **Type Scale**: Modern geometric sans-serif hierarchy; Display/H1 (44–56px bold/extrabold), H2 (30–36px), H3 (20–24px), Body (15–16px, 1.55 line height), and Subtext (12–13px).
3. **Spacing System**: Strict 8pt grid tokenized in increments of 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, preventing arbitrary margins.
4. **Color Palette**: Crisp neutral canvas (Slate-50 `#F8FAFC`, Pure White `#FFFFFF` cards), high-contrast slate text (Headings `#0F172A`, Body `#334155`), Hairline borders (`#E2E8F0`), Deep Royal Blue primary (`#1E3A8A` / `#2563EB`), Emerald accent for verified/savings (`#059669`), and Amber for pending/countdown (`#D97706`).
5. **Cards**: Clean flat-surface cards on white with subtle 1px border (`border-slate-200/80`), soft ambient drop-shadow (`shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]`), rounded-xl (14px) corners, and micro-hover elevation.
6. **Buttons & Controls**: Tactile pill and rounded-lg buttons with crisp 1px inner borders, subtle top-highlight gradient, tactile depression on press (`active:scale-[0.98]`), and high-contrast accessible focus rings (`ring-2 ring-blue-500/50 ring-offset-2`).
7. **Buyer vs Dealer Dialects**: Buyer interface is warm, spacious, and friendly; Dealer interface is denser and data-driven (actionable tables, status pills, side navigation) while preserving the same token palette.

---

## Task Checklist & Commit Plan

- [x] **Task 1**: Project Scaffolding & Configuration
  - Set up Vite + React + TypeScript, Tailwind CSS, React Router DOM, Lucide icons
  - Configure `.npmrc` (`cache=D:\dev-cache\npm`), `.gitignore`, TypeScript strict mode
  - Verify build & commit: `set up vite, tailwind, router and project config`

- [x] **Task 2**: Design Tokens & Base UI Component Library
  - Implement design tokens in Tailwind configuration (fonts, colors, spacing, shadows, radius)
  - Create base UI components inspired by Uiverse/DesignLab (Button, Input, Card, Badge, Modal, Tabs, Select, Toast, Skeleton)
  - Verify build & commit: `add design tokens and base ui components`

- [x] **Task 3**: Environment Handling, Supabase Client & Shared Types
  - Create `.env.example`, blank `.env.local`
  - Implement Supabase client wrapper with type definitions for all tables, views, and functions
  - Add Indian currency formatting helper (`₹12,80,000`), date helpers, and simulated mock fallback
  - Verify build & commit: `add env handling, types and supabase client`

- [x] **Task 4**: Database Schema Migrations & Business Logic
  - `supabase/migrations/001_initial_schema.sql`: profiles, districts, cars (manufacturers, models, variants), dealerships, dealer_users, groups, group_members, quotes, quote_versions, quote_items, interests, bookings, payments, refunds, settings, notifications, ratings, reports, audit_log
  - Group visibility function/view (>= 3 members, or == 2 members after 20 days; 1 member never visible)
  - Constraints: booking amount + fee < 10,000, unique active group per buyer per variant
  - Triggers: price change versioning, bookings-so-far counter, notification dispatch
  - Verify build & commit: `add schema migrations for core tables and business rules`

- [x] **Task 5**: RLS Policies, Seed Data, RUN_ME_FIRST & Dealer Approval Snippet
  - `supabase/migrations/002_rls_policies.sql`: strict RLS for Buyer, Dealer, and Admin
  - Dealer cannot see buyer phone/email before interest or booking
  - `supabase/seed.sql`: 15 districts, 12 real car models with 2-4 variants, 4-5 test dealerships, groups in multiple statuses, quotes (including expired and incomplete)
  - `supabase/RUN_ME_FIRST.md`: step-by-step SQL execution instructions
  - Dealer approval SQL snippet
  - RLS isolation verification queries
  - Verify build & commit: `add rls policies, seed data and approval snippet`

- [x] **Task 6**: Authentication, Role Guards & Auth Pages
  - Auth context and session management
  - Route guards (Buyer, Dealer, Guest) with redirect-back preserving intended destination
  - Shared Login page with role-based redirection
  - Buyer registration (district selection, consent checkbox)
  - Dealer registration (dealership details, GST, brands, districts)
  - Forgot password flow
  - Verify build & commit: `add auth context, role guards and auth pages`

- [x] **Task 7**: Public Pages (Home Preview & Car Detail)
  - Top navigation bar (Logo, Browse Cars, How it works, Login, Register)
  - Hero section with clear value proposition and disclaimers (no misleading savings, platform does not sell cars)
  - 4-step How It Works section
  - Filterable car catalog (brand, fuel, body type, budget, search) with "Starting from ₹X (indicative ex-showroom)"
  - Car detail page: specs, variants table, district active groups preview, "Find or create group"
  - Responsive footer with regulatory disclaimers
  - Verify build & commit: `add public preview landing and car detail pages`

- [x] **Task 8**: Buyer Preferences, Wishlist & Group Discovery
  - Buyer Preferences (preferred fuel, transmission, district, budget range)
  - Wishlist management (save/remove variants)
  - Find Groups page: filtered to buyer's district, same-variant matching, status badges
  - Join Group confirmation modal with clear notice: "Joining does not oblige you to buy"
  - Verify build & commit: `add buyer preferences, wishlist and group discovery`

- [x] **Task 9**: Group Creation, Group Detail & Invite System
  - Create Group flow (model & variant selection in buyer's district)
  - Group Detail view: status timeline, milestone badge ("Strong group" at target), member list displaying First Name + Initial only
  - Waiting countdown badge ("Becomes visible to dealers at 3 members, or after 20 days with 2 members")
  - Shareable invite link promoted when < 3 members
  - Leave group (next member becomes owner if creator leaves) & Rejoin while open
  - Expired/Cancelled group view with "Find similar group" and "Create new group"
  - Verify build & commit: `add group creation, group detail and invite link`

- [x] **Task 10**: Buyer Dashboard & Quotation Comparison
  - Buyer dashboard: active groups summary, status-based action items, expiring quote alerts, activity feed
  - Quotations comparison table (desktop table / mobile swipeable card view)
  - Dealer showroom names displayed
  - Expired quotes greyed and disabled
  - Incomplete quotes flagged and excluded from lowest price/savings calculations
  - Quotation breakdown modal with price change history timeline
  - Printable / downloadable quote with unique verification code
  - Verify build & commit: `add buyer dashboard and offers comparison`

- [x] **Task 11**: Interested Flow & Simulated Payment with Booking
  - "I'm interested" flow: reveals showroom contact & address, notifies dealer with buyer name & phone, clear notice that price is not locked
  - "Book now" flow: booking amount (₹5,000) + platform fee (₹100) breakdown (total < ₹10,000)
  - 3-function simulated payment layer (`createPayment`, `verifyPayment`, `refundPayment`)
  - Payment UI with UPI / Card / Net Banking tabs and prominent "Test mode: no real money charged" banner
  - Tester outcome controls: Success, Failed, Cancelled
  - On Success: locked price snapshot created, buyer automatically removed from group, unique booking code generated
  - On Failure: no booking, buyer remains in group
  - Idempotent click handling & unique constraint prevention
  - Verify build & commit: `add interested flow and simulated payment with booking`

- [x] **Task 12**: My Bookings, Cancellation Preview, Delivery & Reviews
  - My Bookings page: active bookings, locked price snapshot, unique code
  - Cancellation & switch comparison preview: real cost of cancelling (5% retained on buyer cancellation, platform fee non-refundable vs dealer price difference)
  - Dealer-fault cancellation (100% booking amount + fee refund)
  - Delivery confirmation ("I received my car") closing booking as DELIVERED
  - Dealer rating & review form (unlocked upon delivery)
  - Report dealer form ("did not honor price", etc.)
  - Notifications center & Profile / privacy management (consent toggle, data download, account deletion)
  - Verify build & commit: `add my bookings, cancel/refund, delivery, rating, report`

- [x] **Task 13**: Dealer Registration, Pending Screen & Showroom Management
  - Dealer pending approval screen (until dealership status is VERIFIED)
  - Dealer dashboard: summary cards (new eligible groups, active quotes, interested leads, bookings)
  - Showroom profile editor (brands, districts, address, GST, contact, map link)
  - Staff management (add/remove staff users, roles: owner, staff)
  - Dealer disclaimers banner
  - Verify build & commit: `add dealer registration, profile, staff`

- [ ] **Task 14**: Dealer Eligible Groups, Quote Submission & Price History
  - Eligible groups list meeting visibility rule in dealer's brand & district
  - Bookings-so-far counter per group
  - Group detail dealer view: vehicle, variant, district, member count, bookings so far
  - All competitors' quotes viewer (dealer names, full breakdown)
  - Quotation submission form: ex-showroom, insurance, registration, discounts, accessories, auto-calculated on-road price, validity, terms
  - Missing component validation warning (incomplete quotes excluded from best price)
  - Edit quote price anytime with live competitor ranking ("you are currently #2 of 4") and price history logging
  - Verify build & commit: `add dealer groups, quotes, price history`

- [ ] **Task 15**: Dealer Leads, Bookings Management & Notifications
  - Leads tab: interested buyers (name, phone, quote, date) with "Mark as Contacted" toggle
  - Bookings received: locked price snapshot, code, buyer contact, status
  - Dealer-fault cancellation trigger with 100% refund confirmation
  - Dealer delivery fallback trigger after configurable days
  - Read-only ratings and reports received
  - Real-time notification feed (new eligible group, competitor price change, new lead, new booking, buyer cancellation)
  - Verify build & commit: `add dealer leads, bookings, notifications`

- [ ] **Task 16**: Playwright E2E Tests, Responsive Verification & Documentation
  - Playwright test suites covering full buyer and dealer journeys, RLS isolation, visibility rule, booking, refund math
  - Viewport screenshots at 360px, 768px, 1440px
  - `README.md` with setup, env vars, test running, simulated features
  - Architecture overview (`docs/architecture.md`)
  - Verify build & commit: `add playwright e2e tests, responsive verification and docs`
