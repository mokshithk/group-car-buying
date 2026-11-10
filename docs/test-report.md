# Group Car Buying Platform — QA & Test Execution Report

## 1. Execution Summary

- **Date of Verification**: `2026-11-10`
- **Target Backend**: Remote Supabase project `hjqpprhljvwmcelgwznq` (`migrations 001`–`007` applied)
- **Unit Tests**: **10 passed** (`tests/unit/business-rules.spec.ts`)
- **Playwright E2E Tests**: **20 passed** (`13` in `tests/e2e.spec.ts` + `7` in `tests/admin.e2e.spec.ts`) — **30 total Playwright checks passed** (`0` failed, `0` skipped)
- **Static Quality Gates**:
  - `npm run typecheck`: `0` errors
  - `npm run lint`: `0` errors (`4` pre-existing warnings in non-admin files `Toast.tsx`, `AuthContext.tsx`, `DealerStatusPage.tsx`, `PendingApprovalPage.tsx`)
  - `npm run build`: clean Vite production build (`dist/index.html`, `1722` modules transformed)
- **Database Schema & RLS Status**: `24` public tables with Row-Level Security (`RLS`) enabled, `24` admin/helper SQL functions and `65` RLS policies verified at migration `006` (plus `is_dealer_owner_of` replacing `3` recursive policies in `007`). Non-destructive SQL test suite (`supabase/tests/admin_rls_and_rules.sql`) passed remotely prior to `007_fix_dealer_users_rls_recursion.sql`; post-`007` authenticated queries and live admin RPCs were verified via live Supabase queries and the `30/30` Playwright suite.

---

## 2. Comprehensive Verification Matrix

| Area / Module | Feature / Business Rule Verified | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Auth & OTP UI Flow** | Buyer/dealer signup validation, OTP verification screen transitions, forgot-password OTP request & unregistered-email guard (`mailer_autoconfirm: true`) | `tests/e2e.spec.ts` (`#4`, `#5`, `#8`, `#11`, `#12`) | Passed |
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

- **Pure Unit Suite (`tests/unit/business-rules.spec.ts`, `10` tests)**:
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
- **Core Platform E2E (`tests/e2e.spec.ts`, `13` tests)**:
  Exercises public browsing, role chooser, buyer/dealer signup OTP screen transitions, forgot-password flow, dealer pending/status screens, login errors, and unauthenticated route guards (`admin` and buyer/dealer).
- **Admin Module E2E (`tests/admin.e2e.spec.ts`, `7` tests)**:
  Exercises RBAC (`buyer`/`dealer`/`admin`/`super_admin`), live dashboard metrics/chart/responsive viewports, dealership moderation lifecycle with re-authentication, buyers/catalogue/districts/groups/quotations/bookings/reports/ratings live rendering, super-admin invites + Account password guard, and Settings cap validation + audit log persistence + formula-safe CSV export against remote `hjqpprhljvwmcelgwznq`.
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

---

## 6. Manual Verification Checklist (Post-Setup)

Items requiring live external credentials or manual human verification outside automated runs:

- [ ] **Live `.env.local` Gmail SMTP Inbox Test**: Confirm real SMTP credentials (`SMTP_USER`, `SMTP_PASS`) in local `.env.local` deliver a live OTP email when accepting an invite end-to-end via `/admin/accept-invite`.
- [ ] **Optional Supabase Edge Function Dispatch**: Deploy `send-admin-invite` only if switching invite emails away from local `.env.local` SMTP in hosted production.
- [ ] **Post-Setup Security Hygiene**: Store the updated `autogroup256@gmail.com` (`super_admin`) password in a password manager, revoke the temporary Supabase Personal Access Token in Supabase Account Settings, and close/clear any terminal session holding `SUPABASE_ACCESS_TOKEN` or `SUPABASE_DB_PASSWORD`.
