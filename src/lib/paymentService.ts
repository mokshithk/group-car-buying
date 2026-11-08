/**
 * Simulated Payment Service Layer
 * Exactly three functions: createPayment, verifyPayment, refundPayment.
 * Returns realistic transaction fields.
 * Can be swapped with Razorpay/Cashfree gateway without touching the pages.
 */

export interface CreatePaymentParams {
  bookingId: string;
  amount: number;
  method?: 'UPI' | 'CARD' | 'NET_BANKING';
}

export interface PaymentResult {
  paymentId: string;
  bookingId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  amount: number;
  method: 'UPI' | 'CARD' | 'NET_BANKING';
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

/**
 * 1. createPayment: Initiates a transaction order
 */
export async function createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
  const paymentId = 'pay_' + Math.random().toString(36).substring(2, 12);
  const result: PaymentResult = {
    paymentId,
    bookingId: params.bookingId,
    status: 'PENDING',
    amount: params.amount,
    method: params.method || 'UPI',
    timestamp: new Date().toISOString(),
    currency: 'INR',
    gatewayReference: 'sim_' + Math.random().toString(36).substring(2, 10),
  };
  return result;
}

/**
 * 2. verifyPayment: Confirms outcome of payment (Success / Failed / Cancelled)
 */
export async function verifyPayment(
  paymentId: string,
  targetOutcome: 'SUCCESS' | 'FAILED' | 'CANCELLED' = 'SUCCESS'
): Promise<PaymentResult> {
  const result: PaymentResult = {
    paymentId,
    bookingId: '',
    status: targetOutcome,
    amount: 5100,
    method: 'UPI',
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
  return result;
}

/**
 * 3. refundPayment: Processes simulated refund for cancellation
 */
export async function refundPayment(
  paymentId: string,
  bookingId: string,
  amount: number,
  reason: 'BUYER_CANCEL' | 'DEALER_FAULT'
): Promise<RefundResult> {
  const refundId = 'rfnd_' + Math.random().toString(36).substring(2, 12);
  const result: RefundResult = {
    refundId,
    paymentId,
    bookingId,
    amount,
    status: 'PROCESSED',
    timestamp: new Date().toISOString(),
    currency: 'INR',
    reason,
  };
  return result;
}
