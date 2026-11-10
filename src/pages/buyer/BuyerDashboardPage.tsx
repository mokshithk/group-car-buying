import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BuyerLayout } from '@/components/layout/BuyerLayout';
import { Button, Badge, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { fetchBuyerJoinedGroups, getWishlist } from '@/lib/groupService';
import { fetchBuyerBookings } from '@/lib/bookingService';
import { fetchPlatformSettings, DEFAULT_PLATFORM_SETTINGS } from '@/lib/catalogService';
import { isQuoteExpired } from '@/lib/quoteService';
import { supabase } from '@/lib/supabase';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Group, Notification } from '@/types';
import {
  Users,
  Compass,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Bookmark,
  Clock,
  CheckCircle2,
  Tag,
  AlertCircle,
  Bell,
} from 'lucide-react';

interface ExpiringQuoteSummary {
  id: string;
  group_id: string;
  dealership_name: string;
  car_label: string;
  validity_date: string;
  hours_left: number;
}

export function BuyerDashboardPage() {
  const { profile, user } = useAuth();

  const [activeGroups, setActiveGroups] = useState<Group[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [liveQuotesCount, setLiveQuotesCount] = useState(0);
  const [quotesByGroup, setQuotesByGroup] = useState<Record<string, number>>({});
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [expiringQuote, setExpiringQuote] = useState<ExpiringQuoteSummary | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [visibilityThreshold, setVisibilityThreshold] = useState<number>(
    DEFAULT_PLATFORM_SETTINGS.visibilityMemberThreshold
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const [joinedGroups, wl, bookings, settings, notifRes] = await Promise.all([
          fetchBuyerJoinedGroups(user.id),
          getWishlist(user.id),
          fetchBuyerBookings(user.id),
          fetchPlatformSettings(),
          supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;

        setVisibilityThreshold(settings.visibilityMemberThreshold);
        setWishlistCount(wl.length);

        const openStatuses = new Set(['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED']);
        const openGroups = joinedGroups.filter((g) => openStatuses.has(g.status));
        setActiveGroups(openGroups);

        const activeBookings = bookings.filter((b) =>
          ['PENDING', 'PAID', 'DELIVERED'].includes(b.status)
        );
        setActiveBookingsCount(activeBookings.length);

        if (!notifRes.error && notifRes.data) {
          setNotifications(notifRes.data as Notification[]);
        }

        const openIds = openGroups.map((g) => g.id);
        if (openIds.length > 0) {
          const { data: quoteRows, error: qErr } = await supabase
            .from('quotations')
            .select('id, group_id, validity_date, dealership:dealerships(name)')
            .in('group_id', openIds)
            .eq('is_active', true);

          if (!qErr && quoteRows && !cancelled) {
            const countMap: Record<string, number> = {};
            const nowMs = Date.now();
            const fortyEightHoursMs = 48 * 60 * 60 * 1000;
            let totalLive = 0;
            let soonestExpiring: ExpiringQuoteSummary | null = null;
            let soonestRemainingMs = Infinity;

            for (const row of quoteRows as Array<{
              id: string;
              group_id: string;
              validity_date: string;
              dealership?: { name?: string } | Array<{ name?: string }> | null;
            }>) {
              if (isQuoteExpired(row.validity_date)) continue;
              totalLive += 1;
              countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;

              const validMs = new Date(row.validity_date).getTime();
              const remainingMs = validMs - nowMs;
              if (
                Number.isFinite(remainingMs) &&
                remainingMs > 0 &&
                remainingMs <= fortyEightHoursMs &&
                remainingMs < soonestRemainingMs
              ) {
                soonestRemainingMs = remainingMs;
                const grp = openGroups.find((g) => g.id === row.group_id);
                const dealerObj = Array.isArray(row.dealership) ? row.dealership[0] : row.dealership;
                soonestExpiring = {
                  id: row.id,
                  group_id: row.group_id,
                  dealership_name: dealerObj?.name || 'Authorized Showroom',
                  car_label:
                    [grp?.variant?.model?.name, grp?.variant?.name].filter(Boolean).join(' ') ||
                    'Your Buying Group',
                  validity_date: row.validity_date,
                  hours_left: Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000))),
                };
              }
            }

            setLiveQuotesCount(totalLive);
            setQuotesByGroup(countMap);
            setExpiringQuote(soonestExpiring);
          }
        } else {
          setLiveQuotesCount(0);
          setQuotesByGroup({});
          setExpiringQuote(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Unable to load dashboard summary.');
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
  }, [user]);

  return (
    <BuyerLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'Buyer'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Your active buying groups, live dealer quotations, and bookings at a glance.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/buyer/groups/find">
              <Button variant="secondary" size="sm" leftIcon={<Compass className="w-4 h-4" />}>
                Find Groups
              </Button>
            </Link>
            <Link to="/buyer/groups/create">
              <Button variant="primary" size="sm" leftIcon={<Users className="w-4 h-4" />}>
                Create Group
              </Button>
            </Link>
          </div>
        </div>

        {loadError && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3 text-xs text-red-800">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        {/* LIVE EXPIRING QUOTE WARNING BANNER */}
        {expiringQuote && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="font-bold text-amber-900">
                Quotation Expiring Soon: {expiringQuote.car_label}
              </div>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Dealership quotation from <strong>{expiringQuote.dealership_name}</strong> expires in{' '}
                {expiringQuote.hours_left} hour{expiringQuote.hours_left === 1 ? '' : 's'}. Review the on-road price breakdown if you wish to lock your price.
              </p>
            </div>
            <Link to={`/buyer/groups/${expiringQuote.group_id}/offers`} className="shrink-0">
              <Button variant="primary" size="sm" className="bg-amber-600 hover:bg-amber-700 text-xs">
                Review Quote
              </Button>
            </Link>
          </div>
        )}

        {/* SUMMARY STATS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">My Active Groups</span>
              <Users className="w-4 h-4 text-brand-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {activeGroups.length}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Joined tenders</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Live Quotes</span>
              <Tag className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">{liveQuotesCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">On your active groups</div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">My Bookings</span>
              <ShoppingBag className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">{activeBookingsCount}</div>
            <div className="text-[11px] text-indigo-600 font-medium mt-1">
              {activeBookingsCount > 0 ? 'Active price locks' : 'No active bookings'}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-slate-500">Saved Wishlist</span>
              <Bookmark className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {wishlistCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Variants tracked</div>
          </Card>
        </div>

        {/* MY ACTIVE GROUPS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">My Active Buying Groups</h2>
            <Link to="/buyer/groups" className="text-xs font-semibold text-brand-600 hover:underline">
              View all
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-slate-400">Loading your active groups...</div>
          ) : activeGroups.length === 0 ? (
            <Card className="text-center py-12 p-6">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No active groups</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                You haven't joined any district buying groups yet.
              </p>
              <Link to="/buyer/groups/find">
                <Button variant="primary" size="sm">
                  Find Buying Groups
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {activeGroups.slice(0, 3).map((group) => {
                const activeCount = group.member_count ?? 0;
                const isStrong = activeCount >= (group.target_members || 10);
                const quoteCount = quotesByGroup[group.id] || 0;

                return (
                  <Card key={group.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="brand" size="sm">
                            {group.variant?.model?.manufacturer?.name}
                          </Badge>
                          <h3 className="text-base font-bold text-slate-900">
                            {group.variant?.model?.name} — {group.variant?.name}
                          </h3>
                          {isStrong && (
                            <Badge variant="milestone" size="sm">
                              <Sparkles className="w-3 h-3 text-indigo-600 mr-1" /> Strong
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>
                            {activeCount} Member{activeCount === 1 ? '' : 's'}
                          </span>
                          <span>•</span>
                          <span>Ex-Showroom: {formatINR(group.variant?.ex_showroom_price)}</span>
                          <span>•</span>
                          {quoteCount > 0 ? (
                            <span className="text-emerald-700 font-semibold">
                              {quoteCount} Live Quote{quoteCount === 1 ? '' : 's'}
                            </span>
                          ) : group.is_visible_to_dealers ? (
                            <span className="text-brand-700 font-medium">Open for dealer quotes</span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Forming ({Math.max(1, visibilityThreshold - activeCount)} more to unlock)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link to={`/buyer/groups/${group.id}`}>
                          <Button variant="secondary" size="sm">
                            Group Info
                          </Button>
                        </Link>
                        {quoteCount > 0 && (
                          <Link to={`/buyer/groups/${group.id}/offers`}>
                            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                              Compare Quotes
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* RECENT ACTIVITY FEED */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Activity</h2>
            <Link to="/buyer/notifications" className="text-xs font-semibold text-brand-600 hover:underline">
              All notifications
            </Link>
          </div>
          {notifications.length === 0 ? (
            <Card className="p-6 text-center text-xs text-slate-500">
              <Bell className="w-6 h-6 text-slate-300 mx-auto mb-2" />
              No notifications yet. Activity updates on your joined groups, quotations, and bookings will appear here.
            </Card>
          ) : (
            <Card className="divide-y divide-slate-100 p-2">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
                    {notif.type === 'PRICE_CHANGE' ? (
                      <Tag className="w-4 h-4 text-emerald-600" />
                    ) : notif.type === 'NEW_BOOKING' ? (
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Bell className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 text-xs">
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
    </BuyerLayout>
  );
}
