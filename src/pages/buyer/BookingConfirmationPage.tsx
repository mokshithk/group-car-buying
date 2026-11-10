import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Booking } from '@/types';
import {
  CheckCircle2,
  Lock,
  Building2,
  ShoppingBag,
  Printer,
  ShieldCheck,
  Loader2,
} from 'lucide-react';

export function BookingConfirmationPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*, dealership:dealerships(*), quotation:quotations(*), group:groups(*, variant:variants(*, model:models(*)))')
          .eq('id', bookingId)
          .maybeSingle();

        if (!error && data) {
          setBooking(data as Booking);
        }
      } catch (err) {
        console.error('Error loading booking:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [bookingId]);

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
        </div>
      </BuyerLayout>
    );
  }

  if (!booking) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Booking not found</h2>
          <Link to="/buyer/dashboard">
            <Button variant="secondary" size="sm">Go to Dashboard</Button>
          </Link>
        </div>
      </BuyerLayout>
    );
  }

  const snap = booking.price_snapshot;

  return (
    <BuyerLayout>
      <div className="space-y-6 max-w-2xl mx-auto py-4">
        {/* Success header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-subtle">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <Badge variant="success" size="md">Payment Successful & Price Locked</Badge>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Booking Confirmed!
          </h1>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your on-road quotation price is officially locked until delivery. You have been automatically removed from the group pool.
          </p>
        </div>

        {/* Unique Booking Code Card */}
        <Card className="p-6 text-center bg-gradient-to-br from-white via-slate-50 to-brand-50/30 border-brand-200 shadow-card">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Official Booking Voucher Code
          </div>
          <div className="text-3xl font-black font-mono tracking-wider text-brand-700 my-2">
            {booking.booking_code}
          </div>
          <p className="text-xs text-slate-600">
            Present this code or voucher when visiting the showroom to finalize physical vehicle delivery.
          </p>
        </Card>

        {/* LOCKED PRICE SNAPSHOT SUMMARY (Section 2) */}
        <Card className="p-6">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-base text-slate-900">
                Binding Price Snapshot
              </CardTitle>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {formatDateTime(snap.timestamp)}
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-4 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Vehicle & Variant:</span>
              <strong className="text-slate-900">
                {snap.manufacturer_name} {snap.model_name} — {snap.variant_name}
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Authorized Dealership:</span>
              <strong className="text-slate-900 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                {snap.dealer_name}
              </strong>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 mt-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Ex-Showroom Price:</span>
                <span className="font-semibold">{formatINR(snap.ex_showroom_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Insurance (Zero Dep):</span>
                <span className="font-semibold">{formatINR(snap.insurance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">RTO / Taxes:</span>
                <span className="font-semibold">{formatINR(snap.registration_charges)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Group Buyer Corporate Discount:</span>
                <span>-{formatINR(snap.discounts)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Locked On-Road Price:</span>
                <span>{formatINR(snap.on_road_price)}</span>
              </div>
            </div>

            <div className="flex justify-between pt-1">
              <span className="text-slate-500">Booking Deposit Paid Today:</span>
              <span className="font-bold text-emerald-700">{formatINR(booking.booking_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Platform Facilitation Fee Paid:</span>
              <span className="font-semibold text-slate-700">{formatINR(booking.platform_fee)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Remaining Balance at Delivery:</span>
              <span className="font-bold text-slate-900">
                {formatINR(Math.max(0, (snap?.on_road_price || 0) - booking.booking_amount))}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Dealership is legally bound to honor this locked price until vehicle handover.</span>
            </div>
          </CardContent>
        </Card>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link to="/buyer/bookings" className="w-full">
            <Button variant="primary" size="lg" className="w-full font-bold" rightIcon={<ShoppingBag className="w-4 h-4" />}>
              Go to My Bookings
            </Button>
          </Link>
          <Button
            variant="secondary"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Receipt
          </Button>
        </div>
      </div>
    </BuyerLayout>
  );
}
