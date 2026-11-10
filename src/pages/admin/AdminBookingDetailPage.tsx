import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { formatINR } from '@/lib/formatters';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge } from '@/components/ui';
import { ArrowLeft, AlertTriangle, CheckCircle2, Ban, Loader2 } from 'lucide-react';

interface BookingDetailData {
  id: string;
  booking_code: string;
  group_id: string | null;
  quotation_id: string | null;
  buyer_id: string;
  dealership_id: string;
  booking_amount: number;
  platform_fee: number;
  total_amount: number;
  status: string;
  price_snapshot: Record<string, unknown>;
  buyer_name: string;
  buyer_phone: string;
  dealer_suspended?: boolean;
  cancellation_reason?: string | null;
  delivered_at?: string | null;
  created_at: string;
  dealership?: { id: string; name: string; status: string; contact_email?: string; contact_phone?: string } | null;
  buyer?: { id: string; full_name: string; email?: string | null; phone?: string | null } | null;
  group?: {
    id: string;
    district?: { name: string } | null;
    variant?: { name: string; model?: { name: string; manufacturer?: { name: string } | null } | null } | null;
  } | null;
}

interface PaymentRecord {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
  method: string;
  created_at: string;
}

interface RefundRecord {
  id: string;
  reason: string;
  booking_amount_refunded: number;
  dealer_retained_amount: number;
  platform_fee_refunded: number;
  total_refunded: number;
  status: string;
  created_at: string;
}

