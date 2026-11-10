import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DealerLayout } from '@/components/layout/DealerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchDealerEligibleGroups } from '@/lib/groupService';
import { fetchDealerQuotations, isQuoteExpired } from '@/lib/quoteService';
import { fetchDealerBookings, fetchDealerInterests } from '@/lib/bookingService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Group, Notification } from '@/types';
import {
  Users,
  Tag,
  PhoneCall,
  ShoppingBag,
  ShieldCheck,
  ArrowRight,
  Bell,
  AlertCircle,
} from 'lucide-react';

export function DealerDashboardPage() {
  const { user, dealership } = useAuth();

  const [eligibleGroups, setEligibleGroups] = useState<Group[]>([]);
  const [activeQuotesCount, setActiveQuotesCount] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalBookings, setTotalBookings] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [retentionPercent, setRetentionPercent] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.buyerCancelRetentionPercent
  );
  const [feeRefundOnFault, setFeeRefundOnFault] = useState<boolean>(
    DEFAULT_PLATFORM_SETTINGS.feeRefundOnDealerFault
  );
  const [visibilityThreshold, setVisibilityThreshold] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.visibilityMemberThreshold
  );
  const [visibilityDays, setVisibilityDays] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.groupVisibilityDaysFor2Members
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dealership?.id || !user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);
      try {
        const districtIds = Array.from(
          new Set([dealership.district_id, ...(dealership.districts || [])].filter(Boolean))
        ) as string[];

        const [visible, myQuotes, leads, bks, settings, notifRes] = await Promise.all([
          fetchDealerEligibleGroups(districtIds, dealership.brands || []),
          fetchDealerQuotations(dealership.id),
          fetchDealerInterests(dealership.id),
          fetchDealerBookings(dealership.id),
          fetchPlatformSettings(),
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        setEligibleGroups(visible);
        setActiveQuotesCount(
          myQuotes.filter((q) => q.is_active !== false && !isQuoteExpired(q.validity_date)).length
        );
        setTotalLeads(leads.length);
        setTotalBookings(bks.length);
        setRetentionPercent(settings.buyerCancelRetentionPercent);
        setFeeRefundOnFault(settings.feeRefundOnDealerFault);
        setVisibilityThreshold(settings.visibilityMemberThreshold);
        setVisibilityDays(settings.groupVisibilityDaysFor2Members);
        if (!notifRes.error && notifRes.data) {
          setNotifications(notifRes.data as Notification[]);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load dealership overview.');
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
  }, [dealership, user?.id]);

  return (
    <DealerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Dealership Operations Hub
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {dealership?.name} · Operating in {dealership?.brands?.join(', ')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/dealer/groups">
              <Button variant="primary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                View Eligible Groups
              </Button>
            </Link>
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* DEALER STATUTORY DISCLAIMERS BANNER (Section 3: Mandatory Dealer Disclaimers) */}
        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2.5 text-xs shadow-card">
          <div className="flex items-center gap-2 font-bold text-brand-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authorized Dealership Binding Code of Conduct</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px] text-slate-300">
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <strong className="text-white block mb-0.5">1. Price Lock Commitment</strong>
              Every submitted quote is legally locked upon buyer booking and must be honored until delivery.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <strong className="text-white block mb-0.5">2. {retentionPercent}% Retention on Buyer Cancel</strong>
              If a buyer cancels, {retentionPercent}% of the booking deposit is retained by your showroom as an administrative fee.
            </div>
            <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60">
              <strong className="text-white block mb-0.5">3. 100% Refund on Dealer Fault</strong>
              If your showroom cancels or alters the locked price, buyer receives 100% refund of deposit{feeRefundOnFault ? ' + platform fee' : ''}.
            </div>
          </div>
        </div>

        {/* SUMMARY STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Eligible Groups</span>
              <Users className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {eligibleGroups.length}
            </div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              Active local tenders
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Active Quotes</span>
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{activeQuotesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Live in competition</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Interested Leads</span>
              <PhoneCall className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-indigo-700 mt-2">
              {totalLeads}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Buyer contact unlocked</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Confirmed Bookings</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {totalBookings}
            </div>
            <div className="text-[11px] text-amber-700 font-semibold mt-1">
              Price snapshot locked
            </div>
          </Card>
        </div>

        {/* ELIGIBLE GROUPS READY FOR QUOTING */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Eligible Buying Groups in Your District
            </h2>
            <Link to="/dealer/groups" className="text-xs font-semibold text-brand-600 hover:underline">
              View all ({eligibleGroups.length})
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">Loading tenders...</div>
          ) : eligibleGroups.length === 0 ? (
            <Card className="text-center py-12 p-6">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No eligible groups currently</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Groups become visible to dealers once they reach {visibilityThreshold} members or {visibilityDays} days with 2 members.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {eligibleGroups.slice(0, 5).map((g) => (
                <Card key={g.id} className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="brand" size="sm">
                          {g.variant?.model?.manufacturer?.name}
                        </Badge>
                        <h3 className="text-base font-bold text-slate-900">
                          {g.variant?.model?.name} — {g.variant?.name}
                        </h3>
                        <Badge variant="success" size="sm">
                          {g.member_count ?? 0} Members Ready
                        </Badge>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                        <span>District: {g.district?.name || '—'}</span>
                        <span>•</span>
                        <span>Indicative Ex-Showroom: {formatINR(g.variant?.ex_showroom_price)}</span>
                        <span>•</span>
                        <span>{g.bookings_so_far || 0} Bookings so far</span>
                        <span>•</span>
                        <span className="text-emerald-700 font-semibold">Tender Open</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Link to={`/dealer/groups/${g.id}`}>
                        <Button variant="secondary" size="sm">
                          View Competitor Quotes
                        </Button>
                      </Link>
                      <Link to={`/dealer/groups/${g.id}/quote`}>
                        <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                          Submit / Edit Quote
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* RECENT NOTIFICATIONS FEED FOR DEALERS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Dealership Alerts</h2>
            <Link to="/dealer/notifications" className="text-xs font-semibold text-brand-600 hover:underline">
              View all notifications
            </Link>
          </div>
          {notifications.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-500">
              <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              No new dealership alerts. Events for newly visible groups, competitor price revisions, buyer leads, and bookings appear here.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 p-2 text-xs">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-3.5 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    {notif.type === 'NEW_BOOKING' ? (
                      <ShoppingBag className="w-4 h-4 text-emerald-600" />
                    ) : notif.type === 'PRICE_CHANGE' ? (
                      <Tag className="w-4 h-4 text-blue-600" />
                    ) : notif.type === 'NEW_LEAD' ? (
                      <PhoneCall className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Bell className="w-4 h-4 text-brand-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{notif.title}</div>
                    <div className="text-slate-500 mt-0.5">{notif.message}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {formatDateTime(notif.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </DealerLayout>
  );
}
