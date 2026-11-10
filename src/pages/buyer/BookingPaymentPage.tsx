import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Tabs } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { fetchQuotationById, isQuoteExpired } from '@/lib/quoteService';
import { fetchGroupById } from '@/lib/groupService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { executeBooking } from '@/lib/bookingService';
import { createPayment, verifyPayment } from '@/lib/paymentService';
import { formatINR } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  CreditCard,
  Building,
  Smartphone,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export function BookingPaymentPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [bookingAmount, setBookingAmount] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.bookingAmount
  );
  const [platformFee, setPlatformFee] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.platformFee
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Payment UI state
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'NET_BANKING'>('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const totalPayable = bookingAmount + platformFee;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!quoteId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const [target, settings] = await Promise.all([
          fetchQuotationById(quoteId),
          fetchPlatformSettings(),
        ]);
        if (cancelled) return;

        setBookingAmount(settings.bookingAmount);
        setPlatformFee(settings.platformFee);

        if (!target) {
          setLoadError('Quotation not found.');
          return;
        }

        const resolvedGroup = target.group || (await fetchGroupById(target.group_id));
        if (cancelled) return;

        if (!resolvedGroup) {
          setLoadError('Associated buying group not found.');
          return;
        }

        setGroup(resolvedGroup);
        setQuote(target);

        if (target.is_active === false) {
          setErrorMessage('This quotation is inactive and cannot be booked.');
        } else if (!target.is_complete) {
          setErrorMessage('Incomplete quotations missing insurance/RTO cannot be booked.');
        } else if (isQuoteExpired(target.validity_date)) {
          setErrorMessage('This quotation has expired and can no longer be locked.');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load booking checkout.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  const isQuoteBookable =
    !!quote &&
    !!group &&
    quote.is_active !== false &&
    quote.is_complete &&
    !isQuoteExpired(quote.validity_date);

  const handleSimulatePayment = async (outcome: 'SUCCESS' | 'FAILED' | 'CANCELLED') => {
    if (!quote || !group || !user || !profile || isProcessing || !isQuoteBookable) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      // 1. Call payment service createPayment
      const order = await createPayment({
        bookingId: `intent-${quote.id}-${Date.now()}`,
        amount: totalPayable,
        method: paymentMethod,
      });

      // 2. Call payment service verifyPayment with simulated outcome
      const verification = await verifyPayment(order.paymentId, outcome);

      if (verification.status === 'SUCCESS') {
        // Execute booking and auto-remove buyer from group
        const res = await executeBooking(
          quote,
          group,
          user.id,
          profile.full_name,
          profile.phone || '',
          paymentMethod,
          order.paymentId
        );

        if (res.success && res.booking) {
          toast({
            type: 'success',
            title: 'Price Locked & Booking Confirmed!',
            message: `Booking code: ${res.booking.booking_code}. You have been removed from the bidding group.`,
          });
          navigate(`/buyer/booking-confirmation/${res.booking.id}`, { replace: true });
        } else {
          setErrorMessage(res.error || 'Booking execution failed');
        }
      } else if (verification.status === 'CANCELLED') {
        setErrorMessage(
          'Payment simulation was cancelled. No money was charged and you remain an active member of your group.'
        );
        toast({
          type: 'warning',
          title: 'Payment Cancelled',
          message: 'No charges made. You remain in the buying group.',
        });
      } else {
        // FAILED
        setErrorMessage(
          'Simulated payment failed (Declined by bank). No booking was created and you remain in the group.'
        );
        toast({
          type: 'error',
          title: 'Payment Failed',
          message: 'Simulated failure triggered. You remain in the group.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment error';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center text-slate-400">Loading checkout...</div>
      </BuyerLayout>
    );
  }

  if (loadError || !quote || !group) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            {loadError || 'Quotation not found'}
          </h2>
          <Link to="/buyer/groups">
            <Button variant="secondary" size="sm">Back to My Groups</Button>
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <Link
            to={`/buyer/groups/${group.id}/offers`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotes
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Lock Quotation & Reserve Car
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Deposit is held securely until delivery. Price is legally locked.
          </p>
        </div>

        {/* PROMINENT MANDATORY TEST MODE BANNER (Section 2) */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-dashed border-amber-400 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs text-amber-950">
            <div className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
              SIMULATED PAYMENT GATEWAY (TEST MODE ACTIVE)
            </div>
            <p className="mt-0.5 leading-relaxed font-medium">
              <strong>Test mode: no real money is charged.</strong> Use the tester outcome triggers below to verify successful price locking, payment declines, or user cancellations without real banking credentials.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-medium flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}

        {/* ITEMIZATION BREAKDOWN (Section 2: Showroom account vs Platform fee) */}
        <Card className="p-6">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base text-slate-900">
              Payment & Fund Allocation Breakdown
            </CardTitle>
            <CardDescription>
              Vehicle: <strong>{group.variant?.model?.name} {group.variant?.name}</strong> at <strong>{quote.dealership?.name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4 text-xs">
            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-semibold text-slate-800">Dealership Booking Deposit</span>
                <div className="text-[11px] text-slate-500">Transferred directly to showroom's merchant escrow</div>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatINR(bookingAmount)}</span>
            </div>

            <div className="flex justify-between items-center py-1 border-t border-slate-100">
              <div>
                <span className="font-semibold text-slate-800">Platform Facilitation Fee</span>
                <div className="text-[11px] text-slate-500">AutoGroup group formation & price lock service</div>
              </div>
              <span className="font-bold text-slate-900 text-sm">{formatINR(platformFee)}</span>
            </div>

            <div className="pt-3 border-t-2 border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
              <div>
                <span>Total Payable Now:</span>
                {totalPayable <= 10000 && (
                  <div className="text-[10px] text-emerald-700 font-semibold uppercase">
                    (Below Platform ₹10,000 Cap)
                  </div>
                )}
              </div>
              <span className="text-lg text-brand-700">{formatINR(totalPayable)}</span>
            </div>

            {/* Locked Price Summary */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Locked Net On-Road Price:</span>
                <strong className="text-slate-900">{formatINR(quote.on_road_price)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Corporate Group Discount:</span>
                <strong className="text-emerald-700">-{formatINR(quote.discounts)}</strong>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Balance Payable at Showroom Delivery:</span>
                <strong>{formatINR(Math.max(0, quote.on_road_price - bookingAmount))}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PAYMENT OPTIONS TABS (Simulated UPI / Card / Net Banking) */}
        <Card className="p-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-slate-900">Select Simulated Payment Method</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs
              tabs={[
                { id: 'UPI', label: 'UPI / QR', icon: <Smartphone className="w-4 h-4" /> },
                { id: 'CARD', label: 'Credit / Debit Card', icon: <CreditCard className="w-4 h-4" /> },
                { id: 'NET_BANKING', label: 'Net Banking', icon: <Building className="w-4 h-4" /> },
              ]}
              activeTab={paymentMethod}
              onChange={(tabId) => setPaymentMethod(tabId as 'UPI' | 'CARD' | 'NET_BANKING')}
            />

            {paymentMethod === 'UPI' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2 text-xs">
                <div className="font-semibold text-slate-800">Simulated Instant UPI Intent</div>
                <div className="text-[11px] text-slate-500">Supports GPay, PhonePe, Paytm, BHIM</div>
                <div className="w-32 h-32 rounded-lg bg-white border border-slate-300 mx-auto flex items-center justify-center font-mono text-[11px] text-slate-400">
                  [Simulated QR]
                </div>
              </div>
            )}

            {paymentMethod === 'CARD' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-500">
                <div className="font-semibold text-slate-800">Simulated Card Gateway</div>
                <p>Card entry fields simulated. No real card number required.</p>
              </div>
            )}

            {paymentMethod === 'NET_BANKING' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs text-slate-500">
                <div className="font-semibold text-slate-800">Simulated Net Banking</div>
                <p>HDFC, SBI, ICICI, Axis simulated redirection.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TESTER OUTCOME CONTROLS (Success / Failed / Cancelled) */}
        <Card className="p-6 border-brand-200 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">
              Tester Simulation Controls (Section 2)
            </CardTitle>
            <CardDescription className="text-xs">
              Select an outcome below to test the business rules for payment success, failure, or cancellation:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Outcome 1: Success */}
              <Button
                type="button"
                variant="success"
                size="md"
                onClick={() => handleSimulatePayment('SUCCESS')}
                isLoading={isProcessing}
                disabled={!isQuoteBookable}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                className="w-full text-xs font-bold"
              >
                Simulate Success
              </Button>

              {/* Outcome 2: Failed */}
              <Button
                type="button"
                variant="danger"
                size="md"
                onClick={() => handleSimulatePayment('FAILED')}
                isLoading={isProcessing}
                disabled={!isQuoteBookable}
                leftIcon={<XCircle className="w-4 h-4" />}
                className="w-full text-xs font-bold"
              >
                Simulate Failure
              </Button>

              {/* Outcome 3: Cancelled */}
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => handleSimulatePayment('CANCELLED')}
                isLoading={isProcessing}
                disabled={!isQuoteBookable}
                className="w-full text-xs font-bold text-slate-700"
              >
                Simulate Cancel
              </Button>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 leading-relaxed space-y-1">
              <div>
                • <strong>Success:</strong> Locks price snapshot, creates booking code, and automatically removes buyer from the group.
              </div>
              <div>
                • <strong>Failure / Cancel:</strong> Creates no booking and keeps buyer as active member of the group.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </BuyerLayout>
  );
}
