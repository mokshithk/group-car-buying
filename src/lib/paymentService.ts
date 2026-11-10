/**
 * Simulated Payment Service Layer
 * Tracks created payment intents in memory so verifyPayment preserves the
 * actual bookingId, amount, and chosen payment method instead of hardcoding defaults.
 */

export type PaymentMethod = 'UPI' | 'CARD' | 'NET_BANKING';

export interface CreatePaymentParams {
  bookingId: string;
  amount: number;
  method?: PaymentMethod;
}

export interface PaymentResult {
  paymentId: string;
  bookingId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  method: PaymentMethod;
  timestamp: string;
  currency: string;
  gatewayReference?: string;
  error?: string;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  bookingId: string;
  amount: number;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  timestamp: string;
  currency: string;
  reason: 'BUYER_CANCEL' | 'DEALER_FAULT';
}

const intentStore = new Map<string, { bookingId: string; amount: number; method: PaymentMethod }>();

export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const paymentId = 'pay_' + Math.random().toString(36).substring(2, 12);
  const method: PaymentMethod = params.method || 'UPI';

  intentStore.set(paymentId, {
    bookingId: params.bookingId,
    amount: params.amount,
    method,
  });

  return {
    paymentId,
    bookingId: params.bookingId,
    status: 'PENDING',
    amount: params.amount,
    method,
    timestamp: new Date().toISOString(),
    currency: 'INR',
    gatewayReference: 'sim_' + Math.random().toString(36).substring(2, 10),
  };
}

export async function verifyPayment(
  paymentId: string,
  targetOutcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' = 'SUCCESS'
): Promise<PaymentResult> {
  const stored = intentStore.get(paymentId);
  return {
    paymentId,
    bookingId: stored?.bookingId || '',
    status: targetOutcome,
    amount: stored?.amount ?? 0,
    method: stored?.method || 'UPI',
    timestamp: new Date().toISOString(),
    currency: 'INR',
    gatewayReference: 'sim_ref_' + Math.random().toString(36).substring(2, 10),
    error:
      targetOutcome === 'FAILED'
        ? 'Payment simulation declined by issuing bank (Insufficient funds / timeout).'
        : targetOutcome === 'CANCELLED'
        ? 'Payment authorization cancelled by user.'
        : undefined,
  };
}

export async function refundPayment(
  paymentId: string,
  bookingId: string,
  amount: number,
  reason: 'BUYER_CANCEL' | 'DEALER_FAULT'
): Promise<RefundResult> {
  return {
    refundId: 'rfnd_' + Math.random().toString(36).substring(2, 12),
    paymentId,
    bookingId,
    amount,
    status: 'PROCESSED',
    timestamp: new Date().toISOString(),
    currency: 'INR',
    reason,
  };
}
