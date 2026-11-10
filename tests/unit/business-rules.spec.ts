import { test, expect } from '@playwright/test';
import { formatINR } from '../../src/lib/formatters';
import { calculateBuyerRefund, calculateDealerFaultRefund } from '../../src/lib/bookingService';
import { isQuoteComplete, isQuoteExpired, rankQuotes, analyzeQuotations } from '../../src/lib/quoteService';
import { createPayment, verifyPayment } from '../../src/lib/paymentService';
import {
  isAdminRole,
  isSuperAdminRole,
  validateAdminPassword,
  validatePlatformSetting,
  detectQuoteOutliers,
  sanitizePostgrestSearch,
  toLocalDateKey,
  buildCsvContent,
  sha256Hex,
  generateInviteToken,
} from '../../src/lib/adminHelpers';
import { sealToken, unsealToken, safeCodeEquals, type OtpChallengePayload } from '../../api/_lib/otpToken.js';

test.describe('Unit Tests: Core Business Rules', () => {
  // Test 1: formatINR formatting
  test('1. formatINR formats Indian currency, handles 0, large numbers, negatives and decimals gracefully', () => {
    // 0 formatted
    expect(formatINR(0)).toBe('₹0');

    // 12,80,000 formatted according to Indian numbering standard
    expect(formatINR(1280000)).toBe('₹12,80,000');

    // Negative amounts handled gracefully
    expect(formatINR(-500)).toBe('-₹500');

    // Decimals rounded to whole rupee
    expect(formatINR(12.75)).toBe('₹13');

    // Null, undefined, and NaN handled gracefully
    expect(formatINR(null)).toBe('₹0');
    expect(formatINR(undefined)).toBe('₹0');
    expect(formatINR(NaN)).toBe('₹0');
  });

  // Test 2: Refund Math
  test('2. refund math matches strict cancellation business rules', () => {
    const bookingAmount = 10000;
    const platformFee = 999;

    // A. Buyer Cancellation:
    // 5% retained by showroom, platform fee non-refundable
    // Buyer receives 9,500 total, 1,499 lost
    const buyerCancel = calculateBuyerRefund(bookingAmount, platformFee);
    expect(buyerCancel.retainedAmount).toBe(500); // 5% of 10,000
    expect(buyerCancel.refundAmount).toBe(9500); // 10,000 - 500
    expect(buyerCancel.platformFeeNonRefunded).toBe(999);
    expect(buyerCancel.buyerLostAmount).toBe(1499); // 500 retained + 999 fee

    // B. Dealer Fault Cancellation:
    // 100% refund of deposit (10,000) PLUS platform fee (999) = 10,999 returned to buyer
    // Showroom receives 0
    const dealerFaultCancel = calculateDealerFaultRefund(bookingAmount, platformFee);
    expect(dealerFaultCancel.bookingAmountRefunded).toBe(10000);
    expect(dealerFaultCancel.platformFeeRefunded).toBe(999);
    expect(dealerFaultCancel.totalRefunded).toBe(10999);
    expect(dealerFaultCancel.showroomRetained).toBe(0);
  });

  // Test 3: Competitor Quote Ranking & Lowest Price Exclusion
  test('3. competitor quote ranking: lowest complete on-road price first, incomplete quotes excluded from lowest price badge', () => {
    const futureDate = new Date(Date.now() + 7 * 86400 * 1000).toISOString();

    const quotes = [
      {
        id: 'q-incomplete-cheap',
        dealership_id: 'd1',
        on_road_price: 1100000, // Cheaper, but incomplete!
        is_complete: false,
        validity_date: futureDate,
      },
      {
        id: 'q-complete-mid',
        dealership_id: 'd2',
        on_road_price: 1250000, // Complete
        is_complete: true,
        validity_date: futureDate,
      },
      {
        id: 'q-complete-high',
        dealership_id: 'd3',
        on_road_price: 1300000, // Complete
        is_complete: true,
        validity_date: futureDate,
      },
    ];

    const { rankedCompleteQuotes, lowestCompleteQuote, isLowestPrice } = rankQuotes(quotes);

    // Only complete quotes are ranked
    expect(rankedCompleteQuotes.length).toBe(2);
    expect(rankedCompleteQuotes[0].id).toBe('q-complete-mid');
    expect(rankedCompleteQuotes[1].id).toBe('q-complete-high');

    // Lowest complete quote is q-complete-mid (12,50,000), NOT q-incomplete-cheap (11,00,000)
    expect(lowestCompleteQuote?.id).toBe('q-complete-mid');
    expect(lowestCompleteQuote?.on_road_price).toBe(1250000);

    // Incomplete quote is NOT marked as lowest price
    expect(isLowestPrice('q-incomplete-cheap')).toBe(false);
    expect(isLowestPrice('q-complete-mid')).toBe(true);
    expect(isLowestPrice('q-complete-high')).toBe(false);

    // Test with analyzeQuotations helper
    const fullAnalysis = analyzeQuotations(quotes as any);
    expect(fullAnalysis.lowestPriceQuote?.id).toBe('q-complete-mid');
    expect(fullAnalysis.hasIncompleteQuotes).toBe(true);
    expect(fullAnalysis.maxSavings).toBe(50000); // 13,00,000 - 12,50,000
  });

  // Test 4: Incomplete Quote Check
  test('4. incomplete quote check: quote missing insurance or registration is flagged incomplete', () => {
    // Missing insurance (insurance = 0)
    expect(
      isQuoteComplete({
        insurance: 0,
        registration_charges: 65000,
        ex_showroom_price: 1200000,
      })
    ).toBe(false);

    // Missing registration (registration = 0)
    expect(
      isQuoteComplete({
        insurance: 45000,
        registration_charges: 0,
        ex_showroom_price: 1200000,
      })
    ).toBe(false);

    // Undefined insurance and registration
    expect(isQuoteComplete({})).toBe(false);

    // Both insurance and registration present (> 0)
    expect(
      isQuoteComplete({
        insurance: 45000,
        registration_charges: 65000,
        ex_showroom_price: 1200000,
      })
    ).toBe(true);

    // CamelCase variants
    expect(
      isQuoteComplete({
        insurance: 45000,
        registrationCharges: 65000,
        exShowroomPrice: 1200000,
      })
    ).toBe(true);
  });

  // Test 5: Admin Role Helpers
  test('5. admin role helpers distinguish super_admin, admin, buyer and dealer cleanly', () => {
    expect(isAdminRole('super_admin')).toBe(true);
    expect(isAdminRole('admin')).toBe(true);
    expect(isAdminRole('buyer')).toBe(false);
    expect(isAdminRole('dealer')).toBe(false);
    expect(isAdminRole(null)).toBe(false);

    expect(isSuperAdminRole('super_admin')).toBe(true);
    expect(isSuperAdminRole('admin')).toBe(false);
    expect(isSuperAdminRole('buyer')).toBe(false);
  });

  // Test 6: Admin Password Policy (min 12 chars + complexity)
  test('6. validateAdminPassword enforces >= 12 characters and mixed character classes', () => {
    expect(validateAdminPassword('Short1!').valid).toBe(false);
    expect(validateAdminPassword('alllowercase1234').valid).toBe(false);
    expect(validateAdminPassword('ALLUPPERCASE1234').valid).toBe(false);
    expect(validateAdminPassword('NoDigitsOrSymbols').valid).toBe(false);
    expect(validateAdminPassword('AdminStrongPass1').valid).toBe(true);
    expect(validateAdminPassword('Admin!Strong#Pass').valid).toBe(true);
  });

  // Test 7: Platform Settings Validation (booking_amount + platform_fee < 10000)
  test('7. validatePlatformSetting rejects booking_amount + platform_fee >= 10000 and bad types', () => {
    const base = { booking_amount: '5000', platform_fee: '100' };

    expect(validatePlatformSetting('booking_amount', '9899', base).valid).toBe(true); // 9999 < 10000
    expect(validatePlatformSetting('booking_amount', '9900', base).valid).toBe(false); // 10000 >= 10000
    expect(validatePlatformSetting('platform_fee', '5000', base).valid).toBe(false); // 10000 >= 10000
    expect(validatePlatformSetting('platform_fee', '-1', base).valid).toBe(false);
    expect(validatePlatformSetting('buyer_cancel_retention_percent', '105', base).valid).toBe(false);
    expect(validatePlatformSetting('buyer_cancel_retention_percent', '10', base).valid).toBe(true);
    expect(validatePlatformSetting('fee_refund_on_dealer_fault', 'true', base).valid).toBe(true);
    expect(validatePlatformSetting('fee_refund_on_dealer_fault', 'maybe', base).valid).toBe(false);
    expect(validatePlatformSetting('visibility_member_threshold', '0', base).valid).toBe(false);
  });

  // Test 8: Quote Outlier Detection (>= threshold% vs group median)
  test('8. detectQuoteOutliers flags extreme high/low complete quotes against median', () => {
    const quotes = [
      { id: 'q1', group_id: 'g1', on_road_price: 1000000, is_complete: true },
      { id: 'q2', group_id: 'g1', on_road_price: 1020000, is_complete: true },
      { id: 'q3', group_id: 'g1', on_road_price: 1010000, is_complete: true }, // median = 10,10,000
      { id: 'q4', group_id: 'g1', on_road_price: 1300000, is_complete: true }, // high outlier ~ +27.5%
      { id: 'q5', group_id: 'g1', on_road_price: 800000, is_complete: false }, // incomplete
    ];

    const outliers = detectQuoteOutliers(quotes, 15);
    expect(outliers.get('q1')?.isOutlier).toBe(false);
    expect(outliers.get('q4')?.isOutlier).toBe(true);
    expect(outliers.get('q4')?.direction).toBe('HIGH');
  });

  // Test 9: Formula-Safe RFC 4180 CSV Builder
  test('9. buildCsvContent quotes commas/quotes and neutralizes spreadsheet formula injection', () => {
    const csv = buildCsvContent(
      ['Name', 'Formula', 'Notes'],
      [['Tata, Nexon', '=CMD|calc', 'Line "A"']]
    );
    expect(csv).toBe('Name,Formula,Notes\r\n"Tata, Nexon",\'=CMD|calc,"Line ""A"""');
  });

  // Test 10: Admin Invite Token & SHA-256 Digest
  test('10. generateInviteToken produces 48 hex chars and sha256Hex produces 64-char digest', async () => {
    const tok1 = generateInviteToken();
    const tok2 = generateInviteToken();
    expect(tok1).toMatch(/^[0-9a-f]{48}$/);
    expect(tok1).not.toBe(tok2);

    const hash = await sha256Hex(tok1);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(tok1);
  });

  // Test 11: Stateless AES-256-GCM OTP Token & Constant-Time Code Comparison
  test('11. sealToken/unsealToken round-trips OTP payloads and rejects tampered or wrong-secret tokens', () => {
    const secret = 'test-otp-signing-secret-0123456789abcdef';
    const payload: OtpChallengePayload = {
      kind: 'otp_challenge',
      email: 'user@example.com',
      type: 'recovery',
      code: '482913',
      attempts: 0,
      exp: Date.now() + 600000,
    };

    const token = sealToken(payload, secret);
    expect(token.split('.')).toHaveLength(3);
    expect(token).not.toContain('482913');

    const decoded = unsealToken<OtpChallengePayload>(token, secret);
    expect(decoded).toEqual(payload);

    // Wrong secret or tampered ciphertext fails closed
    expect(unsealToken<OtpChallengePayload>(token, 'wrong-secret')).toBeNull();
    const parts = token.split('.');
    const tamperedCipher = Buffer.from(parts[2], 'base64url');
    tamperedCipher[0] ^= 0xff;
    parts[2] = tamperedCipher.toString('base64url');
    expect(unsealToken<OtpChallengePayload>(parts.join('.'), secret)).toBeNull();

    // Timing-safe code comparison
    expect(safeCodeEquals('482913', '482913')).toBe(true);
    expect(safeCodeEquals('482913', '482914')).toBe(false);
    expect(safeCodeEquals('482913', '48291')).toBe(false);
  });

  // Test 12: Quote Filtering Excludes Inactive, Expired & Malformed Dates
  test('12. rankQuotes and isQuoteExpired filter inactive, expired, and malformed validity dates', () => {
    const futureDate = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 86400 * 1000).toISOString();

    expect(isQuoteExpired('')).toBe(true);
    expect(isQuoteExpired('not-a-valid-date')).toBe(true);
    expect(isQuoteExpired(pastDate)).toBe(true);
    expect(isQuoteExpired(futureDate)).toBe(false);

    const ranked = rankQuotes([
      {
        id: 'q-deactivated-cheapest',
        on_road_price: 900000,
        is_complete: true,
        is_active: false,
        validity_date: futureDate,
      },
      {
        id: 'q-expired-cheap',
        on_road_price: 950000,
        is_complete: true,
        is_active: true,
        validity_date: pastDate,
      },
      {
        id: 'q-valid-active',
        on_road_price: 1100000,
        is_complete: true,
        is_active: true,
        validity_date: futureDate,
      },
    ]);

    expect(ranked.rankedCompleteQuotes.map((q) => q.id)).toEqual(['q-valid-active']);
    expect(ranked.lowestCompleteQuote?.id).toBe('q-valid-active');
  });

  // Test 13: Outlier Detection Ignores Inactive/Expired Quotes
  test('13. detectQuoteOutliers ignores inactive and expired quotes when calculating group median', () => {
    const futureDate = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
    const pastDate = new Date(Date.now() - 86400 * 1000).toISOString();

    const outliers = detectQuoteOutliers(
      [
        { id: 'q1', group_id: 'g1', on_road_price: 1000000, is_complete: true, is_active: true, validity_date: futureDate },
        { id: 'q2', group_id: 'g1', on_road_price: 1020000, is_complete: true, is_active: true, validity_date: futureDate },
        { id: 'q3', group_id: 'g1', on_road_price: 1010000, is_complete: true, is_active: true, validity_date: futureDate },
        { id: 'q-dead', group_id: 'g1', on_road_price: 5000000, is_complete: true, is_active: false, validity_date: futureDate },
        { id: 'q-exp', group_id: 'g1', on_road_price: 5000000, is_complete: true, is_active: true, validity_date: pastDate },
      ],
      15
    );

    expect(outliers.get('q-dead')?.isOutlier).toBe(false);
    expect(outliers.get('q-exp')?.isOutlier).toBe(false);
    expect(outliers.get('q1')?.isOutlier).toBe(false);
    expect(outliers.get('q2')?.isOutlier).toBe(false);
  });

  // Test 14: PostgREST .or() Search Sanitization & Integer Settings Validation
  test('14. sanitizePostgrestSearch strips filter injection delimiters and integer settings reject decimals', () => {
    expect(sanitizePostgrestSearch('Tata, Nexon (EV)*\\')).toBe('Tata Nexon EV');
    expect(sanitizePostgrestSearch('  Hyundai   Creta  ')).toBe('Hyundai Creta');

    expect(validatePlatformSetting('visibility_member_threshold', '3.5', {}).valid).toBe(false);
    expect(validatePlatformSetting('default_group_target', '10.2', {}).valid).toBe(false);
    expect(validatePlatformSetting('dealer_delivery_fallback_days', '14', {}).valid).toBe(true);

    const localKey = toLocalDateKey(new Date(2026, 4, 9, 0, 15, 0));
    expect(localKey).toBe('2026-05-09');
  });

  // Test 15: Simulated Payment Intent Tracking Preserves Booking ID, Amount & Method
  test('15. paymentService preserves intent bookingId, amount, and chosen payment method on verification', async () => {
    const intent = await createPayment({
      bookingId: 'bk-test-123',
      amount: 5100,
      method: 'CARD',
    });
    expect(intent.status).toBe('PENDING');
    expect(intent.method).toBe('CARD');

    const verified = await verifyPayment(intent.paymentId, 'SUCCESS');
    expect(verified.status).toBe('SUCCESS');
    expect(verified.bookingId).toBe('bk-test-123');
    expect(verified.amount).toBe(5100);
    expect(verified.method).toBe('CARD');
  });
});
