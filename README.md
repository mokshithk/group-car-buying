# Group Car Buying Platform

A transparent, collective vehicle purchasing web platform connecting prospective car buyers in the same district seeking the exact same vehicle variant into aggregated purchasing groups. Verified dealerships compete by offering itemized on-road quotations. Buyers can signal non-binding interest or lock in their price via simulated payment.

Built with **React 18**, **TypeScript**, **Tailwind CSS**, **Vite**, **Supabase** (PostgreSQL, triggers, functions, RLS), and tested with **Playwright**.

---

## Features

### Public Experience
- **Landing Page & Catalog**: Search & filter by brand, fuel type, body style, and indicative ex-showroom pricing.
- **Car Detail Page**: Technical specifications, variants breakdown, active groups in the user's district, and transparent disclaimers.
- **Responsive Layout**: Designed for mobile (360px), tablet (768px), and desktop (1440px).

### Buyer Module
- **District & Variant Matching**: Strictly matches buyers in the same district seeking the exact same variant.
- **Group Formation & Visibility**: Groups become visible to dealerships once they reach 3+ members, or after 20 days with 2 members. Groups with 1 member are never visible.
- **Privacy First**: Member lists only display first names and last initials (e.g., `Rahul S.`).
- **Offers Comparison**: Real-time dealer quotes breakdown. Quotes missing mandatory insurance or registration are marked **Incomplete** and strictly excluded from lowest-price highlights and savings calculations.
- **"I'm Interested" Flow**: Signal non-binding interest to connect with the showroom. Price is clearly disclosed as NOT locked.
- **"Book Now" & Price Lock**: Fixed booking deposit (₹5,000) + platform fee (₹100). Locks the on-road price until delivery. Upon payment, the buyer is automatically removed from the bidding group.
- **Cancellation & Refund Calculations**:
  - Buyer-initiated cancellation: 5% retained by showroom (₹250), ₹4,750 refunded, platform fee non-refundable.
  - Dealer-fault cancellation: 100% refund of booking deposit (₹5,000) + 100% refund of platform fee (₹100) = ₹5,100.
- **Delivery Confirmation & Reviews**: "I received my car" marks booking as DELIVERED and unlocks dealership rating and reporting.

### Dealer Module
- **Showroom Profile & Multi-Branch**: Configure authorized brands, operating districts, GST, contact info, and address.
- **Eligible Groups**: Filter eligible groups based on dealership's brand, district, and platform visibility rules.
- **Quote Submission & Versioning**: Live on-road calculation with complete price versioning and audit history.
- **Leads & Bookings Management**: Real-time feed of interested buyers and paid bookings with locked price snapshots.

