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

- [x] **Task 14**: Dealer Eligible Groups, Quote Submission & Price History
  - Eligible groups list meeting visibility rule in dealer's brand & district
  - Bookings-so-far counter per group
  - Group detail dealer view: vehicle, variant, district, member count, bookings so far
  - All competitors' quotes viewer (dealer names, full breakdown)
  - Quotation submission form: ex-showroom, insurance, registration, discounts, accessories, auto-calculated on-road price, validity, terms
  - Missing component validation warning (incomplete quotes excluded from best price)
  - Edit quote price anytime with live competitor ranking ("you are currently #2 of 4") and price history logging
  - Verify build & commit: `add dealer groups, quotes, price history`

- [x] **Task 15**: Dealer Leads, Bookings Management & Notifications
  - Leads tab: interested buyers (name, phone, quote, date) with "Mark as Contacted" toggle
  - Bookings received: locked price snapshot, code, buyer contact, status
  - Dealer-fault cancellation trigger with 100% refund confirmation
  - Dealer delivery fallback trigger after configurable days
  - Read-only ratings and reports received
  - Real-time notification feed (new eligible group, competitor price change, new lead, new booking, buyer cancellation)
  - Verify build & commit: `add dealer leads, bookings, notifications`

- [x] **Task 16**: Playwright E2E Tests, Responsive Verification & Documentation
  - Playwright test suites covering full buyer and dealer journeys, RLS isolation, visibility rule, booking, refund math
  - Viewport screenshots at 360px, 768px, 1440px
  - `README.md` with setup, env vars, test running, simulated features
  - Architecture overview (`docs/architecture.md`)
  - Verify build & commit: `add playwright e2e tests, responsive verification and docs`

- [x] **Task 17**: Fix UUID Syntax in Seed and Codebase to Valid Hex Characters
  - Replaced non-hex IDs in `supabase/seed.sql` with RFC 4122 compliant hex UUIDs using consistent entity prefixes (`a` manufacturers, `b` models, `c` variants, `d` districts, `e` dealerships, `f` groups, `fa` quotations)
  - Made `supabase/seed.sql` fully re-runnable with `ON CONFLICT DO NOTHING;` on all table inserts
  - Synchronized all fallback seed catalogs, services (`catalogData.ts`, `groupService.ts`, `quoteService.ts`, `bookingService.ts`), auth contexts, and dealer rating models
  - Updated Playwright E2E tests and verified all 9 tests pass
  - Verify build & commit: `fix uuid syntax in seed and codebase to use valid hex characters`

- [x] **Task 18**: Fix Supabase Email Registration, Automated Auth Triggers & Rate Limits
  - Created `003_auth_user_trigger.sql` with `handle_new_user()` `SECURITY DEFINER` trigger on `auth.users` to automatically create profiles and dealerships without RLS blocking
  - Added user backfill query to restore profiles for any existing users created before the trigger
  - Updated RLS insert policies on `profiles`, `dealerships`, and `dealer_users` to allow registration inserts
  - Passed profile and dealership parameters in `supabase.auth.signUp()` options metadata
  - Handled email confirmation state gracefully: displayed verification confirmation screen with developer guidance on disabling "Confirm email" in Supabase
  - Translated common Supabase auth errors (`over_email_send_rate_limit`, `email_address_invalid`) into human-actionable messages
  - Added Playwright test 10 covering buyer registration form validation
  - Verified build and all 10 Playwright E2E tests pass
  - Verify build & commit: `fix supabase email registration flow and add auth triggers`

- [x] **Task 19**: Complete Auth and Data Layer on Real Supabase Backend
  - Removed demo mode, instant test session shortcuts, and hardcoded in-memory seed arrays from frontend
  - Separated clean catalog (`seed.sql`) from optional demo data (`seed_demo.sql`) using RFC-compliant hex UUIDs
  - Added database trigger migration `004_reliable_profile_trigger.sql` enforcing strict roles (`'buyer'` / `'dealer'`), owner linkage, and RLS policies
  - Built `/register` role chooser ("I'm a Buyer" vs "I'm a Dealership") and 6-digit OTP verification on registration
  - Built `/forgot-password` recovery flow with 6-digit OTP verification and secure password update
  - Protected routes against missing profiles and unrecognized roles with clear error screen and sign-out action
  - Created `docs/auth-setup.md` with complete email templates (`{{ .Token }}`), SMTP guidance, and OTP settings
  - Updated Playwright E2E test suite covering role chooser, registration OTP, password recovery OTP, error states, and route guards

