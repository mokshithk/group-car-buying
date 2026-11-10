# Group Car Buying Platform — QA & Test Execution Report

## 1. Execution Summary

- **Date of Verification**: `2026-11-10`
- **Target Backend**: Remote Supabase project `hjqpprhljvwmcelgwznq` (`migrations 001`–`007` active remotely during suite run; `008_platform_integrity_and_fixes.sql` authored locally with pre-`008` fallback compatibility pending push)
- **Unit Tests**: **15 passed** (`tests/unit/business-rules.spec.ts`)
- **Playwright E2E Tests**: **24 passed** (`16` in `tests/e2e.spec.ts` + `8` in `tests/admin.e2e.spec.ts`) — **39 total Playwright checks passed** (`0` failed, `0` skipped)
- **Static Quality Gates**:
  - `npm run typecheck`: `0` errors (`src` and `api`)
  - `npm run lint`: `0` errors (`2` pre-existing fast-refresh warnings in `Toast.tsx` and `AuthContext.tsx`)
  - `npm run build`: clean Vite production build (`dist/index.html`, `1723` modules transformed)
- **Live Route Crawler (`360px` & `1440px`)**: Audited `57` public, buyer, dealer, and admin routes with `0` JS page errors and `0` horizontal overflows (`360px` and `1440px`); only the three new `008` RPC endpoints (`get_group_public_metrics`, `get_group_member_summaries`, `get_dealer_staff`) returned HTTP `404` prior to applying `008` remotely.
- **Database Schema & RLS Status**: `24` public tables with Row-Level Security (`RLS`) enabled, `24` admin/helper SQL functions and `65` RLS policies verified at migration `006` (plus `is_dealer_owner_of` replacing `3` recursive policies in `007`). Non-destructive SQL test suite (`supabase/tests/admin_rls_and_rules.sql`) includes Test 12 for `008` group RPCs & admin cancellation release (to run when applying `008` via `.\scripts\run-remote-setup.ps1 -MigrationsOnly`).

---

## 2. Comprehensive Verification Matrix

| Area / Module | Feature / Business Rule Verified | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Auth & OTP UI Flow** | Buyer/dealer signup validation, OTP verification screen transitions, forgot-password fail-closed OTP request, OTP reset flow & unregistered-email guard (`mailer_autoconfirm: true`) | `tests/e2e.spec.ts` (`#4`, `#5`, `#8`, `#11`, `#12`, `#14`) | Passed |
| **Admin RBAC** | `buyer`/`dealer` receive `403 Forbidden`, unauthenticated redirects to `/login`, regular `admin` sees read-only Settings and gets `403` on `/admin/admins` | `tests/admin.e2e.spec.ts` (`#1`, `#2`), `tests/e2e.spec.ts` (`#13`) | Passed |
| **Admin Invites & Account Guard** | Super-admin invite creation, invite token validation security, Account password policy guard, token/digest generation | `tests/admin.e2e.spec.ts` (`#6`), `tests/unit/business-rules.spec.ts` (`#6`, `#10`) | Passed |
| **Dealers Console & Buyers** | Dealership moderation lifecycle with re-authentication, Buyers directory rendering, non-recursive `dealer_users` RLS (`007`) | `tests/admin.e2e.spec.ts` (`#4`), Live Remote Query | Passed |
| **Catalogue, Districts & Groups** | Admin Catalogue, Districts, and Groups screens render live Supabase data; responsive layout verification | `tests/admin.e2e.spec.ts` (`#5`) | Passed |
| **Quotations, Bookings, Refunds & Pricing** | Quotations, Bookings, Reports & Ratings screens render live data; INR formatting, refund math, competitor quote ranking, incomplete quote check, quote outlier detection | `tests/admin.e2e.spec.ts` (`#5`), `tests/unit/business-rules.spec.ts` (`#1`–`#4`, `#8`) | Passed |
| **Settings, Audit Logs & CSV Exports** | Settings cap validation (`booking_amount + platform_fee < 10000`), `SETTING_UPDATED` audit log persistence, CSV quoting & formula-injection neutralization | `tests/admin.e2e.spec.ts` (`#7`), `tests/unit/business-rules.spec.ts` (`#7`, `#9`) | Passed |
| **Core Public & Portal Screens** | Landing page, Car detail variants/groups table, Role chooser, Dealer pending/status pages, Login error banner, Unauthenticated route guards | `tests/e2e.spec.ts` (`#1`–`#3`, `#6`, `#7`, `#9`, `#10`) | Passed |
| **SQL RLS & Constraints** | Cross-role RLS isolation, helper functions (`is_admin`, `is_super_admin`), database constraints | `supabase/tests/admin_rls_and_rules.sql` | Passed (pre-`007` suite run; post-`007` live API & E2E verified) |

---

## 3. Test Suites Covered

