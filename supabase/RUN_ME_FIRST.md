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

3. **Step 3: Storage & Performance Indexes**
   - File: `supabase/migrations/003_storage_and_indexes.sql`
   - Configures storage buckets, retention policies, and performance indexes.

4. **Step 4: Base Trigger Setup**
   - File: `supabase/migrations/004_auth_profile_trigger.sql`
   - Initial automatic profile creation trigger on signup.

5. **Step 5: Dealer Verification & Admin Hardening**
   - File: `supabase/migrations/005_dealer_verification_and_admin.sql`
   - Upgraded `handle_new_user()` trigger defaulting missing metadata to `'buyer'` with `NULL` district without crashing.
   - Strictly validates `role IN ('buyer', 'dealer')`.
   - Protects dealership status mutations via `check_dealership_status_change()` trigger so only admins can alter `status`, `rejection_reason`, and `verified_at`.
   - Adds `is_email_registered(p_email TEXT)` `SECURITY DEFINER` function for password recovery check.
   - Adds RLS policies for admin oversight (`/admin/dealers`).

6. **Step 6: Real Automotive Catalog Seed Data**
   - File: `supabase/seed.sql`
   - Seeds the real catalog: 15 Indian districts, 10 manufacturers, 12 car models, and 36 variants.
   - Pure catalog only — zero fake mock groups or fake dealerships.
   - Re-runnable: all inserts use `ON CONFLICT DO NOTHING;` and valid hex UUIDs.

7. **Step 7 (Optional): Test & Demonstration Data**
   - File: `supabase/seed_demo.sql`
   - Seeds sample test dealerships (3 `VERIFIED`, 1 `PENDING`), test groups (illustrating visibility thresholds), and initial quotations for demonstration.
   - Re-runnable with valid hex UUIDs.

8. **Step 8: Standardized Test Accounts Provisioning**
   - File: `supabase/test_setup.sql`
   - Sets roles and districts for 5 test accounts (`buyer1@domain.com`, `buyer2@domain.com`, `dealer1@domain.com`, `dealer2@domain.com`, `admin@domain.com`).
   - Idempotent and guarded against running on non-test accounts.

---

## 2. Authentication & 6-Digit Email OTP Setup

For full instructions on configuring the 6-digit email OTP templates, token variables (`{{ .Token }}`), 10-minute expiry, and custom SMTP recommendations, please refer to:
👉 **[docs/auth-setup.md](../docs/auth-setup.md)**

### Quick Summary:
- **Authentication > Providers > Email**: Enable Email Provider = `ON`, Confirm email = `ON` (or `OFF` for instant local testing).
- **Authentication > Email Templates**: Replace default links with `{{ .Token }}` in "Confirm signup" and "Reset password". Production templates located in `docs/email-templates/`.
- **Authentication > Rate Limits**: Set OTP length to 6 digits, expiration to 600 seconds.

---

## 3. Administrator Role Assignment

To promote any registered user to platform administrator (granting full access to `/admin/dealers`):

```sql
UPDATE public.profiles
SET role = 'admin',
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = '<admin_email_address>');
```

---

## 4. Manual Dealer Approval Snippet

When a dealership registers via `/register/dealer`, its initial status is `PENDING`. It can be approved via the `/admin/dealers` UI or by running:

```sql
UPDATE public.dealerships
SET status = 'VERIFIED',
    verified_at = NOW(),
    updated_at = NOW()
WHERE name = '<Showroom Name>'
   OR contact_email = '<dealer@dealership.com>';
```

---

## 5. Automated SQL Verification Test Suite

Run the SQL verification test suite in `supabase/tests/rls_and_business_rules.sql` in the Supabase SQL Editor. It validates:
1. Group visibility logic (1 member hidden, 3 members visible).
2. `is_email_registered` function behavior.
3. Dealership status change protection trigger (blocks non-admins from self-approving).
4. RLS enabled status across all core tables.
