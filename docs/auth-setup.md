# Supabase Authentication & Email OTP Setup Guide

This guide details the complete configuration required in the Supabase Dashboard to enable the 6-digit Email OTP registration and password recovery flows for the Group Car Buying Platform.

---

## 1. Authentication Dashboard Configuration

In your Supabase project dashboard, navigate to **Authentication** > **Providers** > **Email**:

1. **Enable Email provider**: `ON`
2. **Confirm email**: `ON` (enforces OTP verification upon registration)
   *(Note: For rapid offline/local development without email delivery, you may temporarily toggle this to `OFF`).*
3. **Secure email change**: `ON`
4. **Secure password reset**: `ON`

---

## 2. OTP Expiry and Length Settings

Navigate to **Authentication** > **Rate Limits / Expiry**:

- **OTP Expiration**: `600 seconds` (10 minutes)
- **OTP Length**: `6 digits` (matches the 6-box tactile UI component)
- **Max Email Send Rate**: Adjust if using custom SMTP (default free tier is 30/hour, or 3/hour on shared pools).

---

## 3. URL Configuration

Navigate to **Authentication** > **URL Configuration**:

- **Site URL**: `http://localhost:5173` (or `http://localhost:3000`)
- **Redirect URLs**: Add the following:
  - `http://localhost:5173/**`
  - `http://localhost:3000/**`

---

## 4. Email Templates (Crucial: Use `{{ .Token }}`)

By default, Supabase email templates use confirmation links (`{{ .ConfirmationURL }}`). To use the platform's in-app **6-digit OTP verification screen**, you must update the email templates to deliver the 6-digit numeric token (`{{ .Token }}`).

In your Supabase Dashboard, navigate to **Authentication** > **Email Templates**:

### A. "Confirm signup" Template

- **Subject**: `Your 6-Digit AutoGroup Verification Code: {{ .Token }}`
- **Body (HTML / Text)**:
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Auto<span style="color: #2563eb;">Group</span></h2>
    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Group Vehicle Purchasing Platform</p>
  </div>
  
  <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello,</p>
  <p style="color: #334155; font-size: 15px; line-height: 1.6;">Thank you for registering. Enter the following 6-digit verification code in the platform to verify your email address and activate your account:</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 28px 0;">
    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #1e3a8a;">{{ .Token }}</span>
  </div>
  
  <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This code will expire in 10 minutes. If you did not create an AutoGroup account, you can safely ignore this email.</p>
  
  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
    &copy; AutoGroup Platform. Strictly verified vehicle purchase tenders.
  </div>
</div>
```

---

### B. "Reset Password" Template

- **Subject**: `Your 6-Digit Password Reset Code: {{ .Token }}`
- **Body (HTML / Text)**:
```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="color: #0f172a; font-size: 24px; font-weight: 700; margin: 0;">Auto<span style="color: #2563eb;">Group</span></h2>
    <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Account Security & Recovery</p>
  </div>
  
  <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello,</p>
  <p style="color: #334155; font-size: 15px; line-height: 1.6;">We received a request to reset your AutoGroup account password. Enter this 6-digit recovery code on the verification screen to proceed:</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 28px 0;">
    <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #dc2626;">{{ .Token }}</span>
  </div>
  
  <p style="color: #64748b; font-size: 13px; line-height: 1.5;">This recovery code expires in 10 minutes. If you did not initiate this password reset request, please protect your credentials immediately.</p>
  
  <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
    &copy; AutoGroup Platform. Strictly verified vehicle purchase tenders.
  </div>
</div>
```

---

## 5. Custom SMTP Recommendation

> [!WARNING]
> Supabase's default built-in SMTP service is intended **only for initial evaluation**. It enforces strict rate limits (e.g. 3–30 emails per hour) and blocks standard test domains (`@example.com`, etc.), triggering `429: Email rate limit exceeded`.

For smooth registration and OTP delivery:
1. In the Supabase Dashboard, navigate to **Authentication** > **SMTP Settings**.
2. Enable **Enable Custom SMTP**.
3. Configure your provider details (e.g. [Resend](https://resend.com), [Brevo](https://brevo.com), [AWS SES], or [SendGrid]):
   - **Sender email**: `noreply@yourdomain.com` or `notifications@yourdomain.com`
   - **Sender name**: `AutoGroup Platform`
   - **Host**: `smtp.resend.com` (or provider host)
   - **Port**: `587` or `465`
   - **User**: `resend` (or provider username)
   - **Password**: Your SMTP API key / password

---

## 6. Manual Dealer Verification

When a dealership registers via `/register/dealer`, the profile trigger creates the showroom with `status = 'PENDING'`. The pending dealer sees:
`"Your dealership is awaiting verification."`

To approve a dealership, run the following SQL snippet in your Supabase SQL Editor:

```sql
UPDATE public.dealerships
SET status = 'VERIFIED',
    verified_at = NOW()
WHERE showroom_name = '<Dealership Showroom Name>'
   OR owner_email = '<dealer_email@domain.com>';
```