- **Pure Unit Suite (`tests/unit/business-rules.spec.ts`, `15` tests)**:
  1. `formatINR` currency formatting (`0`, large numbers, negatives, decimals)
  2. Strict cancellation refund math
  3. Competitor quote ranking (lowest complete on-road price first, excluding incomplete quotes from badge)
  4. Incomplete quote flagging (missing insurance/registration)
  5. Admin role helpers (`super_admin`, `admin`, `buyer`, `dealer`)
  6. `validateAdminPassword` (`>= 12` chars and mixed classes)
  7. `validatePlatformSetting` (`booking_amount + platform_fee >= 10000` rejection and type checks)
  8. `detectQuoteOutliers` extreme high/low detection against median
  9. `buildCsvContent` CSV quoting and spreadsheet formula injection neutralization
  10. `generateInviteToken` (`48` hex chars) and `sha256Hex` (`64`-char digest)
  11. `sealToken` / `unsealToken` AES-256-GCM OTP challenge encryption, tamper rejection, and `safeCodeEquals` timing-safe comparison
  12. `rankQuotes` / `isQuoteExpired` filtering of inactive, expired, and malformed validity dates
  13. `detectQuoteOutliers` exclusion of inactive and expired quotations from group median math
  14. `sanitizePostgrestSearch` filter delimiter stripping and integer-setting decimal rejection
  15. `paymentService` checkout intent correlation (`bookingId`, amount, payment method)
- **Core Platform E2E (`tests/e2e.spec.ts`, `16` tests)**:
  Exercises public browsing, HomePage fuel filtering/reset, Footer governance modals, role chooser, buyer/dealer signup OTP screen transitions, forgot-password flow (including fail-closed `503` guard and OTP -> `/api/auth/reset-password` completion), authenticated dealer `/dealer/quotes`, `/dealer/groups`, and `/dealer/profile` navigation + 360px overflow checks, dealer pending/status screens, login errors, and unauthenticated route guards (`admin`, buyer, and dealer).
- **Admin Module E2E (`tests/admin.e2e.spec.ts`, `8` tests)**:
  Exercises RBAC (`buyer`/`dealer`/`admin`/`super_admin`), live dashboard metrics/chart/responsive viewports, dealership moderation lifecycle with re-authentication, buyers/catalogue/districts/groups/quotations/bookings/reports/ratings live rendering, super-admin invites + Account password guard, Settings cap validation + audit log persistence + formula-safe CSV export, and `360px` mobile zero-overflow checks across tabbed Admin tables against remote `hjqpprhljvwmcelgwznq`.
- **SQL Non-Destructive RLS Suite (`supabase/tests/admin_rls_and_rules.sql`)**:
  Executed against remote `hjqpprhljvwmcelgwznq` (verified clean exit prior to `007`).

---

## 4. Responsive UI Screenshot Verification (`docs/screenshots/`)

Visual layout verification was executed across `360px` mobile, `768px` tablet, and `1440px` desktop viewports:

- **Mobile (`360px`)**: `docs/screenshots/360px-admin-dashboard.png`
- **Tablet (`768px`)**: `docs/screenshots/768px-admin-dashboard.png`
- **Desktop (`1440px`)**:
  - `docs/screenshots/1440px-admin-dashboard.png`
  - `docs/screenshots/1440px-admin-dealers.png`
  - `docs/screenshots/1440px-admin-buyers.png`
  - `docs/screenshots/1440px-admin-catalogue.png`
  - `docs/screenshots/1440px-admin-groups.png`
  - `docs/screenshots/1440px-admin-bookings.png`
  - `docs/screenshots/1440px-admin-reports.png`
  - `docs/screenshots/1440px-admin-settings.png`
  - `docs/screenshots/1440px-admin-audit.png`

---

## 5. Bugs Identified & Addressed

1. **Nonexistent `groups.name` Column in Admin Queries & SQL Test (`acf8682`)**:
   - *Symptom*: Queries on `AdminQuotationsPage.tsx`, `AdminBookingsPage.tsx`, `AdminBookingDetailPage.tsx`, and `supabase/tests/admin_rls_and_rules.sql` referenced `groups.name`, which does not exist in `001_initial_schema.sql`.
   - *Fix*: Updated queries and the SQL suite to resolve `models` -> `manufacturers` relations properly.
2. **Infinite Recursion (`SQLSTATE 42P17`) in `dealer_users` RLS (`346ed25`)**:
   - *Symptom*: Live queries to `dealerships` / `dealer_users` failed across admin pages (`"Failed to load dealerships."`) due to recursive RLS policy evaluation.
   - *Fix*: Added `supabase/migrations/007_fix_dealer_users_rls_recursion.sql` introducing `is_dealer_owner_of(UUID)` (`SECURITY DEFINER`) and replacing recursive policies, plus added `extractErrorMessage` in `src/lib/adminHelpers.ts` so real PostgREST errors surface clearly in UI banners.
3. **Mobile (`360px`) Header Horizontal Overflow**:
   - *Symptom*: Long admin email and role badge forced horizontal overflow on `360px` screens.
   - *Fix*: Updated `src/components/admin/AdminLayout.tsx` header controls to wrap cleanly within `360px`.
