import { supabase } from '@/lib/supabase';
import {
  AuditLogEntry,
  Booking,
  Dealership,
  DealerRating,
  District,
  Group,
  Manufacturer,
  Model,
  Profile,
  Quotation,
  Report,
  Setting,
  Variant,
  AdminInvite,
  Notification,
} from '@/types';
import { DailySeriesPoint } from '@/components/admin/AdminCharts';

export interface DashboardMetrics {
  buyersCount: number;
  dealershipsByStatus: Record<'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED', number>;
  activeGroupsCount: number;
  groupsByStatus: Record<string, number>;
  quotationsCount: number;
  bookingsCount: number;
  paidBookingsCount: number;
  deliveredBookingsCount: number;
  platformFeesCollected: number;
  refundsSummary: {
    totalRefunded: number;
    buyerCancelCount: number;
    buyerCancelAmount: number;
    buyerCancelRetained: number;
    dealerFaultCount: number;
    dealerFaultAmount: number;
  };
  pendingDealers: Dealership[];
  recentAudit: AuditLogEntry[];
  series30Days: DailySeriesPoint[];
}

export async function fetchAdminDashboardMetrics(): Promise<DashboardMetrics> {
  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400 * 1000).toISOString();

  const [
    { data: profilesData, error: profErr },
    { data: dealersData, error: dealErr },
    { data: groupsData, error: grpErr },
    { count: quotesCount, error: quoteErr },
    { data: bookingsData, error: bookErr },
    { data: refundsData, error: refErr },
    { data: auditData, error: audErr },
  ] = await Promise.all([
    supabase.from('profiles').select('id, role, created_at'),
    supabase.from('dealerships').select('*').order('created_at', { ascending: false }),
    supabase.from('groups').select('id, status, created_at'),
    supabase.from('quotations').select('id', { count: 'exact', head: true }),
    supabase.from('bookings').select('id, status, booking_amount, platform_fee, total_amount, created_at'),
    supabase.from('refunds').select('*'),
    supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (profErr) throw new Error(profErr.message);
  if (dealErr) throw new Error(dealErr.message);
  if (grpErr) throw new Error(grpErr.message);
  if (quoteErr) throw new Error(quoteErr.message);
  if (bookErr) throw new Error(bookErr.message);
  if (refErr) throw new Error(refErr.message);
  if (audErr) throw new Error(audErr.message);

  const buyersCount = (profilesData || []).filter((p: any) => p.role === 'buyer').length;

  const dealershipsByStatus = {
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    SUSPENDED: 0,
  };
  const pendingDealers: Dealership[] = [];
  for (const d of (dealersData || []) as Dealership[]) {
    if (d.status in dealershipsByStatus) {
      dealershipsByStatus[d.status] += 1;
    }
    if (d.status === 'PENDING' && pendingDealers.length < 5) {
      pendingDealers.push(d);
    }
  }

  const groupsByStatus: Record<string, number> = {
    FORMING: 0,
    OPEN_FOR_QUOTES: 0,
    OFFERS_RECEIVED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    EXPIRED: 0,
  };
  let activeGroupsCount = 0;
  for (const g of groupsData || []) {
    groupsByStatus[g.status] = (groupsByStatus[g.status] || 0) + 1;
    if (['FORMING', 'OPEN_FOR_QUOTES', 'OFFERS_RECEIVED'].includes(g.status)) {
      activeGroupsCount += 1;
    }
  }

  let paidBookingsCount = 0;
  let deliveredBookingsCount = 0;
  let platformFeesCollected = 0;
  for (const b of bookingsData || []) {
    if (b.status === 'PAID') paidBookingsCount += 1;
    if (b.status === 'DELIVERED') deliveredBookingsCount += 1;
    if (['PAID', 'DELIVERED', 'CANCELLED_BY_BUYER'].includes(b.status)) {
      platformFeesCollected += Number(b.platform_fee || 0);
    }
  }

  const refundsSummary = {
    totalRefunded: 0,
    buyerCancelCount: 0,
    buyerCancelAmount: 0,
    buyerCancelRetained: 0,
    dealerFaultCount: 0,
    dealerFaultAmount: 0,
  };
  for (const r of refundsData || []) {
    refundsSummary.totalRefunded += Number(r.total_refunded || 0);
    if (r.reason === 'BUYER_CANCEL') {
      refundsSummary.buyerCancelCount += 1;
      refundsSummary.buyerCancelAmount += Number(r.total_refunded || 0);
      refundsSummary.buyerCancelRetained += Number(r.dealer_retained_amount || 0);
    } else if (r.reason === 'DEALER_FAULT') {
      refundsSummary.dealerFaultCount += 1;
      refundsSummary.dealerFaultAmount += Number(r.total_refunded || 0);
    }
  }

  // Resolve actor info for recent audit entries
  const actorIds = Array.from(
    new Set((auditData || []).map((a: any) => a.actor_id).filter(Boolean))
  ) as string[];
  const actorMap = new Map<string, { full_name?: string; email?: string }>();
  if (actorIds.length > 0) {
    const { data: actors } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', actorIds);
    (actors || []).forEach((a: any) => actorMap.set(a.id, a));
  }
  const recentAudit: AuditLogEntry[] = (auditData || []).map((a: any) => ({
    ...a,
    actor: a.actor_id ? actorMap.get(a.actor_id) || null : null,
  }));

  // Build exact 30-day series
  const dayBuckets = new Map<string, DailySeriesPoint>();
  for (let offset = 29; offset >= 0; offset--) {
    const d = new Date(Date.now() - offset * 86400 * 1000);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    dayBuckets.set(iso, { date: iso, label, signups: 0, groups: 0, bookings: 0 });
  }

  for (const p of profilesData || []) {
    if (p.created_at && p.created_at >= thirtyDaysAgo) {
      const bucket = dayBuckets.get(p.created_at.slice(0, 10));
      if (bucket) bucket.signups += 1;
    }
  }
  for (const g of groupsData || []) {
    if (g.created_at && g.created_at >= thirtyDaysAgo) {
      const bucket = dayBuckets.get(g.created_at.slice(0, 10));
      if (bucket) bucket.groups += 1;
    }
  }
  for (const b of bookingsData || []) {
    if (b.created_at && b.created_at >= thirtyDaysAgo) {
      const bucket = dayBuckets.get(b.created_at.slice(0, 10));
      if (bucket) bucket.bookings += 1;
    }
  }

  return {
    buyersCount,
    dealershipsByStatus,
    activeGroupsCount,
    groupsByStatus,
    quotationsCount: quotesCount || 0,
    bookingsCount: (bookingsData || []).length,
    paidBookingsCount,
    deliveredBookingsCount,
    platformFeesCollected,
    refundsSummary,
    pendingDealers,
    recentAudit,
    series30Days: Array.from(dayBuckets.values()),
  };
}

// Re-export shared types cleanly for convenience in Admin pages
export type {
  AuditLogEntry,
  Booking,
  Dealership,
  DealerRating,
  District,
  Group,
  Manufacturer,
  Model,
  Profile,
  Quotation,
  Report,
  Setting,
  Variant,
  AdminInvite,
  Notification,
};
