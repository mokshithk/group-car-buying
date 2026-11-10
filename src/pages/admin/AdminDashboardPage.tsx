import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminCharts } from '@/components/admin/AdminCharts';
import { fetchAdminDashboardMetrics, DashboardMetrics } from '@/lib/adminService';
import { formatINR, formatDateTime } from '@/lib/formatters';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Skeleton } from '@/components/ui';
import {
  Users,
  Building2,
  Layers,
  FileSpreadsheet,
  ShoppingBag,
  IndianRupee,
  AlertCircle,
  ArrowRight,
  Clock,
  RefreshCw,
} from 'lucide-react';

export function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchAdminDashboardMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard analytics.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <AdminLayout
      title="Operations Dashboard"
      breadcrumbs={[{ label: 'Dashboard' }]}
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={loadMetrics}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      }
    >
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {error}
          </span>
          <Button variant="secondary" size="sm" onClick={loadMetrics}>
            Retry
          </Button>
        </div>
      )}

      {/* Top KPI Cards */}
      <section aria-label="Platform Key Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Buyers</span>
            <Users className="w-4 h-4 text-brand-600" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? <Skeleton className="h-7 w-16" /> : metrics?.buyersCount ?? 0}
          </div>
          <Link to="/admin/buyers" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            View buyers <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>

        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dealerships</span>
            <Building2 className="w-4 h-4 text-slate-700" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              (metrics?.dealershipsByStatus.VERIFIED ?? 0) +
              (metrics?.dealershipsByStatus.PENDING ?? 0) +
              (metrics?.dealershipsByStatus.REJECTED ?? 0) +
              (metrics?.dealershipsByStatus.SUSPENDED ?? 0)
            )}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
            {metrics?.dealershipsByStatus.VERIFIED ?? 0} verified •{' '}
            <span className="text-amber-700 font-semibold">{metrics?.dealershipsByStatus.PENDING ?? 0} pending</span>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Active Groups</span>
            <Layers className="w-4 h-4 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? <Skeleton className="h-7 w-16" /> : metrics?.activeGroupsCount ?? 0}
          </div>
          <Link to="/admin/groups" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            Manage groups <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>

        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Quotations</span>
            <FileSpreadsheet className="w-4 h-4 text-slate-700" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? <Skeleton className="h-7 w-16" /> : metrics?.quotationsCount ?? 0}
          </div>
          <Link to="/admin/quotations" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            Inspect quotes <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>

        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Bookings</span>
            <ShoppingBag className="w-4 h-4 text-brand-600" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? <Skeleton className="h-7 w-16" /> : metrics?.bookingsCount ?? 0}
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 tabular-nums">
            {metrics?.paidBookingsCount ?? 0} paid • {metrics?.deliveredBookingsCount ?? 0} delivered
          </div>
        </Card>

        <Card className="p-4 border-slate-200 shadow-subtle">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Fees Collected</span>
            <IndianRupee className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              formatINR(metrics?.platformFeesCollected ?? 0)
            )}
          </div>
          <Link to="/admin/exports" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            Revenue report <ArrowRight className="w-3 h-3" />
          </Link>
        </Card>
      </section>

      {/* Pending Dealer Approvals + Dealership Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7 border-slate-200 shadow-subtle">
          <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900">
                Pending Dealership Approvals ({metrics?.dealershipsByStatus.PENDING ?? 0})
              </CardTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Showrooms waiting for verification before viewing buyer tenders
              </p>
            </div>
            <Link to="/admin/dealers?status=PENDING">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Review All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !metrics?.pendingDealers.length ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No pending dealership applications in the queue.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {metrics.pendingDealers.map((d) => (
                  <div key={d.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-slate-50/70">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{d.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        GSTIN: <span className="font-mono">{d.gst_number}</span> • {d.contact_email}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="warning" size="sm">
                        <Clock className="w-3 h-3" /> PENDING
                      </Badge>
                      <Link to={`/admin/dealers/${d.id}`}>
                        <Button variant="secondary" size="sm">Inspect</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Groups by Status + Bookings & Refunds Summary */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-200 shadow-subtle p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Groups by Status</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              {Object.entries(metrics?.groupsByStatus || {}).map(([status, count]) => (
                <div key={status} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 truncate">
                    {status.replace(/_/g, ' ')}
                  </div>
                  <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">{count}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-slate-200 shadow-subtle p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Refunds &amp; Retention Summary</h2>
              <Link to="/admin/bookings" className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
                Open Bookings
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs tabular-nums">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Buyer Cancellations ({metrics?.refundsSummary.buyerCancelCount ?? 0})</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {formatINR(metrics?.refundsSummary.buyerCancelAmount ?? 0)} refunded
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {formatINR(metrics?.refundsSummary.buyerCancelRetained ?? 0)} dealer retained
                </div>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <div className="text-[11px] text-slate-500">Dealer-Fault Refunds ({metrics?.refundsSummary.dealerFaultCount ?? 0})</div>
                <div className="text-sm font-bold text-rose-700 mt-0.5">
                  {formatINR(metrics?.refundsSummary.dealerFaultAmount ?? 0)} refunded
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">100% deposit + fee</div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* 30-Day Trend Chart */}
      {!isLoading && metrics && <AdminCharts data={metrics.series30Days} />}

      {/* Recent Audit Activity */}
      <Card className="border-slate-200 shadow-subtle">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">Recent Audit Activity</CardTitle>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Immutable ledger of latest administrative writes
            </p>
          </div>
          <Link to="/admin/audit">
            <Button variant="secondary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Full Audit Log
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Actor</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Action</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Entity</th>
                <th className="px-4 py-2.5 font-semibold uppercase tracking-wider text-[10px]">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!metrics?.recentAudit.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    No audit activity recorded yet.
                  </td>
                </tr>
              ) : (
                metrics.recentAudit.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap tabular-nums">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {entry.actor?.email || entry.actor?.full_name || entry.actor_id?.slice(0, 8) || 'System'}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-slate-900">
                      {entry.action}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {entry.entity_type} <span className="font-mono text-[10px] text-slate-400">({entry.entity_id.slice(0, 8)})</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">
                      {entry.reason || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