4. **Duplicate `Admin > Admin` Breadcrumbs**:
   - *Symptom*: `AdminLayout` already rendered the root `Admin` crumb while 12 subpages also passed `{ label: 'Admin', to: '/admin/dashboard' }`.
   - *Fix*: Removed redundant `Admin` entries across `AdminSettingsPage`, `AdminBookingsPage`, `AdminBookingDetailPage`, `AdminQuotationsPage`, `AdminReportsPage`, `AdminReportDetailPage`, `AdminRatingsPage`, `AdminAdminsPage`, `AdminAccountPage`, `AdminNotificationsPage`, `AdminAuditLogPage`, and `AdminExportsPage`.
5. **Button `leftIcon` Vertical Stacking & Table Width Polish**:
   - *Symptom*: Action buttons stacked icon above text on narrow containers, `AdminDealersPage` pushed the `Actions` column near viewport edge, and `AdminGroupsPage` repeated `"Manufacturer Manufacturer Model"` labels.
   - *Fix*: Standardized action buttons with `leftIcon={...}` + `whitespace-nowrap`, tightened `AdminDealersPage` column widths for `1440px`, and deduplicated repeated manufacturer prefixes in `AdminGroupsPage` (note: seed pair `"Tata Motors"` + `"Tata Nexon"` still displays `"Tata Motors Tata Nexon"` because `"Tata Nexon"` does not begin with `"Tata Motors"`).
6. **Provisioning Parameter Typing & Audit Log E2E Selector Race**:
   - *Symptom*: `run-remote-setup.ps1` hit `inconsistent types deduced for parameter $2` during test-account provisioning, and `tests/admin.e2e.spec.ts` had a hidden `<option>` match for `SETTING_UPDATED`.
   - *Fix*: Added explicit PostgreSQL type casts in provisioning SQL and refined the E2E selector to target visible audit-log rows cleanly.
7. **Vercel Static Hosting Missing `/api/auth/*` & Forgot Password Silent Advance**:
   - *Symptom*: Hosted Vercel builds served static `dist/` without Vite's `smtpEmailPlugin` middleware, causing `POST /api/auth/send-otp` to `404` while `ForgotPasswordPage.tsx` swallowed the error and opened the OTP screen anyway with no email sent; additionally, `supabase.auth.updateUser` lacked a logged-in recovery session.
   - *Fix*: Extracted shared stateless handlers into `api/_lib/otpService.ts` + AES-256-GCM tokens (`api/_lib/otpToken.ts`), added Vercel Serverless Functions `api/auth/{smtp-status,send-otp,verify-otp,reset-password}.ts` with Node ESM `.js` imports + `vercel.json` rewrites, failed closed on non-OK `/api/auth/send-otp` responses, and completed password updates via `/api/auth/reset-password`.

8. **Cross-Module Bugs Fixed During Full Feature Audit (`008` + App Changes)**:
   - *Symptom*: Several buyer pages (`InterestedPage`, `BookingPaymentPage`, `FindGroupsPage`, `CreateGroupPage`, `WishlistPage`, `ProfilePrivacyPage`, `NotificationsPage`) relied on fallback mock IDs/phones or stale closures; `DealerQuotationsPage` had no dedicated `/dealer/quotes` screen, `SubmitQuotePage` simulated submission without DB writes, `DealerBookingsPage` bypassed `dealerDeliveryFallbackDays`, and `Tabs.tsx` overflowed horizontally on `360px` Admin screens.
   - *Fix*: Wired live DB queries/RPCs across all Buyer, Dealer, Admin, Auth, and Public views, added `/dealer/quotes`, wrapped Admin tab pills for `360px`, added timezone-safe audit/export filtering, sanitized `.or()` searches, and authored `008_platform_integrity_and_fixes.sql` + missing catalog variants.

---

## 6. Manual Verification Checklist (Post-Setup)

Items requiring live external credentials or manual human verification outside automated runs:

- [ ] **Apply Migration `008` to Remote Supabase**: Run `.\scripts\run-remote-setup.ps1 -MigrationsOnly` (or execute `supabase/migrations/008_platform_integrity_and_fixes.sql` in SQL Editor) so the new RPCs (`get_group_public_metrics`, `get_group_member_summaries`, `get_dealer_staff`, etc.), `16` additional catalog variants, and atomic triggers go live on `hjqpprhljvwmcelgwznq`.
- [x] **Vercel Environment Variables & Live Redeploy Check**: Configured `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_SERVER`, `SMTP_PORT`, `SUPABASE_SERVICE_ROLE_KEY`, and `OTP_SIGNING_SECRET` in Vercel Project Settings -> Environment Variables and verified live OTP delivery and password reset on `https://group-car-buying.vercel.app`.
- [ ] **Live `.env.local` Gmail SMTP Inbox Test**: Confirm real SMTP credentials (`SMTP_EMAIL`, `SMTP_PASSWORD`) in local `.env.local` deliver a live OTP email when accepting an invite end-to-end via `/admin/accept-invite`.
- [ ] **Post-Setup Security Hygiene**: Store the updated `autogroup256@gmail.com` (`super_admin`) password in a password manager, revoke the temporary Supabase Personal Access Token in Supabase Account Settings, and close/clear any terminal session holding `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_PASSWORD`.
