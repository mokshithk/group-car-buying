import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { detectQuoteOutliers } from '@/lib/adminHelpers';
import { formatINR } from '@/lib/formatters';
import { Button, Badge, Tabs, Modal, Select } from '@/components/ui';
import { AlertTriangle, History } from 'lucide-react';

interface AdminQuoteRow {
  id: string;
  group_id: string;
  dealership_id: string;
  ex_showroom_price: number;
  insurance: number;
  registration_charges: number;
  discounts: number;
  accessories_extras: number;
  on_road_price: number;
  validity_date: string;
  is_complete: boolean;
  is_active: boolean;
  deactivated_reason?: string | null;
  created_at: string;
  dealership?: { id: string; name: string; status: string } | null;
  group?: {
    id: string;
    status: string;
    district?: { name: string } | null;
    variant?: { name: string; model?: { name: string } | null } | null;
  } | null;
}

interface QuoteVersionRow {
  id: string;
  version_number: number;
  on_road_price: number;
  price_breakdown: Record<string, number>;
  changed_at: string;
}

export function AdminQuotationsPage() {
  const [quotes, setQuotes] = useState<AdminQuoteRow[]>([]);
  const [thresholdPercent, setThresholdPercent] = useState(15);
  const [tab, setTab] = useState<'ALL' | 'OUTLIERS' | 'INACTIVE'>('ALL');
  const [completeFilter, setCompleteFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // History modal
  const [historyQuote, setHistoryQuote] = useState<AdminQuoteRow | null>(null);
  const [versions, setVersions] = useState<QuoteVersionRow[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const loadQuotations = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [qRes, sRes] = await Promise.all([
        supabase
          .from('quotations')
          .select(
            '*, dealership:dealerships(id, name, status), group:groups(id, status, district:districts(name), variant:variants(name, model:models(name)))'
          )
          .order('created_at', { ascending: false }),
        supabase
          .from('settings')
          .select('value')
          .eq('key', 'quote_outlier_threshold_percent')
          .maybeSingle(),
      ]);

      if (qRes.error) throw qRes.error;
      setQuotes((qRes.data || []) as AdminQuoteRow[]);

      if (sRes.data?.value) {
        const parsed = Number(sRes.data.value);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setThresholdPercent(parsed);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load quotations.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [loadQuotations]);

  const outlierMap = useMemo(
    () => detectQuoteOutliers(quotes, thresholdPercent),
    [quotes, thresholdPercent]
  );

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = quotes.filter((row) => {
      if (tab === 'OUTLIERS' && !outlierMap.get(row.id)?.isOutlier) return false;
      if (tab === 'INACTIVE' && row.is_active !== false) return false;
      if (completeFilter === 'COMPLETE' && !row.is_complete) return false;
      if (completeFilter === 'INCOMPLETE' && row.is_complete) return false;

      if (q) {
        const hay = `${row.dealership?.name || ''} ${row.group_id} ${row.group?.variant?.model?.name || ''} ${row.group?.variant?.name || ''} ${row.group?.district?.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      const va =
        sortKey === 'on_road_price'
          ? Number(a.on_road_price) || 0
          : new Date(a.created_at).getTime();
      const vb =
        sortKey === 'on_road_price'
          ? Number(b.on_road_price) || 0
          : new Date(b.created_at).getTime();
      return sortDirection === 'asc' ? va - vb : vb - va;
    });

    return list;
  }, [quotes, outlierMap, tab, completeFilter, searchQuery, sortKey, sortDirection]);

  const paginatedQuotes = useMemo(
    () => filteredQuotes.slice((page - 1) * pageSize, page * pageSize),
    [filteredQuotes, page]
  );

  const openHistoryModal = async (quote: AdminQuoteRow) => {
    setHistoryQuote(quote);
    setVersions([]);
    setLoadingVersions(true);
    try {
      const { data, error: vErr } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('quotation_id', quote.id)
        .order('version_number', { ascending: false });
      if (vErr) throw vErr;
      setVersions((data || []) as QuoteVersionRow[]);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const outlierCount = useMemo(
    () => quotes.filter((q) => outlierMap.get(q.id)?.isOutlier).length,
    [quotes, outlierMap]
  );

  const columns: ColumnDef<AdminQuoteRow>[] = [
    {
      key: 'dealership',
      header: 'Dealership & Group',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={`/admin/dealers/${row.dealership_id}`}
              className="font-semibold text-slate-900 hover:text-brand-600"
            >
              {row.dealership?.name || 'Dealership'}
            </Link>
            {row.dealership?.status === 'SUSPENDED' && (
              <Badge variant="danger" size="sm">Dealer Suspended</Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-500">
            Group:{' '}
            <Link to={`/admin/groups/${row.group_id}`} className="text-brand-600 hover:underline font-mono">
              #{row.group_id.slice(0, 8)}
            </Link>{' '}
            ({row.group?.district?.name || '—'})
          </div>
        </div>
      ),
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (row) => (
        <div className="text-xs text-slate-700">
          {row.group?.variant?.model?.name} {row.group?.variant?.name}
        </div>
      ),
    },
    {
      key: 'on_road_price',
      header: 'On-Road Price',
      sortable: true,
      align: 'right',
      render: (row) => {
        const outlier = outlierMap.get(row.id);
        return (
          <div className="text-right space-y-0.5">
            <div className="font-bold text-slate-900 tabular-nums">
              {formatINR(Number(row.on_road_price))}
            </div>
            {outlier?.isOutlier && (
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                <AlertTriangle className="w-3 h-3 text-amber-700" />
                Outlier ({outlier.deviationPercent > 0 ? `+${outlier.deviationPercent}%` : `${outlier.deviationPercent}%`} vs median)
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'breakdown',
      header: 'Status & Integrity',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1">
            <Badge variant={row.is_complete ? 'success' : 'warning'} size="sm">
              {row.is_complete ? 'Complete' : 'Incomplete'}
            </Badge>
            <Badge variant={row.is_active !== false ? 'brand' : 'default'} size="sm">
              {row.is_active !== false ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <div className="text-[11px] text-slate-500 tabular-nums">
            Valid until {new Date(row.validity_date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'History',
      align: 'right',
      render: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openHistoryModal(row)}
        >
          <History className="w-3.5 h-3.5 mr-1" /> Price History
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Quotations Oversight"
      breadcrumbs={[
        { label: 'Admin', to: '/admin/dashboard' },
        { label: 'Quotations' },
      ]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search dealership, model, group..."
    >
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Tabs
            tabs={[
              { id: 'ALL', label: `All Quotations (${quotes.length})` },
              { id: 'OUTLIERS', label: `Outliers >=${thresholdPercent}% (${outlierCount})` },
              { id: 'INACTIVE', label: 'Inactive' },
            ]}
            activeTab={tab}
            onChange={(id) => {
              setTab(id as 'ALL' | 'OUTLIERS' | 'INACTIVE');
              setPage(1);
            }}
          />

          <div className="w-48">
            <Select
              value={completeFilter}
              onChange={(e) => {
                setCompleteFilter(e.target.value as 'ALL' | 'COMPLETE' | 'INCOMPLETE');
                setPage(1);
              }}
              options={[
                { value: 'ALL', label: 'All Completeness' },
                { value: 'COMPLETE', label: 'Complete Quotes Only' },
                { value: 'INCOMPLETE', label: 'Incomplete Only' },
              ]}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={paginatedQuotes}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadQuotations}
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
          totalCount={filteredQuotes.length}
          onPageChange={setPage}
          emptyTitle="No matching quotations"
          emptyDescription="No dealer quotations match your current filters."
        />
      </div>

      {/* Quotation Version History Modal */}
      <Modal
        isOpen={Boolean(historyQuote)}
        onClose={() => setHistoryQuote(null)}
        title="Quotation Price Change History"
        maxWidth="xl"
      >
        {historyQuote && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="font-semibold text-slate-900">
                {historyQuote.dealership?.name} — {historyQuote.group?.variant?.model?.name} {historyQuote.group?.variant?.name}
              </div>
              <div className="text-slate-600 tabular-nums">
                Current On-Road: <strong>{formatINR(Number(historyQuote.on_road_price))}</strong>{' '}
                (Ex-Showroom {formatINR(Number(historyQuote.ex_showroom_price))}, Insurance {formatINR(Number(historyQuote.insurance))}, RTO {formatINR(Number(historyQuote.registration_charges))}, Discount -{formatINR(Number(historyQuote.discounts))}, Accessories {formatINR(Number(historyQuote.accessories_extras))})
              </div>
            </div>

            {loadingVersions ? (
              <div className="py-6 text-center text-xs text-slate-500">Loading revision log...</div>
            ) : versions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
                No prior price revisions recorded for this quotation yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Ver</th>
                      <th className="py-2 px-3">Changed At</th>
                      <th className="py-2 px-3 text-right">Ex-Showroom</th>
                      <th className="py-2 px-3 text-right">Insurance</th>
                      <th className="py-2 px-3 text-right">RTO</th>
                      <th className="py-2 px-3 text-right">Discount</th>
                      <th className="py-2 px-3 text-right">On-Road Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 tabular-nums">
                    {versions.map((v) => {
                      const pb = v.price_breakdown || {};
                      return (
                        <tr key={v.id}>
                          <td className="py-2 px-3 font-semibold">v{v.version_number}</td>
                          <td className="py-2 px-3 text-slate-500">
                            {new Date(v.changed_at).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatINR(Number(pb.ex_showroom_price ?? pb.ex_showroom ?? 0))}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatINR(Number(pb.insurance ?? 0))}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formatINR(Number(pb.registration_charges ?? pb.rto_tax ?? 0))}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700">
                            -{formatINR(Number(pb.discounts ?? pb.group_discount ?? 0))}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatINR(Number(v.on_road_price))}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
