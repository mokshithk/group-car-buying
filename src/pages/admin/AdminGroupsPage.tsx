import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { Group, District, GroupStatus } from '@/types';
import { formatDate } from '@/lib/formatters';
import { Badge, Button, Tabs } from '@/components/ui';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface AdminGroupRow extends Group {
  active_members_count: number;
  is_visible_dealers: boolean;
}

type GroupTab = 'ALL' | GroupStatus | 'SUSPICIOUS';

export function AdminGroupsPage() {
  const [tab, setTab] = useState<GroupTab>('ALL');
  const [districtFilter, setDistrictFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [{ data: distData }, { data: settingsData }] = await Promise.all([
        supabase.from('districts').select('*').order('name', { ascending: true }),
        supabase.from('settings').select('key, value'),
      ]);
      setDistricts((distData || []) as District[]);

      const settingsMap = new Map((settingsData || []).map((s: any) => [s.key, s.value]));
      const visThreshold = Number(settingsMap.get('visibility_member_threshold') || 3);
      const visDays = Number(settingsMap.get('group_visibility_days_for_2_members') || 20);

      let query = supabase
        .from('groups')
        .select(
          '*, variant:variants(*, model:models(*, manufacturer:manufacturers(*))), district:districts(*), group_members(id, status, joined_at)',
          { count: 'exact' }
        );

      if (tab === 'SUSPICIOUS') {
        query = query.eq('is_suspicious', true);
      } else if (tab !== 'ALL') {
        query = query.eq('status', tab);
      }

      if (districtFilter) {
        query = query.eq('district_id', districtFilter);
      }

      const validSort = ['created_at', 'status', 'target_members'];
      query = query.order(validSort.includes(sortKey) ? sortKey : 'created_at', { ascending: sortDir === 'asc' });

      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, count, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const mapped: AdminGroupRow[] = (data || []).map((g: any) => {
        const activeMembers = (g.group_members || []).filter((m: any) => m.status === 'ACTIVE');
        const activeCount = activeMembers.length;
        const daysOld = Math.floor((Date.now() - new Date(g.created_at).getTime()) / 86400000);
        const visible = activeCount >= visThreshold || (activeCount === 2 && daysOld >= visDays);
        return {
          ...g,
          active_members_count: activeCount,
          is_visible_dealers: visible,
        };
      });

      const q = searchQuery.trim().toLowerCase();
      const searchFiltered = q
        ? mapped.filter(
            (g) =>
              (g.variant?.name || '').toLowerCase().includes(q) ||
              (g.variant?.model?.name || '').toLowerCase().includes(q) ||
              (g.variant?.model?.manufacturer?.name || '').toLowerCase().includes(q) ||
              (g.district?.name || '').toLowerCase().includes(q)
          )
        : mapped;

      setGroups(searchFiltered);
      setTotalCount(q ? searchFiltered.length : count || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load groups.');
    } finally {
      setIsLoading(false);
    }
  }, [tab, districtFilter, searchQuery, sortKey, sortDir, page]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const columns: ColumnDef<AdminGroupRow>[] = [
    {
      key: 'variant',
      header: 'Vehicle & Variant',
      render: (g) => (
        <div>
          <Link to={`/admin/groups/${g.id}`} className="font-bold text-slate-900 hover:text-brand-600 inline-flex items-center gap-1">
            {g.variant?.model?.manufacturer?.name} {g.variant?.model?.name} <ExternalLink className="w-3 h-3 text-slate-400" />
          </Link>
          <div className="text-[11px] text-slate-500">{g.variant?.name}</div>
        </div>
      ),
    },
    {
      key: 'district',
      header: 'District',
      render: (g) => <span>{g.district?.name || '—'}</span>,
    },
    {
      key: 'members',
      header: 'Members / Target',
      align: 'right',
      render: (g) => (
        <span className="font-semibold tabular-nums">
          {g.active_members_count} / {g.target_members}
        </span>
      ),
    },
    {
      key: 'visibility',
      header: 'Dealer Visibility',
      render: (g) => (
        <Badge variant={g.is_visible_dealers ? 'success' : 'default'} size="sm">
          {g.is_visible_dealers ? 'Visible' : 'Hidden'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (g) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={
              g.status === 'OPEN_FOR_QUOTES' || g.status === 'OFFERS_RECEIVED'
                ? 'success'
                : g.status === 'CANCELLED' || g.status === 'EXPIRED'
                ? 'danger'
                : 'warning'
            }
            size="sm"
          >
            {g.status}
          </Badge>
          {g.is_suspicious && (
            <Badge variant="danger" size="sm">
              <AlertTriangle className="w-3 h-3" /> Suspicious
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (g) => <span className="tabular-nums text-slate-500 whitespace-nowrap">{formatDate(g.created_at)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (g) => (
        <Link to={`/admin/groups/${g.id}`}>
          <Button variant="secondary" size="sm">Inspect</Button>
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Buying Groups Oversight"
      breadcrumbs={[{ label: 'Groups' }]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search model, variant, district..."
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <Tabs
          activeTab={tab}
          onChange={(t) => {
            setTab(t as GroupTab);
            setPage(1);
          }}
          tabs={[
            { id: 'ALL', label: 'All' },
            { id: 'FORMING', label: 'Forming' },
            { id: 'OPEN_FOR_QUOTES', label: 'Open Quotes' },
            { id: 'OFFERS_RECEIVED', label: 'Offers' },
            { id: 'CANCELLED', label: 'Cancelled' },
            { id: 'EXPIRED', label: 'Expired' },
            { id: 'SUSPICIOUS', label: 'Suspicious' },
          ]}
        />

        <select
          aria-label="Filter groups by district"
          value={districtFilter}
          onChange={(e) => {
            setDistrictFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800"
        >
          <option value="">All Districts</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={groups}
        rowKey={(g) => g.id}
        isLoading={isLoading}
        error={error}
        onRetry={loadGroups}
        sortKey={sortKey}
        sortDirection={sortDir}
        onSortChange={(k) => {
          if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          else {
            setSortKey(k);
            setSortDir('asc');
          }
          setPage(1);
        }}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        onPageChange={setPage}
      />
    </AdminLayout>
  );
}
