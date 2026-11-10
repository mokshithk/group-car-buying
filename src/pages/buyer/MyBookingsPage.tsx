import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card, Modal, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  fetchBuyerBookings,
  cancelBookingByBuyer,
  confirmDelivery,
  submitDealerRating,
  submitDealerReport,
  calculateBuyerRefund,
} from '@/lib/bookingService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Booking } from '@/types';
import {
  ShoppingBag,
  Building2,
  CheckCircle2,
  Star,
  Flag,
  ArrowRight,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export function MyBookingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [ratedBookingIds, setRatedBookingIds] = useState<Set<string>>(new Set());
  const [retentionPercent, setRetentionPercent] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.buyerCancelRetentionPercent
  );
  const [refundFeeOnDealerFault, setRefundFeeOnDealerFault] = useState<boolean>(
    DEFAULT_PLATFORM_SETTINGS.feeRefundOnDealerFault
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [cancelBookingTarget, setCancelBookingTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const [ratingBookingTarget, setRatingBookingTarget] = useState<Booking | null>(null);
  const [starRating, setStarRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const [reportBookingTarget, setReportBookingTarget] = useState<Booking | null>(null);
  const [reportReason, setReportReason] = useState('did_not_honor_price');
  const [reportDetails, setReportDetails] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const [all, settings, ratingsRes] = await Promise.all([
        fetchBuyerBookings(user.id),
        fetchPlatformSettings(),
        supabase.from('dealer_ratings').select('booking_id').eq('buyer_id', user.id),
      ]);
      setBookings(all);
      setRetentionPercent(settings.buyerCancelRetentionPercent);
      setRefundFeeOnDealerFault(settings.feeRefundOnDealerFault);
      if (!ratingsRes.error && ratingsRes.data) {
        setRatedBookingIds(
          new Set(ratingsRes.data.map((r: { booking_id: string }) => r.booking_id))
        );
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load your bookings.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleConfirmDelivery = async (bookingId: string) => {
    const res = await confirmDelivery(bookingId);
    if (res.success) {
      toast({
        type: 'success',
        title: 'Vehicle Delivery Confirmed!',
        message: 'Congratulations on receiving your car! Please rate your showroom experience.',
      });
      await loadBookings();
      const fresh = await fetchBuyerBookings(user?.id || '');
      const updated = fresh.find((b: Booking) => b.id === bookingId);
      if (updated && !ratedBookingIds.has(bookingId)) {
        setRatingBookingTarget(updated);
      }
    } else {
      toast({
        type: 'error',
        title: 'Could Not Confirm Delivery',
        message: res.error || 'Please try again.',
      });
    }
  };

  const handleCancelBooking = async () => {
    if (!cancelBookingTarget || isCancelling) return;
    setIsCancelling(true);

    try {
      const res = await cancelBookingByBuyer(cancelBookingTarget.id);
      if (!res.success) {
        toast({
          type: 'error',
          title: 'Cancellation failed',
          message: res.error || 'Unable to cancel this booking.',
        });
        return;
      }
      toast({
        type: 'info',
        title: 'Booking Cancelled',
        message: `Refund of ${formatINR(res.refundAmount)} processed. ${formatINR(res.retainedAmount)} (${retentionPercent}%) retained by dealership.`,
      });
      setCancelBookingTarget(null);
      await loadBookings();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Cancellation failed',
        message: err instanceof Error ? err.message : 'Unable to cancel this booking.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingBookingTarget || !user || isSubmittingRating) return;

    setIsSubmittingRating(true);
    try {
      const res = await submitDealerRating(
        ratingBookingTarget.id,
        ratingBookingTarget.dealership_id,
        user.id,
        starRating,
        reviewText
      );
      if (!res.success) {
        toast({
          type: 'error',
          title: 'Review Failed',
          message: res.error || 'Could not submit your dealer rating.',
        });
        return;
      }

      toast({
        type: 'success',
        title: 'Review Submitted',
        message: 'Thank you for sharing your dealer experience with the AutoGroup community.',
      });
      setRatedBookingIds((prev) => new Set(prev).add(ratingBookingTarget.id));
      setRatingBookingTarget(null);
      setReviewText('');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportBookingTarget || !user || isSubmittingReport) return;

    setIsSubmittingReport(true);
    try {
      const res = await submitDealerReport(
        reportBookingTarget.dealership_id,
        user.id,
        reportReason,
        `Booking ${reportBookingTarget.booking_code}: ${reportDetails.trim()}`
      );
      if (!res.success) {
        toast({
          type: 'error',
          title: 'Report Submission Failed',
          message: res.error || 'Could not submit report.',
        });
        return;
      }

      toast({
        type: 'warning',
        title: 'Report Logged',
        message: 'Our compliance team will review this dealer pricing report.',
      });
      setReportBookingTarget(null);
      setReportDetails('');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const cancelPreview = cancelBookingTarget
    ? calculateBuyerRefund(
        cancelBookingTarget.booking_amount,
        cancelBookingTarget.platform_fee,
        retentionPercent
      )
    : null;

  return (
    <BuyerLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              My Locked Bookings
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track active reservations, locked price vouchers, delivery confirmation, and cancellation terms.
          </p>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <Card className="text-center py-16 p-8">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No vehicle bookings yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-6">
              When a buying group receives competitive quotations, tap "Book Now" to lock your on-road price.
            </p>
            <Link to="/buyer/groups/find">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Find Active Buying Groups
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {bookings.map((booking) => {
              const snap = booking.price_snapshot;
              const isPaid = booking.status === 'PAID';
              const isDelivered = booking.status === 'DELIVERED';

              return (
                <Card key={booking.id} className="p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500 uppercase">
                            Booking Code:
                          </span>
                          <span className="font-mono text-sm font-black text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                            {booking.booking_code}
                          </span>
                          {booking.status === 'PENDING' && (
                            <Badge variant="warning" size="sm">Payment Pending</Badge>
                          )}
                          {isPaid && <Badge variant="success" size="sm">Price Locked</Badge>}
                          {isDelivered && <Badge variant="milestone" size="sm">Delivered</Badge>}
                          {booking.status === 'CANCELLED_BY_BUYER' && (
                            <Badge variant="danger" size="sm">
                              Cancelled by Buyer ({Math.max(0, 100 - retentionPercent)}% Refunded)
                            </Badge>
                          )}
                          {booking.status === 'CANCELLED_BY_DEALER' && (
                            <Badge variant="danger" size="sm">Cancelled by Dealer (100% Refunded)</Badge>
                          )}
                          {booking.status === 'REFUNDED' && (
                            <Badge variant="default" size="sm">Refunded</Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Booked on {formatDateTime(booking.created_at)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-500">Locked Net On-Road Price</div>
                        <div className="text-xl font-black text-slate-900">
                          {formatINR(snap.on_road_price)}
                        </div>
                      </div>
                    </div>

                    {/* Snapshot Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {snap.manufacturer_name} {snap.model_name} — {snap.variant_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>Showroom: <strong>{snap.dealer_name}</strong></span>
                        </div>
                        <div className="text-slate-500">
                          Corporate Group Discount: <strong className="text-emerald-700">-{formatINR(snap.discounts)}</strong>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Booking Amount Paid:</span>
                          <span className="font-bold text-slate-900">{formatINR(booking.booking_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Platform Service Fee:</span>
                          <span className="font-semibold text-slate-700">{formatINR(booking.platform_fee)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                          <span>Balance Due at Delivery:</span>
                          <span className="text-slate-900">{formatINR(snap.on_road_price - booking.booking_amount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isPaid && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => handleConfirmDelivery(booking.id)}
                            leftIcon={<CheckCircle2 className="w-4 h-4" />}
                          >
                            I Received My Car
                          </Button>
                        )}
                        {isDelivered && !ratedBookingIds.has(booking.id) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setRatingBookingTarget(booking)}
                            leftIcon={<Star className="w-4 h-4 text-amber-500" />}
                          >
                            Rate Dealer
                          </Button>
                        )}
                        {isDelivered && ratedBookingIds.has(booking.id) && (
                          <Badge variant="success" size="sm">Review Submitted</Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setReportBookingTarget(booking)}
                          className="text-slate-500 hover:text-rose-600"
                          leftIcon={<Flag className="w-3.5 h-3.5" />}
                        >
                          Report Dealer
                        </Button>
                      </div>

                      {/* Cancel / Switch Button (Only if still in PAID status before delivery) */}
                      {isPaid && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCancelBookingTarget(booking)}
                          className="text-rose-600 border-rose-300 hover:bg-rose-50"
                          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                        >
                          Cancel Booking & Refund Preview
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* CANCEL & REFUND PREVIEW MODAL (Section 2: Real cost of cancelling & switch comparison) */}
        <Modal
          isOpen={!!cancelBookingTarget}
          onClose={() => setCancelBookingTarget(null)}
          title="Cancel Booking & Refund Preview"
          description="Review exact refund calculations before cancelling."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setCancelBookingTarget(null)}
                disabled={isCancelling}
              >
                Keep Booking
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleCancelBooking}
                isLoading={isCancelling}
              >
                Confirm Cancellation
              </Button>
            </div>
          }
        >
          {cancelBookingTarget && cancelPreview && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 text-sm">
                  Cancellation Refund Math (Buyer Cancellation Rule)
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Booking Amount Paid:</span>
                  <span className="font-semibold text-slate-900">
                    {formatINR(cancelBookingTarget.booking_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-rose-600 font-semibold">
                  <span>Showroom Retention ({retentionPercent}% Policy):</span>
                  <span>-{formatINR(cancelPreview.retainedAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Platform Fee (Non-refundable on buyer cancel):</span>
                  <span>{formatINR(cancelBookingTarget.platform_fee)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-emerald-700 text-sm">
                  <span>Net Amount Refunded to Your Account:</span>
                  <span>{formatINR(cancelPreview.refundAmount)}</span>
                </div>
              </div>

              {/* Cancel and Switch Comparison (Section 2) */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2 text-blue-950">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Thinking of switching dealers?</span>
                </div>
                <p className="leading-relaxed">
                  Total cost of cancelling this booking is <strong>{formatINR(cancelPreview.buyerLostAmount)}</strong> ({formatINR(cancelPreview.retainedAmount)} showroom retention + {formatINR(cancelBookingTarget.platform_fee)} platform fee). To make switching worthwhile, ensure your alternative dealer quote is at least {formatINR(cancelPreview.buyerLostAmount)} lower than <strong>{formatINR(cancelBookingTarget.price_snapshot.on_road_price)}</strong>.
                </p>
              </div>

              <div className="text-[11px] text-slate-500 leading-relaxed">
                If the dealership is at fault (e.g. refused to honor the locked price or failed delivery), report them below to receive 100% refund of booking amount{refundFeeOnDealerFault ? ' plus platform fee' : ''}.
              </div>
            </div>
          )}
        </Modal>

        {/* DEALER RATING MODAL (Unlocked upon delivery) */}
        <Modal
          isOpen={!!ratingBookingTarget}
          onClose={() => setRatingBookingTarget(null)}
          title="Rate Dealership Experience"
          description={ratingBookingTarget?.price_snapshot.dealer_name}
        >
          <form onSubmit={handleSubmitRating} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
                Overall Experience Rating
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    type="button"
                    key={star}
                    onClick={() => setStarRating(star)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= starRating
                          ? 'fill-amber-400 text-amber-500'
                          : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Written Review (Optional)"
              placeholder="How was the handover? Did they honor the locked price seamlessly?"
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isSubmittingRating}
            >
              Submit Dealer Review
            </Button>
          </form>
        </Modal>

        {/* REPORT DEALER MODAL (Section 3: "did not honor price", etc.) */}
        <Modal
          isOpen={!!reportBookingTarget}
          onClose={() => setReportBookingTarget(null)}
          title="Report Dealership Dispute"
          description={reportBookingTarget?.price_snapshot.dealer_name}
        >
          <form onSubmit={handleSubmitReport} className="space-y-4 pt-2 text-xs">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Violation Reason
              </label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900"
              >
                <option value="did_not_honor_price">Dealership did not honor locked on-road price</option>
                <option value="unauthorized_charges">Demanded extra mandatory charges or accessories</option>
                <option value="delivery_delay">Unreasonable delivery delay beyond quoted window</option>
                <option value="other">Other unethical showroom conduct</option>
              </select>
            </div>

            <Input
              label="Detailed Explanation"
              placeholder="Describe what occurred at the showroom..."
              required
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
            />

            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-800 text-[11px] leading-relaxed">
              If dealer fault is confirmed (changing locked price), AutoGroup enforces <strong>100% refund of booking deposit plus platform fee</strong>.
            </div>

            <Button
              type="submit"
              variant="danger"
              size="md"
              className="w-full"
              isLoading={isSubmittingReport}
            >
              File Official Dealer Report
            </Button>
          </form>
        </Modal>
      </div>
    </BuyerLayout>
  );
}
