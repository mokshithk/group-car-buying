# Supabase Authentication & Email OTP Setup Guide

This guide details the complete configuration required in the Supabase Dashboard to enable the 6-digit Email OTP registration, password recovery flows, admin dealer verification, and test account provisioning for the Group Car Buying Platform.

---

## 1. Migration Sequence & Database Execution

Run migrations in exact numerical sequence using the Supabase Dashboard **SQL Editor**:

1. `supabase/migrations/001_initial_schema.sql`: Core relational tables (profiles, districts, dealerships, groups, quotations, bookings, reviews).
2. `supabase/migrations/002_rls_policies.sql`: Row-Level Security policies enforcing 3-member group visibility, role isolation, and privacy.
3. `supabase/migrations/003_storage_and_indexes.sql`: Performance indexes and document storage.
4. `supabase/migrations/004_auth_profile_trigger.sql`: Automatic profile creation on auth signup.
5. `supabase/migrations/005_dealer_verification_and_admin.sql`: Hardened trigger (`handle_new_user()`), admin dealership status mutation lock (`check_dealership_status_change()`), and `is_email_registered()` `SECURITY DEFINER` check.
6. `supabase/seed.sql`: **Real automotive catalog only** (all 31 districts of Karnataka, manufacturers, models, and real variants). Valid hex UUIDs only.
7. `supabase/seed_demo.sql` *(Optional)*: Realistic sample dealerships, tenders, and quotations for previewing the platform.
8. `supabase/test_setup.sql`: Test account provisioning script (strictly configures roles, districts, and verified status for the 5 standardized test accounts).

---

## 2. Authentication Dashboard Configuration

In your Supabase project dashboard, navigate to **Authentication** > **Providers** > **Email**:

1. **Enable Email provider**: `ON`
2. **Confirm email**: `ON` (enforces 6-digit OTP verification upon registration)
   *(Note: For rapid offline/local development without email delivery, you may temporarily toggle this to `OFF`).*
3. **Secure email change**: `ON`
4. **Secure password reset**: `ON`

---

## 3. OTP Expiry and Length Settings

Navigate to **Authentication** > **Rate Limits / Expiry**:

- **OTP Expiration**: `600 seconds` (10 minutes)
- **OTP Length**: `6 digits` (matches the 6-box tactile UI component)
- **Max Email Send Rate**: Adjust if using custom SMTP (default free tier is 30/hour, or 3/hour on shared pools).

---

## 4. URL Configuration

Navigate to **Authentication** > **URL Configuration**:

- **Site URL**: `http://localhost:5173` (or `http://localhost:3000`)
- **Redirect URLs**: Add the following:
  - `http://localhost:5173/**`
  - `http://localhost:3000/**`

---

## 5. Email Templates (Professional Responsive Design)

AutoGroup uses in-app **6-digit numeric OTP verification** (`{{ .Token }}`). Do NOT use standard confirmation links (`{{ .ConfirmationURL }}`).

Pre-designed production email templates are available in `docs/email-templates/`:
- **Signup Confirmation**: [confirm-signup.html](file:///D:/group-car-buying/docs/email-templates/confirm-signup.html) & [confirm-signup.txt](file:///D:/group-car-buying/docs/email-templates/confirm-signup.txt)
- **Password Reset**: [reset-password.html](file:///D:/group-car-buying/docs/email-templates/reset-password.html) & [reset-password.txt](file:///D:/group-car-buying/docs/email-templates/reset-password.txt)

In your Supabase Dashboard, navigate to **Authentication** > **Email Templates**:

### A. "Confirm signup" Template
- **Subject**: `Your AutoGroup verification code: {{ .Token }}`
- **Body**: Copy contents of `docs/email-templates/confirm-signup.html`.

### B. "Reset Password" Template
- **Subject**: `Your AutoGroup password reset code: {{ .Token }}`
- **Body**: Copy contents of `docs/email-templates/reset-password.html`.

---

## 6. Custom SMTP Setup (Resend & Brevo)

> [!WARNING]
> Supabase's built-in default SMTP pool is capped at **3 to 30 emails per hour** and actively blocks standard test domains (`@testdomain.com`, `@example.com`), throwing `429: Email rate limit exceeded`. For reliable OTP delivery, configure a custom SMTP provider.

### Option A: Resend (Recommended)
1. Sign up at [resend.com](https://resend.com) and create an API Key.
2. In Supabase Dashboard, go to **Authentication** > **SMTP Settings**:
   - **Sender email**: `onboarding@resend.dev` (or your verified domain)
   - **Sender name**: `AutoGroup Verification`
   - **Host**: `smtp.resend.com`
   - **Port**: `587`
   - **User**: `resend`
   - **Password**: `re_123456...` (Your Resend API key)

### Option B: Brevo (formerly Sendinblue)
1. Sign up at [brevo.com](https://brevo.com) and navigate to **Transactional** > **Settings** > **Configuration**.
2. In Supabase Dashboard, go to **Authentication** > **SMTP Settings**:
   - **Sender email**: Your verified sender email
   - **Sender name**: `AutoGroup Verification`
   - **Host**: `smtp-relay.brevo.com`
   - **Port**: `587`
   - **User**: Your Brevo login email
   - **Password**: Your Brevo Master SMTP key

---

## 7. Admin Assignment SQL Snippet

To grant administrator privileges to any registered user (enabling access to the `/admin/dealers` portal), run this SQL snippet in the Supabase SQL Editor:

```sql
UPDATE public.profiles
SET role = 'admin',
    updated_at = NOW()
WHERE id = (
  SELECT id FROM auth.users WHERE email = '<admin_email_address>'
);
```

---

## 8. Dealership Manual Verification SQL Snippet

If approving a dealership manually outside the `/admin/dealers` web portal, run:

```sql
UPDATE public.dealerships
SET status = 'VERIFIED',
    verified_at = NOW(),
    updated_at = NOW()
WHERE name = '<Dealership Showroom Name>'
   OR contact_email = '<dealer_contact_email>';
```

---

## 9. Standardized Test Accounts

For automated and manual verification, AutoGroup supports 5 standard test accounts:
1. `buyer1@domain.com`: Buyer in Bangalore Urban (District 1)
2. `buyer2@domain.com`: Buyer in Bangalore Urban (District 1)
3. `dealer1@domain.com`: Verified Dealership 1 (Tata Motors, Bangalore Urban)
4. `dealer2@domain.com`: Verified Dealership 2 (Tata Motors & Hyundai, Bangalore Urban)
5. `admin@domain.com`: Platform Administrator

### Quick Setup:
1. Register these 5 accounts through the `/register` web forms with your password.
2. Verify their 6-digit OTP codes.
3. In your Supabase SQL Editor, run `supabase/test_setup.sql`. The script safely and idempotently sets roles, associates Bangalore Urban district, creates and verifies the test showrooms, and grants the admin role.