### Admin Console (`/admin/*` — `admin` & `super_admin`)
- **Security & Access Control**: Shared `/login` entry; buyers & dealers receive a strict **403 Forbidden** screen on `/admin/*`; forced >= 12-character password change on first provisioned admin login; password re-authentication (`ReAuthModal`) on sensitive writes; 30-minute idle session timeout with 1-minute warning.
- **Dashboard & Analytics (`/admin/dashboard`)**: 6 live metric cards, pending approvals queue, group status distribution, refund/retention summary, and a 30-day SVG trend chart.
- **Dealers & Buyers Oversight (`/admin/dealers`, `/admin/buyers`)**: Search, district/status filters, detail views, approve/reject/suspend/reactivate showrooms (auto-deactivating quotes and flagging paid bookings on suspension), buyer suspension & privacy deletion workflow.
- **Catalogue & Districts (`/admin/catalogue`, `/admin/districts`)**: Manage manufacturers, models, variants (with image URL + SVG fallback), and districts via soft activation/deactivation.
- **Groups, Quotations, Bookings & Refunds (`/admin/groups`, `/admin/quotations`, `/admin/bookings`)**: Suspicious group flagging, manual/cron 1-member group expiry, quote outlier detection (>= threshold% vs group median) + full `quotation_versions` price history, dealer-fault forced cancellation refunds, and fallback delivery completion.
- **Trust & Moderation (`/admin/reports`, `/admin/ratings`)**: Repeat-offender flagging, warning notifications / suspension actions, and hiding/unhiding abusive buyer reviews.
- **Governance, System & Exports (`/admin/admins`, `/admin/settings`, `/admin/notifications`, `/admin/audit`, `/admin/exports`, `/admin/account`)**: One-time hashed admin invites with email OTP acceptance, `super_admin`-only settings enforcing `booking_amount + platform_fee < 10000`, broadcast announcements, append-only audit log explorer, and formula-safe CSV exports.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/mokshithk/group-car-buying.git
cd group-car-buying
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local` and add your Supabase credentials:
```bash
cp .env.example .env.local
```
Update `.env.local`:
```env
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Supabase Migrations & Database Setup
Run the SQL scripts in your Supabase SQL Editor in this exact order:
1. `supabase/migrations/001_initial_schema.sql` - Core schema, tables, constraints, visibility functions, and triggers.
2. `supabase/migrations/002_rls_policies.sql` - Row-level security policies enforcing buyer privacy and dealership isolation.
3. `supabase/migrations/003_storage_and_indexes.sql` - Performance indexes and document storage.
4. `supabase/migrations/004_auth_profile_trigger.sql` - Base automatic profile creation trigger.
5. `supabase/migrations/005_dealer_verification_and_admin.sql` - Hardened trigger (`handle_new_user()`), admin dealership status mutation lock, and `is_email_registered()` function.
6. `supabase/migrations/006_admin_module.sql` - Admin role hierarchy (`admin`, `super_admin`), last `super_admin` guard, `admin_invites`, append-only `audit_log`, 13 platform settings, moderation flags, and `SECURITY DEFINER` RPCs.
7. `supabase/migrations/007_fix_dealer_users_rls_recursion.sql` - `SECURITY DEFINER` helper `is_dealer_owner_of()` eliminating recursive RLS checks on `dealer_users`.
8. `supabase/seed.sql` - Real catalog data (districts, manufacturers, models, variants). Pure catalog with zero fake data.
9. `supabase/seed_demo.sql` - (Optional) Realistic test dealerships, demo buying groups, and quotations.
10. `supabase/test_setup.sql` - Provisions standardized `@autogroup.in` test accounts for automated & manual verification.
11. `supabase/make_first_admin.sql` - Documented SQL fallback to promote the initial `super_admin`.

For 6-digit `.env.local` SMTP OTP setup and admin onboarding details, see [docs/auth-setup.md](docs/auth-setup.md).

#### Admin Role Assignment Snippet
To promote an existing registered user to initial `super_admin`, run [supabase/make_first_admin.sql](supabase/make_first_admin.sql) or `node scripts/db-admin-ops.mjs bootstrap-first-admin`.

#### Manual Dealer Approval Snippet
Newly registered dealerships start with status `PENDING` until approved via `/admin/dealers` or direct SQL:
```sql
UPDATE public.dealerships
SET status = 'VERIFIED',
    verified_at = NOW(),
    updated_at = NOW()
WHERE name = '<Dealership Showroom Name>'
   OR contact_email = '<dealer_contact_email>';
```

---

## Simulated Systems & Architecture

### Simulated Payment Service
The platform does not process real card transactions. The payment layer in `src/lib/paymentService.ts` implements three standard methods:
- `createPayment({ bookingId, amount, currency, customer })`
- `verifyPayment({ paymentId, simulateOutcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' })`
- `refundPayment({ paymentId, amount, reason })`

The checkout interface provides a visible **"Test Mode: No real money is charged"** banner, allowing testers to trigger success, cancellation, or failure states to verify idempotent booking creation and automatic group member removal.

---

## Testing & Quality Assurance

### Pure Unit Tests
Run the unit test suite covering currency formatting, refund math, and quotation rankings:
```bash
npm run test:unit
```

### End-to-End Tests with Playwright
Run all unit and E2E tests:
```bash
npm test
```
Or run E2E suite specifically:
```bash
npm run test:e2e
```
Or run with UI mode:
```bash
npx playwright test --ui
```

All responsive screenshots at 360px, 768px, and 1440px are saved to `docs/screenshots/`.
Comprehensive test reports and verification matrices are documented in [docs/test-report.md](docs/test-report.md).
