import { Booking, PriceSnapshot, Interest, Quotation, Group, DealerRating, Report } from '@/types';
import { leaveGroup } from './groupService';
import { refundPayment } from './paymentService';

const LOCAL_BOOKINGS_KEY = 'autogroup_local_bookings';
const LOCAL_INTERESTS_KEY = 'autogroup_local_interests';
const LOCAL_RATINGS_KEY = 'autogroup_local_ratings';
const LOCAL_REPORTS_KEY = 'autogroup_local_reports';

export function getLocalBookings(): Booking[] {
  const saved = localStorage.getItem(LOCAL_BOOKINGS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveLocalBookings(bookings: Booking[]): void {
  localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(bookings));
}

export function getLocalInterests(): Interest[] {
  const saved = localStorage.getItem(LOCAL_INTERESTS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function saveLocalInterests(interests: Interest[]): void {
  localStorage.setItem(LOCAL_INTERESTS_KEY, JSON.stringify(interests));
}

/**
 * 1. Express Interest Flow ("I'm interested")
 * Shares buyer contact with the dealership and notifies dealer.
 */
export async function expressInterest(
  quotation: Quotation,
  _group: Group,
  buyerId: string,
  buyerName: string,
  buyerPhone: string
): Promise<{ success: boolean; interestId: string }> {
  const interests = getLocalInterests();
  const existing = interests.find(
    (i) => i.quotation_id === quotation.id && i.user_id === buyerId
  );

  if (existing) {
    return { success: true, interestId: existing.id };
  }

  const newInterest: Interest = {
    id: 'int-' + Math.random().toString(36).substring(2, 9),
    quotation_id: quotation.id,
    user_id: buyerId,
    dealership_id: quotation.dealership_id,
    contacted: false,
    created_at: new Date().toISOString(),
    quotation,
    buyer: {
      id: buyerId,
      role: 'buyer',
      full_name: buyerName,
      phone: buyerPhone,
      consent_share_details: true,
      created_at: '',
      updated_at: '',
    },
  };

  interests.unshift(newInterest);
  saveLocalInterests(interests);
  return { success: true, interestId: newInterest.id };
}

/**
 * 2. Book Now Flow ("Book now" + Simulated Payment)
 * Locks the price snapshot, stores booking, and removes buyer from group.
 */
export async function executeBooking(
  quotation: Quotation,
  group: Group,
  buyerId: string,
  buyerName: string,
  buyerPhone: string
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  const bookings = getLocalBookings();

  // Prevent double-booking with same quote / active booking
  const existingActive = bookings.find(
    (b) =>
      b.buyer_id === buyerId &&
      b.quotation_id === quotation.id &&
      b.status !== 'CANCELLED_BY_BUYER' &&
      b.status !== 'CANCELLED_BY_DEALER' &&
      b.status !== 'REFUNDED'
  );

  if (existingActive) {
    return {
      success: false,
      error: 'You already hold an active booking with this dealership quotation.',
    };
  }

  const bookingAmount = 5000;
  const platformFee = 100;
  const totalAmount = bookingAmount + platformFee; // ₹5,100 (< ₹10,000 check)

  if (totalAmount >= 10000) {
    return { success: false, error: 'Booking amount + fee exceeds platform limit of ₹10,000.' };
  }

  const bookingCode = 'AG-BK-' + Math.random().toString(36).substring(2, 7).toUpperCase();

  const priceSnapshot: PriceSnapshot = {
    dealer_name: quotation.dealership?.name || 'Authorized Dealership',
    dealership_id: quotation.dealership_id,
    variant_name: group.variant?.name || 'Variant',
    model_name: group.variant?.model?.name || 'Model',
    manufacturer_name: group.variant?.model?.manufacturer?.name || 'Manufacturer',
    ex_showroom_price: quotation.ex_showroom_price,
    insurance: quotation.insurance,
    registration_charges: quotation.registration_charges,
    discounts: quotation.discounts,
    accessories_extras: quotation.accessories_extras,
    on_road_price: quotation.on_road_price,
    validity_date: quotation.validity_date,
    terms: quotation.terms,
    timestamp: new Date().toISOString(),
  };

  const newBooking: Booking = {
    id: crypto.randomUUID(),
    booking_code: bookingCode,
    group_id: group.id,
    quotation_id: quotation.id,
    buyer_id: buyerId,
    dealership_id: quotation.dealership_id,
    booking_amount: bookingAmount,
    platform_fee: platformFee,
    total_amount: totalAmount,
    status: 'PAID', // Payment succeeded
    price_snapshot: priceSnapshot,
    buyer_name: buyerName,
    buyer_phone: buyerPhone,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dealership: quotation.dealership,
    group,
  };

  bookings.unshift(newBooking);
  saveLocalBookings(bookings);

  // Business Rule (Section 2): "After successful payment the buyer is automatically removed from the group (never before)."
  await leaveGroup(group.id, buyerId);

  return { success: true, booking: newBooking };
}

/**
 * 3. Buyer Cancellation:
 * 5% retained by showroom, platform fee is NOT refunded.
 */
export async function cancelBookingByBuyer(
  bookingId: string
): Promise<{
  success: boolean;
  refundAmount: number;
  retainedAmount: number;
  platformFeeNonRefunded: number;
}> {
  const bookings = getLocalBookings();
  const b = bookings.find((item) => item.id === bookingId);
  if (!b) throw new Error('Booking not found');

  const retentionPercent = 0.05; // 5%
  const retainedAmount = Math.round(b.booking_amount * retentionPercent);
  const refundAmount = b.booking_amount - retainedAmount;
  const platformFeeNonRefunded = b.platform_fee;

  b.status = 'CANCELLED_BY_BUYER';
  b.updated_at = new Date().toISOString();
  saveLocalBookings(bookings);

  await refundPayment('pay_' + b.id, b.id, refundAmount, 'BUYER_CANCEL');

  return {
    success: true,
    refundAmount,
    retainedAmount,
    platformFeeNonRefunded,
  };
}

/**
 * 4. Dealer Fault Cancellation:
 * 100% of booking amount + platform fee refunded to buyer.
 */
export async function cancelBookingByDealerFault(
  bookingId: string
): Promise<{
  success: boolean;
  totalRefunded: number;
  bookingAmountRefunded: number;
  platformFeeRefunded: number;
}> {
  const bookings = getLocalBookings();
  const b = bookings.find((item) => item.id === bookingId);
  if (!b) throw new Error('Booking not found');

  const bookingAmountRefunded = b.booking_amount;
  const platformFeeRefunded = b.platform_fee;
  const totalRefunded = bookingAmountRefunded + platformFeeRefunded;

  b.status = 'CANCELLED_BY_DEALER';
  b.updated_at = new Date().toISOString();
  saveLocalBookings(bookings);

  await refundPayment('pay_' + b.id, b.id, totalRefunded, 'DEALER_FAULT');

  return {
    success: true,
    totalRefunded,
    bookingAmountRefunded,
    platformFeeRefunded,
  };
}

/**
 * 5. Delivery Confirmation:
 * Buyer confirms "I received my car" -> marked DELIVERED and unlocks dealer rating.
 */
export async function confirmDelivery(bookingId: string): Promise<boolean> {
  const bookings = getLocalBookings();
  const b = bookings.find((item) => item.id === bookingId);
  if (!b) return false;

  b.status = 'DELIVERED';
  b.delivered_at = new Date().toISOString();
  b.updated_at = new Date().toISOString();
  saveLocalBookings(bookings);
  return true;
}

/**
 * 6. Dealer Rating & Review:
 */
export function submitDealerRating(
  bookingId: string,
  dealershipId: string,
  buyerId: string,
  rating: number,
  review: string
): void {
  const saved = localStorage.getItem(LOCAL_RATINGS_KEY);
  const ratings: DealerRating[] = saved ? JSON.parse(saved) : [];

  ratings.unshift({
    id: 'rate-' + Math.random().toString(36).substring(2, 9),
    booking_id: bookingId,
    dealership_id: dealershipId,
    buyer_id: buyerId,
    rating,
    review,
    created_at: new Date().toISOString(),
  });

  localStorage.setItem(LOCAL_RATINGS_KEY, JSON.stringify(ratings));
}

/**
 * 7. Report Dealer ("did not honor price", etc.)
 */
export function submitDealerReport(
  dealershipId: string,
  buyerId: string,
  reason: string,
  details: string
): void {
  const saved = localStorage.getItem(LOCAL_REPORTS_KEY);
  const reports: Report[] = saved ? JSON.parse(saved) : [];

  reports.unshift({
    id: 'rep-' + Math.random().toString(36).substring(2, 9),
    dealership_id: dealershipId,
    buyer_id: buyerId,
    reason,
    details,
    created_at: new Date().toISOString(),
  });

  localStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify(reports));
}
