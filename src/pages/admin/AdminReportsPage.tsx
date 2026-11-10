import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { Button, Badge, Tabs } from '@/components/ui';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface AdminReportRow {
  id: string;
  dealership_id: string;
  buyer_id: string;
  reason: string;
  details: string;
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';
  action_taken?: string | null;
  created_at: string;
  dealership?: { id: string; name: string; status: string } | null;
  buyer?: { id: string; full_name: string; email?: string | null } | null;
}

type ReportTab = 'ALL' | 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'REJECTED';

export function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [tab, setTab] = useState<ReportTab>('OPEN');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: rErr } = await supabase
        .from('reports')
        .select('*, dealership:dealerships(id, name, status), buyer:profiles(id, full_name, email)')
        .order('created_at', { ascending: false });

      if (rErr) throw rErr;
      setReports((data || []) as AdminReportRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Repeat-offender count per dealership across all reports
  const dealerReportCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reports) {
      map.set(r.dealership_id, (map.get(r.dealership_id) || 0) + 1);
    }
    return map;
  }, [reports]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (tab !== 'ALL' && (r.status || 'OPEN') !== tab) return false;
      if (q) {
        const hay = `${r.reason} ${r.details} ${r.dealership?.name || ''} ${r.buyer?.full_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, tab, searchQuery]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const statusBadge = (status: string) => {
    if (status === 'OPEN') return <Badge variant="danger" size="sm">Open</Badge>;
    if (status === 'INVESTIGATING') return <Badge variant="warning" size="sm">Investigating</Badge>;
    if (status === 'RESOLVED') return <Badge variant="success" size="sm">Resolved</Badge>;
    return <Badge variant="default" size="sm">Rejected</Badge>;
  };

  const columns: ColumnDef<AdminReportRow>[] = [
    {
      key: 'reason',
      header: 'Dispute & Summary',
      render: (row) => (
        <div className="space-y-0.5 max-w-sm">
          <div className="font-semibold text-slate-900">{row.reason}</div>
          <p className="text-[11px] text-slate-600 line-clamp-2">{row.details}</p>
        </div>
      ),
    },
    {
      key: 'dealership',
      header: 'Reported Dealership',
      render: (row) => {
        const count = dealerReportCounts.get(row.dealership_id) || 1;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/admin/dealers/${row.dealership_id}`}
                className="font-medium text-slate-800 hover:text-brand-600"
              >
                {row.dealership?.name || 'Dealership'}
              </Link>
              {count >= 2 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  <AlertTriangle className="w-3 h-3" /> Repeat ({count})
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">Status: {row.dealership?.status}</div>
          </div>
        );
      },
    },
    {
      key: 'buyer',
      header: 'Reporter',
      render: (row) => (
        <div className="text-xs">
          <Link
            to={`/admin/buyers/${row.buyer_id}`}
            className="font-medium text-slate-800 hover:text-brand-600"
          >
            {row.buyer?.full_name || 'Buyer'}
          </Link>
          <div className="text-[11px] text-slate-500">
            {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status & Action',
      render: (row) => (
        <div className="space-y-1">
          {statusBadge(row.status || 'OPEN')}
          {row.action_taken && (
            <div className="text-[10px] font-mono text-slate-500">{row.action_taken}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Review',
      align: 'right',
      render: (row) => (
        <Link to={`/admin/reports/${row.id}`}>
          <Button size="sm" variant="outline">
            Investigate <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Reports & Disputes"
      breadcrumbs={[{ label: 'Reports & Disputes' }]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search reason, dealer, buyer..."
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'OPEN', label: `Open (${reports.filter((r) => (r.status || 'OPEN') === 'OPEN').length})` },
            { id: 'INVESTIGATING', label: `Investigating (${reports.filter((r) => r.status === 'INVESTIGATING').length})` },
            { id: 'RESOLVED', label: 'Resolved' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'ALL', label: `All (${reports.length})` },
          ]}
          activeTab={tab}
          onChange={(id) => {
            setTab(id as ReportTab);
            setPage(1);
          }}
        />

        <DataTable
          columns={columns}
          data={paginated}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadReports}
          page={page}
          pageSize={pageSize}
          totalCount={filtered.length}
          onPageChange={setPage}
          emptyTitle="No reports in this queue"
          emptyDescription="No buyer reports or compliance disputes match the current filter."
        />
      </div>
    </AdminLayout>
  );
}
