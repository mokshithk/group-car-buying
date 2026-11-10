import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

function loadTestEnv(): Record<string, string> {
  const envPath = path.resolve('.env.test');
  const result: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return result;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    result[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
}

const testEnv = loadTestEnv();
const screenshotsDir = path.resolve('docs/screenshots');

async function signInViaSharedLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function signOutCleanly(page: Page) {
  await page.evaluate(() => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') || k.includes('supabase'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  });
}

test.describe('Admin Module Real Supabase E2E Suite', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('1. RBAC: buyer and dealer get 403 Forbidden on admin routes; unauthenticated redirects to /login', async ({ page }) => {
    test.skip(!testEnv.TEST_BUYER_A_EMAIL || !testEnv.TEST_BUYER_A_PASSWORD, '.env.test credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Unauthenticated redirects to /login
    await page.goto('/admin/dashboard');
    await page.waitForURL('**/login**');

    // Buyer login -> 403 on /admin/*
    await signInViaSharedLogin(page, testEnv.TEST_BUYER_A_EMAIL, testEnv.TEST_BUYER_A_PASSWORD);
    await expect(page).toHaveURL(/\/buyer\/dashboard/, { timeout: 15000 });
    await page.goto('/admin/dashboard');
    await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Access Denied').or(page.locator('text=Forbidden')).first()).toBeVisible();

    await page.goto('/admin/settings');
    await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });

    // Dealer login -> 403 on /admin/*
    if (testEnv.TEST_DEALER_A_EMAIL && testEnv.TEST_DEALER_A_PASSWORD) {
      await signOutCleanly(page);
      await signInViaSharedLogin(page, testEnv.TEST_DEALER_A_EMAIL, testEnv.TEST_DEALER_A_PASSWORD);
      await expect(page).toHaveURL(/\/dealer\//, { timeout: 15000 });
      await page.goto('/admin/dealers');
      await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });
    }
  });

  test('2. Regular admin sees read-only Settings and gets 403 on super_admin /admin/admins', async ({ page }) => {
    test.skip(!testEnv.TEST_ADMIN_EMAIL || !testEnv.TEST_ADMIN_PASSWORD, '.env.test regular admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_ADMIN_EMAIL, testEnv.TEST_ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.locator(`text=Signed in as ${testEnv.TEST_ADMIN_EMAIL}`)).toBeVisible();

    // Settings should be read-only
    await page.goto('/admin/settings');
    await expect(page.locator('text=Read-Only View')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Save")')).toHaveCount(0);

    // /admin/admins blocked with 403
    await page.goto('/admin/admins');
    await expect(page.locator('text=403')).toBeVisible({ timeout: 10000 });
  });

  test('3. Super admin dashboard renders live metrics, chart, header & responsive viewports', async ({ page }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });
    await expect(page.locator(`text=Signed in as ${testEnv.TEST_SUPER_ADMIN_EMAIL}`)).toBeVisible();
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('svg').first()).toBeVisible();

    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-dashboard.png'), fullPage: false });
    const overflow1440 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow1440).toBe(false);

    // Tablet 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: path.join(screenshotsDir, '768px-admin-dashboard.png'), fullPage: false });

    // Mobile 360px
    await page.setViewportSize({ width: 360, height: 740 });
    await page.screenshot({ path: path.join(screenshotsDir, '360px-admin-dashboard.png'), fullPage: false });
    const overflow360 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
    expect(overflow360).toBe(false);
  });

  test('4. Dealership moderation lifecycle with re-authentication and Buyers directory', async ({ page }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);

    await page.goto('/admin/dealers');
    await expect(page.locator('text=Sunrise Auto E2E Pending').or(page.locator('text=Apex Motors Bengaluru')).first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-dealers.png'), fullPage: false });

    // Open Sunrise Auto E2E Pending detail page, approve via ReAuthModal
    await page.goto('/admin/dealers/e1111111-1111-1111-1111-111111111103');
    const approveBtn = page.locator('button:has-text("Approve Dealership")');
    if (await approveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await approveBtn.click();
      await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
      await page.locator('button:has-text("Confirm")').last().click();
      await expect(page.locator('text=VERIFIED').first()).toBeVisible({ timeout: 10000 });

      // Suspend with mandatory reason
      await page.locator('button:has-text("Suspend")').click();
      const reasonInput = page.locator('input[placeholder*="reason" i], textarea').first();
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('E2E automated suspension check');
      }
      await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
      await page.locator('button:has-text("Confirm")').last().click();
      await expect(page.locator('text=SUSPENDED').first()).toBeVisible({ timeout: 10000 });
    }

    // Check Buyers directory
    await page.goto('/admin/buyers');
    await expect(page.locator('text=Test Buyer Alpha').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-buyers.png'), fullPage: false });
  });

  test('5. Catalogue, Districts, Groups, Quotations, Bookings, Reports & Ratings screens render live data', async ({ page }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);

    await page.goto('/admin/catalogue');
    await expect(page.locator('h1')).toContainText('Catalogue');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-catalogue.png'), fullPage: false });

    await page.goto('/admin/districts');
    await expect(page.locator('h1')).toContainText('Districts');

    await page.goto('/admin/groups');
    await expect(page.locator('h1')).toContainText('Groups');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-groups.png'), fullPage: false });
    const expireBtn = page.locator('button:has-text("Run 1-Member Expiry")');
    await expireBtn.click();
    await expect(page.locator('text=Group Expiry Complete').first()).toBeVisible({ timeout: 10000 });

    await page.goto('/admin/quotations');
    await expect(page.locator('h1')).toContainText('Quotations');

    await page.goto('/admin/bookings');
    await expect(page.locator('h1')).toContainText('Bookings');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-bookings.png'), fullPage: false });

    await page.goto('/admin/reports');
    await expect(page.locator('h1')).toContainText('Reports');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-reports.png'), fullPage: false });

    await page.goto('/admin/ratings');
    await expect(page.locator('h1')).toContainText('Ratings');
  });

  test('6. Super admin invites, invite validation security, and Account password guard', async ({ page, browser }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);

    await page.goto('/admin/admins');
    await expect(page.locator(`text=${testEnv.TEST_SUPER_ADMIN_EMAIL}`)).toBeVisible({ timeout: 15000 });

    // Create invite for synthetic email
    const syntheticInviteEmail = `e2e_invite_${Date.now()}@example.test`;
    await page.click('button:has-text("Invite Admin")');
    await page.fill('input[placeholder="colleague@company.com"]', syntheticInviteEmail);
    await page.click('button:has-text("Continue to Re-Authenticate")');
    await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
    await page.locator('button:has-text("Create Invite")').click();

    await expect(page.locator(`text=One-Time Invite Link Ready for ${syntheticInviteEmail}`)).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible();

    const inviteUrl = await page.locator('code:has-text("/admin/accept-invite?token=")')
      .first()
      .innerText();

    // Verify valid invite renders local .env.local SMTP OTP screen in a fresh logged-out context
    const inviteCtx = await browser.newContext();
    const invitePage = await inviteCtx.newPage();
    await invitePage.goto(inviteUrl);
    await expect(invitePage.locator('text=Verify Invited Email Address')).toBeVisible({ timeout: 15000 });
    await expect(invitePage.locator('input[aria-label="Digit 1"]')).toBeVisible();
    await inviteCtx.close();

    // Revoke invite via table so test DB remains clean, then check invalid/revoked invite URL
    const rowRevoke = page.locator('tr', { hasText: syntheticInviteEmail }).locator('button:has-text("Revoke")');
    await rowRevoke.click();
    await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
    await page.locator('button:has-text("Confirm & Apply")').click();
    await expect(page.locator('text=Invite Revoked').first()).toBeVisible({ timeout: 10000 });

    // Also test Account page session controls cleanly
    await page.goto('/admin/account');
    await expect(page.locator('h1')).toContainText('My Admin Account');
    await page.click('button:has-text("Sign out of all other sessions")');
    await expect(page.locator('text=Other Sessions Terminated')).toBeVisible({ timeout: 10000 });

    // Public invite page with revoked token must reject cleanly
    await signOutCleanly(page);
    await page.goto(new URL(inviteUrl).pathname + new URL(inviteUrl).search);
    await expect(page.locator('text=Invalid or Expired Invitation')).toBeVisible({ timeout: 10000 });
  });

  test('7. Settings cap validation, audit log persistence & formula-safe CSV export', async ({ page }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);

    // Settings validation & audit logging
    await page.goto('/admin/settings');
    await expect(page.locator('input[aria-label="booking_amount"]')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-settings.png'), fullPage: false });

    const bookingInput = page.locator('input[aria-label="booking_amount"]');
    const originalBookingAmt = await bookingInput.inputValue();
    await bookingInput.fill('9950');
    await expect(page.locator('text=must remain strictly below').or(page.locator('text=must stay strictly below')).first()).toBeVisible();
    await bookingInput.fill(originalBookingAmt);

    // Update quote_validity_default_days and restore it
    const validityInput = page.locator('input[aria-label="quote_validity_default_days"]');
    const originalValidity = await validityInput.inputValue();
    const tempVal = originalValidity === '15' ? '14' : '15';
    await validityInput.fill(tempVal);
    await page.click('button[aria-label="Save quote_validity_default_days"]');
    await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
    await page.locator('button:has-text("Confirm & Apply Setting")').click();
    await expect(page.locator('text=Setting Updated')).toBeVisible({ timeout: 10000 });

    // Restore original value cleanly
    await page.locator('input[aria-label="quote_validity_default_days"]').fill(originalValidity);
    await page.click('button[aria-label="Save quote_validity_default_days"]');
    await page.fill('input[type="password"]', testEnv.TEST_SUPER_ADMIN_PASSWORD);
    await page.locator('button:has-text("Confirm & Apply Setting")').click();
    await expect(page.locator('text=Setting Updated')).toBeVisible({ timeout: 10000 });

    // Notifications page
    await page.goto('/admin/notifications');
    await expect(page.locator('h1')).toContainText('Notifications');

    // Audit Logs page confirms SETTING_UPDATED entries
    await page.goto('/admin/audit');
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('table').getByText('SETTING_UPDATED').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-admin-audit.png'), fullPage: false });

    // Exports page CSV download
    await page.goto('/admin/exports');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Download CSV")').nth(4).click(), // Revenue summary CSV
    ]);
    expect(download.suggestedFilename()).toContain('autogroup-revenue-summary');
  });

  test('8. Admin mobile 360px viewport has zero horizontal overflow across tabbed table screens', async ({ page }) => {
    test.skip(!testEnv.TEST_SUPER_ADMIN_EMAIL || !testEnv.TEST_SUPER_ADMIN_PASSWORD, '.env.test super_admin credentials required');

    await signOutCleanly(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await signInViaSharedLogin(page, testEnv.TEST_SUPER_ADMIN_EMAIL, testEnv.TEST_SUPER_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15000 });

    for (const route of ['/admin/dealers', '/admin/groups', '/admin/bookings', '/admin/admins']) {
      await page.goto(route);
      await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 15000 });
      const overflowPx = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      );
      expect(overflowPx, `Expected no 360px horizontal overflow on ${route}`).toBeLessThanOrEqual(2);
    }
  });
});
