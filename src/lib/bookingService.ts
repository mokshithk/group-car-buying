import { Booking, PriceSnapshot, Interest, Quotation, Group } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { refundPayment, createPayment } from './paymentService';

/**
 * Booking Service: Real Supabase implementation
 * Implements expressions of interest, locked-price bookings, cancellations, delivery and reviews.
 * No mock arrays or in-memory fallbacks.
 */

export async function fetchBuyerBookings(buyerId: string): Promise<Booking[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*, dealership:dealerships(*), quotation:quotations(*), group:groups(*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))))')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching buyer bookings:', error);
    return [];
  }

  return (data || []) as Booking[];
}

export async function fetchDealerBookings(dealershipId: string): Promise<Booking[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('bookings')
    .select('*, buyer:profiles(*), quotation:quotations(*), group:groups(*, variant:variants(*, model:models(*)))')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching dealer bookings:', error);
    return [];
  }

  return (data || []) as Booking[];
}

export async function fetchDealerInterests(dealershipId: string): Promise<Interest[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await supabase
    .from('interests')
    .select('*, buyer:profiles(*), quotation:quotations(*)')
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching dealer interests:', error);
    return [];
  }

  return (data || []) as Interest[];
}

/**
 * 1. Express Interest Flow ("I'm interested")
 * Shares buyer contact with the dealership.
 */
export async function expressInterest(
  quotation: Quotation,
  _group: Group,
  buyerId: string,
  _buyerName: string,
  _buyerPhone: string
): Promise<{ success: boolean; interestId?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data: existing } = await supabase
    .from('interests')
    .select('id')
    .eq('quotation_id', quotation.id)
    .eq('user_id', buyerId)
    .maybeSingle();

  if (existing) {
    return { success: true, interestId: existing.id };
  }

  const { data, error } = await supabase
    .from('interests')
    .insert({
      quotation_id: quotation.id,
      user_id: buyerId,
      dealership_id: quotation.dealership_id,
      contacted: false,
    })
    .select()
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, interestId: data.id };
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
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  // Prevent double-booking with same quote / active booking
  const { data: existingActive } = await supabase
    .from('bookings')
    .select('id')
    .eq('buyer_id', buyerId)
    .eq('quotation_id', quotation.id)
    .in('status', ['PENDING', 'PAID', 'DELIVERED'])
    .maybeSingle();

  if (existingActive) {
    return {
      success: false,
      error: 'You already hold an active booking with this dealership quotation.',
    };
  }

  const bookingAmount = 5000;
  const platformFee = 100;
  const totalAmount = bookingAmount + platformFee; // ₹5,100 (< ₹10,000 limit)

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

  // Simulate payment processing
  const paymentIntent = await createPayment({
    bookingId: bookingCode,
    amount: totalAmount,
    method: 'UPI',
  });

  // Insert booking
  const { data: bookingRow, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      booking_code: bookingCode,
      group_id: group.id,
      quotation_id: quotation.id,
      buyer_id: buyerId,
      dealership_id: quotation.dealership_id,
      booking_amount: bookingAmount,
      platform_fee: platformFee,
      total_amount: totalAmount,
      status: 'PAID',
      price_snapshot: priceSnapshot,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
    })
    .select()
    .single();

  if (bookingErr || !bookingRow) {
    return { success: false, error: bookingErr?.message || 'Failed to record booking.' };
  }

  // Insert payment record
  await supabase.from('payments').insert({
    booking_id: bookingRow.id,
    payment_id: paymentIntent.paymentId,
    amount: totalAmount,
    status: 'SUCCESS',
    method: 'UPI',
  });

  // Business Rule: "After successful payment the buyer is automatically removed from the group (never before)."
  await supabase
    .from('group_members')
    .update({ status: 'BOOKED', left_at: new Date().toISOString() })
    .eq('group_id', group.id)
    .eq('user_id', buyerId);

  return {
    success: true,
    booking: {
      ...bookingRow,
      dealership: quotation.dealership,
      group,
    },
  };
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
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data: b, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error || !b) throw new Error('Booking not found');

  const retentionPercent = 0.05; // 5%
  const retainedAmount = Math.round(b.booking_amount * retentionPercent);
  const refundAmount = b.booking_amount - retainedAmount;
  const platformFeeNonRefunded = b.platform_fee;

  await supabase
    .from('bookings')
    .update({ status: 'CANCELLED_BY_BUYER', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  await supabase.from('refunds').insert({
    booking_id: bookingId,
    reason: 'BUYER_CANCEL',
    booking_amount_refunded: refundAmount,
    dealer_retained_amount: retainedAmount,
    platform_fee_refunded: 0,
    total_refunded: refundAmount,
    status: 'PROCESSED',
  });

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
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data: b, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (error || !b) throw new Error('Booking not found');

  const bookingAmountRefunded = b.booking_amount;
  const platformFeeRefunded = b.platform_fee;
  const totalRefunded = bookingAmountRefunded + platformFeeRefunded;

  await supabase
    .from('bookings')
    .update({ status: 'CANCELLED_BY_DEALER', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  await supabase.from('refunds').insert({
    booking_id: bookingId,
    reason: 'DEALER_FAULT',
    booking_amount_refunded: bookingAmountRefunded,
    dealer_retained_amount: 0,
    platform_fee_refunded: platformFeeRefunded,
    total_refunded: totalRefunded,
    status: 'PROCESSED',
  });

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
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'DELIVERED',
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId);

  return !error;
}

/**
 * 6. Dealer Rating & Review:
 */
export async function submitDealerRating(
  bookingId: string,
  dealershipId: string,
  buyerId: string,
  rating: number,
  review: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('dealer_ratings').insert({
    booking_id: bookingId,
    dealership_id: dealershipId,
    buyer_id: buyerId,
    rating,
    review,
  });

  return !error;
}

/**
 * 7. Report Dealer ("did not honor price", etc.)
 */
export async function submitDealerReport(
  dealershipId: string,
  buyerId: string,
  reason: string,
  details: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const { error } = await supabase.from('reports').insert({
    dealership_id: dealershipId,
    buyer_id: buyerId,
    reason,
    details,
  });

  return !error;
}
