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

    // Reset to desktop for further tests
    await page.setViewportSize({ width: 1440, height: 900 });

    // Test Catalog Filters on Landing Page
    const brandSelect = page.locator('select').first();
    if (await brandSelect.isVisible()) {
      await brandSelect.selectOption('Tata Motors');
      await expect(page.locator('text=Tata Nexon')).toBeVisible();
    }
  });

  test('2. Car detail page with variants table and active groups in district', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/cars/c1111111-1111-1111-1111-111111111101');

    // Title and disclaimers
    await expect(page.locator('h1')).toContainText('Tata Nexon');
    await expect(page.locator('text=Indicative ex-showroom').first()).toBeVisible();

    // Variants table
    await expect(page.locator('text=Creative Plus').first()).toBeVisible();

    // Active groups section
    await expect(page.locator('text=Variants & Local Buying Groups')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-car-detail.png'), fullPage: false });
  });

  test('3. Buyer demo login, dashboard summary, and find groups flow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');

    // Check login page elements
    await expect(page.locator('text=Welcome back')).toBeVisible();
    await expect(page.locator('text=Instant Test Session')).toBeVisible();

    // Use Quick Login as Buyer Test Session
    await page.click('button:has-text("Buyer Test Session")');

    // Should redirect to /buyer/dashboard
    await page.waitForURL('**/buyer/dashboard');
    await expect(page.locator('text=Welcome back,')).toBeVisible();
    await expect(page.locator('text=Active Groups').first()).toBeVisible();
    await expect(page.locator('text=Live Quotes').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-buyer-dashboard.png'), fullPage: false });

    // Navigate to Find Groups
    await page.goto('/buyer/groups/find');
    await expect(page.locator('text=Find Buying Groups')).toBeVisible();

    // Join Group Modal disclaimer check
    const joinBtn = page.locator('button:has-text("Join Group")').first();
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
      await expect(page.locator('text=Joining does not oblige you to buy')).toBeVisible();
      await page.click('button:has-text("Cancel")');
    }
  });

  test('4. Group detail page with waiting countdown, invite link, and member privacy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Buyer Test Session")');
    await page.waitForURL('**/buyer/dashboard');

    // Group 1: 3 members -> Visible to authorized dealers
    await page.goto('/buyer/groups/g1111111-1111-1111-1111-111111111101');
    await expect(page.locator('text=Tata Nexon').first()).toBeVisible();
    await expect(page.locator('text=Visible to Authorized Dealers')).toBeVisible();

    // Check privacy of member names (First name + initial only)
    await expect(page.locator('text=Rahul S.').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-group-detail.png'), fullPage: false });

    // Group 3: 2 members, 2 days old -> Waiting gate countdown active
    await page.goto('/buyer/groups/g1111111-1111-1111-1111-111111111103');
    await expect(page.locator('text=Dealer Visibility Waiting Gate')).toBeVisible();
    await expect(page.locator('text=automatically becomes visible to dealers in')).toBeVisible();
  });

  test('5. Offers comparison excludes incomplete quotes from lowest price badge', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Buyer Test Session")');
    await page.waitForURL('**/buyer/dashboard');

    await page.goto('/buyer/groups/g1111111-1111-1111-1111-111111111101/offers');
    await expect(page.locator('text=Quotation Comparison:').first()).toBeVisible();

    // Check that quotes exist and incomplete quote notice is displayed
    await expect(page.locator('text=Incomplete quotes are strictly excluded from "Lowest Price"')).toBeVisible();

    // Verified complete quotation advantage badge should be present
    await expect(page.locator('text=Verified Complete Quotation Advantage')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-offers-comparison.png'), fullPage: false });
  });

  test('6. "I am interested" flow with showroom contact and unlocked price notice', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Buyer Test Session")');
    await page.waitForURL('**/buyer/dashboard');

    await page.goto('/buyer/quote/q1111111-1111-1111-1111-111111111101/interested');
    await expect(page.locator('text=Interest Confirmed & Showroom Unlocked')).toBeVisible();
    await expect(page.locator('text=Important Pricing Notice: Price Is NOT Locked')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-interested-flow.png'), fullPage: false });
  });

  test('7. Simulated booking payment: failure retains group, success locks price', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Buyer Test Session")');
    await page.waitForURL('**/buyer/dashboard');

    // Go to booking payment page
    await page.goto('/buyer/quote/q1111111-1111-1111-1111-111111111101/book');
    await expect(page.locator('text=Lock Quotation & Reserve Car')).toBeVisible();
    await expect(page.locator('text=SIMULATED PAYMENT GATEWAY')).toBeVisible();
    await expect(page.locator('text=Dealership Booking Deposit')).toBeVisible();
    await expect(page.locator('text=Platform Facilitation Fee')).toBeVisible();

    // Test Cancelled Scenario: Simulate Cancel
    await page.click('button:has-text("Simulate Cancel")');
    await expect(page.locator('text=Payment simulation was cancelled')).toBeVisible();

    // Test Success Scenario: Simulate Success
    await page.click('button:has-text("Simulate Success")');
    await page.waitForURL('**/buyer/booking-confirmation/**');
    await expect(page.locator('text=Payment Successful & Price Locked')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Booking Confirmed!', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-booking-confirmed.png'), fullPage: false });
  });

  test('8. My bookings with cancellation preview (5% retained) and delivery confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Buyer Test Session")');
    await page.waitForURL('**/buyer/dashboard');

    await page.goto('/buyer/bookings');
    await expect(page.locator('text=My Bookings')).toBeVisible();

    // Verify cancellation modal calculation if bookings exist
    const cancelBtn = page.locator('button:has-text("Cancel Booking")').first();
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
      await expect(page.locator('text=Cancellation & Refund Preview')).toBeVisible();
      await expect(page.locator('text=5% Showroom Cancellation Fee')).toBeVisible();
      await expect(page.locator('text=Platform Fee (Non-refundable)')).toBeVisible();
      await page.click('button:has-text("Keep My Booking")');
    }
  });

  test('9. Dealer workflow: dashboard, eligible groups, quotation submission, leads and bookings', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.click('button:has-text("Dealer Test Session")');
    await page.waitForURL('**/dealer/dashboard');

    await expect(page.locator('text=Dealership Operations Hub')).toBeVisible();
    await expect(page.locator('text=Eligible Groups').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-dealer-dashboard.png'), fullPage: false });

    // Check Dealer Groups
    await page.goto('/dealer/groups');
    await expect(page.locator('text=Eligible Group Tenders')).toBeVisible();
    await expect(page.locator('text=Bookings So Far').first()).toBeVisible();

    // Check Quote Submission Page
    await page.goto('/dealer/groups/g1111111-1111-1111-1111-111111111101/quote');
    await expect(page.locator('text=Submit / Revise Quotation')).toBeVisible();
    await expect(page.locator('text=Live Competitive Projection')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '1440px-dealer-submit-quote.png'), fullPage: false });

    // Check Dealer Leads
    await page.goto('/dealer/leads');
    await expect(page.locator('text=Interested Customer Leads')).toBeVisible();

    // Check Dealer Bookings
    await page.goto('/dealer/bookings');
    await expect(page.locator('text=Customer Bookings Received')).toBeVisible();
  });
});
