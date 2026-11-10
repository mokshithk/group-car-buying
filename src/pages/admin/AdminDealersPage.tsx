import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import { buildCsvContent, triggerCsvDownload, extractErrorMessage } from '@/lib/adminHelpers';
import { Dealership, DealershipStatus, District } from '@/types';
import { formatDate } from '@/lib/formatters';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Tabs } from '@/components/ui';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Download,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';

interface ExtendedDealership extends Dealership {
  district_name?: string;
  district_state?: string;
}

type StatusTab = 'ALL' | DealershipStatus;

export function AdminDealersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const initialStatus = (searchParams.get('status')?.toUpperCase() as StatusTab) || 'ALL';
  const [statusFilter, setStatusFilter] = useState<StatusTab>(
    ['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].includes(initialStatus) ? initialStatus : 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [rows, setRows] = useState<ExtendedDealership[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState<Record<StatusTab, number>>({
    ALL: 0,
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
    SUSPENDED: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [selectedDealer, setSelectedDealer] = useState<ExtendedDealership | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'SUSPEND' | 'REACTIVATE' | null>(null);

  const loadDealers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [{ data: distData }, { data: allStatuses }] = await Promise.all([
        supabase.from('districts').select('id, name, state'),
        supabase.from('dealerships').select('status'),
      ]);

      const distMap = new Map<string, Pick<District, 'id' | 'name' | 'state'>>();
      (distData || []).forEach((d: any) => distMap.set(d.id, d));

      const nextCounts: Record<StatusTab, number> = {
        ALL: (allStatuses || []).length,
        PENDING: 0,
        VERIFIED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
      };
      (allStatuses || []).forEach((r: any) => {
        if (r.status in nextCounts) {
          nextCounts[r.status as DealershipStatus] += 1;
        }
      });
      setCounts(nextCounts);

      let query = supabase.from('dealerships').select('*', { count: 'exact' });
      if (statusFilter !== 'ALL') {
        query = query.eq('status', statusFilter);
      }

      const cleanQ = searchQuery.trim();
      if (cleanQ) {
        query = query.or(
          `name.ilike.%${cleanQ}%,gst_number.ilike.%${cleanQ}%,contact_email.ilike.%${cleanQ}%,contact_phone.ilike.%${cleanQ}%`
        );
      }

      const validSortCols = ['created_at', 'name', 'status', 'verified_at'];
      const targetSort = validSortCols.includes(sortKey) ? sortKey : 'created_at';
      query = query.order(targetSort, { ascending: sortDir === 'asc' });

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const mapped: ExtendedDealership[] = (data || []).map((d: any) => {
        const dist = d.district_id ? distMap.get(d.district_id) : undefined;
        return {
          ...d,
          district_name: dist?.name,
          district_state: dist?.state,
        };
      });

      setRows(mapped);
      setTotalCount(count || 0);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Failed to load dealerships.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, sortKey, sortDir, page]);

  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  const handleTabChange = (tabId: string) => {
    const nextStatus = tabId as StatusTab;
    setStatusFilter(nextStatus);
    setPage(1);
    if (nextStatus === 'ALL') {
      searchParams.delete('status');
    } else {
      searchParams.set('status', nextStatus);
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSortChange = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const executeStatusMutation = async (reason: string) => {
    if (!selectedDealer || !actionType) return;
    const { error: rpcErr } = await supabase.rpc('admin_set_dealership_status', {
      p_dealership_id: selectedDealer.id,
      p_action: actionType,
      p_reason: reason || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: `Dealership ${actionType.toLowerCase()}ed`,
      message: `${selectedDealer.name} has been updated cleanly.`,
    });
    await loadDealers();
  };

  const handleExportCsv = async () => {
    const { data, error: expErr } = await supabase
      .from('dealerships')
      .select('*')
      .order('created_at', { ascending: false });
    if (expErr || !data) {
      toast({ type: 'error', title: 'Export Failed', message: expErr?.message });
      return;
    }

    const csv = buildCsvContent(
      ['ID', 'Name', 'Status', 'GSTIN', 'Email', 'Phone', 'Brands', 'Created At'],
      data.map((d: any) => [
        d.id,
        d.name,
        d.status,
        d.gst_number,
        d.contact_email,
        d.contact_phone,
        (d.brands || []).join('; '),
        d.created_at,
      ])
    );
    triggerCsvDownload(`autogroup_dealers_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    try {
      await supabase.rpc('admin_log_export', {
        p_export_type: 'DEALERS',
        p_row_count: data.length,
        p_filters: { statusFilter, searchQuery },
      });
    } catch {
      // ignore non-critical log failure
    }
    toast({ type: 'success', title: 'CSV Exported', message: `Exported ${data.length} dealership records.` });
  };

  const renderStatusBadge = (status: DealershipStatus) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <Badge variant="success" size="sm">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="warning" size="sm">
            <AlertTriangle className="w-3 h-3" /> PENDING
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="danger" size="sm">
            <XCircle className="w-3 h-3" /> REJECTED
          </Badge>
        );
      case 'SUSPENDED':
        return (
          <Badge variant="outline" size="sm" className="bg-slate-100 text-slate-800 border-slate-300">
            <AlertCircle className="w-3 h-3" /> SUSPENDED
          </Badge>
        );
    }
  };

  const columns: ColumnDef<ExtendedDealership>[] = [
    {
      key: 'name',
      header: 'Showroom',
      sortable: true,
      render: (d) => (
        <div className="min-w-[180px]">
          <Link to={`/admin/dealers/${d.id}`} className="font-bold text-slate-900 hover:text-brand-600 inline-flex items-center gap-1">
            {d.name} <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
          <div className="text-[11px] text-slate-500">{d.contact_email}</div>
        </div>
      ),
    },
    {
      key: 'gst_number',
      header: 'GSTIN',
      render: (d) => <span className="font-mono text-[11px] text-slate-800">{d.gst_number}</span>,
    },
    {
      key: 'district_name',
      header: 'District',
      render: (d) => (
        <span className="text-slate-700 block max-w-[140px]">
          {d.district_name ? `${d.district_name} (${d.district_state})` : '—'}
        </span>
      ),
    },
    {
      key: 'brands',
      header: 'Authorized Brands',
      render: (d) => (
        <div className="flex flex-wrap gap-1 max-w-[140px]">
          {(d.brands || []).map((b) => (
            <span key={b} className="text-[10px] px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
              {b}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (d) => renderStatusBadge(d.status),
    },
    {
      key: 'created_at',
      header: 'Applied',
      sortable: true,
      render: (d) => <span className="whitespace-nowrap tabular-nums text-slate-500">{formatDate(d.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (d) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <Link to={`/admin/dealers/${d.id}`}>
            <Button variant="ghost" size="sm">Details</Button>
          </Link>
          {d.status === 'PENDING' && (
            <>
              <Button
                variant="success"
                size="sm"
                onClick={() => {
                  setSelectedDealer(d);
                  setActionType('APPROVE');
                }}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setSelectedDealer(d);
                  setActionType('REJECT');
                }}
              >
                Reject
              </Button>
            </>
          )}
          {d.status === 'VERIFIED' && (
            <Button
              variant="secondary"
              size="sm"
              className="text-rose-700 border-rose-200 hover:bg-rose-50"
              onClick={() => {
                setSelectedDealer(d);
                setActionType('SUSPEND');
              }}
            >
              Suspend
            </Button>
          )}
          {(d.status === 'SUSPENDED' || d.status === 'REJECTED') && (
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<RotateCcw className="w-3 h-3" />}
              onClick={() => {
                setSelectedDealer(d);
                setActionType('REACTIVATE');
              }}
            >
              Reactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Dealership Verification & Oversight"
      breadcrumbs={[{ label: 'Dealers' }]}
      searchValue={searchQuery}
      onSearchChange={(val) => {
        setSearchQuery(val);
        setPage(1);
      }}
      searchPlaceholder="Search name, GSTIN, email..."
      headerActions={
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExportCsv}
          leftIcon={<Download className="w-3.5 h-3.5" />}
        >
          Export CSV
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          activeTab={statusFilter}
          onChange={handleTabChange}
          tabs={[
            { id: 'PENDING', label: 'Pending', badge: counts.PENDING },
            { id: 'VERIFIED', label: 'Verified', badge: counts.VERIFIED },
            { id: 'REJECTED', label: 'Rejected', badge: counts.REJECTED },
            { id: 'SUSPENDED', label: 'Suspended', badge: counts.SUSPENDED },
            { id: 'ALL', label: 'All', badge: counts.ALL },
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        onRetry={loadDealers}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyTitle="No dealerships match this view"
        emptyDescription="Switch status tabs or clear your search filter."
      />

      <ReAuthModal
        isOpen={Boolean(selectedDealer && actionType)}
        onClose={() => {
          setSelectedDealer(null);
          setActionType(null);
        }}
        title={
          actionType === 'APPROVE'
            ? 'Approve Showroom'
            : actionType === 'REJECT'
            ? 'Reject Dealership Application'
            : actionType === 'SUSPEND'
            ? 'Suspend Dealership Account'
            : 'Reactivate Dealership'
        }
        description={
          actionType === 'SUSPEND' ? (
            <div className="space-y-2">
              <p>
                Suspending <strong>{selectedDealer?.name}</strong> will immediately deactivate all live quotations (hiding them from buyers), block new buyer interests/bookings, flag existing PAID bookings as <strong>dealer suspended</strong>, and notify both showroom and affected buyers.
              </p>
            </div>
          ) : actionType === 'REJECT' ? (
            <p>
              Rejecting <strong>{selectedDealer?.name}</strong> denies tender access and records your reason on the dealer status screen.
            </p>
          ) : actionType === 'APPROVE' ? (
            <p>
              Approving <strong>{selectedDealer?.name}</strong> sets status to <strong>VERIFIED</strong> and grants immediate access to eligible district buying groups.
            </p>
          ) : (
            <p>
              Reactivating <strong>{selectedDealer?.name}</strong> restores <strong>VERIFIED</strong> status and re-enables non-expired quotations.
            </p>
          )
        }
        confirmLabel={
          actionType === 'APPROVE'
            ? 'Confirm Approval'
            : actionType === 'REJECT'
            ? 'Confirm Rejection'
            : actionType === 'SUSPEND'
            ? 'Suspend Dealership'
            : 'Confirm Reactivation'
        }
        confirmVariant={actionType === 'APPROVE' || actionType === 'REACTIVATE' ? 'success' : 'danger'}
        requireReason={actionType === 'REJECT' || actionType === 'SUSPEND'}
        reasonPlaceholder="Specify exact GST, OEM authorization, or compliance violation reason..."
        requirePassword={actionType === 'SUSPEND' || actionType === 'REACTIVATE'}
        onConfirm={executeStatusMutation}
      />
    </AdminLayout>
  );
}
