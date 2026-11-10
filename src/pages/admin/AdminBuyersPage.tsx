import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { ReAuthModal } from '@/components/admin/ReAuthModal';
import {
  buildCsvContent,
  triggerCsvDownload,
  sanitizePostgrestSearch,
} from '@/lib/adminHelpers';
import { Profile, District, AccountStatus } from '@/types';
import { formatDate } from '@/lib/formatters';
import { useToast } from '@/components/ui/Toast';
import { Button, Badge, Tabs } from '@/components/ui';
import { Download, ExternalLink, AlertTriangle, CheckCircle2, UserX } from 'lucide-react';

interface BuyerRow extends Profile {
  district_name?: string;
}

type BuyerTab = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'DELETION_REQUESTS';

export function AdminBuyersPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<BuyerTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [rows, setRows] = useState<BuyerRow[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [deletionCount, setDeletionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [targetBuyer, setTargetBuyer] = useState<BuyerRow | null>(null);
  const [actionType, setActionType] = useState<
    'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE' | 'PROCESS_DELETION' | 'REJECT_DELETION' | null
  >(null);

  const loadBuyers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [{ data: distData }, { count: pendingDelCount }] = await Promise.all([
        supabase.from('districts').select('*').order('name', { ascending: true }),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'buyer')
          .eq('deletion_status', 'PENDING'),
      ]);

      const dList = (distData || []) as District[];
      setDistricts(dList);
      setDeletionCount(pendingDelCount || 0);
      const distMap = new Map(dList.map((d) => [d.id, `${d.name} (${d.state})`]));

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'buyer');

      if (tab === 'DELETION_REQUESTS') {
        query = query.eq('deletion_status', 'PENDING');
      } else if (tab !== 'ALL') {
        query = query.eq('status', tab);
      }

      if (districtFilter) {
        query = query.eq('district_id', districtFilter);
      }

      const q = sanitizePostgrestSearch(searchQuery);
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      }

      const validSortCols = ['created_at', 'full_name', 'status'];
      const col = validSortCols.includes(sortKey) ? sortKey : 'created_at';
      query = query.order(col, { ascending: sortDir === 'asc' });

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setRows(
        ((data || []) as Profile[]).map((p) => ({
          ...p,
          district_name: p.district_id ? distMap.get(p.district_id) : undefined,
        }))
      );
      setTotalCount(count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load buyer records.');
    } finally {
      setIsLoading(false);
    }
  }, [tab, districtFilter, searchQuery, sortKey, sortDir, page]);

  useEffect(() => {
    loadBuyers();
  }, [loadBuyers]);

  const handleSortChange = (key: string) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);
  };

  const executeBuyerAction = async (reason: string) => {
    if (!targetBuyer || !actionType) return;
    const { error: rpcErr } = await supabase.rpc('admin_set_buyer_status', {
      p_buyer_id: targetBuyer.id,
      p_action: actionType,
      p_reason: reason || null,
    });
    if (rpcErr) throw new Error(rpcErr.message);

    toast({
      type: 'success',
      title: 'Buyer Account Updated',
      message: `Action ${actionType} applied to ${targetBuyer.full_name}.`,
    });
    await loadBuyers();
  };

  const handleExportCsv = async () => {
    let expQuery = supabase.from('profiles').select('*').eq('role', 'buyer');
    if (tab === 'DELETION_REQUESTS') {
      expQuery = expQuery.eq('deletion_status', 'PENDING');
    } else if (tab !== 'ALL') {
      expQuery = expQuery.eq('status', tab);
    }
    if (districtFilter) {
      expQuery = expQuery.eq('district_id', districtFilter);
    }
    const q = sanitizePostgrestSearch(searchQuery);
    if (q) {
      expQuery = expQuery.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data, error: expErr } = await expQuery.order('created_at', { ascending: false });

    if (expErr || !data) {
      toast({ type: 'error', title: 'Export Failed', message: expErr?.message });
      return;
    }

    const distMap = new Map(districts.map((d) => [d.id, `${d.name} (${d.state})`]));
    const csv = buildCsvContent(
      ['ID', 'Full Name', 'Email', 'Phone', 'District', 'Status', 'Deletion Status', 'Joined At'],
      data.map((p: any) => [
        p.id,
        p.full_name,
        p.email || '',
        p.phone || '',
        p.district_id ? distMap.get(p.district_id) || p.district_id : '',
        p.status || 'ACTIVE',
        p.deletion_status || 'NONE',
        p.created_at,
      ])
    );
    triggerCsvDownload(`autogroup_buyers_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    try {
      await supabase.rpc('admin_log_export', {
        p_export_type: 'BUYERS',
        p_row_count: data.length,
        p_filters: { tab, districtFilter, searchQuery },
      });
    } catch {
      // ignore non-critical
    }
    toast({ type: 'success', title: 'CSV Exported', message: `Exported ${data.length} buyer records.` });
  };

  const renderStatus = (status?: AccountStatus) => {
    const s = status || 'ACTIVE';
    if (s === 'ACTIVE') return <Badge variant="success" size="sm"><CheckCircle2 className="w-3 h-3" /> ACTIVE</Badge>;
    if (s === 'SUSPENDED') return <Badge variant="warning" size="sm"><AlertTriangle className="w-3 h-3" /> SUSPENDED</Badge>;
    return <Badge variant="danger" size="sm"><UserX className="w-3 h-3" /> DEACTIVATED</Badge>;
  };

  const columns: ColumnDef<BuyerRow>[] = [
    {
      key: 'full_name',
      header: 'Buyer',
      sortable: true,
      render: (b) => (
        <div className="min-w-[160px]">
          <Link to={`/admin/buyers/${b.id}`} className="font-bold text-slate-900 hover:text-brand-600 inline-flex items-center gap-1">
            {b.full_name} <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
          <div className="text-[11px] text-slate-500">{b.email || 'Email not synced'}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (b) => <span className="font-mono text-[11px]">{b.phone || '—'}</span>,
    },
    {
      key: 'district_name',
      header: 'District',
      render: (b) => <span>{b.district_name || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (b) => (
        <div className="flex flex-wrap items-center gap-1">
          {renderStatus(b.status)}
          {b.deletion_status === 'PENDING' && (
            <Badge variant="danger" size="sm">Deletion Requested</Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Registered',
      sortable: true,
      render: (b) => <span className="tabular-nums text-slate-500 whitespace-nowrap">{formatDate(b.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (b) => (
        <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
          <Link to={`/admin/buyers/${b.id}`}>
            <Button variant="ghost" size="sm">Details</Button>
          </Link>
          {b.deletion_status === 'PENDING' && (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  setTargetBuyer(b);
                  setActionType('PROCESS_DELETION');
                }}
              >
                Process Deletion
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTargetBuyer(b);
                  setActionType('REJECT_DELETION');
                }}
              >
                Reject Deletion
              </Button>
            </>
          )}
          {(b.status || 'ACTIVE') === 'ACTIVE' && (
            <Button
              variant="secondary"
              size="sm"
              className="text-amber-800 border-amber-300 hover:bg-amber-50"
              onClick={() => {
                setTargetBuyer(b);
                setActionType('SUSPEND');
              }}
            >
              Suspend
            </Button>
          )}
          {b.status === 'SUSPENDED' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTargetBuyer(b);
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
      title="Buyer Management & Privacy Requests"
      breadcrumbs={[{ label: 'Buyers' }]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search buyer name, email, phone..."
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          activeTab={tab}
          onChange={(t) => {
            setTab(t as BuyerTab);
            setPage(1);
          }}
          tabs={[
            { id: 'ALL', label: 'All Buyers' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'SUSPENDED', label: 'Suspended' },
            { id: 'DEACTIVATED', label: 'Deactivated' },
            { id: 'DELETION_REQUESTS', label: 'Deletion Requests', badge: deletionCount },
          ]}
        />

        <div className="w-full sm:w-64">
          <select
            aria-label="Filter buyers by district"
            value={districtFilter}
            onChange={(e) => {
              setDistrictFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.state})
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        isLoading={isLoading}
        error={error}
        onRetry={loadBuyers}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSortChange={handleSortChange}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPage}
        emptyTitle="No buyer accounts found"
        emptyDescription="No buyer accounts matched your current filters."
      />

      <ReAuthModal
        isOpen={Boolean(targetBuyer && actionType)}
        onClose={() => {
          setTargetBuyer(null);
          setActionType(null);
        }}
        title={
          actionType === 'PROCESS_DELETION'
            ? 'Process Account Deletion Request'
            : actionType === 'REJECT_DELETION'
            ? 'Reject Deletion Request'
            : actionType === 'SUSPEND'
            ? 'Suspend Buyer Account'
            : actionType === 'REACTIVATE'
            ? 'Reactivate Buyer Account'
            : 'Update Buyer Status'
        }
        description={
          actionType === 'PROCESS_DELETION' ? (
            <p>
              Processing deletion for <strong>{targetBuyer?.full_name}</strong> ({targetBuyer?.email}) will scrub personal contact info, deactivate login, and mark active group memberships as LEFT while retaining accounting ledger integrity.
            </p>
          ) : actionType === 'REJECT_DELETION' ? (
            <p>
              Rejecting the deletion request for <strong>{targetBuyer?.full_name}</strong> keeps their buyer account active and logs your compliance reason.
            </p>
          ) : (
            <p>
              Apply <strong>{actionType}</strong> to buyer <strong>{targetBuyer?.full_name}</strong>?
            </p>
          )
        }
        confirmLabel="Confirm Action"
        confirmVariant={actionType === 'REACTIVATE' || actionType === 'REJECT_DELETION' ? 'success' : 'danger'}
        requireReason={actionType === 'SUSPEND' || actionType === 'DEACTIVATE' || actionType === 'REJECT_DELETION'}
        requirePassword={true}
        onConfirm={executeBuyerAction}
      />
    </AdminLayout>
  );
}
