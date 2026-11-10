import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { DataTable, ColumnDef } from '@/components/admin/DataTable';
import { buildCsvContent, triggerCsvDownload } from '@/lib/adminHelpers';
import { Button, Badge, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/Toast';
import { Download } from 'lucide-react';

interface AuditLogRow {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  reason?: string | null;
  before_summary?: Record<string, unknown> | null;
  after_summary?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
}

interface ActorProfile {
  id: string;
  full_name: string;
  email?: string | null;
  role: string;
}

export function AdminAuditLogPage() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [actorMap, setActorMap] = useState<Map<string, ActorProfile>>(new Map());

  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadAuditLogs = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: logErr } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (logErr) throw logErr;
      const rows = (data || []) as AuditLogRow[];
      setLogs(rows);

      const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter((id): id is string => Boolean(id))));
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, role')
          .in('id', actorIds);
        const map = new Map<string, ActorProfile>();
        for (const p of (profiles || []) as ActorProfile[]) {
          map.set(p.id, p);
        }
        setActorMap(map);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  const entityOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.entity_type).filter(Boolean))).sort(),
    [logs]
  );

  const actionOptions = useMemo(
    () => Array.from(new Set(logs.map((l) => l.action).filter(Boolean))).sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00Z`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59Z`).getTime() : null;

    return logs.filter((l) => {
      if (entityFilter && l.entity_type !== entityFilter) return false;
      if (actionFilter && l.action !== actionFilter) return false;

      const ts = new Date(l.created_at).getTime();
      if (fromMs !== null && ts < fromMs) return false;
      if (toMs !== null && ts > toMs) return false;

      if (q) {
        const actor = l.actor_id ? actorMap.get(l.actor_id) : null;
        const hay = `${l.action} ${l.entity_type} ${l.entity_id} ${l.reason || ''} ${actor?.full_name || ''} ${actor?.email || ''} ${JSON.stringify(l.after_summary || l.payload || '')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, actorMap, entityFilter, actionFilter, fromDate, toDate, searchQuery]);

  const paginated = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page]
  );

  const handleExportCsv = async () => {
    const headers = ['Timestamp', 'Actor Name', 'Actor Role', 'Action', 'Entity Type', 'Entity ID', 'Reason', 'Before', 'After'];
    const rows = filtered.map((l) => {
      const actor = l.actor_id ? actorMap.get(l.actor_id) : null;
      return [
        l.created_at,
        actor?.full_name || l.actor_id || 'System',
        actor?.role || 'system',
        l.action,
        l.entity_type,
        l.entity_id,
        l.reason || '',
        l.before_summary ? JSON.stringify(l.before_summary) : '',
        l.after_summary ? JSON.stringify(l.after_summary) : l.payload ? JSON.stringify(l.payload) : '',
      ];
    });
    const csv = buildCsvContent(headers, rows);
    triggerCsvDownload(`autogroup-audit-log-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    await supabase.rpc('admin_log_export', {
      p_export_type: 'audit_log',
      p_row_count: filtered.length,
      p_filters: { entityFilter, actionFilter, fromDate, toDate },
    });
    toast({ type: 'success', title: 'Audit Log Exported', message: `Downloaded ${filtered.length} rows.` });
  };

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      key: 'created_at',
      header: 'Timestamp',
      render: (row) => (
        <span className="text-[11px] font-mono text-slate-600 tabular-nums whitespace-nowrap">
          {new Date(row.created_at).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'Admin / Actor',
      render: (row) => {
        const actor = row.actor_id ? actorMap.get(row.actor_id) : null;
        return (
          <div className="text-xs">
            <div className="font-semibold text-slate-900">{actor?.full_name || (row.actor_id ? 'Admin' : 'System / Cron')}</div>
            {actor?.email && <div className="text-[11px] text-slate-500">{actor.email}</div>}
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      render: (row) => <Badge variant="brand" size="sm">{row.action}</Badge>,
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{row.entity_type}</span>
          <div className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">{row.entity_id}</div>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Reason & Before/After Summary',
      render: (row) => (
        <div className="text-[11px] text-slate-700 space-y-1 max-w-md">
          {row.reason && <div className="font-medium text-slate-900">{row.reason}</div>}
          {row.before_summary && (
            <div className="font-mono text-[10px] text-slate-500 truncate">
              Before: {JSON.stringify(row.before_summary)}
            </div>
          )}
          {(row.after_summary || row.payload) && (
            <div className="font-mono text-[10px] text-slate-600 truncate">
              After: {JSON.stringify(row.after_summary || row.payload)}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Immutable Audit Logs"
      breadcrumbs={[{ label: 'Audit Logs' }]}
      searchValue={searchQuery}
      onSearchChange={(v) => {
        setSearchQuery(v);
        setPage(1);
      }}
      searchPlaceholder="Search actor, entity id, reason..."
      headerActions={
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportCsv}
          leftIcon={<Download className="w-3.5 h-3.5" />}
          className="whitespace-nowrap"
        >
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Entity Type"
            value={entityFilter}
            onChange={(e) => {
              setEntityFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Entities' },
              ...entityOptions.map((e) => ({ value: e, label: e })),
            ]}
          />

          <Select
            label="Action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All Actions' },
              ...actionOptions.map((a) => ({ value: a, label: a })),
            ]}
          />

          <Input
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />

          <Input
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <DataTable
          columns={columns}
          data={paginated}
          rowKey={(r) => r.id}
          isLoading={isLoading}
          error={error}
          onRetry={loadAuditLogs}
          page={page}
          pageSize={pageSize}
          totalCount={filtered.length}
          onPageChange={setPage}
          emptyTitle="No audit entries match filters"
          emptyDescription="Adjust filter criteria or date range to view historical audit events."
        />
      </div>
    </AdminLayout>
  );
}
