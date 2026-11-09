import { test, expect } from '@playwright/test';
import { formatINR } from '../../src/lib/formatters';
import { calculateBuyerRefund, calculateDealerFaultRefund } from '../../src/lib/bookingService';
import { isQuoteComplete, rankQuotes, analyzeQuotations } from '../../src/lib/quoteService';

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
});
