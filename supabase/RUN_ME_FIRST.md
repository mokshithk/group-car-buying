# Supabase Setup Guide & Execution Order

Follow these steps in your Supabase project's **SQL Editor** (`https://supabase.com/dashboard/project/<your-project-id>/sql`).

---

## 1. Migration Execution Order

Run each of these scripts in your Supabase SQL Editor in the exact sequence below:

1. **Step 1: Core Schema, Constraints & Functions**
   - File: `supabase/migrations/001_initial_schema.sql`
   - Creates tables (`profiles`, `districts`, `manufacturers`, `models`, `variants`, `dealerships`, `dealer_users`, `groups`, `group_members`, `quotations`, `quotation_versions`, `quote_items`, `interests`, `bookings`, `payments`, `refunds`, `settings`, `notifications`, `dealer_ratings`, `reports`, `wishlist`, `buyer_preferences`, `audit_log`).
   - Creates the group visibility function `fn_is_group_visible_to_dealers`, view `dealer_eligible_groups_view`, and automated triggers for price versioning and group removal after booking.

2. **Step 2: Row Level Security (RLS) Policies**
   - File: `supabase/migrations/002_rls_policies.sql`
   - Enables RLS on all tables.
   - Enforces isolation: buyers only see groups in their district; dealers cannot see buyer phone/email before an interest/booking; dealers only see their own leads and bookings; quotation controls.

3. **Step 3: Base Trigger Schema**
   - File: `supabase/migrations/003_auth_user_trigger.sql`
   - Baseline trigger definitions on `auth.users`.

4. **Step 4: Reliable Profile & Dealership Trigger (Hardened)**
   - File: `supabase/migrations/004_reliable_profile_trigger.sql`
   - Sets up hardened `handle_new_user()` trigger running with `SECURITY DEFINER`.
   - Strictly enforces role safety (only `'buyer'` or `'dealer'`, never `'admin'`).
   - Automatically provisions a pending showroom in `dealerships` linked to `dealer_users` for dealer accounts.
   - Includes backfill for any existing accounts created before trigger setup.
   - Adds explicit own-profile read/update RLS policies.

5. **Step 5: Catalog Seed Data**
   - File: `supabase/seed.sql`
   - Seeds the real catalog: 15 Indian districts, 10 manufacturers, 12 car models, and 36 variants.
   - Pure catalog only — zero fake mock groups or fake dealerships.
   - Re-runnable: all inserts use `ON CONFLICT DO NOTHING;` and valid hex UUIDs.

6. **Step 6 (Optional): Test & Demonstration Data**
   - File: `supabase/seed_demo.sql`
   - Seeds sample test dealerships (3 `VERIFIED`, 1 `PENDING`), test groups (illustrating visibility thresholds), and initial quotations for demonstration.
   - Re-runnable with valid hex UUIDs.

---

## 2. Authentication & 6-Digit Email OTP Setup

For full instructions on configuring the 6-digit email OTP templates, token variables (`{{ .Token }}`), 10-minute expiry, and custom SMTP recommendations, please refer to:
👉 **[docs/auth-setup.md](../docs/auth-setup.md)**

### Quick Summary:
- **Authentication > Providers > Email**: Enable Email Provider = `ON`, Confirm email = `ON` (or `OFF` for instant local testing).
- **Authentication > Email Templates**: Replace default links with `{{ .Token }}` in "Confirm signup" and "Reset password".
- **Authentication > Rate Limits**: Set OTP length to 6 digits, expiration to 600 seconds.

---

## 3. Setting Up Environment Variables

1. Copy `.env.example` to `.env.local` in `D:\group-car-buying`:
   ```bash
   cp .env.example .env.local
   ```
2. Open `.env.local` and paste your project URL and public anon key from **Project Settings > API**:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
   ```
   *(Never commit `.env.local`. It is already excluded in `.gitignore`.)*

---

## 4. Manual Dealer Approval Snippet

When a dealership registers via `/register/dealer`, its initial status is `PENDING`. Run this SQL query in Supabase to approve the showroom:

```sql
UPDATE public.dealerships
SET status = 'VERIFIED',
    verified_at = NOW()
WHERE showroom_name = 'Your Dealership Name'
   OR owner_email = 'dealer@example.com';
```

Verify the approval status:
```sql
SELECT id, showroom_name, status, owner_email, verified_at 
FROM public.dealerships;
```

---

## 5. SQL Verification Checks (RLS Isolation)

Run these queries to verify data isolation:

```sql
-- 1. Profiles query (should only return own user profile under RLS):
SELECT id, full_name, phone, role FROM public.profiles;

-- 2. Group visibility rule verification:
SELECT 
    id, 
    variant_name, 
    active_members, 
    bookings_so_far, 
    is_visible 
FROM public.dealer_eligible_groups_view;
```
