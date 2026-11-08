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
- **Showroom Profile & Multi-Branch**: Configure authorized brands, operating districts, GST, contact info, and map links.
- **Staff Management**: Assign owner and staff roles.
- **Eligible Groups**: Filter eligible groups based on dealership's brand, district, and platform visibility rules.
- **Quote Submission & Versioning**: Live on-road calculation with complete price versioning and audit history.
- **Leads & Bookings Management**: Real-time feed of interested buyers and paid bookings with locked price snapshots.

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

### 4. Supabase Migrations
Run the migrations in your Supabase SQL Editor in the following order:
1. `supabase/migrations/001_initial_schema.sql` - Core tables, settings, visibility functions, and price versioning triggers.
2. `supabase/migrations/002_rls_policies.sql` - Row-level security policies enforcing buyer privacy and dealership isolation.
3. `supabase/seed.sql` - Optional seed data with catalog vehicles, sample groups, and dealerships.

#### Manual Dealer Approval Snippet
Until an administrative module is deployed, newly registered dealerships start with `PENDING` verification. Run this SQL query to verify a dealership:
```sql
UPDATE public.dealerships
SET verification_status = 'VERIFIED',
    updated_at = NOW()
WHERE id = '<DEALERSHIP_UUID>'; -- or WHERE name = 'Your Showroom Name'
```

---

## Simulated Systems & Architecture

### Simulated Payment Service
The platform does not process real card transactions. The payment layer in `src/lib/paymentService.ts` implements three standard methods:
- `createPayment({ bookingId, amount, currency, customer })`
- `verifyPayment({ paymentId, simulateOutcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' })`
- `refundPayment({ paymentId, amount, reason })`

The checkout interface provides a visible **"Test Mode: No real money is charged"** banner, allowing testers to trigger success, cancellation, or failure states to verify idempotent booking creation and automatic group member removal.

### Admin Module Scope
The platform schema fully supports platform-wide administrative controls (`settings` table, dealer verification statuses, platform fee overrides). The Admin UI is out of current scope and can be added using the existing schema foundation.

---

## Testing & Quality Assurance

### End-to-End Tests with Playwright
Run the complete E2E test suite:
```bash
npm run test:e2e
```
Or run with UI mode:
```bash
npx playwright test --ui
```

All responsive screenshots at 360px, 768px, and 1440px are saved to `docs/screenshots/`.
