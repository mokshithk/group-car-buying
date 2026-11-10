# Authentication & Email OTP Setup Guide

This guide describes how AutoGroup handles 6-digit Email OTP verification, Admin Invite verification, Password Recovery, First Super Admin provisioning, and Test Account setup.

---

## 1. Local & Vercel SMTP OTP Portal (Active Default)

All interactive 6-digit OTP flows (buyer registration, dealership registration, forgot-password recovery, and `/admin/accept-invite` confirmation) route through shared handlers in [api/_lib/otpService.ts](../api/_lib/otpService.ts) (`POST /api/auth/send-otp`, `POST /api/auth/verify-otp`, `POST /api/auth/reset-password`, `GET /api/auth/smtp-status`):
- **Localhost (`npm run dev` / `npm run preview`)**: Served by Vite middleware in [src/server/smtpPlugin.ts](../src/server/smtpPlugin.ts), reading `.env.local` / `.env`.
- **Vercel Deployment**: Served by Vercel Serverless Functions in `api/auth/` (`smtp-status.ts`, `send-otp.ts`, `verify-otp.ts`, `reset-password.ts`) with SPA routing configured in [vercel.json](../vercel.json). OTP challenge and recovery verification tokens use stateless AES-256-GCM encryption (`api/_lib/otpToken.ts`) so verification works reliably across stateless serverless instances and mobile browsers.

1. Configure your `.env.local` file locally (gitignored — never commit secrets):
   ```env
   VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<your-anon-key>

   SMTP_EMAIL=your-sender@gmail.com
   SMTP_PASSWORD=your-app-password
   SMTP_SERVER=smtp.gmail.com
   SMTP_PORT=465

   # Required for server-side Forgot Password completion (/api/auth/reset-password)
   SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
   OTP_SIGNING_SECRET=<long-random-secret>
   ```
2. Add those same variables in **Vercel Dashboard -> Project -> Settings -> Environment Variables** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SMTP_EMAIL`, `SMTP_PASSWORD`, `SMTP_SERVER`, `SMTP_PORT`, `SUPABASE_SERVICE_ROLE_KEY`, `OTP_SIGNING_SECRET`). Never prefix `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_PASSWORD`, or `OTP_SIGNING_SECRET` with `VITE_`.
3. Keep Supabase Dashboard **Authentication -> Providers -> Email -> Confirm email** toggled **OFF** (`mailer_autoconfirm: true`).
   - Why: Supabase does not send confirmation emails directly or block password login while your SMTP OTP portal delivers and verifies all 6-digit OTPs cleanly.
   - During local non-Vercel dev/test runs when `SMTP_EMAIL` / `SMTP_PASSWORD` are left blank, `OtpVerification.tsx` displays a `[Dev OTP]` preview banner and Auto-Fill helper. On Vercel production (`VERCEL=1`), `devOtp` fallback is strictly disabled.

---

## 2. Admin Onboarding & Invitations Security

1. **First Super Admin (`must_change_password = true`)**:
   - Provisioned via `node scripts/db-admin-ops.mjs bootstrap-first-admin` (or SQL fallback [supabase/make_first_admin.sql](../supabase/make_first_admin.sql)) with `role = 'super_admin'`.
   - On first sign-in at `/login`, `ProtectedRoute` enforces `/admin/set-password` (`ForcePasswordChangePage.tsx`) requiring >= 12 characters with uppercase, lowercase, and a digit or symbol before any `/admin/*` screen opens.
2. **Subsequent Admin Invites (`/admin/admins` -> `/admin/accept-invite?token=...`)**:
   - Only `super_admin` can create, resend, or revoke invites (`admin_create_invite`, rate-limited to 10/hr).
   - Database table `admin_invites` stores only the SHA-256 digest (`token_hash`) with 7-day expiry.
   - Pre-existing buyer/dealer accounts are blocked from accepting an admin invite unless `convert_existing` is explicitly enabled.
   - Optional Edge Function [supabase/functions/send-admin-invite/index.ts](../supabase/functions/send-admin-invite/index.ts) is available if automated email dispatch via Resend (`RESEND_API_KEY` secret) is later deployed; otherwise, the UI provides a one-time copyable link and `mailto:` trigger.

---

## 3. Supabase Templates & Optional Custom SMTP

If you deploy without the local Vite middleware server and switch **Confirm email** to **ON**:
- Enable Custom SMTP in Supabase Dashboard (**Authentication -> SMTP Settings**).
- Configure OTP length = `6`, OTP expiration = `600` seconds, and copy templates from `docs/email-templates/` (`{{ .Token }}`).

---

## 4. Standardized Test Accounts (6 Roles)

Copy `.env.test.example` to `.env.test` (gitignored) or run `node scripts/db-admin-ops.mjs setup-test-suite` to provision the 6 disposable `@autogroup.in` test accounts cleanly:
- `test_buyer_a@autogroup.in` (`buyer` — Bengaluru Urban)
- `test_buyer_b@autogroup.in` (`buyer` — Bengaluru Urban)
- `test_dealer_a@autogroup.in` (`dealer` — Verified Apex Motors)
- `test_dealer_b@autogroup.in` (`dealer` — Verified Premier Motors)
- `test_admin@autogroup.in` (`admin` — Operations & Moderation, read-only Settings)
- `test_super_admin@autogroup.in` (`super_admin` — Full platform governance)
