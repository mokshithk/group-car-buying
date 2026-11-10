# Supabase Setup Guide & Execution Order

Follow these steps for a clean Supabase project setup via the local Supabase CLI or the Supabase Dashboard **SQL Editor** (`https://supabase.com/dashboard/project/<your-project-id>/sql`).

---

## 1. Migration Execution Order

Apply migrations in strict numerical order (`001` through `007`):

1. **`supabase/migrations/001_initial_schema.sql`** — Core tables, constraints (`booking_amount + platform_fee < 10000`), triggers, and `fn_is_group_visible_to_dealers`.
2. **`supabase/migrations/002_rls_policies.sql`** — Initial Row-Level Security (RLS) policies across all tables.
3. **`supabase/migrations/003_auth_user_trigger.sql`** — Base user-profile creation trigger.
4. **`supabase/migrations/004_reliable_profile_trigger.sql`** — Resilient metadata parsing in `handle_new_user()`.
5. **`supabase/migrations/005_dealer_verification_and_admin.sql`** — Signup role restrictions (`buyer`/`dealer`), `check_dealership_status_change()` lock, and `is_email_registered()`.
6. **`supabase/migrations/006_admin_module.sql`** — Admin roles (`admin`, `super_admin`), last `super_admin` guard, append-only `audit_log`, `admin_invites` (SHA-256 `token_hash`), 13 configurable `settings`, suspicious group trigger, 1-member group expiry (`fn_expire_1_member_groups`), `dealer_ratings.is_hidden`, `reports` workflow, and all `SECURITY DEFINER` Admin RPCs.
7. **`supabase/migrations/007_fix_dealer_users_rls_recursion.sql`** — Adds `is_dealer_owner_of(UUID)` (`SECURITY DEFINER`) and updates `dealer_users`/`dealerships` RLS policies to prevent `42P17` policy recursion.
8. **`supabase/seed.sql`** — Real automotive catalog data (districts, manufacturers, models, variants). Pure catalog only; re-runnable.
9. **`supabase/seed_demo.sql`** *(Optional)* — Sample dealerships, groups, and quotations for local UI demonstration.
10. **`supabase/test_setup.sql`** *(Testing only)* — Configures the 6 standardized `@autogroup.in` test accounts and pending dealership fixture.
11. **`supabase/cleanup_test_data.sql`** *(Cleanup only)* — Safely removes synthetic `@autogroup.in` notifications, invites, and test dealership fixtures without touching real user data.

---

## 2. Authentication & 6-Digit Email OTP Setup

This platform uses `.env.local` SMTP credentials via [src/server/smtpPlugin.ts](../src/server/smtpPlugin.ts) (`/api/auth/send-otp` and `/api/auth/verify-otp`) for buyer signup, dealer signup, password recovery, and `/admin/accept-invite` verification, keeping Supabase Auth's **Confirm email = OFF** (`mailer_autoconfirm: true`).

For details on `.env.local` SMTP configuration and optional Dashboard templates, see **[docs/auth-setup.md](../docs/auth-setup.md)**.

---

## 3. First Super Admin Account Setup

Automated setup (reads session environment variables cleanly):
```powershell
node scripts/db-admin-ops.mjs bootstrap-first-admin
```
Or manual SQL fallback via **[supabase/make_first_admin.sql](./make_first_admin.sql)** (replace `'<ADMIN_EMAIL>'` with a registered user email — sets `role = 'super_admin'`, `must_change_password = true`, and logs an `audit_log` entry).

On first login at `/login`, the admin is redirected to `/admin/set-password` to choose a new password (minimum 12 characters).

---

## 4. Automated SQL Verification Suites

Run in a rolled-back transaction (`BEGIN; ... ROLLBACK;`) to verify RLS isolation, role restrictions, triggers, audit log immutability, settings cap, and 1-member expiry:
- `supabase/tests/rls_and_business_rules.sql`
- `supabase/tests/admin_rls_and_rules.sql`