- [x] **Task 20**: Complete Dealer Approval, Status Pages, Admin Portal, Tests & Documentation
  - Rewrote Dealer Pending page to display real showroom name, GSTIN, brands, district, address, and PENDING status directly from DB
  - Implemented 6-digit Email OTP verification with auto-focus, paste support, and auto-submit on 6th digit
  - Built status-aware login redirecting to buyer dashboard, dealer dashboard, dealer pending, dealer status, or admin portal
  - Built `/dealer/status` page for rejected and suspended dealerships showing rejection reason and compliance contact info
  - Built `/admin/dealers` administrative verification portal with status filter tabs, search, and approve/reject/suspend modal actions
  - Added migration `005_dealer_verification_and_admin.sql` with hardened trigger, admin-only status modification trigger, and `is_email_registered()` function
  - Created transactional email templates in `docs/email-templates/` (`confirm-signup.html`/`.txt` and `reset-password.html`/`.txt`)
  - Added test accounts setup (`.env.test.example`, `supabase/test_setup.sql`)
  - Added pure unit tests (`tests/unit/business-rules.spec.ts`) covering INR formatting, refund math, quote ranking, and incomplete quote validation
  - Updated Playwright E2E suite (`tests/e2e.spec.ts`) to 13 tests covering all responsive viewports, registration, error banners, route guards, and status views
  - Created comprehensive QA report (`docs/test-report.md`), refreshed `README.md`, `supabase/RUN_ME_FIRST.md`, and `docs/auth-setup.md`

---

## Admin Module Implementation Plan & Progress

- [x] **Admin Task 1**: Admin Roles, Security Model & Audit Helpers (`add admin roles and audit helpers`)
  - Extended `profiles.role` to support `super_admin` & `admin` with signup trigger lockdown, `is_admin()`, `is_super_admin()`, last `super_admin` guard, append-only `audit_log`, `admin_invites`, and transactional `SECURITY DEFINER` RPCs in `006_admin_module.sql`
  - Created `supabase/make_first_admin.sql`, `adminHelpers.ts` (validators, outlier detector, CSV builder, SHA-256 token hashing), `ForbiddenPage` (403), `ForcePasswordChangePage` (first-login 12+ char reset), and ESLint/Supabase CLI local tooling
- [x] **Admin Task 2**: Admin Layout Shell, Idle Timeout, Re-auth Modal & Dashboard (`add admin layout and dashboard`)
  - Built `AdminLayout` (grouped sidebar, breadcrumbs, persistent `"Signed in as <email> (Admin)"` label, 30-min idle timeout with 1-min warning modal, mobile slide-over drawer)
  - Built shared `DataTable` (sticky headers, tabular numbers, sorting, pagination, skeleton/empty/error states), `ReAuthModal` (password verification + mandatory reason), `AdminCharts` (30-day SVG trend chart), and `AdminDashboardPage` (`/admin/dashboard`)
- [x] **Admin Task 3**: Dealer & Buyer Management (`add dealer and buyer management`)
  - Refactored `AdminDealersPage` (`/admin/dealers`) with `AdminLayout`, `DataTable` pagination/sorting, CSV export, and `ReAuthModal` -> `admin_set_dealership_status`
  - Built `AdminDealerDetailPage` (`/admin/dealers/:id`) displaying profile, GSTIN, brands, districts, staff, quotes, bookings, ratings, reports, and status history
  - Built `AdminBuyersPage` (`/admin/buyers`) and `AdminBuyerDetailPage` (`/admin/buyers/:id`) with search/filters, suspend/reactivate/deactivate (`ReAuthModal`), and real deletion request processing synced with `ProfilePrivacyPage`
- [x] **Admin Task 4**: Catalogue, Districts & Groups Pages (`add catalogue, districts and groups pages`)
- [ ] **Admin Task 5**: Quotations, Bookings/Refunds, Reports & Ratings (`add bookings, reports and ratings pages`)
- [ ] **Admin Task 6**: Admin Invites, Accept Invite & Admin Account Pages (`add admin invites and account page`)
- [ ] **Admin Task 7**: Settings, Notifications, Audit Log, Exports & Group Expiry (`settings, notifications, audit log, exports and group expiry`)
- [ ] **Admin Task 8**: Remote Migrations, First Admin & Test Setup, Full Test Suite & Docs (`tests, test report and documentation`)
