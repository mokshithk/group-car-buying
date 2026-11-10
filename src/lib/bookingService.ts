import { Booking, PriceSnapshot, Interest, Quotation, Group } from '@/types';
import { supabase, isSupabaseConfigured } from './supabase';
import { refundPayment, createPayment, type PaymentMethod } from './paymentService';
import { fetchPlatformSettings } from './catalogService';
import { isQuoteExpired } from './quoteService';

export async function fetchBuyerBookings(buyerId: string): Promise<Booking[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(
      '*, dealership:dealerships(*), quotation:quotations(*), payments(*), refunds(*), group:groups(*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))))'
    )
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load bookings: ${error.message}`);
  }

  return (data || []) as Booking[];
}

export async function fetchDealerBookings(dealershipId: string): Promise<Booking[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('bookings')
    .select(
      '*, buyer:profiles(*), quotation:quotations(*), payments(*), refunds(*), group:groups(*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))))'
    )
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load dealership bookings: ${error.message}`);
  }

  return (data || []) as Booking[];
}

export async function fetchDealerInterests(dealershipId: string): Promise<Interest[]> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabase
    .from('interests')
    .select(
      '*, buyer:profiles(*), quotation:quotations(*, group:groups(*, variant:variants(*, model:models(*, manufacturer:manufacturers(*)))))'
    )
    .eq('dealership_id', dealershipId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load interested buyer leads: ${error.message}`);
  }

  return (data || []) as Interest[];
}

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

  if (quotation.is_active === false) {
    return { success: false, error: 'This quotation is no longer active.' };
  }
  if (!quotation.is_complete) {
    return { success: false, error: 'Incomplete quotations cannot be selected.' };
  }
  if (isQuoteExpired(quotation.validity_date)) {
    return { success: false, error: 'This quotation has expired.' };
  }

  const { data: existing, error: existErr } = await supabase
    .from('interests')
    .select('id')
    .eq('quotation_id', quotation.id)
    .eq('user_id', buyerId)
    .maybeSingle();

  if (existErr) {
    return { success: false, error: existErr.message };
  }
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
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Unable to record showroom interest.' };
  }

  return { success: true, interestId: data.id };
}

export async function executeBooking(
  quotation: Quotation,
  group: Group,
  buyerId: string,
  buyerName: string,
  buyerPhone: string,
  paymentMethod: PaymentMethod = 'UPI',
  existingPaymentId?: string
): Promise<{ success: boolean; booking?: Booking; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured.');
  }

  if (quotation.is_active === false) {
    return { success: false, error: 'This quotation was deactivated and cannot be booked.' };
  }
  if (!quotation.is_complete) {
    return { success: false, error: 'Incomplete quotations missing insurance/RTO cannot be booked.' };
  }
  if (isQuoteExpired(quotation.validity_date)) {
    return { success: false, error: 'This quotation has expired and cannot be booked.' };
  }
  if (!['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED'].includes(group.status)) {
    return { success: false, error: `Group is ${group.status.toLowerCase()} and cannot accept new bookings.` };
  }

  const { data: memberRow } = await supabase
    .from('group_members')
    .select('status')
    .eq('group_id', group.id)
    .eq('user_id', buyerId)
    .maybeSingle();

  if (!memberRow || memberRow.status !== 'ACTIVE') {
    return {
      success: false,
      error:
        memberRow?.status === 'BOOKED'
          ? 'You have already completed a booking for this group.'
          : 'You must be an active member of this group before booking.',
    };
  }

  const { data: existingActive } = await supabase
    .from('bookings')
    .select('id')
    .eq('buyer_id', buyerId)
    .or(`quotation_id.eq.${quotation.id},group_id.eq.${group.id}`)
    .in('status', ['PENDING', 'PAID', 'DELIVERED'])
    .maybeSingle();

  if (existingActive) {
    return {
      success: false,
      error: 'You already hold an active booking for this group or quotation.',
    };
  }

  const settings = await fetchPlatformSettings();
  const bookingAmount = settings.bookingAmount;
  const platformFee = settings.platformFee;
  const totalAmount = bookingAmount + platformFee;

  if (totalAmount >= 10000) {
    return { success: false, error: 'Booking amount + platform fee exceeds the ₹10,000 limit.' };
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

  const paymentId =
    existingPaymentId ||
    (
      await createPayment({
        bookingId: bookingCode,
        amount: totalAmount,
        method: paymentMethod,
      })
    ).paymentId;

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

  const { error: payErr } = await supabase.from('payments').insert({
    booking_id: bookingRow.id,
    payment_id: paymentId,
    amount: totalAmount,
    status: 'SUCCESS',
    method: paymentMethod,
  });

  if (payErr) {
    return { success: false, error: `Booking saved but payment ledger failed: ${payErr.message}` };
  }

  return {
    success: true,
    booking: {
      ...bookingRow,
      dealership: quotation.dealership,
      quotation,
      group,
    },
  };
}

export function calculateBuyerRefund(
  bookingAmount: number,
  platformFee: number = 999,
  retentionPercent: number = 5
) {
  const retainedAmount = Math.round((bookingAmount * retentionPercent) / 100);
  const refundAmount = bookingAmount - retainedAmount;
  const platformFeeNonRefunded = platformFee;
  const buyerLostAmount = retainedAmount + platformFeeNonRefunded;
  return {
    refundAmount,
    retainedAmount,
    platformFeeNonRefunded,
    buyerLostAmount,
  };
}

export function calculateDealerFaultRefund(
  bookingAmount: number,
  platformFee: number = 999,
  refundPlatformFee: boolean = true
) {
  const bookingAmountRefunded = bookingAmount;
  const platformFeeRefunded = refundPlatformFee ? platformFee : 0;
  const totalRefunded = bookingAmountRefunded + platformFeeRefunded;
  const showroomRetained = 0;
  return {
    totalRefunded,
    bookingAmountRefunded,
    platformFeeRefunded,
    showroomRetained,
  };
}

export async function cancelBookingByBuyer(
  bookingId: string,
  notes?: string
): Promise<{
  success: boolean;
  refundAmount: number;
  retainedAmount: number;
  platformFeeNonRefunded: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_booking_atomic', {
    p_booking_id: bookingId,
    p_reason_type: 'BUYER_CANCEL',
    p_notes: notes || null,
  });

  if (!rpcErr && rpcRes) {
    const payload = rpcRes as any;
    const retained = Number(payload.dealer_retained_amount || 0);
    const refunded = Number(payload.booking_amount_refunded || 0);
    await refundPayment('rfnd_' + bookingId, bookingId, refunded, 'BUYER_CANCEL');
    return {
      success: Boolean(payload.success),
      refundAmount: refunded,
      retainedAmount: retained,
      platformFeeNonRefunded: Number(payload.platform_fee_refunded === 0 ? 0 : 0),
    };
  }

  if (rpcErr && !rpcErr.message.includes('cancel_booking_atomic')) {
    return {
      success: false,
      refundAmount: 0,
      retainedAmount: 0,
      platformFeeNonRefunded: 0,
      error: rpcErr.message,
    };
  }

  const [settings, { data: b, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase.from('bookings').select('*').eq('id', bookingId).single(),
  ]);

  if (error || !b) {
    return { success: false, refundAmount: 0, retainedAmount: 0, platformFeeNonRefunded: 0, error: 'Booking not found' };
  }
  if (b.status !== 'PAID') {
    return {
      success: false,
      refundAmount: 0,
      retainedAmount: 0,
      platformFeeNonRefunded: 0,
      error: `Only PAID bookings can be cancelled (current: ${b.status}).`,
    };
  }

  const { refundAmount, retainedAmount, platformFeeNonRefunded } = calculateBuyerRefund(
    b.booking_amount,
    b.platform_fee,
    settings.buyerCancelRetentionPercent
  );

  const { error: updErr } = await supabase
    .from('bookings')
    .update({ status: 'CANCELLED_BY_BUYER', cancellation_reason: notes || 'Cancelled by buyer', updated_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (updErr) {
    return { success: false, refundAmount: 0, retainedAmount: 0, platformFeeNonRefunded: 0, error: updErr.message };
  }

  const { error: refErr } = await supabase.from('refunds').insert({
    booking_id: bookingId,
    reason: 'BUYER_CANCEL',
    booking_amount_refunded: refundAmount,
    dealer_retained_amount: retainedAmount,
    platform_fee_refunded: 0,
    total_refunded: refundAmount,
    status: 'PROCESSED',
  });
  if (refErr) {
    return { success: false, refundAmount: 0, retainedAmount: 0, platformFeeNonRefunded: 0, error: refErr.message };
  }

  const { data: payRow } = await supabase.from('payments').select('payment_id').eq('booking_id', b.id).maybeSingle();
  await refundPayment(payRow?.payment_id || 'pay_' + b.id, b.id, refundAmount, 'BUYER_CANCEL');

  return {
    success: true,
    refundAmount,
    retainedAmount,
    platformFeeNonRefunded,
  };
}

export async function cancelBookingByDealerFault(
  bookingId: string,
  reason?: string
): Promise<{
  success: boolean;
  totalRefunded: number;
  bookingAmountRefunded: number;
  platformFeeRefunded: number;
  error?: string;
}> {
  if (!isSupabaseConfigured()) throw new Error('Supabase is not configured');

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_booking_atomic', {
    p_booking_id: bookingId,
    p_reason_type: 'DEALER_FAULT',
    p_notes: reason || null,
  });

  if (!rpcErr && rpcRes) {
    const payload = rpcRes as any;
    const total = Number(payload.total_refunded || 0);
    await refundPayment('rfnd_' + bookingId, bookingId, total, 'DEALER_FAULT');
    return {
      success: Boolean(payload.success),
      totalRefunded: total,
      bookingAmountRefunded: Number(payload.booking_amount_refunded || 0),
      platformFeeRefunded: Number(payload.platform_fee_refunded || 0),
    };
  }

  if (rpcErr && !rpcErr.message.includes('cancel_booking_atomic')) {
    return {
      success: false,
      totalRefunded: 0,
      bookingAmountRefunded: 0,
      platformFeeRefunded: 0,
      error: rpcErr.message,
    };
  }

  const [settings, { data: b, error }] = await Promise.all([
    fetchPlatformSettings(),
    supabase.from('bookings').select('*').eq('id', bookingId).single(),
  ]);

  if (error || !b) {
    return { success: false, totalRefunded: 0, bookingAmountRefunded: 0, platformFeeRefunded: 0, error: 'Booking not found' };
  }
  if (b.status !== 'PAID') {
    return {
      success: false,
      totalRefunded: 0,
      bookingAmountRefunded: 0,
      platformFeeRefunded: 0,
      error: `Only PAID bookings can be cancelled (current: ${b.status}).`,
    };
  }

  const { totalRefunded, bookingAmountRefunded, platformFeeRefunded } = calculateDealerFaultRefund(
    b.booking_amount,
    b.platform_fee,
    settings.feeRefundOnDealerFault
  );

  const { error: updErr } = await supabase
    .from('bookings')
    .update({ status: 'CANCELLED_BY_DEALER', cancellation_reason: reason || 'Cancelled by dealership', updated_at: new Date().toISOString() })
    .eq('id', bookingId);
  if (updErr) {
    return { success: false, totalRefunded: 0, bookingAmountRefunded: 0, platformFeeRefunded: 0, error: updErr.message };
  }

  const { error: refErr } = await supabase.from('refunds').insert({
    booking_id: bookingId,
    reason: 'DEALER_FAULT',
    booking_amount_refunded: bookingAmountRefunded,
    dealer_retained_amount: 0,
    platform_fee_refunded: platformFeeRefunded,
    total_refunded: totalRefunded,
    status: 'PROCESSED',
  });
  if (refErr) {
    return { success: false, totalRefunded: 0, bookingAmountRefunded: 0, platformFeeRefunded: 0, error: refErr.message };
  }

  const { data: payRow } = await supabase.from('payments').select('payment_id').eq('booking_id', b.id).maybeSingle();
  await refundPayment(payRow?.payment_id || 'pay_' + b.id, b.id, totalRefunded, 'DEALER_FAULT');

  return {
    success: true,
    totalRefunded,
    bookingAmountRefunded,
    platformFeeRefunded,
  };
}

export async function confirmDelivery(bookingId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };

  const { error: rpcErr } = await supabase.rpc('confirm_booking_delivery', {
    p_booking_id: bookingId,
  });

  if (!rpcErr) {
    return { success: true };
  }
  if (!rpcErr.message.includes('confirm_booking_delivery')) {
    return { success: false, error: rpcErr.message };
  }

  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'DELIVERED',
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookingId)
    .eq('status', 'PAID');

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

export async function submitDealerRating(
  bookingId: string,
  dealershipId: string,
  buyerId: string,
  rating: number,
  review: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };

  const { error } = await supabase.from('dealer_ratings').insert({
    booking_id: bookingId,
    dealership_id: dealershipId,
    buyer_id: buyerId,
    rating,
    review,
  });

  if (error) {
    return {
      success: false,
      error: error.code === '23505' ? 'You have already submitted a rating for this booking.' : error.message,
    };
  }
  return { success: true };
}

export async function submitDealerReport(
  dealershipId: string,
  buyerId: string,
  reason: string,
  details: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase is not configured.' };

  const { error } = await supabase.from('reports').insert({
    dealership_id: dealershipId,
    buyer_id: buyerId,
    reason,
    details,
  });

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
