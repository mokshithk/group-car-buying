import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { buildCsvContent, triggerCsvDownload } from '@/lib/adminHelpers';
import { formatINR } from '@/lib/formatters';
import { Button, Badge, Tabs } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Download, AlertTriangle, ExternalLink } from 'lucide-react';

interface AdminBookingRow {
  id: string;
  booking_code: string;
  group_id: string | null;
  buyer_id: string;
  dealership_id: string;
  booking_amount: number;
  platform_fee: number;
  total_amount: number;
  status: string;
  buyer_name: string;
  buyer_phone: string;
  dealer_suspended?: boolean;
  created_at: string;
  dealership?: { id: string; name: string; status: string } | null;
  group?: {
    id: string;
    variant?: { name: string; model?: { name: string } | null } | null;
  } | null;
}

type BookingTab = 'ALL' | 'PAID' | 'DELIVERED' | 'CANCELLED' | 'DEALER_SUSPENDED';

export function AdminBookingsPage() {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [tab, setTab] = useState<BookingTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBookings = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('bookings')
        .select(
          '*, dealership:dealerships(id, name, status), group:groups(id, variant:variants(name, model:models(name)))'
        )
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setBookings((data || []) as AdminBookingRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = bookings.filter((b) => {
      if (tab === 'PAID' && b.status !== 'PAID') return false;
      if (tab === 'DELIVERED' && b.status !== 'DELIVERED') return false;
      if (tab === 'CANCELLED' && !b.status.startsWith('CANCELLED') && b.status !== 'REFUNDED') return false;
      if (tab === 'DEALER_SUSPENDED' && !b.dealer_suspended && b.dealership?.status !== 'SUSPENDED') return false;

      if (q) {
        const hay = `${b.booking_code} ${b.buyer_name} ${b.buyer_phone} ${b.dealership?.name || ''} ${b.group?.variant?.model?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const va =
        sortKey === 'total_amount' ? Number(a.total_amount) : new Date(a.created_at).getTime();
      const vb =
        sortKey === 'total_amount' ? Number(b.total_amount) : new Date(b.created_at).getTime();
      return sortDirection === 'asc' ? va - vb : vb - va;
    });

    return list;
  }, [bookings, tab, searchQuery, sortKey, sortDirection]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const handleExportCsv = async () => {
    const headers = [
      'Booking Code',
      'Status',
      'Buyer',
      'Dealership',
      'Dealer Suspended',
      'Vehicle',
      'Deposit (INR)',
      'Platform Fee (INR)',
      'Total Paid (INR)',
      'Created At',
    ];
    const rows = filtered.map((b) => [
      b.booking_code,
      b.status,
      b.buyer_name,
      b.dealership?.name || '',
      b.dealer_suspended || b.dealership?.status === 'SUSPENDED' ? 'YES' : 'NO',
      `${b.group?.variant?.model?.name || ''} ${b.group?.variant?.name || ''}`.trim(),
      b.booking_amount,
      b.platform_fee,
      b.total_amount,
      b.created_at,
    ]);
    const csv = buildCsvContent(headers, rows);
    triggerCsvDownload(`autogroup-bookings-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    await supabase.rpc('admin_log_export', {
      p_export_type: 'bookings_list',
      p_row_count: filtered.length,
      p_filters: { tab, searchQuery },
    });
    toast({ type: 'success', title: 'CSV Downloaded', message: `Exported ${filtered.length} bookings.` });
  };

  const renderStatusBadge = (status: string) => {
    if (status === 'DELIVERED') return <Badge variant="success" size="sm">Delivered</Badge>;
    if (status === 'PAID') return <Badge variant="brand" size="sm">Paid / Active</Badge>;
    if (status === 'CANCELLED_BY_DEALER') return <Badge variant="danger" size="sm">Cancelled (Dealer Fault)</Badge>;
    if (status === 'CANCELLED_BY_BUYER') return <Badge variant="warning" size="sm">Cancelled (Buyer)</Badge>;
    if (status === 'REFUNDED') return <Badge variant="default" size="sm">Refunded</Badge>;
    return <Badge variant="default" size="sm">{status}</Badge>;
  };

  const columns: ColumnDef<AdminBookingRow>[] = [
    {
      key: 'booking_code',
      header: 'Booking Code',
      render: (row) => (
        <div className="space-y-0.5">
          <Link
            to={`/admin/bookings/${row.id}`}
            className="font-mono font-bold text-slate-900 hover:text-brand-600"
          >
            {row.booking_code}
          </Link>
          <div className="text-[11px] text-slate-500">
            {new Date(row.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'buyer',
      header: 'Buyer',
      render: (row) => (
        <div className="space-y-0.5">
          <Link
            to={`/admin/buyers/${row.buyer_id}`}
            className="font-medium text-slate-800 hover:text-brand-600"
          >
            {row.buyer_name}
          </Link>
          <div className="text-[11px] text-slate-500 font-mono">{row.buyer_phone}</div>
        </div>
      ),
    },
    {
      key: 'dealership',
      header: 'Dealership & Vehicle',
      render: (row) => {
        const suspended = Boolean(row.dealer_suspended || row.dealership?.status === 'SUSPENDED');
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                to={`/admin/dealers/${row.dealership_id}`}
                className="font-medium text-slate-800 hover:text-brand-600"
              >
                {row.dealership?.name || 'Dealership'}
              </Link>
              {suspended && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                  <AlertTriangle className="w-3 h-3" /> Dealer Suspended
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              {row.group?.variant?.model?.name} {row.group?.variant?.name}
            </div>
          </div>
        );
      },
    },
    {
      key: 'total_amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      render: (row) => (
        <div className="text-right tabular-nums">
          <div className="font-semibold text-slate-900">{formatINR(Number(row.total_amount))}</div>
          <div className="text-[10px] text-slate-500">
            {formatINR(Number(row.booking_amount))} + {formatINR(Number(row.platform_fee))} fee
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => renderStatusBadge(row.status),
    },
    {
      key: 'actions',
      header: 'Manage',
      align: 'right',
      render: (row) => (
        <Link to={`/admin/bookings/${row.id}`}>
          <Button size="sm" variant="outline">
            Details <ExternalLink className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      ),
    },
  ];

  const suspendedCount = useMemo(
    () => bookings.filter((b) => b.dealer_suspended || b.dealership?.status === 'SUSPENDED').length,
    [bookings]
  );

  return (
    <AdminLayout
      title="Bookings & Refunds"
      breadcrumbs={[
        { label: 'Admin', to: '/admin/dashboard' },
        { label: 'Bookings' },
      ]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search booking code, buyer, dealer..."
      headerActions={
        <Button size="sm" variant="outline" onClick={handleExportCsv}>
          <Download className="w-3.5 h-3.5 mr-1" /> Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: 'ALL', label: `All (${bookings.length})` },
            { id: 'PAID', label: `Active / Paid (${bookings.filter((b) => b.status === 'PAID').length})` },
            { id: 'DELIVERED', label: 'Delivered' },
            { id: 'CANCELLED', label: 'Cancelled / Refunded' },
            { id: 'DEALER_SUSPENDED', label: `Dealer Suspended (${suspendedCount})` },
          ]}
          activeTab={tab}
          onChange={(id) => {
            setTab(id as BookingTab);
            setPage(1);
          }}
        />

        <DataTable
          columns={columns}
          data={paginated}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadBookings}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={(key) => {
            if (sortKey === key) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
            else {
              setSortKey(key);
              setSortDirection('desc');
            }
          }}
          page={page}
          pageSize={pageSize}
          totalCount={filtered.length}
          onPageChange={setPage}
          emptyTitle="No matching bookings"
          emptyDescription="No bookings match your current filters."
        />
      </div>
    </AdminLayout>
  );
}
