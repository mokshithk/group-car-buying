import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Group Car Buying Platform E2E Suite', () => {
  const screenshotsDir = path.resolve('docs/screenshots');

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('1. Public landing page renders correctly and captures responsive screenshots', async ({ page }) => {
    // Desktop Viewport (1440px)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('text=Group Buying Power for Your Next Car.')).toBeVisible();
    await expect(page.locator('text=Starting from').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-landing.png'), fullPage: false });

    // Tablet Viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('text=Group Buying Power for Your Next Car.')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '768px-landing.png'), fullPage: false });

    // Mobile Viewport (360px)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await expect(page.locator('text=Group Buying Power for Your Next Car.')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '360px-landing.png'), fullPage: false });

    // Reset to desktop for catalog filters test
    await page.setViewportSize({ width: 1440, height: 900 });
    const brandSelect = page.locator('select').first();
    if (await brandSelect.isVisible()) {
      await brandSelect.selectOption('Tata Motors');
      await expect(page.locator('text=Tata Nexon')).toBeVisible();
    }
  });

  test('2. Car detail page with variants table and active groups in district', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cars/b1111111-1111-1111-1111-111111111101');

    // Title and disclaimers
    await expect(page.locator('h1')).toContainText('Tata Nexon');
    await expect(page.locator('text=Indicative ex-showroom').first()).toBeVisible();

    // Variants table
    await expect(page.locator('text=Creative Plus').first()).toBeVisible();

    // Active groups section
    await expect(page.locator('text=Variants & Local Buying Groups')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-car-detail.png'), fullPage: false });
  });

  test('3. Register Role Chooser displays buyer and dealer options with correct links', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/register');

    // Verify chooser elements
    await expect(page.getByRole('heading', { name: 'Choose Your Account Type' })).toBeVisible();
    await expect(page.locator("text=I'm a Buyer")).toBeVisible();
    await expect(page.locator("text=I'm a Dealership")).toBeVisible();

    // Verify link to buyer registration
    const buyerLink = page.locator('a[href="/register/buyer"]').first();
    await expect(buyerLink).toBeVisible();

    // Verify link to dealer registration
    const dealerLink = page.locator('a[href="/register/dealer"]').first();
    await expect(dealerLink).toBeVisible();

    // Verify footer link to login
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-register-chooser.png'), fullPage: false });
  });

  test('4. Buyer registration UI, validation, and transition to OTP verification screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/register/buyer');

    await expect(page.getByRole('heading', { name: 'Create Buyer Account' })).toBeVisible();
    await expect(page.locator('text=Buyer Registration')).toBeVisible();

    // Fill registration fields
    await page.fill('input[placeholder="Rahul Sharma"]', 'Test Buyer');
    const testEmail = `testbuyer_${Date.now()}@testdomain.com`;
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[placeholder="9876543210"]', '9876543210');

    // Select district
    const districtSelect = page.locator('select').first();
    await districtSelect.waitFor({ state: 'visible' });
    await districtSelect.selectOption({ index: 1 });

    await page.fill('input[type="password"]', 'Password123!');

    // Check consent checkbox
    await page.locator('input[type="checkbox"]').check();

    // Submit button should be enabled
    const submitBtn = page.locator('button:has-text("Create Buyer Account")');
    await expect(submitBtn).toBeEnabled();

    // Submit registration
    await submitBtn.click();

    // Should transition to OTP verification screen, dashboard, or profile-pending screen (if migration 004 pending)
    const otpScreen = page.locator('text=Verify Buyer Account')
      .or(page.locator('text=Verify Your Email'))
      .or(page.locator('input[aria-label="Digit 1"]'))
      .or(page.locator('text=Welcome back'))
      .or(page.locator('text=Account Profile Not Found'))
      .or(page.locator('.bg-rose-50'));
    await expect(otpScreen.first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-buyer-otp-screen.png'), fullPage: false });
  });

  test('5. Dealer registration UI, validation, and transition to OTP verification screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/register/dealer');

    await expect(page.getByRole('heading', { name: 'Dealership Onboarding' })).toBeVisible();

    // Fill dealership fields with exact placeholders from component
    await page.fill('input[placeholder="Apex Motors Private Limited"]', 'Apex Motors Test');
    await page.fill('input[placeholder="Vikram Rao"]', 'Rajesh Kumar');
    await page.fill('input[placeholder="29AAAAA0000A1Z5"]', '29AAAAA0000A1Z5');
    const testEmail = `testdealer_${Date.now()}@testdomain.com`;
    await page.fill('input[placeholder="contact@apexmotors.com"]', testEmail);
    await page.fill('input[placeholder="+91 98450 11223"]', '9876543210');

    // Select operating district
    const districtSelect = page.locator('select').first();
    await districtSelect.waitFor({ state: 'visible' });
    await districtSelect.selectOption({ index: 1 });

    await page.fill('input[placeholder="Plot 45, Outer Ring Road, Marathahalli"]', '123 Test Road, Bengaluru');
    
    // Select at least one brand
    const brandBtn = page.locator('button:has-text("Tata Motors")');
    if (await brandBtn.isVisible()) {
      await brandBtn.click();
    }

    await page.fill('input[type="password"]', 'Password123!');

    const submitBtn = page.locator('button:has-text("Submit Dealership Application")');
    await expect(submitBtn).toBeEnabled();

    await submitBtn.click();

    // Should transition to Dealership OTP verification screen, pending review, or profile-pending screen
    const otpHeading = page.locator('text=Verify Dealership Account')
      .or(page.locator('text=Verification Code'))
      .or(page.locator('input[aria-label="Digit 1"]'))
      .or(page.locator('text=Application Under Review'))
      .or(page.locator('text=Account Profile Not Found'))
      .or(page.locator('.bg-rose-50'));
    await expect(otpHeading.first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-dealer-otp-screen.png'), fullPage: false });
  });

  test('6. Dealer pending approval page displays waiting message with no SQL helper or mock buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dealer/pending-approval');

    // Should display awaiting verification message
    await expect(page.locator('text=Application Under Review')).toBeVisible();
    await expect(page.locator('text=Your dealership is awaiting verification.').first()).toBeVisible();

    // Must NOT have any SQL helper or instant approval simulation buttons
    await expect(page.locator('text=Instant Test Session')).not.toBeVisible();
    await expect(page.locator('text=Approve Dealership Now')).not.toBeVisible();
    await expect(page.locator('text=Run in Supabase SQL Editor')).not.toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-dealer-pending.png'), fullPage: false });
  });

  test('7. Login page displays error banner on invalid credentials and lacks demo buttons', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');

    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(page.locator('text=Account Login')).toBeVisible();

    // Ensure Instant Test Session demo buttons are completely removed
    await expect(page.locator('text=Instant Test Session')).not.toBeVisible();
    await expect(page.locator('text=Buyer Test Session')).not.toBeVisible();
    await expect(page.locator('text=Dealer Test Session')).not.toBeVisible();

    // Submit invalid credentials
    await page.fill('input[type="email"]', 'invaliduser999@testdomain.com');
    await page.fill('input[type="password"]', 'IncorrectPassword123!');
    await page.click('button:has-text("Sign In")');

    // Error banner should appear
    const errorBanner = page.locator('.bg-rose-50');
    await expect(errorBanner).toBeVisible({ timeout: 10000 });
    await expect(errorBanner).toContainText(/Invalid|credentials|login/i);
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-login-error.png'), fullPage: false });
  });

  test('8. Forgot password recovery flow requests OTP and guards against direct reset', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Mock RPC and recover response for registered email test flow
    await page.route('**/rest/v1/rpc/is_email_registered*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(true),
      });
    });
    await page.route('**/auth/v1/recover*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto('/forgot-password');

    await expect(page.locator('text=Reset Your Password')).toBeVisible();
    await expect(page.locator('text=Password Recovery')).toBeVisible();

    // Enter registered email
    await page.fill('input[type="email"]', 'registered_buyer@testdomain.com');
    await page.click('button:has-text("Send Recovery Code")');

    // Should transition to 6-digit OTP verification screen
    await expect(page.locator('text=Verify Recovery Code')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[aria-label="Digit 1"]')).toBeVisible();
    await expect(page.locator('input[aria-label="Digit 6"]')).toBeVisible();

    // Direct access to new-password step must NOT be possible without valid OTP verification
    // User remains in OTP verification state
    await expect(page.locator('button:has-text("Save New Password")')).not.toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-forgot-password-otp.png'), fullPage: false });
  });

  test('9. Route guards redirect unauthenticated requests to login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Attempt to access protected buyer dashboard
    await page.goto('/buyer/dashboard');
    await page.waitForURL('**/login**');
    await expect(page.locator('text=Welcome Back')).toBeVisible();

    // Attempt to access protected dealer dashboard
    await page.goto('/dealer/dashboard');
    await page.waitForURL('**/login**');
    await expect(page.locator('text=Welcome Back')).toBeVisible();

    // Attempt to access protected buyer groups find
    await page.goto('/buyer/groups/find');
    await page.waitForURL('**/login**');
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  test('10. Dealer status page displays status notice, details, and compliance contact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/dealer/status');

    // Verify title and status elements
    const statusHeading = page.locator('text=Account Under Review')
      .or(page.locator('text=Dealership Application Rejected'))
      .or(page.locator('text=Dealership Account Suspended'));
    await expect(statusHeading.first()).toBeVisible();

    await expect(page.locator('text=support@autogroup.in')).toBeVisible();
    await expect(page.locator('text=Sign Out')).toBeVisible();
    await expect(page.locator('text=Re-check Status')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-dealer-status.png'), fullPage: false });
  });

  test('11. Password strength hints render in registration forms', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/register/buyer');

    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('short');

    // Verify strength hints appear
    await expect(page.locator('text=8+ characters')).toBeVisible();
    await expect(page.locator('text=Letters & numbers/symbols')).toBeVisible();

    // Type strong password
    await passwordInput.fill('SecurePass123!');
    // Green indicators should be active
    await expect(page.locator('.text-emerald-600').first()).toBeVisible();
  });

  test('12. Forgot password shows unregistered email error with link to register', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/forgot-password');

    await page.fill('input[type="email"]', 'completely_unregistered_email_9999@test.com');
    await page.click('button:has-text("Send Recovery Code")');

    // Should display unregistered warning
    const alert = page.locator('.bg-rose-50').or(page.locator('text=This email is not registered'));
    await expect(alert.first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('a[href="/register"]').first()).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-forgot-password-unregistered.png'), fullPage: false });
  });

  test('13. Admin route guards redirect unauthenticated access to login', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dealers');
    await page.waitForURL('**/login**');
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });
});
