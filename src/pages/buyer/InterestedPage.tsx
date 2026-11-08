import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchQuotationsForGroup } from '@/lib/quoteService';
import { fetchGroupById } from '@/lib/groupService';
import { expressInterest } from '@/lib/bookingService';
import { formatINR } from '@/lib/formatters';
import { Group, Quotation } from '@/types';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
} from 'lucide-react';

export function InterestedPage() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { user, profile } = useAuth();

  const [quote, setQuote] = useState<Quotation | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!quoteId) return;
      setIsLoading(true);

      const g = await fetchGroupById('f1111111-1111-1111-1111-111111111101');
      if (g) {
        setGroup(g);
        const quotes = await fetchQuotationsForGroup(g.id);
        const target = quotes.find((q) => q.id === quoteId) || quotes[0];
        setQuote(target);

        if (target && user && profile) {
          await expressInterest(
            target,
            g,
            user.id,
            profile.full_name,
            profile.phone || '+91 98765 43210'
          );
        }
      }
      setIsLoading(false);
    }
    load();
  }, [quoteId, user, profile]);

  if (isLoading) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center text-slate-400">Loading showroom details...</div>
      </BuyerLayout>
    );
  }

  if (!quote || !group) {
    return (
      <BuyerLayout>
        <div className="py-20 text-center space-y-3">
          <h2 className="text-lg font-bold text-slate-900">Quotation not found</h2>
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
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotation Comparison
          </Link>

          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Interest Confirmed & Showroom Unlocked
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            No money charged. The dealer has received your contact details to schedule your showroom visit.
          </p>
        </div>

        {/* MANDATORY DISCLAIMER: PRICE IS NOT LOCKED (Section 2) */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 space-y-1.5 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Important Pricing Notice: Price Is NOT Locked</span>
          </div>
          <p className="leading-relaxed">
            By choosing <strong>"I'm interested"</strong>, you have unlocked direct showroom contact without paying a booking deposit. <strong>Your quotation price of {formatINR(quote.on_road_price)} is NOT locked.</strong> The price may vary based on vehicle availability, manufacturer tariff updates, or RTO revisions before booking.
          </p>
          <div className="pt-2">
            <Link
              to={`/buyer/quote/${quote.id}/book`}
              className="font-bold text-brand-700 underline flex items-center gap-1"
            >
              Want to strictly freeze this on-road price? Tap here to Book Now <Lock className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* SHOWROOM CONTACT & ADDRESS DETAILS */}
        <Card className="p-6">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-900">
                  {quote.dealership?.name}
                </CardTitle>
                <CardDescription>
                  Authorized Dealership Partner · {group.district?.name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-xs">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-900">Showroom Address:</div>
                <div className="text-slate-600 leading-relaxed mt-0.5">
                  {quote.dealership?.address}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Phone className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Phone Number</div>
                  <a
                    href={`tel:${quote.dealership?.contact_phone}`}
                    className="font-bold text-slate-900 hover:text-brand-600"
                  >
                    {quote.dealership?.contact_phone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <Mail className="w-4 h-4 text-brand-600 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Email Address</div>
                  <a
                    href={`mailto:${quote.dealership?.contact_email}`}
                    className="font-bold text-slate-900 hover:text-brand-600"
                  >
                    {quote.dealership?.contact_email}
                  </a>
                </div>
              </div>
            </div>

            {/* Quote Snapshot Preview */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 mt-4">
              <div className="font-bold text-slate-900 text-sm">
                Quoted Vehicle: {group.variant?.model?.name} {group.variant?.name}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quoted On-Road Price:</span>
                <span className="font-bold text-slate-900">{formatINR(quote.on_road_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Group Corporate Discount:</span>
                <span className="font-bold text-emerald-700">-{formatINR(quote.discounts)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Quote Validity Window:</span>
                <span>Until {quote.validity_date ? new Date(quote.validity_date).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>

            <div className="pt-2 text-slate-500 text-[11px] leading-relaxed">
              ℹ️ Dealership sales executives have been notified of your interest with your registered contact details: <strong>{profile?.full_name} ({profile?.phone})</strong>.
            </div>
          </CardContent>
        </Card>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link to={`/buyer/quote/${quote.id}/book`} className="w-full">
            <Button variant="primary" size="lg" className="w-full font-bold">
              Lock This Price Now ({formatINR(5100)})
            </Button>
          </Link>
          <Link to={`/buyer/groups/${group.id}/offers`} className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full">
              Compare Other Showrooms
            </Button>
          </Link>
        </div>
      </div>
    </BuyerLayout>
  );
}
