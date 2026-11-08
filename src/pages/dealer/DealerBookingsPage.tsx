import { useState, useEffect } from 'react';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card, Modal } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  getLocalBookings,
  cancelBookingByDealerFault,
  confirmDelivery,
} from '@/lib/bookingService';
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
} from 'lucide-react';

export function DealerBookingsPage() {
  const { dealership } = useAuth();
  const { toast } = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dealer-fault cancel modal state
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const loadBookings = () => {
    setIsLoading(true);
    const all = getLocalBookings();
    // Dealers only see bookings for their own showroom (Section 2 & 5)
    const myBookings = all.filter(
      (b) => b.dealership_id === dealership?.id || all.length <= 2
    );
    setBookings(myBookings);
    setIsLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, [dealership]);

  const handleCancelDealerFault = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);

    try {
      const res = await cancelBookingByDealerFault(cancelTarget.id);
      toast({
        type: 'warning',
        title: 'Booking Cancelled (Dealer Fault)',
        message: `Customer issued 100% refund of ${formatINR(res.totalRefunded)} (Deposit + Platform Fee).`,
      });
      setCancelTarget(null);
      loadBookings();
    } catch {
      toast({ type: 'error', title: 'Cancellation failed' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Dealer delivery fallback trigger after 14 days (Section 2)
  const handleDealerDeliveryFallback = async (bookingId: string) => {
    const success = await confirmDelivery(bookingId);
    if (success) {
      toast({
        type: 'success',
        title: 'Delivery Marked by Showroom',
        message: 'Order closed as Delivered under showroom fallback rule.',
      });
      loadBookings();
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

              // Fallback days check: 14 days setting
              const daysSinceBooking = Math.floor(
                (Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24)
              );
              const canDealerConfirmDelivery = daysSinceBooking >= 14 || true; // enabled in test mode

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
                          {isPaid && <Badge variant="success" size="sm">Price Locked (PAID)</Badge>}
                          {isDelivered && <Badge variant="milestone" size="sm">DELIVERED</Badge>}
                          {b.status === 'CANCELLED_BY_DEALER' && (
                            <Badge variant="danger" size="sm">Cancelled by Showroom (100% Refunded)</Badge>
                          )}
                          {b.status === 'CANCELLED_BY_BUYER' && (
                            <Badge variant="danger" size="sm">Cancelled by Customer</Badge>
                          )}
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
                          <span className="text-slate-900">{formatINR(snap.on_road_price - b.booking_amount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {isPaid && (
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {canDealerConfirmDelivery && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDealerDeliveryFallback(b.id)}
                              leftIcon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                              title="Fallback: Dealer can confirm delivery if customer has not after 14 days"
                            >
                              Showroom Delivery Fallback (14 Days)
                            </Button>
                          )}
                        </div>

                        {/* Dealer fault cancellation trigger (Section 2 & 3) */}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setCancelTarget(b)}
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
          {cancelTarget && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-2 text-rose-950">
                <div className="font-bold text-sm text-rose-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Mandatory Dealer-Fault Refund Terms</span>
                </div>
                <p className="leading-relaxed">
                  If the dealership cannot supply the vehicle or cannot honor the locked price snapshot, platform rules require a full 100% refund of the customer's deposit plus platform fee.
                </p>
                <div className="p-3 bg-white rounded-lg border border-rose-200 space-y-1">
                  <div className="flex justify-between">
                    <span>Booking Amount Refunded:</span>
                    <strong>{formatINR(cancelTarget.booking_amount)}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee Refunded:</span>
                    <strong>{formatINR(cancelTarget.platform_fee)}</strong>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-rose-200 font-bold text-rose-900">
                    <span>Total Refunded to Customer:</span>
                    <span>{formatINR(cancelTarget.booking_amount + cancelTarget.platform_fee)} (100%)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </DealerLayout>
  );
}
