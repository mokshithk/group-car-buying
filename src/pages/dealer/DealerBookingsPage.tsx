import { useState, useEffect, useCallback } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, Modal, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  fetchDealerBookings,
  cancelBookingByDealerFault,
  confirmDelivery,
  calculateDealerFaultRefund,
} from '@/lib/bookingService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Booking } from '@/types';
import {
  ShoppingBag,
  Phone,
  User,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';

export function DealerBookingsPage() {
  const { dealership } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [deliveryFallbackDays, setDeliveryFallbackDays] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.dealerDeliveryFallbackDays
  );
  const [feeRefundOnFault, setFeeRefundOnFault] = useState<boolean>(
    DEFAULT_PLATFORM_SETTINGS.feeRefundOnDealerFault
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Dealer-fault cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    if (!dealership) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    try {
      const [myBookings, settings] = await Promise.all([
        fetchDealerBookings(dealership.id),
        fetchPlatformSettings(),
      ]);
      setBookings(myBookings);
      setDeliveryFallbackDays(settings.dealerDeliveryFallbackDays);
      setFeeRefundOnFault(settings.feeRefundOnDealerFault);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load customer bookings.');
    } finally {
      setIsLoading(false);
    }
  }, [dealership]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCancelDealerFault = async () => {
    if (!cancelTarget || isCancelling) return;
    if (!cancelReason.trim()) {
      toast({
        type: 'error',
        title: 'Reason Required',
        message: 'Provide a reason for the dealer-fault cancellation.',
      });
      return;
    }

    setIsCancelling(true);
    try {
      const res = await cancelBookingByDealerFault(cancelTarget.id, cancelReason.trim());
      if (!res.success) {
        toast({
          type: 'error',
          title: 'Cancellation Failed',
          message: res.error || 'Could not cancel booking.',
        });
        return;
      }

      toast({
        type: 'warning',
        title: 'Booking Cancelled (Dealer Fault)',
        message: `Customer issued refund of ${formatINR(res.totalRefunded)}.`,
      });
      setCancelTarget(null);
      setCancelReason('');
      await loadBookings();
    } catch (err) {
      toast({
        type: 'error',
        title: 'Cancellation failed',
        message: err instanceof Error ? err.message : 'Unable to process cancellation.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Dealer delivery fallback trigger after configured fallback days
  const handleDealerDeliveryFallback = async (bookingId: string) => {
    const res = await confirmDelivery(bookingId);
    if (res.success) {
      toast({
        type: 'success',
        title: 'Delivery Marked by Showroom',
        message: `Order closed as Delivered under the ${deliveryFallbackDays}-day showroom fallback policy.`,
      });
      await loadBookings();
    } else {
      toast({
        type: 'error',
        title: 'Delivery Confirmation Blocked',
        message: res.error || 'Unable to confirm delivery.',
      });
    }
  };

  return (
    <DealerLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-brand-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Customer Bookings Received ({bookings.length})
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Confirmed customer orders with legally locked price snapshots. Fulfill physical delivery at this locked price.
          </p>
        </div>

        {/* Security Notice */}
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex items-center gap-2.5 text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Price Honoring Obligation:</strong> Dealership is legally required to honor the locked price snapshot for every customer below until vehicle delivery.
          </span>
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
            <h3 className="text-base font-bold text-slate-800">No bookings received yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              When buyers choose your quotation and complete simulated checkout, their locked orders appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.map((b) => {
              const snap = b.price_snapshot;
              const isPaid = b.status === 'PAID';
              const isDelivered = b.status === 'DELIVERED';

              const daysSinceBooking = Math.floor(
                (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              const canDealerConfirmDelivery = daysSinceBooking >= deliveryFallbackDays;
              const daysRemaining = Math.max(0, deliveryFallbackDays - daysSinceBooking);

              return (
                <Card key={b.id} className="p-6">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400">
                            VOUCHER:
                          </span>
                          <span className="font-mono text-sm font-black text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded border border-brand-200">
                            {b.booking_code}
                          </span>
                          {b.status === 'PENDING' && <Badge variant="warning" size="sm">PENDING</Badge>}
                          {isPaid && <Badge variant="success" size="sm">Price Locked (PAID)</Badge>}
                          {isDelivered && <Badge variant="milestone" size="sm">DELIVERED</Badge>}
                          {b.status === 'CANCELLED_BY_DEALER' && (
                            <Badge variant="danger" size="sm">Cancelled by Showroom</Badge>
                          )}
                          {b.status === 'CANCELLED_BY_BUYER' && (
                            <Badge variant="danger" size="sm">Cancelled by Customer</Badge>
                          )}
                          {b.status === 'REFUNDED' && <Badge variant="default" size="sm">REFUNDED</Badge>}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Booked on {formatDateTime(b.created_at)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-slate-500">Locked Net On-Road</div>
                        <div className="text-lg font-black text-slate-900">
                          {formatINR(snap.on_road_price)}
                        </div>
                      </div>
                    </div>

                    {/* Customer & Car Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <div className="font-bold text-slate-900 text-sm">
                          {snap.manufacturer_name} {snap.model_name} — {snap.variant_name}
                        </div>
                        <div className="flex items-center gap-2 font-semibold text-slate-800">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Customer: {b.buyer_name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-emerald-700">
                          <Phone className="w-3.5 h-3.5" />
                          <a href={`tel:${b.buyer_phone}`} className="hover:underline">
                            {b.buyer_phone}
                          </a>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Deposit Received:</span>
                          <span className="font-bold text-emerald-700">{formatINR(b.booking_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Corporate Group Discount:</span>
                          <span className="font-semibold text-emerald-700">-{formatINR(snap.discounts)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                          <span>Balance to Collect at Delivery:</span>
                          <span className="text-slate-900">
                            {formatINR(Math.max(0, snap.on_road_price - b.booking_amount))}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isPaid && (
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={!canDealerConfirmDelivery}
                            onClick={() => handleDealerDeliveryFallback(b.id)}
                            leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            title={
                              canDealerConfirmDelivery
                                ? `Showroom fallback available after ${deliveryFallbackDays} days`
                                : `Available in ${daysRemaining} day(s) under the ${deliveryFallbackDays}-day policy`
                            }
                          >
                            {canDealerConfirmDelivery
                              ? `Showroom Delivery Fallback (${deliveryFallbackDays} Days)`
                              : `Delivery Fallback (${daysRemaining}d left)`}
                          </Button>
                        </div>

                        {/* Dealer fault cancellation trigger */}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setCancelReason('');
                            setCancelTarget(b);
                          }}
                          leftIcon={<RotateCcw className="w-4 h-4" />}
                        >
                          Cancel Booking (Dealer Fault)
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* DEALER FAULT CANCELLATION MODAL (Section 2: 100% booking amount + platform fee refund) */}
        <Modal
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          title="Cancel Booking (Dealer Fault Notice)"
          description="Enforces 100% consumer protection refund policy."
          footer={
            <div className="flex items-center justify-end gap-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={() => setCancelTarget(null)}
                disabled={isCancelling}
              >
                Abort
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleCancelDealerFault}
                isLoading={isCancelling}
              >
                Confirm 100% Refund Cancellation
              </Button>
            </div>
          }
        >
          {cancelTarget && (() => {
            const refundCalc = calculateDealerFaultRefund(
              cancelTarget.booking_amount,
              cancelTarget.platform_fee,
              feeRefundOnFault
            );
            return (
              <div className="space-y-4 pt-2 text-xs">
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-rose-950">
                  <div className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Mandatory Dealer-Fault Refund Terms</span>
                  </div>
                  <p className="leading-relaxed">
                    If the dealership cannot supply the vehicle or cannot honor the locked price snapshot, platform policy enforces a 100% booking deposit refund{feeRefundOnFault ? ' plus platform fee refund' : ''}.
                  </p>
                  <div className="p-3 bg-white rounded-lg border border-rose-200 space-y-1">
                    <div className="flex justify-between">
                      <span>Booking Amount Refunded:</span>
                      <strong>{formatINR(refundCalc.bookingAmountRefunded)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Fee Refunded:</span>
                      <strong>{formatINR(refundCalc.platformFeeRefunded)}</strong>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-rose-200 font-bold text-rose-900">
                      <span>Total Refunded to Customer:</span>
                      <span>{formatINR(refundCalc.totalRefunded)}</span>
                    </div>
                  </div>
                </div>

                <Input
                  label="Cancellation Reason (Required)"
                  placeholder="e.g. Allocation unavailable for this color/variant within delivery window"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            );
          })()}
        </Modal>
      </div>
    </DealerLayout>
  );
}
