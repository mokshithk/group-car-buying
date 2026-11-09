# Supabase Setup Guide & Execution Order

Follow these steps in your Supabase project's **SQL Editor** (`https://supabase.com/dashboard/project/<your-project-id>/sql`).

---

## 1. Execution Order

Run each of these scripts in the exact sequence below:

1. **Step 1: Core Schema, Constraints & Functions**
   - File: `supabase/migrations/001_initial_schema.sql`
   - Creates tables (`profiles`, `districts`, `manufacturers`, `models`, `variants`, `dealerships`, `dealer_users`, `groups`, `group_members`, `quotations`, `quotation_versions`, `quote_items`, `interests`, `bookings`, `payments`, `refunds`, `settings`, `notifications`, `dealer_ratings`, `reports`, `wishlist`, `buyer_preferences`, `audit_log`).
   - Creates the group visibility function `fn_is_group_visible_to_dealers`, view `dealer_eligible_groups_view`, and automated triggers for price versioning and group removal after booking.

2. **Step 2: Row Level Security (RLS) Policies**
   - File: `supabase/migrations/002_rls_policies.sql`
   - Enables RLS on all 22 tables.
   - Enforces isolation: buyers only see groups in their district; dealers cannot see buyer phone/email before an interest/booking; dealers only see their own leads and bookings; dealer quotation controls.

3. **Step 3: Seed Data**
   - File: `supabase/seed.sql`
   - Seeds 15 Indian districts, 10 manufacturers, 12 car models with 3 variants each.
   - Seeds 4 fake test dealerships (3 `VERIFIED`, 1 `PENDING`).
   - Seeds groups illustrating the visibility rule.
   - Re-runnable: all inserts use `ON CONFLICT DO NOTHING;`.

4. **Step 4: Automated Auth Trigger & Registration RLS**
   - File: `supabase/migrations/003_auth_user_trigger.sql`
   - Creates `handle_new_user()` trigger on `auth.users` to automatically create buyer profiles and dealer records.
   - Backfills existing users who signed up before the trigger was created.

---

## 2. Supabase Email Confirmation Setting (Crucial for Testing)

By default, new Supabase projects enforce email confirmation and restrict outgoing emails to **3 per hour** on the free tier. This causes:
- `429: email rate limit exceeded` after 3 signup attempts.
- Rejection of test emails (`@example.com` is blocked).
- Inability to log in immediately without opening an external email link.

**To enable instant, frictionless registration & login:**
1. Go to **Authentication** > **Providers** in your Supabase Dashboard:
   `https://supabase.com/dashboard/project/<your-project-id>/auth/providers`
2. Click the **Email** provider.
3. Turn **OFF** the toggle for **"Confirm email"**.
4. Click **Save**.

*(Once turned off, every signup is automatically activated and immediately logged in, with no rate limits or email hurdles).*

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
   *(Never commit `.env.local`. It is already in `.gitignore`.)*

---

## 4. Creating Your First Buyer and Dealer Users

1. Start the app: `npm run dev`.
2. **Register a Buyer**:
   - Go to `http://localhost:3000/register/buyer`
   - Fill in: Full Name (e.g., `Rahul Sharma`), Email, Phone (`9876543210`), District (e.g., `Bengaluru Urban`), Password, and check the consent box.
   - Click **Create Buyer Account**. You are registered with role `buyer`.
3. **Register a Dealership**:
   - Log out, then go to `http://localhost:3000/register/dealer`
   - Fill in: Dealership Name (e.g., `Premier Auto Hub`), Email (`dealer@example.com`), Phone, District (`Bengaluru Urban`), Brands (`Tata Motors`), GST Number, and password.
   - Click **Submit Dealership Application**.
   - Upon registration, your dealership status will be **PENDING**. You will see the friendly *Pending Approval* screen.

---

## 5. Dealer Approval SQL Snippet

Run this SQL in your Supabase SQL Editor to approve the dealership and give it access to eligible groups:

```sql
-- Approve dealership by dealer contact email:
UPDATE public.dealerships
SET status = 'VERIFIED',
    updated_at = now()
WHERE contact_email = 'dealer@example.com';

-- OR approve dealership by dealership name:
-- UPDATE public.dealerships
-- SET status = 'VERIFIED',
--     updated_at = now()
-- WHERE name ILIKE '%Premier Auto Hub%';

-- Verify status is now VERIFIED:
SELECT id, name, status, contact_email FROM public.dealerships;
```

---

## 6. SQL Verification Checks (RLS Isolation)

Run these queries to prove data isolation between buyers and dealers:

```sql
-- 1. Verify that non-interested dealers cannot view buyer phone or email
-- As an anonymous or un-interested dealer user, querying profiles will return empty or only own profile:
SELECT id, full_name, phone, role FROM public.profiles;

-- 2. Verify group visibility rule:
-- Group 1 (3 members): true
-- Group 2 (2 members, 25 days old): true
-- Group 3 (2 members, 2 days old): false
-- Group 4 (1 member): false
SELECT 
    id, 
    variant_name, 
    active_members, 
    bookings_so_far, 
    is_visible 
FROM public.dealer_eligible_groups_view;

-- 3. Verify dealer quotation isolation:
-- Check that dealers only see quotes on eligible groups and cannot update other dealers' quotes:
SELECT q.id, d.name AS dealer_name, q.on_road_price, q.is_complete
FROM public.quotations q
JOIN public.dealerships d ON q.dealership_id = d.id;
```