export function AdminBookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [booking, setBooking] = useState<BookingDetailData | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [feeRefundOnFault, setFeeRefundOnFault] = useState(true);
  const [fallbackDays, setFallbackDays] = useState(14);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionModal, setActionModal] = useState<'FORCE_CANCEL' | 'FALLBACK_DELIVER' | null>(null);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const [bRes, pRes, rRes, sRes] = await Promise.all([
        supabase
          .from('bookings')
          .select(
            '*, dealership:dealerships(id, name, status, contact_email, contact_phone), buyer:profiles(id, full_name, email, phone), group:groups(id, district:districts(name), variant:variants(name, model:models(name, manufacturer:manufacturers(name))))'
          )
          .eq('id', id)
          .maybeSingle(),
        supabase.from('payments').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
        supabase.from('refunds').select('*').eq('booking_id', id).order('created_at', { ascending: false }),
        supabase
          .from('settings')
          .select('key, value')
          .in('key', ['fee_refund_on_dealer_fault', 'dealer_delivery_fallback_days']),
      ]);

      if (bRes.error) throw bRes.error;
      if (!bRes.data) {
        setError('Booking not found.');
      } else {
        setBooking(bRes.data as BookingDetailData);
        setPayments((pRes.data || []) as PaymentRecord[]);
        setRefunds((rRes.data || []) as RefundRecord[]);

        for (const row of sRes.data || []) {
          if (row.key === 'fee_refund_on_dealer_fault') {
            setFeeRefundOnFault(row.value === 'true');
          } else if (row.key === 'dealer_delivery_fallback_days') {
            const parsed = Number(row.value);
            if (!Number.isNaN(parsed) && parsed > 0) setFallbackDays(parsed);
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load booking details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  if (isLoading) {
    return (
      <AdminLayout
        title="Booking Details"
        breadcrumbs={[
          { label: 'Admin', to: '/admin/dashboard' },
          { label: 'Bookings', to: '/admin/bookings' },
          { label: 'Loading...' },
        ]}
      >
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !booking) {
    return (
      <AdminLayout
        title="Booking Not Found"
        breadcrumbs={[
          { label: 'Admin', to: '/admin/dashboard' },
          { label: 'Bookings', to: '/admin/bookings' },
          { label: 'Error' },
        ]}
      >
        <div className="bg-white border border-rose-200 rounded-xl p-6 text-center space-y-3">
          <div className="text-sm font-bold text-rose-800">{error || 'Booking not found'}</div>
          <Link to="/admin/bookings">
            <Button variant="outline" size="sm">Back to Bookings</Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const elapsedDays = Math.floor((Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60 * 60 * 24));
  const fallbackEligible = booking.status === 'PAID' && elapsedDays >= fallbackDays;
  const canForceCancel = booking.status === 'PAID' || booking.status === 'PENDING';
  const expectedFeeRefund = feeRefundOnFault ? Number(booking.platform_fee) : 0;
  const expectedTotalRefund = Number(booking.booking_amount) + expectedFeeRefund;
  const isDealerSuspended = Boolean(booking.dealer_suspended || booking.dealership?.status === 'SUSPENDED');
  const snapshot = booking.price_snapshot || {};

  const handleConfirmAction = async (reason: string) => {
    if (!actionModal) return;
    const rpcAction =
      actionModal === 'FORCE_CANCEL' ? 'FORCE_DEALER_FAULT_CANCEL' : 'MARK_DELIVERED_FALLBACK';

    const { error: rpcErr } = await supabase.rpc('admin_manage_booking', {
      p_booking_id: booking.id,
      p_action: rpcAction,
      p_reason: reason,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: actionModal === 'FORCE_CANCEL' ? 'Dealer-Fault Refund Processed' : 'Booking Marked Delivered',
      message:
        actionModal === 'FORCE_CANCEL'
          ? `Refund of ${formatINR(expectedTotalRefund)} recorded for ${booking.booking_code}.`
          : `Fallback delivery confirmed for ${booking.booking_code}.`,
    });
    setActionModal(null);
    await loadDetail();
  };

  return (
    <AdminLayout
      title={`Booking ${booking.booking_code}`}
      breadcrumbs={[
        { label: 'Admin', to: '/admin/dashboard' },
        { label: 'Bookings', to: '/admin/bookings' },
        { label: booking.booking_code },
      ]}
      headerActions={
        <Link to="/admin/bookings">
          <Button size="sm" variant="outline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
          </Button>
        </Link>
      }
    >
      <div className="space-y-5">
        {isDealerSuspended && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Dealership Suspended:</strong> {booking.dealership?.name} is currently suspended. If the dealership cannot fulfill delivery, force a dealer-fault cancellation to issue a 100% refund to the buyer.
            </div>
          </div>
        )}

        {/* Top Summary & Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-bold text-slate-900">{booking.booking_code}</span>
              <Badge
                variant={
                  booking.status === 'DELIVERED'
                    ? 'success'
                    : booking.status === 'PAID'
                    ? 'brand'
                    : booking.status === 'CANCELLED_BY_DEALER'
                    ? 'danger'
                    : 'warning'
                }
              >
                {booking.status}
              </Badge>
            </div>
            <div className="text-xs text-slate-600">
              Booked {new Date(booking.created_at).toLocaleString()} ({elapsedDays} days ago)
              {booking.delivered_at && ` • Delivered ${new Date(booking.delivered_at).toLocaleString()}`}
            </div>
            {booking.cancellation_reason && (
              <div className="text-xs text-rose-700 font-medium">
                Cancellation Reason: {booking.cancellation_reason}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {canForceCancel && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setActionModal('FORCE_CANCEL')}
              >
                <Ban className="w-3.5 h-3.5 mr-1" /> Force Dealer-Fault Cancellation & Refund
              </Button>
            )}
            {booking.status === 'PAID' && (
              <Button
                variant="outline"
                size="sm"
                disabled={!fallbackEligible}
                title={
                  fallbackEligible
                    ? 'Confirm delivery under fallback rule'
                    : `Requires ${fallbackDays} days elapsed since booking (currently ${elapsedDays} days)`
                }
                onClick={() => setActionModal('FALLBACK_DELIVER')}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Mark Delivered (Fallback {elapsedDays}/{fallbackDays}d)
              </Button>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Parties & Vehicle */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <h2 className="text-sm font-bold text-slate-900">Parties & Vehicle</h2>
            <div className="space-y-2">
              <div>
                <div className="text-slate-500">Buyer</div>
                <Link to={`/admin/buyers/${booking.buyer_id}`} className="font-semibold text-brand-600 hover:underline">
                  {booking.buyer?.full_name || booking.buyer_name}
                </Link>
                <div className="text-slate-600">{booking.buyer?.email || booking.buyer_phone}</div>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-slate-500">Authorized Dealership</div>
                <Link to={`/admin/dealers/${booking.dealership_id}`} className="font-semibold text-brand-600 hover:underline">
                  {booking.dealership?.name}
                </Link>
                <div className="text-slate-600">Status: {booking.dealership?.status}</div>
              </div>
              {booking.group && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-slate-500">Vehicle & Group</div>
                  <div className="font-semibold text-slate-900">
                    {booking.group.variant?.model?.manufacturer?.name} {booking.group.variant?.model?.name}{' '}
                    {booking.group.variant?.name}
                  </div>
                  <Link to={`/admin/groups/${booking.group.id}`} className="text-brand-600 hover:underline">
                    Group #{booking.group.id.slice(0, 8)} ({booking.group.district?.name})
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Locked Price Snapshot */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs lg:col-span-2">
            <h2 className="text-sm font-bold text-slate-900">Locked On-Road Price Snapshot & Deposit</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 tabular-nums">
              <div>
                <div className="text-slate-500">Booking Deposit</div>
                <div className="text-sm font-bold text-slate-900">{formatINR(Number(booking.booking_amount))}</div>
              </div>
              <div>
                <div className="text-slate-500">Platform Fee</div>
                <div className="text-sm font-bold text-slate-900">{formatINR(Number(booking.platform_fee))}</div>
              </div>
              <div>
                <div className="text-slate-500">Total Paid</div>
                <div className="text-sm font-bold text-slate-900">{formatINR(Number(booking.total_amount))}</div>
              </div>
              <div>
                <div className="text-slate-500">Locked On-Road</div>
                <div className="text-sm font-bold text-brand-700">
                  {formatINR(Number(snapshot.on_road_price ?? 0))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 tabular-nums">
              <div>Ex-Showroom: <strong>{formatINR(Number(snapshot.ex_showroom_price ?? 0))}</strong></div>
              <div>Insurance: <strong>{formatINR(Number(snapshot.insurance ?? 0))}</strong></div>
              <div>RTO / Tax: <strong>{formatINR(Number(snapshot.registration_charges ?? 0))}</strong></div>
              <div>Group Discount: <strong className="text-emerald-700">-{formatINR(Number(snapshot.discounts ?? 0))}</strong></div>
            </div>
          </div>
        </div>

        {/* Payments & Refunds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Simulated Payments ({payments.length})</h2>
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500">No payment rows recorded.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.id} className="p-2.5 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-mono font-semibold text-slate-900">{p.payment_id}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.method} • {new Date(p.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold tabular-nums">{formatINR(Number(p.amount))}</div>
                      <Badge variant={p.status === 'SUCCESS' ? 'success' : 'default'} size="sm">
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Refund Records ({refunds.length})</h2>
            {refunds.length === 0 ? (
              <p className="text-xs text-slate-500">No refunds issued for this booking.</p>
            ) : (
              <div className="space-y-2">
                {refunds.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant={r.reason === 'DEALER_FAULT' ? 'danger' : 'warning'} size="sm">
                        {r.reason}
                      </Badge>
                      <span className="font-bold text-slate-900 tabular-nums">
                        Total Refunded: {formatINR(Number(r.total_refunded))}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 tabular-nums">
                      Deposit Refunded: {formatINR(Number(r.booking_amount_refunded))} • Platform Fee Refunded:{' '}
                      {formatINR(Number(r.platform_fee_refunded))} • Dealer Retained:{' '}
                      {formatINR(Number(r.dealer_retained_amount))}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Status: {r.status} • {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ReAuthModal
        isOpen={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal === 'FORCE_CANCEL'
            ? `Force Dealer-Fault Cancellation (${booking.booking_code})`
            : `Mark Delivered Under Fallback Rule (${booking.booking_code})`
        }
        description={
          actionModal === 'FORCE_CANCEL' ? (
            <div className="space-y-1.5">
              <p>
                This will cancel the booking under <strong>DEALER_FAULT</strong> and credit a full refund to{' '}
                <strong>{booking.buyer_name}</strong>:
              </p>
              <div className="p-2 rounded bg-slate-100 text-[11px] font-mono text-slate-800 space-y-0.5">
                <div>Deposit Refund: {formatINR(Number(booking.booking_amount))} (100%)</div>
                <div>
                  Platform Fee Refund: {formatINR(expectedFeeRefund)} (
                  {feeRefundOnFault ? 'refundable per setting' : 'retained per setting'})
                </div>
                <div className="font-bold">Total Refund to Buyer: {formatINR(expectedTotalRefund)}</div>
                <div>Dealership Retained: ₹0</div>
              </div>
            </div>
          ) : (
            <p>
              Confirm delivery completion for <strong>{booking.booking_code}</strong> after {elapsedDays} elapsed days
              (threshold: {fallbackDays} days).
            </p>
          )
        }
        confirmLabel={actionModal === 'FORCE_CANCEL' ? 'Confirm Dealer-Fault Refund' : 'Mark Delivered'}
        confirmVariant={actionModal === 'FORCE_CANCEL' ? 'danger' : 'primary'}
        requireReason={actionModal === 'FORCE_CANCEL'}
        reasonLabel={actionModal === 'FORCE_CANCEL' ? 'Fault Reason (Required)' : 'Admin Note'}
        onConfirm={handleConfirmAction}
      />
    </AdminLayout>
  );
}
