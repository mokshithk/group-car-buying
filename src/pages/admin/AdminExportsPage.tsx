import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { buildCsvContent, triggerCsvDownload, toLocalDateKey } from '@/lib/adminHelpers';
import { useToast } from '@/components/ui/Toast';
import { Button, Input } from '@/components/ui';
import { Download, Clock } from 'lucide-react';

export function AdminExportsPage() {
  const { toast } = useToast();

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [runningExport, setRunningExport] = useState<string | null>(null);
  const [isExpiring, setIsExpiring] = useState(false);

  const dateFilterIso = () => ({
    from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null,
    to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : null,
  });

  const exportDataset = async (type: 'buyers' | 'dealers' | 'bookings' | 'reports' | 'revenue') => {
    setRunningExport(type);
    const { from, to } = dateFilterIso();
    const suffix = new Date().toISOString().slice(0, 10);

    try {
      if (type === 'buyers') {
        let q = supabase
          .from('profiles')
          .select('id, full_name, email, phone, status, district:districts(name), created_at')
          .eq('role', 'buyer')
          .order('created_at', { ascending: false });
        if (from) q = q.gte('created_at', from);
        if (to) q = q.lte('created_at', to);
        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []).map((b: Record<string, unknown>) => {
          const dist = b.district as { name?: string } | null;
          return [
            String(b.id ?? ''),
            String(b.full_name ?? ''),
            String(b.email ?? ''),
            String(b.phone ?? ''),
            String(b.status ?? 'ACTIVE'),
            String(dist?.name ?? ''),
            String(b.created_at ?? ''),
          ];
        });
        triggerCsvDownload(
          `autogroup-buyers-${suffix}.csv`,
          buildCsvContent(['ID', 'Full Name', 'Email', 'Phone', 'Status', 'District', 'Joined At'], rows)
        );
        await supabase.rpc('admin_log_export', { p_export_type: 'buyers', p_row_count: rows.length, p_filters: { from, to } });
        toast({ type: 'success', title: 'Buyers Exported', message: `Downloaded ${rows.length} rows.` });
      } else if (type === 'dealers') {
        let q = supabase
          .from('dealerships')
          .select('id, name, status, gst_number, contact_email, contact_phone, district:districts(name), created_at')
          .order('created_at', { ascending: false });
        if (from) q = q.gte('created_at', from);
        if (to) q = q.lte('created_at', to);
        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []).map((d: Record<string, unknown>) => {
          const dist = d.district as { name?: string } | null;
          return [
            String(d.id ?? ''),
            String(d.name ?? ''),
            String(d.status ?? ''),
            String(d.gst_number ?? ''),
            String(d.contact_email ?? ''),
            String(d.contact_phone ?? ''),
            String(dist?.name ?? ''),
            String(d.created_at ?? ''),
          ];
        });
        triggerCsvDownload(
          `autogroup-dealers-${suffix}.csv`,
          buildCsvContent(['ID', 'Dealership', 'Status', 'GSTIN', 'Email', 'Phone', 'Primary District', 'Created At'], rows)
        );
        await supabase.rpc('admin_log_export', { p_export_type: 'dealers', p_row_count: rows.length, p_filters: { from, to } });
        toast({ type: 'success', title: 'Dealers Exported', message: `Downloaded ${rows.length} rows.` });
      } else if (type === 'bookings') {
        let q = supabase
          .from('bookings')
          .select('booking_code, status, buyer_name, buyer_phone, booking_amount, platform_fee, total_amount, dealership:dealerships(name), created_at')
          .order('created_at', { ascending: false });
        if (from) q = q.gte('created_at', from);
        if (to) q = q.lte('created_at', to);
        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []).map((b: Record<string, unknown>) => {
          const dl = b.dealership as { name?: string } | null;
          return [
            String(b.booking_code ?? ''),
            String(b.status ?? ''),
            String(b.buyer_name ?? ''),
            String(b.buyer_phone ?? ''),
            String(dl?.name ?? ''),
            Number(b.booking_amount ?? 0),
            Number(b.platform_fee ?? 0),
            Number(b.total_amount ?? 0),
            String(b.created_at ?? ''),
          ];
        });
        triggerCsvDownload(
          `autogroup-bookings-${suffix}.csv`,
          buildCsvContent(['Booking Code', 'Status', 'Buyer', 'Phone', 'Dealership', 'Deposit', 'Platform Fee', 'Total', 'Created At'], rows)
        );
        await supabase.rpc('admin_log_export', { p_export_type: 'bookings', p_row_count: rows.length, p_filters: { from, to } });
        toast({ type: 'success', title: 'Bookings Exported', message: `Downloaded ${rows.length} rows.` });
      } else if (type === 'reports') {
        let q = supabase
          .from('reports')
          .select('id, reason, status, action_taken, dealership:dealerships(name), buyer:profiles(full_name), created_at')
          .order('created_at', { ascending: false });
        if (from) q = q.gte('created_at', from);
        if (to) q = q.lte('created_at', to);
        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []).map((r: Record<string, unknown>) => {
          const dl = r.dealership as { name?: string } | null;
          const by = r.buyer as { full_name?: string } | null;
          return [
            String(r.id ?? ''),
            String(r.reason ?? ''),
            String(r.status ?? 'OPEN'),
            String(r.action_taken ?? ''),
            String(dl?.name ?? ''),
            String(by?.full_name ?? ''),
            String(r.created_at ?? ''),
          ];
        });
        triggerCsvDownload(
          `autogroup-reports-${suffix}.csv`,
          buildCsvContent(['ID', 'Reason', 'Status', 'Action Taken', 'Dealership', 'Reporter', 'Created At'], rows)
        );
        await supabase.rpc('admin_log_export', { p_export_type: 'reports', p_row_count: rows.length, p_filters: { from, to } });
        toast({ type: 'success', title: 'Reports Exported', message: `Downloaded ${rows.length} rows.` });
      } else {
        // Platform-Fee Revenue Summary by month
        let bq = supabase.from('bookings').select('id, platform_fee, booking_amount, status, created_at');
        if (from) bq = bq.gte('created_at', from);
        if (to) bq = bq.lte('created_at', to);
        const [bRes, rRes] = await Promise.all([
          bq,
          supabase.from('refunds').select('booking_id, platform_fee_refunded, booking_amount_refunded, reason, created_at'),
        ]);
        if (bRes.error) throw bRes.error;
        if (rRes.error) throw rRes.error;

        const byMonth = new Map<string, { bookings: number; grossFees: number; refundedFees: number; depositVolume: number }>();
        for (const b of bRes.data || []) {
          if (b.status === 'PENDING') continue;
          const m = toLocalDateKey(String(b.created_at)).slice(0, 7);
          const cur = byMonth.get(m) || { bookings: 0, grossFees: 0, refundedFees: 0, depositVolume: 0 };
          cur.bookings += 1;
          cur.grossFees += Number(b.platform_fee) || 0;
          cur.depositVolume += Number(b.booking_amount) || 0;
          byMonth.set(m, cur);
        }
        for (const r of rRes.data || []) {
          if (from && String(r.created_at) < from) continue;
          if (to && String(r.created_at) > to) continue;
          const m = toLocalDateKey(String(r.created_at)).slice(0, 7);
          const cur = byMonth.get(m) || { bookings: 0, grossFees: 0, refundedFees: 0, depositVolume: 0 };
          cur.refundedFees += Number(r.platform_fee_refunded) || 0;
          byMonth.set(m, cur);
        }

        const rows = Array.from(byMonth.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, s]) => [
            month,
            s.bookings,
            s.depositVolume,
            s.grossFees,
            s.refundedFees,
            s.grossFees - s.refundedFees,
          ]);

        triggerCsvDownload(
          `autogroup-revenue-summary-${suffix}.csv`,
          buildCsvContent(
            ['Month', 'Bookings Count', 'Gross Deposits (INR)', 'Gross Platform Fees (INR)', 'Refunded Fees (INR)', 'Net Platform Fee Revenue (INR)'],
            rows
          )
        );
        await supabase.rpc('admin_log_export', { p_export_type: 'platform_revenue_summary', p_row_count: rows.length, p_filters: { from, to } });
        toast({ type: 'success', title: 'Revenue Summary Exported', message: `Downloaded ${rows.length} monthly summary row(s).` });
      }
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Export Failed',
        message: err instanceof Error ? err.message : 'Unable to generate CSV export.',
      });
    } finally {
      setRunningExport(null);
    }
  };

  const handleRunGroupExpiry = async () => {
    setIsExpiring(true);
    try {
      const { data, error } = await supabase.rpc('fn_expire_1_member_groups');
      if (error) throw error;
      const res = data as { expired_count?: number; expiry_days?: number } | null;
      toast({
        type: 'success',
        title: 'Group Expiry Job Executed',
        message: `Expired ${res?.expired_count ?? 0} unformed 1-member group(s) older than ${res?.expiry_days ?? 45} days.`,
      });
    } catch (err: unknown) {
      toast({
        type: 'error',
        title: 'Expiry Job Failed',
        message: err instanceof Error ? err.message : 'Unable to execute expiry job.',
      });
    } finally {
      setIsExpiring(false);
    }
  };

  const cards: { id: 'buyers' | 'dealers' | 'bookings' | 'reports' | 'revenue'; title: string; desc: string }[] = [
    { id: 'buyers', title: 'Buyers Directory CSV', desc: 'Registered buyers with district, contact info, and status.' },
    { id: 'dealers', title: 'Dealerships CSV', desc: 'Authorized, pending, and suspended dealer accounts and GSTINs.' },
    { id: 'bookings', title: 'Bookings & Deposits CSV', desc: 'All locked bookings with deposit, fee, and status breakdown.' },
    { id: 'reports', title: 'Reports & Compliance CSV', desc: 'Buyer dispute filings, status, and enforcement outcomes.' },
    { id: 'revenue', title: 'Platform-Fee Revenue Summary CSV', desc: 'Monthly gross fees, refunded fees, and net platform revenue.' },
  ];

  return (
    <AdminLayout
      title="Data Exports & Scheduled Jobs"
      breadcrumbs={[{ label: 'Exports' }]}
    >
      <div className="space-y-6 max-w-5xl">
        {/* Date Filter Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="w-full sm:w-52">
            <Input
              label="From Date (Optional)"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-52">
            <Input
              label="To Date (Optional)"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          {(fromDate || toDate) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFromDate('');
                setToDate('');
              }}
            >
              Clear Dates
            </Button>
          )}
          <div className="text-[11px] text-slate-500 sm:ml-auto">
            All CSV exports are sanitized against formula injection and recorded in <code className="bg-slate-100 px-1 rounded">audit_log</code>.
          </div>
        </div>

        {/* Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">{c.title}</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{c.desc}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                isLoading={runningExport === c.id}
                onClick={() => exportDataset(c.id)}
                leftIcon={<Download className="w-3.5 h-3.5" />}
                className="whitespace-nowrap"
              >
                Download CSV
              </Button>
            </div>
          ))}
        </div>

        {/* Scheduled Group Expiry Trigger */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-600" />
              1-Member Group Expiry Maintenance
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Runs daily via PostgreSQL cron when enabled, and can be executed manually to expire unformed 1-member groups past the configured threshold.
            </p>
          </div>
          <Button size="sm" variant="primary" isLoading={isExpiring} onClick={handleRunGroupExpiry} className="shrink-0">
            Run Group Expiry Now
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
